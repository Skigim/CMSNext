import {
  CaseDisplay,
  CaseCategory,
  FinancialItem,
  NewPersonData,
  NewCaseRecordData,
  NewNoteData,
  AlertWorkflowStatus,
} from "../types/case";
import { v4 as uuidv4 } from 'uuid';
import AutosaveFileService from './AutosaveFileService';
import { transformImportedData } from './dataTransform';
import {
  reportFileStorageError,
  type FileStorageOperation,
} from "./fileStorageErrorReporter";
import {
  CategoryConfig,
  CategoryKey,
  mergeCategoryConfig,
  sanitizeCategoryValues,
} from "../types/categoryConfig";
import {
  AlertsIndex,
  AlertWithMatch,
  createAlertsIndexFromAlerts,
  createEmptyAlertsIndex,
  parseStackedAlerts,
} from "./alertsData";

interface DataManagerConfig {
  fileService: AutosaveFileService;
  persistNormalizationFixes?: boolean;
}

interface FileData {
  cases: CaseDisplay[];
  exported_at: string;
  total_cases: number;
  categoryConfig: CategoryConfig;
}

interface StoredAlertWorkflowState {
  alertId: string;
  status?: AlertWorkflowStatus;
  resolvedAt?: string | null;
  resolutionNotes?: string;
  updatedAt?: string | null;
  firstSeenAt?: string | null;
}

/**
 * Normalizes note metadata for a collection of cases while gracefully pruning invalid entries.
 *
 * Ensures each note has an identifier, category, content, and timestamps. Notes that are not
 * objects are discarded instead of being converted into placeholder items to avoid confusing
 * empty entries in the UI.
 *
 * @param cases - The case collection to normalize.
 * @returns A tuple containing the normalized cases array and whether any changes were applied.
 */
function normalizeCaseNotes(cases: CaseDisplay[]): { cases: CaseDisplay[]; changed: boolean } {
  let changed = false;

  const normalizedCases = cases.map(caseItem => {
    const notes = caseItem.caseRecord?.notes;
    if (!Array.isArray(notes) || notes.length === 0) {
      return caseItem;
    }

    let notesChanged = false;
    const filteredNotes = notes.filter(note => {
      const isValid = !!note && typeof note === "object";
      if (!isValid) {
        notesChanged = true;
        changed = true;
      }
      return isValid;
    });

    if (filteredNotes.length === 0) {
      return {
        ...caseItem,
        caseRecord: {
          ...caseItem.caseRecord,
          notes: [],
        },
      };
    }

    const normalizedNotes = filteredNotes.map(note => {
      let noteChanged = false;

      const hasValidId = typeof note.id === "string" && note.id.trim().length > 0;
      const normalizedId = hasValidId ? note.id : uuidv4();
      if (!hasValidId) {
        noteChanged = true;
      }

      const normalizedCategory = note.category || "General";
      const normalizedContent = typeof note.content === "string" ? note.content : "";
      const normalizedCreatedAt = note.createdAt || note.updatedAt || new Date().toISOString();
      const normalizedUpdatedAt = note.updatedAt || normalizedCreatedAt;

      if (
        noteChanged ||
        normalizedCategory !== note.category ||
        normalizedContent !== note.content ||
        normalizedCreatedAt !== note.createdAt ||
        normalizedUpdatedAt !== note.updatedAt
      ) {
        noteChanged = true;
      }

      if (!noteChanged) {
        return note;
      }

      notesChanged = true;
      changed = true;
      return {
        ...note,
        id: normalizedId,
        category: normalizedCategory,
        content: normalizedContent,
        createdAt: normalizedCreatedAt,
        updatedAt: normalizedUpdatedAt,
      };
    });

    if (!notesChanged) {
      return caseItem;
    }

    return {
      ...caseItem,
      caseRecord: {
        ...caseItem.caseRecord,
        notes: normalizedNotes,
      },
    };
  });

  return { cases: normalizedCases, changed };
}

/**
 * Stateless Data Manager
 * 
 * Core Principles:
 * - NO data storage/caching anywhere
 * - File system is the single source of truth
 * - All operations: read file → modify → write file
 * - Always returns fresh data from file system
 */
export class DataManager {
  private fileService: AutosaveFileService;
  private persistNormalizationFixes: boolean;
  private static readonly ERROR_SOURCE = "DataManager";
  private static readonly ALERTS_FILE_NAME = "alerts.csv";
  private static readonly ALERTS_JSON_NAME = "alerts.json";
  private static readonly ALERTS_STORAGE_VERSION = 2;

  constructor(config: DataManagerConfig) {
    this.fileService = config.fileService;
    this.persistNormalizationFixes = config.persistNormalizationFixes ?? true;
  }

  private normalizeMcn(value: string | null | undefined): string {
    if (!value) {
      return "";
    }

    return value.replace(/[^a-z0-9]/gi, "").trim().toUpperCase();
  }

  private buildCaseLookup(cases: CaseDisplay[]): Map<string, CaseDisplay> {
    const lookup = new Map<string, CaseDisplay>();

    cases.forEach(caseItem => {
      const mcn = caseItem.caseRecord?.mcn ?? caseItem.mcn;
      const normalized = this.normalizeMcn(mcn);
      if (!normalized || lookup.has(normalized)) {
        return;
      }

      lookup.set(normalized, caseItem);
    });

    return lookup;
  }

  private rematchAlertForCases(alert: AlertWithMatch, lookup: Map<string, CaseDisplay>): AlertWithMatch {
    if (!alert) {
      return alert;
    }

    const normalizedMcn = this.normalizeMcn(alert.mcNumber ?? null);
    const matchedCase = normalizedMcn ? lookup.get(normalizedMcn) : undefined;

    if (!matchedCase) {
      if (alert.matchStatus === "matched" || alert.matchedCaseId) {
        return {
          ...alert,
          matchStatus: normalizedMcn ? "unmatched" : "missing-mcn",
          matchedCaseId: undefined,
          matchedCaseName: undefined,
          matchedCaseStatus: undefined,
        };
      }
      return alert;
    }

    return {
      ...alert,
      matchStatus: "matched",
      matchedCaseId: matchedCase.id,
      matchedCaseName: matchedCase.name,
      matchedCaseStatus: matchedCase.status,
    };
  }

  private rematchAlertsForCases(alerts: AlertWithMatch[], cases: CaseDisplay[]): AlertWithMatch[] {
    if (!alerts || alerts.length === 0) {
      return alerts ?? [];
    }

    const lookup = this.buildCaseLookup(cases);
    return alerts.map(alert => this.rematchAlertForCases(alert, lookup));
  }

  private alertsAreEqual(a: AlertWithMatch, b: AlertWithMatch): boolean {
    return (
      a.id === b.id &&
      a.reportId === b.reportId &&
      a.status === b.status &&
      a.resolvedAt === b.resolvedAt &&
      a.resolutionNotes === b.resolutionNotes &&
      a.matchStatus === b.matchStatus &&
      a.matchedCaseId === b.matchedCaseId &&
      a.matchedCaseName === b.matchedCaseName &&
      a.matchedCaseStatus === b.matchedCaseStatus
    );
  }

  private alertKey(alert: AlertWithMatch): string {
    if (!alert) {
      return "";
    }

    const key = alert.reportId ?? alert.id;
    return key ?? alert.id;
  }

  private isDebugEnvironment(): boolean {
    try {
      if (typeof import.meta !== "undefined" && (import.meta as any).env) {
        const env = (import.meta as any).env;
        if (typeof env.MODE === "string") {
          return env.MODE !== "production";
        }
        if (typeof env.DEV === "boolean") {
          return env.DEV;
        }
      }
    } catch (error) {
      // Ignore import.meta access issues in non-module contexts
    }

    if (typeof process !== "undefined" && process.env?.NODE_ENV) {
      return process.env.NODE_ENV !== "production";
    }

    return false;
  }

  private debugLogAlertsSample(source: string, alerts: AlertWithMatch[] | undefined): void {
    if (!alerts || alerts.length === 0 || !this.isDebugEnvironment()) {
      return;
    }

    const preview = alerts.slice(0, Math.min(alerts.length, 3)).map(alert => ({
      id: alert.id,
      reportId: alert.reportId,
      alertCode: alert.alertCode,
      status: alert.status,
      program: alert.program,
      alertType: alert.alertType,
      description: alert.description,
      matchStatus: alert.matchStatus,
      mcNumber: alert.mcNumber,
      metadata: {
        rawProgram: alert.metadata?.rawProgram,
        rawType: alert.metadata?.rawType,
        rawDescription: alert.metadata?.rawDescription,
        alertNumber: alert.metadata?.alertNumber,
      },
    }));

    console.info(`[DataManager] Alert preview (${source})`, preview);
  }

  private countUniqueAlertKeys(alerts: AlertWithMatch[]): number {
    if (!alerts || alerts.length === 0) {
      return 0;
    }

    const keys = new Set<string>();
    alerts.forEach(alert => {
      const key = this.alertKey(alert);
      if (key) {
        keys.add(key);
      }
    });

    return keys.size;
  }

  private normalizeStoredAlertEntry(entry: unknown): {
    workflow: StoredAlertWorkflowState | null;
    legacy: boolean;
  } {
    if (!entry || typeof entry !== "object") {
      return { workflow: null, legacy: true };
    }

    const raw = entry as Record<string, unknown>;
    const candidateIds: Array<string | undefined> = [
      typeof raw.alertId === "string" ? raw.alertId.trim() : undefined,
      typeof raw.id === "string" ? raw.id.trim() : undefined,
      typeof raw.reportId === "string" ? raw.reportId.trim() : undefined,
      typeof raw.alertCode === "string" ? raw.alertCode.trim() : undefined,
    ];

    const alertId = candidateIds.find(id => id && id.length > 0) ?? null;
    if (!alertId) {
      return { workflow: null, legacy: true };
    }

    const status = typeof raw.status === "string" ? (raw.status as AlertWorkflowStatus) : undefined;
    const resolvedAtValue = raw.resolvedAt;
    const resolvedAt =
      resolvedAtValue === null
        ? null
        : typeof resolvedAtValue === "string"
          ? resolvedAtValue
          : undefined;
    const resolutionNotes =
      typeof raw.resolutionNotes === "string" && raw.resolutionNotes.trim().length > 0
        ? raw.resolutionNotes
        : undefined;
    const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : undefined;
    const firstSeenAtValue = raw.firstSeenAt;
    const firstSeenAt =
      firstSeenAtValue === null
        ? null
        : typeof firstSeenAtValue === "string"
          ? firstSeenAtValue
          : undefined;

    const legacy =
      typeof raw.alertId !== "string" ||
      "alertType" in raw ||
      "severity" in raw ||
      "program" in raw ||
      "region" in raw ||
      "state" in raw ||
      "source" in raw ||
      "metadata" in raw;

    const workflow: StoredAlertWorkflowState = {
      alertId,
      ...(status ? { status } : {}),
      ...(resolvedAt !== undefined ? { resolvedAt } : {}),
      ...(resolutionNotes ? { resolutionNotes } : {}),
      ...(updatedAt ? { updatedAt } : {}),
      ...(firstSeenAt !== undefined ? { firstSeenAt } : {}),
    };

    return { workflow, legacy };
  }

  private parseStoredAlertsPayload(payload: unknown): {
    workflows: StoredAlertWorkflowState[];
    needsMigration: boolean;
  } {
    if (!payload || typeof payload !== "object") {
      return { workflows: [], needsMigration: false };
    }

    const root = payload as Record<string, unknown>;
    const version = typeof root.version === "number" ? root.version : 1;
    const alertsInput = Array.isArray(root.alerts) ? root.alerts : [];

    const workflows: StoredAlertWorkflowState[] = [];
    let needsMigration = version < DataManager.ALERTS_STORAGE_VERSION;

    alertsInput.forEach(entry => {
      const { workflow, legacy } = this.normalizeStoredAlertEntry(entry);
      if (workflow) {
        workflows.push(workflow);
      }
      if (legacy) {
        needsMigration = true;
      }
    });

    return { workflows, needsMigration };
  }

  private applyStoredAlertWorkflows(
    alerts: AlertWithMatch[],
    storedWorkflows: StoredAlertWorkflowState[],
  ): {
    alerts: AlertWithMatch[];
    changed: boolean;
    unmatchedIds: string[];
  } {
    if (!alerts.length || !storedWorkflows.length) {
      return { alerts, changed: false, unmatchedIds: storedWorkflows.map(entry => entry.alertId) };
    }

    const storedMap = new Map<string, StoredAlertWorkflowState>();
    storedWorkflows.forEach(entry => {
      storedMap.set(entry.alertId, entry);
    });

    let changed = false;
    const updatedAlerts = alerts.map(alert => {
      const key = this.alertKey(alert);
      if (!key) {
        return alert;
      }

      const stored = storedMap.get(key);
      if (!stored) {
        return alert;
      }

      const nextAlert: AlertWithMatch = {
        ...alert,
        status: stored.status ?? alert.status ?? "new",
        resolvedAt:
          stored.resolvedAt !== undefined
            ? stored.resolvedAt
            : alert.resolvedAt ?? null,
        resolutionNotes:
          stored.resolutionNotes ?? alert.resolutionNotes,
        updatedAt: stored.updatedAt ?? alert.updatedAt,
      };

      if (
        !this.alertsAreEqual(alert, nextAlert) ||
        alert.updatedAt !== nextAlert.updatedAt
      ) {
        changed = true;
      }

      storedMap.delete(key);
      return nextAlert;
    });

    return { alerts: updatedAlerts, changed, unmatchedIds: [...storedMap.keys()] };
  }

  private serializeStoredAlert(
    alert: AlertWithMatch,
    options: { forceSnapshot?: boolean } = {},
  ): StoredAlertWorkflowState | null {
    const alertId = this.alertKey(alert);
    if (!alertId) {
      return null;
    }

    const entry: StoredAlertWorkflowState = { alertId };
    const forceSnapshot = options.forceSnapshot === true;

    if (alert.status && (alert.status !== "new" || forceSnapshot)) {
      entry.status = alert.status;
    } else if (forceSnapshot) {
      entry.status = alert.status ?? "new";
    }

    if (alert.resolvedAt) {
      entry.resolvedAt = alert.resolvedAt;
    }

    if (alert.resolutionNotes && alert.resolutionNotes.trim().length > 0) {
      entry.resolutionNotes = alert.resolutionNotes;
    }

    const snapshotUpdatedAt = alert.updatedAt || alert.createdAt || alert.alertDate || null;

    if (snapshotUpdatedAt && snapshotUpdatedAt.trim().length > 0) {
      if (forceSnapshot) {
        entry.updatedAt = snapshotUpdatedAt;
      } else if (alert.updatedAt && alert.updatedAt.trim().length > 0 && alert.updatedAt !== alert.createdAt) {
        entry.updatedAt = alert.updatedAt;
      }
    }

    const snapshotFirstSeen = alert.alertDate || alert.createdAt || null;
    if (forceSnapshot && snapshotFirstSeen && snapshotFirstSeen.trim().length > 0) {
      entry.firstSeenAt = snapshotFirstSeen;
    }

    if (!forceSnapshot && Object.keys(entry).length <= 1) {
      return null;
    }

    return entry;
  }

  private parseAlertsWithFallback(csvContent: string, cases: CaseDisplay[]): AlertsIndex {
    const stacked = parseStackedAlerts(csvContent, cases);
    const stackedUnique = this.countUniqueAlertKeys(stacked.alerts);

    if (this.isDebugEnvironment()) {
      const metrics = {
        stacked: {
          total: stacked.alerts.length,
          unique: stackedUnique,
          uniqueRatio:
            stacked.alerts.length > 0 && Number.isFinite(stackedUnique / stacked.alerts.length)
              ? Number((stackedUnique / stacked.alerts.length).toFixed(4))
              : 0,
        },
      };
      console.info("[DataManager] Alert parser metrics", JSON.stringify(metrics, null, 2));
    }

    this.debugLogAlertsSample(
      stacked.alerts.length > 0 ? "csv-stacked" : "csv-empty",
      stacked.alerts,
    );

    return stacked;
  }

  private reportStorageError(
    operation: FileStorageOperation,
    error: unknown,
    context?: Record<string, unknown>,
    fallbackMessage?: string,
  ) {
    reportFileStorageError({
      operation,
      error,
      source: DataManager.ERROR_SOURCE,
      context,
      fallbackMessage,
    });
  }

  // =============================================================================
  // CORE FILE OPERATIONS (Private)
  // =============================================================================

  /**
   * Read current data from file system
   * Returns null if no file exists or error occurs
   */
  private async readFileData(): Promise<FileData | null> {
    try {
      const rawData = await this.fileService.readFile();
      
      if (!rawData) {
        // No file exists yet - return empty structure
        return {
          cases: [],
          exported_at: new Date().toISOString(),
          total_cases: 0,
          categoryConfig: mergeCategoryConfig(),
        };
      }

      // Handle different data formats
      let cases: CaseDisplay[] = [];
      
      if (rawData.cases && Array.isArray(rawData.cases)) {
        // Already in the correct format
        cases = rawData.cases;
      } else if (rawData.people && rawData.caseRecords) {
        // Raw format - transform using the data transformer
        console.log('[DataManager] Transforming raw data format (people + caseRecords) to cases');
        cases = transformImportedData(rawData);
      } else {
        // Try to transform whatever format this is
        cases = transformImportedData(rawData);
      }

  const categoryConfig = mergeCategoryConfig(rawData.categoryConfig);

  const { cases: normalizedCases, changed } = normalizeCaseNotes(cases);

      let finalCases = normalizedCases;
      let finalExportedAt = rawData.exported_at || rawData.exportedAt || new Date().toISOString();

      if (changed) {
        if (this.persistNormalizationFixes) {
          const persistedData = await this.writeFileData({
            cases: normalizedCases,
            exported_at: finalExportedAt,
            total_cases: normalizedCases.length,
            categoryConfig,
          });

          finalCases = persistedData.cases;
          finalExportedAt = persistedData.exported_at;
        } else {
          console.warn(
            "[DataManager] Detected note normalization changes but skipping persistence due to configuration.",
          );
        }
      }

      return {
        cases: finalCases,
        exported_at: finalExportedAt,
        total_cases: finalCases.length,
        categoryConfig,
      };
    } catch (error) {
      console.error('Failed to read file data:', error);
      this.reportStorageError("readData", error, { method: "readFileData" });
      throw new Error(`Failed to read case data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Write data to file system with retry logic
   * Throws error if write fails after retries
   */
  private async writeFileData(data: FileData): Promise<FileData> {
    try {
      // Ensure data integrity before writing
      const validatedData: FileData = {
        ...data,
        exported_at: new Date().toISOString(),
        total_cases: data.cases.length,
        categoryConfig: mergeCategoryConfig(data.categoryConfig),
        cases: data.cases.map(caseItem => ({ ...caseItem })),
      };

      const success = await this.fileService.writeFile(validatedData);
      
      if (!success) {
        throw new Error('File write operation failed');
      }

      return validatedData;
    } catch (error) {
      console.error('Failed to write file data:', error);
      
      // Provide specific error messaging based on error type
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        if (error.message.includes('state cached in an interface object') || 
            error.message.includes('state had changed')) {
          errorMessage = 'File was modified by another process. Please try again.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Permission denied. Please check file permissions.';
        } else {
          errorMessage = error.message;
        }
      }

      this.reportStorageError("writeData", error, {
        method: "writeFileData",
        errorMessage,
      });

      throw new Error(`Failed to save case data: ${errorMessage}`);
    }
  }

  private touchCaseTimestamps(
    cases: CaseDisplay[],
    touchedCaseIds?: Iterable<string>,
  ): CaseDisplay[] {
    if (!touchedCaseIds) {
      return cases;
    }

    const ids = touchedCaseIds instanceof Set ? touchedCaseIds : new Set(touchedCaseIds);
    if (ids.size === 0) {
      return cases;
    }

    const timestamp = new Date().toISOString();

    return cases.map(caseItem => (
      ids.has(caseItem.id)
        ? { ...caseItem, updatedAt: timestamp }
        : caseItem
    ));
  }

  // =============================================================================
  // PUBLIC API - READ OPERATIONS
  // =============================================================================

  /**
   * Get all cases (always reads fresh from file)
   */
  async getAllCases(): Promise<CaseDisplay[]> {
    const data = await this.readFileData();
    return data ? data.cases : [];
  }

  /**
   * Get a specific case by ID (always reads fresh from file)
   */
  async getCaseById(caseId: string): Promise<CaseDisplay | null> {
    const data = await this.readFileData();
    if (!data) return null;
    
    const caseItem = data.cases.find(c => c.id === caseId);
    return caseItem || null;
  }

  /**
   * Get cases count (always reads fresh from file)
   */
  async getCasesCount(): Promise<number> {
    const data = await this.readFileData();
    return data ? data.cases.length : 0;
  }

  async getAlertsIndex(options: { cases?: CaseDisplay[] } = {}): Promise<AlertsIndex> {
    const cases = options.cases ?? (await this.getAllCases());
    let storedWorkflows: StoredAlertWorkflowState[] = [];
    let needsMigration = false;
    let storedWorkflowReadIssue: "invalid-json" | null = null;

    try {
      const storedJson = await this.fileService.readNamedFile(DataManager.ALERTS_JSON_NAME);
      if (storedJson && typeof storedJson === "object") {
        const parsed = this.parseStoredAlertsPayload(storedJson);
        storedWorkflows = parsed.workflows;
        needsMigration = parsed.needsMigration;
        if (storedWorkflows.length > 0) {
          console.info(
            "[DataManager] Loaded %d stored alert workflow entries",
            storedWorkflows.length,
          );
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError || (error as Error)?.name === "SyntaxError") {
        console.warn(
          "[DataManager] alerts.json contained invalid JSON and will be rebuilt",
          error,
        );
        storedWorkflows = [];
        needsMigration = true;
        storedWorkflowReadIssue = "invalid-json";
      } else {
        this.reportStorageError("readData", error, {
          fileName: DataManager.ALERTS_JSON_NAME,
        }, "We couldn’t load saved alerts. Reconnect and try again.");
      }
    }

    let parsedCsvAlerts: AlertWithMatch[] = [];
    try {
      const csvContent = await this.fileService.readTextFile(DataManager.ALERTS_FILE_NAME);
      if (csvContent) {
        const parsed = this.parseAlertsWithFallback(csvContent, cases);
        parsedCsvAlerts = parsed.alerts;
        this.debugLogAlertsSample("csv-parsed", parsedCsvAlerts);
        console.info(
          "[DataManager] Parsed %d alerts from alerts.csv",
          parsedCsvAlerts.length,
        );
      }
    } catch (error) {
      this.reportStorageError("readData", error, {
        fileName: DataManager.ALERTS_FILE_NAME,
      }, "We couldn’t read the alerts file. Reconnect and try again.");
    }

    if (parsedCsvAlerts.length === 0) {
      if ((needsMigration || storedWorkflowReadIssue) && storedWorkflows.length === 0) {
        void this.saveAlerts([]);
      }
      return createEmptyAlertsIndex();
    }

    let workingAlerts = this.rematchAlertsForCases(parsedCsvAlerts, cases);
    const applied = this.applyStoredAlertWorkflows(workingAlerts, storedWorkflows);
    workingAlerts = applied.alerts;

    this.debugLogAlertsSample("alerts-working", workingAlerts);

    const shouldPersist =
      needsMigration ||
      storedWorkflowReadIssue === "invalid-json" ||
      applied.changed ||
      (storedWorkflows.length > 0 && applied.unmatchedIds.length > 0);

    if (shouldPersist) {
      console.info(
        "[DataManager] Persisting %d alerts to alerts.json",
        workingAlerts.length,
      );
      void this.saveAlerts(workingAlerts, {
        forceSnapshot: storedWorkflowReadIssue === "invalid-json",
      });
    }

    if (workingAlerts.length === 0) {
      return createEmptyAlertsIndex();
    }

    return createAlertsIndexFromAlerts(workingAlerts);
  }

  async updateAlertStatus(
    alertId: string,
    updates: {
      status?: AlertWorkflowStatus;
      resolvedAt?: string | null;
      resolutionNotes?: string;
    },
    options: { cases?: CaseDisplay[] } = {},
  ): Promise<AlertWithMatch | null> {
    const cases = options.cases ?? (await this.getAllCases());

    let storedWorkflows: StoredAlertWorkflowState[] = [];
    let storedWorkflowReadIssue: "invalid-json" | null = null;
    try {
      const storedJson = await this.fileService.readNamedFile(DataManager.ALERTS_JSON_NAME);
      if (storedJson && typeof storedJson === "object") {
        const parsedStored = this.parseStoredAlertsPayload(storedJson);
        storedWorkflows = parsedStored.workflows;
      }
    } catch (error) {
      if (error instanceof SyntaxError || (error as Error)?.name === "SyntaxError") {
        console.warn(
          "[DataManager] alerts.json contained invalid JSON before updating alert status; rebuilding",
          error,
        );
        storedWorkflows = [];
        storedWorkflowReadIssue = "invalid-json";
      } else {
        this.reportStorageError("readData", error, {
          fileName: DataManager.ALERTS_JSON_NAME,
        });
      }
    }

    let workingAlerts: AlertWithMatch[] = [];
    try {
      const csvContent = await this.fileService.readTextFile(DataManager.ALERTS_FILE_NAME);
      if (csvContent) {
        const parsed = this.parseAlertsWithFallback(csvContent, cases);
        workingAlerts = parsed.alerts;
      }
    } catch (error) {
      this.reportStorageError("readData", error, {
        fileName: DataManager.ALERTS_FILE_NAME,
      });
    }

    if (workingAlerts.length === 0) {
      console.warn("[DataManager] No alerts available to update status for", alertId);
      return null;
    }

    const applied = this.applyStoredAlertWorkflows(workingAlerts, storedWorkflows);
    workingAlerts = applied.alerts;

    const targetIndex = workingAlerts.findIndex(alert => alert.id === alertId || alert.reportId === alertId);
    if (targetIndex === -1) {
      console.warn("[DataManager] Could not find alert to update", alertId);
      return null;
    }

    const targetAlert = workingAlerts[targetIndex];
    const nextStatus: AlertWorkflowStatus = updates.status ?? targetAlert.status ?? "new";
    let nextResolvedAt: string | null =
      updates.resolvedAt !== undefined ? updates.resolvedAt : targetAlert.resolvedAt ?? null;

    if (nextStatus === "resolved" && !nextResolvedAt) {
      nextResolvedAt = new Date().toISOString();
    }

    if (nextStatus !== "resolved" && updates.resolvedAt === undefined) {
      nextResolvedAt = targetAlert.resolvedAt ?? null;
    }

    const updatedAlertBase: AlertWithMatch = {
      ...targetAlert,
      status: nextStatus,
      resolvedAt: nextResolvedAt,
      resolutionNotes: updates.resolutionNotes ?? targetAlert.resolutionNotes,
      updatedAt: new Date().toISOString(),
    };

    const [rematchedAlert] = this.rematchAlertsForCases([updatedAlertBase], cases);
    workingAlerts[targetIndex] = rematchedAlert;

    if (storedWorkflowReadIssue === "invalid-json") {
      console.info("[DataManager] Rewriting alerts.json after recovering from invalid JSON");
    }

    await this.saveAlerts(workingAlerts);
    return rematchedAlert;
  }

  async saveAlerts(alerts: AlertWithMatch[], options: { forceSnapshot?: boolean } = {}): Promise<boolean> {
    try {
      const storedAlerts = alerts
        .map(alert => this.serializeStoredAlert(alert, options))
        .filter((entry): entry is StoredAlertWorkflowState => entry !== null);

      const alertsById = new Map<string, StoredAlertWorkflowState>();
      storedAlerts.forEach(entry => {
        const existing = alertsById.get(entry.alertId);
        alertsById.set(entry.alertId, existing ? { ...existing, ...entry } : entry);
      });

      const dedupedAlerts = Array.from(alertsById.values());

      const payload = {
        version: DataManager.ALERTS_STORAGE_VERSION,
        updatedAt: new Date().toISOString(),
        alerts: dedupedAlerts,
      };
      console.info(
        "[DataManager] Saving %d alert workflow entries to alerts.json",
        storedAlerts.length,
      );
      const success = await this.fileService.writeNamedFile(DataManager.ALERTS_JSON_NAME, payload);
      if (!success) {
        throw new Error("Alerts write operation failed");
      }
      console.info("[DataManager] Saved alerts.json successfully");
      try {
        if (typeof this.fileService.notifyDataChange === "function") {
          this.fileService.notifyDataChange();
        }
      } catch (notifyError) {
        console.warn("[DataManager] Failed to notify file storage change after saving alerts", notifyError);
      }
      return true;
    } catch (error) {
      this.reportStorageError("writeData", error, {
        fileName: DataManager.ALERTS_JSON_NAME,
      }, "We couldn’t save the alerts file. Try again after reconnecting.");
      return false;
    }
  }

  // =============================================================================
  // PUBLIC API - CATEGORY CONFIGURATION
  // =============================================================================

  async getCategoryConfig(): Promise<CategoryConfig> {
    const data = await this.readFileData();
    return data ? mergeCategoryConfig(data.categoryConfig) : mergeCategoryConfig();
  }

  async updateCategoryConfig(categoryConfig: CategoryConfig): Promise<CategoryConfig> {
    const sanitized = mergeCategoryConfig(categoryConfig);
    const currentData = await this.readFileData();

    const baseData: FileData = currentData ?? {
      cases: [],
      exported_at: new Date().toISOString(),
      total_cases: 0,
      categoryConfig: mergeCategoryConfig(),
    };

    const updatedData: FileData = {
      ...baseData,
      categoryConfig: sanitized,
    };

    await this.writeFileData(updatedData);
    return sanitized;
  }

  async updateCategoryValues(key: CategoryKey, values: string[]): Promise<CategoryConfig> {
    const sanitizedValues = sanitizeCategoryValues(values);
    if (sanitizedValues.length === 0) {
      throw new Error('At least one option is required');
    }

    const currentConfig = await this.getCategoryConfig();
    const nextConfig: CategoryConfig = {
      ...currentConfig,
      [key]: sanitizedValues,
    };

    return this.updateCategoryConfig(nextConfig);
  }

  async resetCategoryConfig(): Promise<CategoryConfig> {
    const defaults = mergeCategoryConfig();
    await this.updateCategoryConfig(defaults);
    return defaults;
  }

  // =============================================================================
  // PUBLIC API - WRITE OPERATIONS
  // =============================================================================

  /**
   * Create a new complete case
   * Pattern: read → modify → write
   */
  async createCompleteCase(caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Create new case
    const newCase: CaseDisplay = {
      id: uuidv4(),
      name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
      mcn: caseData.caseRecord.mcn,
      status: caseData.caseRecord.status,
      priority: Boolean(caseData.caseRecord.priority),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      person: {
        id: uuidv4(),
        firstName: caseData.person.firstName,
        lastName: caseData.person.lastName,
        name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
        dateOfBirth: caseData.person.dateOfBirth || '',
        ssn: caseData.person.ssn || '',
        phone: caseData.person.phone || '',
        email: caseData.person.email || '',
        organizationId: caseData.person.organizationId || null,
        livingArrangement: caseData.person.livingArrangement || '',
        address: caseData.person.address || {
          street: '',
          city: '',
          state: '',
          zip: ''
        },
        mailingAddress: caseData.person.mailingAddress || {
          street: '',
          city: '',
          state: '',
          zip: '',
          sameAsPhysical: true
        },
        authorizedRepIds: caseData.person.authorizedRepIds || [],
        familyMembers: caseData.person.familyMembers || [],
        status: caseData.person.status || 'Active',
        dateAdded: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      caseRecord: {
        id: uuidv4(),
        personId: '', // Will be set below
        mcn: caseData.caseRecord.mcn,
        applicationDate: caseData.caseRecord.applicationDate || new Date().toISOString(),
        caseType: caseData.caseRecord.caseType || 'General',
        spouseId: caseData.caseRecord.spouseId || '',
        status: caseData.caseRecord.status,
        description: caseData.caseRecord.description || '',
        priority: Boolean(caseData.caseRecord.priority),
        livingArrangement: caseData.caseRecord.livingArrangement || '',
        withWaiver: Boolean(caseData.caseRecord.withWaiver),
        admissionDate: caseData.caseRecord.admissionDate || new Date().toISOString(),
        organizationId: caseData.caseRecord.organizationId || '',
        authorizedReps: caseData.caseRecord.authorizedReps || [],
        retroRequested: caseData.caseRecord.retroRequested || '',
        financials: {
          resources: [],
          income: [],
          expenses: []
        },
        notes: [],
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString()
      }
    };

    // Set the person ID reference
    newCase.caseRecord.personId = newCase.person.id;

    // Modify data
    const casesWithNewCase = [...currentData.cases, newCase];
    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithNewCase, [newCase.id]);

    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps.find(c => c.id === newCase.id) ?? newCase;
  }

  /**
   * Update an existing complete case
   * Pattern: read → modify → write
   */
  async updateCompleteCase(caseId: string, caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const existingCase = currentData.cases[caseIndex];

    // Update person data
    const updatedPerson = {
      ...existingCase.person,
      firstName: caseData.person.firstName,
      lastName: caseData.person.lastName,
      name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
      dateOfBirth: caseData.person.dateOfBirth || '',
      ssn: caseData.person.ssn || '',
      phone: caseData.person.phone || '',
      email: caseData.person.email || '',
      organizationId: caseData.person.organizationId || null,
      livingArrangement: caseData.person.livingArrangement || '',
      address: caseData.person.address || existingCase.person.address,
      mailingAddress: caseData.person.mailingAddress || existingCase.person.mailingAddress,
      authorizedRepIds: caseData.person.authorizedRepIds || [],
      familyMembers: caseData.person.familyMembers || [],
      status: caseData.person.status || 'Active'
    };

    // Update case record data
    const updatedCaseRecord = {
      ...existingCase.caseRecord,
      mcn: caseData.caseRecord.mcn,
      applicationDate: caseData.caseRecord.applicationDate || existingCase.caseRecord.applicationDate,
      caseType: caseData.caseRecord.caseType || existingCase.caseRecord.caseType,
      spouseId: caseData.caseRecord.spouseId || '',
      status: caseData.caseRecord.status,
      description: caseData.caseRecord.description || '',
      priority: Boolean(caseData.caseRecord.priority),
      livingArrangement: caseData.caseRecord.livingArrangement || '',
      withWaiver: Boolean(caseData.caseRecord.withWaiver),
      admissionDate: caseData.caseRecord.admissionDate || existingCase.caseRecord.admissionDate,
      organizationId: caseData.caseRecord.organizationId || '',
      authorizedReps: caseData.caseRecord.authorizedReps || [],
      retroRequested: caseData.caseRecord.retroRequested || '',
      // Preserve existing financials and notes
      financials: existingCase.caseRecord.financials,
      notes: existingCase.caseRecord.notes,
      updatedDate: new Date().toISOString()
    };

    const caseWithChanges: CaseDisplay = {
      ...existingCase,
      name: updatedPerson.name,
      mcn: updatedCaseRecord.mcn,
      status: updatedCaseRecord.status,
      priority: updatedCaseRecord.priority,
      person: updatedPerson,
      caseRecord: updatedCaseRecord,
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithChanges : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Modify data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  async updateCaseStatus(caseId: string, status: CaseDisplay["status"]): Promise<CaseDisplay> {
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error("Failed to read current data");
    }

    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error("Case not found");
    }

    const targetCase = currentData.cases[caseIndex];

    const caseWithUpdatedStatus: CaseDisplay = {
      ...targetCase,
      status,
      caseRecord: {
        ...targetCase.caseRecord,
        status,
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithUpdatedStatus : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Delete a case
   * Pattern: read → modify → write
   */
  async deleteCase(caseId: string): Promise<void> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Check if case exists
    const caseExists = currentData.cases.some(c => c.id === caseId);
    if (!caseExists) {
      throw new Error('Case not found');
    }

    // Modify data (remove case)
    const updatedData: FileData = {
      ...currentData,
      cases: currentData.cases.filter(c => c.id !== caseId)
    };

    // Write back to file
    await this.writeFileData(updatedData);
  }

  // =============================================================================
  // FINANCIAL ITEM OPERATIONS
  // =============================================================================

  /**
   * Add financial item to a case
   * Pattern: read → modify → write
   */
  async addItem(caseId: string, category: CaseCategory, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Create new item
    const newItem: FinancialItem = {
      ...itemData,
      id: uuidv4(),
      dateAdded: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Modify case data
    const caseWithNewItem: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        financials: {
          ...targetCase.caseRecord.financials,
          [category]: [...targetCase.caseRecord.financials[category], newItem],
        },
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithNewItem : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Update financial item in a case
   * Pattern: read → modify → write
   */
  async updateItem(
    caseId: string,
    category: CaseCategory,
    itemId: string,
    updatedItem: Partial<FinancialItem>,
  ) {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Find item to update
    const itemIndex = targetCase.caseRecord.financials[category].findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }

    const existingItem = targetCase.caseRecord.financials[category][itemIndex];

    // Update item
    const updatedItemData: FinancialItem = {
      ...existingItem,
      ...updatedItem,
      id: itemId, // Preserve ID
      createdAt: existingItem.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString()
    };

    // Modify case data
    const caseWithUpdatedItem: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        financials: {
          ...targetCase.caseRecord.financials,
          [category]: targetCase.caseRecord.financials[category].map((item, index) =>
            index === itemIndex ? updatedItemData : item,
          ),
        },
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithUpdatedItem : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Delete financial item from a case
   * Pattern: read → modify → write
   */
  async deleteItem(caseId: string, category: CaseCategory, itemId: string): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Check if item exists
    const itemExists = targetCase.caseRecord.financials[category].some(item => item.id === itemId);
    if (!itemExists) {
      throw new Error('Item not found');
    }

    // Modify case data
    const caseWithItemRemoved: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        financials: {
          ...targetCase.caseRecord.financials,
          [category]: targetCase.caseRecord.financials[category].filter(item => item.id !== itemId),
        },
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithItemRemoved : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  // =============================================================================
  // NOTE OPERATIONS
  // =============================================================================

  /**
   * Add note to a case
   * Pattern: read → modify → write
   */
  async addNote(caseId: string, noteData: NewNoteData): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Create new note
    const newNote = {
      id: uuidv4(),
      category: noteData.category || 'General',
      content: noteData.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Modify case data
    const caseWithNewNote: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        notes: [...(targetCase.caseRecord.notes || []), newNote],
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithNewNote : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Update note in a case
   * Pattern: read → modify → write
   */
  async updateNote(caseId: string, noteId: string, noteData: NewNoteData): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Find note to update
    const noteIndex = (targetCase.caseRecord.notes || []).findIndex(note => note.id === noteId);
    if (noteIndex === -1) {
      throw new Error('Note not found');
    }

    const existingNote = targetCase.caseRecord.notes![noteIndex];

    // Update note
    const updatedNote = {
      ...existingNote,
      category: noteData.category || existingNote.category,
      content: noteData.content,
      updatedAt: new Date().toISOString()
    };

    // Modify case data
    const caseWithUpdatedNote: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        notes: (targetCase.caseRecord.notes || []).map((note, index) =>
          index === noteIndex ? updatedNote : note,
        ),
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithUpdatedNote : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Delete note from a case
   * Pattern: read → modify → write
   */
  async deleteNote(caseId: string, noteId: string): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Check if note exists
    const noteExists = (targetCase.caseRecord.notes || []).some(note => note.id === noteId);
    if (!noteExists) {
      throw new Error('Note not found');
    }

    // Modify case data
    const caseWithNoteRemoved: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        notes: (targetCase.caseRecord.notes || []).filter(note => note.id !== noteId),
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithNoteRemoved : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  /**
   * Import multiple cases at once
   * Pattern: read → modify → write (single operation)
   */
  async importCases(cases: CaseDisplay[]): Promise<void> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Validate and ensure unique IDs
    const casesToImport = cases.map(caseItem => ({
      ...caseItem,
      id: caseItem.id || uuidv4(),
      caseRecord: {
        ...caseItem.caseRecord,
        updatedDate: new Date().toISOString(),
      },
    }));

    const touchedCaseIds = casesToImport.map(caseItem => caseItem.id);

    const combinedCases = [...currentData.cases, ...casesToImport];
    const casesWithTouchedTimestamps = this.touchCaseTimestamps(combinedCases, touchedCaseIds);

    // Modify data (append new cases)
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);
  }

  /**
   * Clear all data
   * Pattern: write empty structure
   */
  async clearAllData(): Promise<void> {
    let categoryConfig = mergeCategoryConfig();
    try {
      const currentData = await this.readFileData();
      if (currentData) {
        categoryConfig = mergeCategoryConfig(currentData.categoryConfig);
      }
    } catch (error) {
      console.warn('[DataManager] Failed to read existing data before clearing. Using default category config.', error);
    }

    const emptyData: FileData = {
      cases: [],
      exported_at: new Date().toISOString(),
      total_cases: 0,
      categoryConfig,
    };

    await this.writeFileData(emptyData);
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Check if file service is available and connected
   */
  isConnected(): boolean {
    return this.fileService.getStatus().permissionStatus === 'granted';
  }

  /**
   * Get file service status
   */
  getStatus() {
    return this.fileService.getStatus();
  }
}

export default DataManager;