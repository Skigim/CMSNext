import {
  CaseDisplay,
  CaseCategory,
  FinancialItem,
  NewPersonData,
  NewCaseRecordData,
  CaseStatus,
  NewNoteData,
  AlertWorkflowStatus,
} from "../types/case";
import type { CaseActivityEntry } from "../types/activityLog";
import { v4 as uuidv4 } from 'uuid';
import AutosaveFileService from './AutosaveFileService';
import { createLogger } from './logger';
import {
  reportFileStorageError,
  type FileStorageOperation,
} from "./fileStorageErrorReporter";
import {
  CategoryConfig,
  CategoryKey,
  mergeCategoryConfig,
} from "../types/categoryConfig";
import {
  AlertsIndex,
  AlertsSummary,
  AlertWithMatch,
  createAlertsIndexFromAlerts,
  createEmptyAlertsIndex,
  buildAlertStorageKey,
  normalizeMcn,
  parseStackedAlerts,
} from "./alertsData";
import { FileStorageService, type FileData } from "./services/FileStorageService";
import { ActivityLogService } from "./services/ActivityLogService";
import { CategoryConfigService } from "./services/CategoryConfigService";
import { NotesService } from "./services/NotesService";
import { FinancialsService } from "./services/FinancialsService";
import { CaseService } from "./services/CaseService";

// ============================================================================
// Configuration & Logging
// ============================================================================

interface DataManagerConfig {
  fileService: AutosaveFileService;
  persistNormalizationFixes?: boolean;
}

const logger = createLogger('DataManager');

// ============================================================================
// Type Definitions
// ============================================================================

interface StoredAlertWorkflowState {
  alertId: string;
  status?: AlertWorkflowStatus;
  resolvedAt?: string | null;
  resolutionNotes?: string;
  updatedAt?: string | null;
  firstSeenAt?: string | null;
}

interface AlertLookupCandidate {
  key: string;
  fallback: boolean;
}

interface LoadAlertsResult {
  alerts: AlertWithMatch[] | null;
  legacyWorkflows: StoredAlertWorkflowState[];
  needsMigration: boolean;
  invalidJson: boolean;
  sourceFile?: string;
}

interface MergeAlertsResult {
  added: number;
  updated: number;
  total: number;
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
  private fileStorage: FileStorageService;
  private activityLog: ActivityLogService;
  private categoryConfig: CategoryConfigService;
  private notes: NotesService;
  private financials: FinancialsService;
  private cases: CaseService;
  private static readonly ERROR_SOURCE = "DataManager";
  private static readonly ALERTS_FILE_NAME = "alerts.csv";
  private static readonly ALERTS_JSON_NAME = "alerts.json";
  private static readonly ALERTS_STORAGE_VERSION = 3;
  private static readonly ALERT_MATCH_STATUS_SET = new Set<AlertWithMatch["matchStatus"]>([
    "matched",
    "unmatched",
    "missing-mcn",
  ]);
  private static readonly ALERT_WORKFLOW_STATUSES: readonly AlertWorkflowStatus[] = [
    "new",
    "in-progress",
    "acknowledged",
    "snoozed",
    "resolved",
  ];
  private static readonly ALERT_WORKFLOW_STATUS_SET = new Set<AlertWorkflowStatus>(
    DataManager.ALERT_WORKFLOW_STATUSES,
  );
  private static readonly ALERT_WORKFLOW_PRIORITY: readonly AlertWorkflowStatus[] =
    DataManager.ALERT_WORKFLOW_STATUSES;

  constructor(config: DataManagerConfig) {
    this.fileService = config.fileService;
    this.fileStorage = new FileStorageService({
      fileService: config.fileService,
      persistNormalizationFixes: config.persistNormalizationFixes,
      normalizeCaseNotes,
    });
    this.activityLog = new ActivityLogService({
      fileStorage: this.fileStorage,
    });
    this.categoryConfig = new CategoryConfigService({
      fileStorage: this.fileStorage,
    });
    this.notes = new NotesService({
      fileStorage: this.fileStorage,
    });
    this.financials = new FinancialsService({
      fileStorage: this.fileStorage,
    });
    this.cases = new CaseService({
      fileStorage: this.fileStorage,
    });
  }

  // ==========================================================================
  // Private: Alert Matching & Processing
  // ==========================================================================

  private buildCaseLookup(cases: CaseDisplay[]): Map<string, CaseDisplay> {
    const lookup = new Map<string, CaseDisplay>();

    cases.forEach(caseItem => {
      const mcn = caseItem.caseRecord?.mcn ?? caseItem.mcn;
      const normalized = normalizeMcn(mcn);
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

  const normalizedMcn = normalizeMcn(alert.mcNumber ?? null);
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

    const storageKey = buildAlertStorageKey(alert);
    if (storageKey && storageKey.trim().length > 0) {
      return storageKey;
    }

    return alert.reportId ?? alert.id ?? "";
  }

  private alertLegacyKey(alert: AlertWithMatch): string | null {
    if (!alert) {
      return null;
    }

    const baseId = alert.reportId?.trim() || alert.id?.trim();
    if (!baseId) {
      return null;
    }

    const dateSource = alert.alertDate || alert.updatedAt || alert.createdAt || "";
    if (!dateSource) {
      return baseId;
    }

    const parsed = new Date(dateSource);
    const normalizedDate = Number.isNaN(parsed.getTime())
      ? dateSource
      : parsed.toISOString().slice(0, 10);

    return `${baseId}|${normalizedDate}`;
  }

  private buildAlertLookupCandidates(alert: AlertWithMatch): AlertLookupCandidate[] {
    const strong: AlertLookupCandidate[] = [];
    const fallback: AlertLookupCandidate[] = [];

    const addCandidate = (
      value: string | null | undefined,
      options: { fallback?: boolean } = {},
    ) => {
      if (!value) {
        return;
      }

      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return;
      }

      const target = options.fallback ? fallback : strong;
      if (target.some(candidate => candidate.key === trimmed)) {
        return;
      }

      target.push({ key: trimmed, fallback: !!options.fallback });
    };

    addCandidate(this.alertKey(alert));

    const legacyKey = this.alertLegacyKey(alert);
    if (legacyKey) {
      addCandidate(legacyKey, { fallback: true });
    }

    if (alert.metadata && typeof alert.metadata === "object") {
      const metadataStrongKeys = ["uniqueId", "unique_id", "storageKey", "storage_key"];
      metadataStrongKeys.forEach(key => {
        const metaValue = alert.metadata?.[key];
        if (typeof metaValue === "string") {
          addCandidate(metaValue);
        }
      });

      const metadataFallbackKeys = [
        "alertId",
        "reportId",
        "id",
        "report_id",
        "alert_id",
        "alert_number",
        "alertNumber",
        "alertCode",
        "alert_code",
      ];
      metadataFallbackKeys.forEach(key => {
        const metaValue = alert.metadata?.[key];
        if (typeof metaValue === "string") {
          addCandidate(metaValue, { fallback: true });
        }
      });
    }

    addCandidate(alert.reportId, { fallback: true });
    addCandidate(alert.id, { fallback: true });
    addCandidate(alert.alertCode, { fallback: true });

    if (strong.length > 0) {
      return [...strong, ...fallback];
    }

    return fallback;
  }

  private shouldMatchUsingFallback(
    incoming: AlertWithMatch,
    existing: AlertWithMatch,
    incomingStrongKeys: string[],
  ): boolean {
    const existingStrongKeys = this.buildAlertLookupCandidates(existing)
      .filter(candidate => !candidate.fallback)
      .map(candidate => candidate.key);

    if (incomingStrongKeys.length === 0 || existingStrongKeys.length === 0) {
      return true;
    }

    if (incomingStrongKeys.some(key => existingStrongKeys.includes(key))) {
      return true;
    }

    const incomingMcn = normalizeMcn(incoming.mcNumber ?? null);
    const existingMcn = normalizeMcn(existing.mcNumber ?? null);
    if (incomingMcn && existingMcn && incomingMcn !== existingMcn) {
      return false;
    }

    const normalizeText = (value: string | undefined): string | null =>
      value && value.trim().length > 0 ? value.trim().toLowerCase() : null;

    const incomingDescription = normalizeText(incoming.description);
    const existingDescription = normalizeText(existing.description);
    const descriptionsMatch =
      incomingDescription !== null &&
      existingDescription !== null &&
      incomingDescription === existingDescription;

    const incomingRawDescription = normalizeText(incoming.metadata?.rawDescription);
    const existingRawDescription = normalizeText(existing.metadata?.rawDescription);
    const rawDescriptionsMatch =
      incomingRawDescription !== null &&
      existingRawDescription !== null &&
      incomingRawDescription === existingRawDescription;

    const hasTextualMatch = descriptionsMatch || rawDescriptionsMatch;
    if (!hasTextualMatch) {
      return false;
    }

    const normalizeDate = (value: string | null | undefined): string | null => {
      if (!value) {
        return null;
      }

      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }

      return value.slice(0, 10);
    };

    const incomingDate = normalizeDate(incoming.alertDate || incoming.updatedAt || incoming.createdAt);
    const existingDate = normalizeDate(existing.alertDate || existing.updatedAt || existing.createdAt);
    const datesMatch = incomingDate !== null && existingDate !== null && incomingDate === existingDate;

    const mcnMatches = incomingMcn !== null && existingMcn !== null && incomingMcn === existingMcn;

    if (datesMatch || mcnMatches) {
      return true;
    }

    return false;
  }

  private mergeAlertDetails(
    existing: AlertWithMatch,
    incoming: AlertWithMatch,
  ): { alert: AlertWithMatch; changed: boolean } {
    const mergedMetadata = {
      ...(existing.metadata ?? {}),
      ...(incoming.metadata ?? {}),
    };

    const metadataValue = Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined;

    const preferredStatus = this.selectPreferredWorkflowStatus(existing.status, incoming.status);
    const existingResolvedAt = existing.resolvedAt ?? null;
    const incomingResolvedAt = incoming.resolvedAt ?? null;

    const resolvedAtForStatus = preferredStatus === "resolved"
      ? existingResolvedAt ?? incomingResolvedAt ?? null
      : null;

    const resolutionNotesForStatus =
      preferredStatus === existing.status && existing.resolutionNotes !== undefined
        ? existing.resolutionNotes
        : preferredStatus === incoming.status && incoming.resolutionNotes !== undefined
          ? incoming.resolutionNotes
          : existing.resolutionNotes ?? incoming.resolutionNotes;

    const merged: AlertWithMatch = {
      ...incoming,
      metadata: metadataValue,
      status: preferredStatus,
      resolvedAt: resolvedAtForStatus,
      resolutionNotes: resolutionNotesForStatus,
    };

    if (!merged.mcNumber && existing.mcNumber) {
      merged.mcNumber = existing.mcNumber;
    }

    if (!merged.matchedCaseId && existing.matchedCaseId) {
      merged.matchedCaseId = existing.matchedCaseId;
    }

    if (!merged.matchedCaseName && existing.matchedCaseName) {
      merged.matchedCaseName = existing.matchedCaseName;
    }

    if (!merged.matchedCaseStatus && existing.matchedCaseStatus) {
      merged.matchedCaseStatus = existing.matchedCaseStatus;
    }

    const existingUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt).getTime() : Number.NaN;
    const incomingUpdatedAt = merged.updatedAt ? new Date(merged.updatedAt).getTime() : Number.NaN;

    if (!Number.isNaN(existingUpdatedAt) && Number.isNaN(incomingUpdatedAt)) {
      merged.updatedAt = existing.updatedAt;
    } else if (!Number.isNaN(existingUpdatedAt) && !Number.isNaN(incomingUpdatedAt)) {
      if (existingUpdatedAt > incomingUpdatedAt) {
        merged.updatedAt = existing.updatedAt;
      }
    }

    const existingMetadataString = JSON.stringify(existing.metadata ?? {});
    const mergedMetadataString = JSON.stringify(metadataValue ?? {});
    const metadataChanged = existingMetadataString !== mergedMetadataString;

    const fieldsToCompare: Array<keyof AlertWithMatch> = [
      "alertCode",
      "alertType",
      "alertDate",
      "createdAt",
      "updatedAt",
      "mcNumber",
      "personName",
      "program",
      "region",
      "state",
      "source",
      "description",
      "status",
      "resolvedAt",
      "resolutionNotes",
      "matchStatus",
      "matchedCaseId",
      "matchedCaseName",
      "matchedCaseStatus",
    ];

    const detailsChanged =
      metadataChanged ||
      fieldsToCompare.some(field => {
        const existingValue = existing[field];
        const mergedValue = merged[field];

        if (existingValue === mergedValue) {
          return false;
        }

        if ((existingValue === null || existingValue === undefined) && (mergedValue === null || mergedValue === undefined)) {
          return false;
        }

        if (existingValue instanceof Date || mergedValue instanceof Date) {
          return existingValue?.valueOf() !== mergedValue?.valueOf();
        }

        return existingValue !== mergedValue;
      });

    return { alert: merged, changed: detailsChanged };
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

    logger.debug('Alert preview generated', {
      source,
      preview,
    });
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

  private normalizeWorkflowStatus(value: unknown): AlertWorkflowStatus {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase() as AlertWorkflowStatus;
      if (DataManager.ALERT_WORKFLOW_STATUS_SET.has(normalized)) {
        return normalized;
      }
    }

    return "new";
  }

  private selectPreferredWorkflowStatus(
    existingStatus: AlertWorkflowStatus | null | undefined,
    incomingStatus: AlertWorkflowStatus | null | undefined,
  ): AlertWorkflowStatus {
    const normalizedExisting = this.normalizeWorkflowStatus(existingStatus);
    const normalizedIncoming = this.normalizeWorkflowStatus(incomingStatus);

    if (normalizedExisting === normalizedIncoming) {
      return normalizedExisting;
    }

    const existingPriority = DataManager.ALERT_WORKFLOW_PRIORITY.indexOf(normalizedExisting);
    const incomingPriority = DataManager.ALERT_WORKFLOW_PRIORITY.indexOf(normalizedIncoming);

    return incomingPriority > existingPriority ? normalizedIncoming : normalizedExisting;
  }

  private normalizeMatchStatus(value: unknown): AlertWithMatch["matchStatus"] {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase() as AlertWithMatch["matchStatus"];
      if (DataManager.ALERT_MATCH_STATUS_SET.has(normalized)) {
        return normalized;
      }
    }

    return "unmatched";
  }

  private hydrateStoredAlert(entry: unknown): AlertWithMatch | null {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const raw = entry as Record<string, unknown>;
    const idCandidate = typeof raw.id === "string" ? raw.id.trim() : "";
    const reportIdCandidate = typeof raw.reportId === "string" ? raw.reportId.trim() : "";
    const alertId = idCandidate || reportIdCandidate;
    if (!alertId) {
      return null;
    }

    const alert: AlertWithMatch = {
      id: alertId,
      reportId: reportIdCandidate || undefined,
      alertCode: typeof raw.alertCode === "string" ? raw.alertCode : "",
      alertType: typeof raw.alertType === "string" ? raw.alertType : "",
      alertDate: typeof raw.alertDate === "string" ? raw.alertDate : "",
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
      mcNumber:
        raw.mcNumber === null || typeof raw.mcNumber === "string"
          ? (raw.mcNumber as string | null | undefined)
          : undefined,
      personName: typeof raw.personName === "string" ? raw.personName : undefined,
      program: typeof raw.program === "string" ? raw.program : undefined,
      region: typeof raw.region === "string" ? raw.region : undefined,
      state: typeof raw.state === "string" ? raw.state : undefined,
      source: typeof raw.source === "string" ? raw.source : undefined,
      description: typeof raw.description === "string" ? raw.description : undefined,
      status: this.normalizeWorkflowStatus(raw.status),
      resolvedAt:
        raw.resolvedAt === null || typeof raw.resolvedAt === "string"
          ? (raw.resolvedAt as string | null | undefined)
          : undefined,
      resolutionNotes: typeof raw.resolutionNotes === "string" ? raw.resolutionNotes : undefined,
      metadata:
        typeof raw.metadata === "object" && raw.metadata !== null
          ? (raw.metadata as Record<string, string | undefined>)
          : undefined,
      matchStatus: this.normalizeMatchStatus(raw.matchStatus),
      matchedCaseId: typeof raw.matchedCaseId === "string" ? raw.matchedCaseId : undefined,
      matchedCaseName: typeof raw.matchedCaseName === "string" ? raw.matchedCaseName : undefined,
      matchedCaseStatus: (typeof raw.matchedCaseStatus === "string" ? raw.matchedCaseStatus as CaseStatus : undefined),
    };

    return alert;
  }

  private haveAlertsChanged(original: AlertWithMatch[], updated: AlertWithMatch[]): boolean {
    if (original.length !== updated.length) {
      return true;
    }

    const originalMap = new Map<string, AlertWithMatch>();
    original.forEach(alert => {
      originalMap.set(this.alertKey(alert), alert);
    });

    for (const alert of updated) {
      const key = this.alertKey(alert);
      const previous = originalMap.get(key);
      if (!previous || !this.alertsAreEqual(previous, alert)) {
        return true;
      }
      originalMap.delete(key);
    }

    return originalMap.size > 0;
  }

  private async loadAlertsFromStore(): Promise<LoadAlertsResult> {
    try {
      const payload = await this.fileService.readNamedFile(DataManager.ALERTS_JSON_NAME);
      if (!payload) {
        return {
          alerts: null,
          legacyWorkflows: [],
          needsMigration: false,
          invalidJson: false,
        };
      }

      if (typeof payload !== "object" || payload === null) {
        return {
          alerts: null,
          legacyWorkflows: [],
          needsMigration: true,
          invalidJson: false,
        };
      }

      const root = payload as Record<string, unknown>;
      const version = typeof root.version === "number" ? root.version : 1;
      const sourceFile = typeof root.sourceFile === "string" ? root.sourceFile : undefined;

      if (version >= DataManager.ALERTS_STORAGE_VERSION) {
        if (!Array.isArray(root.alerts)) {
          return {
            alerts: null,
            legacyWorkflows: [],
            needsMigration: true,
            invalidJson: false,
            sourceFile,
          };
        }

        const hydratedAlerts = (root.alerts as unknown[])
          .map(entry => this.hydrateStoredAlert(entry))
          .filter((alert): alert is AlertWithMatch => alert !== null);

        return {
          alerts: hydratedAlerts,
          legacyWorkflows: [],
          needsMigration: false,
          invalidJson: false,
          sourceFile,
        };
      }

      const { workflows, needsMigration } = this.parseStoredAlertsPayload(root);
      return {
        alerts: null,
        legacyWorkflows: workflows,
        needsMigration: needsMigration || version < DataManager.ALERTS_STORAGE_VERSION,
        invalidJson: false,
        sourceFile,
      };
    } catch (error) {
      if (error instanceof SyntaxError || (error as Error)?.name === "SyntaxError") {
        logger.warn('alerts.json contained invalid JSON and will be rebuilt', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return {
          alerts: null,
          legacyWorkflows: [],
          needsMigration: true,
          invalidJson: true,
        };
      }

      this.reportStorageError("readData", error, {
        fileName: DataManager.ALERTS_JSON_NAME,
      }, "We couldn’t load saved alerts. Reconnect and try again.");

      return {
        alerts: null,
        legacyWorkflows: [],
        needsMigration: false,
        invalidJson: false,
      };
    }
  }

  private async importAlertsFromCsv(cases: CaseDisplay[]): Promise<{ alerts: AlertWithMatch[]; sourceFile?: string }> {
    try {
      const csvContent = await this.fileService.readTextFile(DataManager.ALERTS_FILE_NAME);
      if (!csvContent) {
        return { alerts: [], sourceFile: DataManager.ALERTS_FILE_NAME };
      }

      const parsed = this.parseAlertsWithFallback(csvContent, cases);
      return { alerts: parsed.alerts, sourceFile: DataManager.ALERTS_FILE_NAME };
    } catch (error) {
      this.reportStorageError("readData", error, {
        fileName: DataManager.ALERTS_FILE_NAME,
      }, "We couldn’t read the alerts file. Reconnect and try again.");
      return { alerts: [], sourceFile: DataManager.ALERTS_FILE_NAME };
    }
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

    const workflowKeyIndex = new Map<string, number[]>();
    storedWorkflows.forEach((workflow, index) => {
      const key = workflow?.alertId?.trim();
      if (!key) {
        return;
      }

      const existing = workflowKeyIndex.get(key);
      if (existing) {
        existing.push(index);
        return;
      }

      workflowKeyIndex.set(key, [index]);
    });

    const usedIndices = new Set<number>();

    const resolveStoredWorkflowForAlert = (alert: AlertWithMatch): { workflow: StoredAlertWorkflowState | null; index: number } => {
      const candidates = this.buildAlertLookupCandidates(alert);

      let matchedIndex = -1;
      let matchedWorkflow: StoredAlertWorkflowState | null = null;

      for (const { key: candidate } of candidates) {
        const candidateIndices = workflowKeyIndex.get(candidate);
        if (!candidateIndices?.length) {
          continue;
        }

        for (const index of candidateIndices) {
          if (usedIndices.has(index)) {
            continue;
          }

          matchedIndex = index;
          matchedWorkflow = storedWorkflows[index] ?? null;
          break;
        }

        if (matchedWorkflow) {
          break;
        }
      }

      if (matchedIndex === -1 || !matchedWorkflow) {
        return { workflow: null, index: -1 };
      }

      usedIndices.add(matchedIndex);
      return { workflow: matchedWorkflow, index: matchedIndex };
    };

    let changed = false;
    const updatedAlerts = alerts.map(alert => {
      const { workflow } = resolveStoredWorkflowForAlert(alert);
      if (!workflow) {
        return alert;
      }

      const nextAlert: AlertWithMatch = {
        ...alert,
        status: workflow.status ?? alert.status ?? "new",
        resolvedAt:
          workflow.resolvedAt !== undefined
            ? workflow.resolvedAt
            : alert.resolvedAt ?? null,
        resolutionNotes:
          workflow.resolutionNotes ?? alert.resolutionNotes,
        updatedAt: workflow.updatedAt ?? alert.updatedAt,
      };

      if (
        !this.alertsAreEqual(alert, nextAlert) ||
        alert.updatedAt !== nextAlert.updatedAt
      ) {
        changed = true;
      }

      return nextAlert;
    });

    const unmatchedIds = storedWorkflows
      .map((workflow, index) => ({ workflow, index }))
      .filter(entry => entry.workflow.alertId && !usedIndices.has(entry.index))
      .map(entry => entry.workflow.alertId);

    return { alerts: updatedAlerts, changed, unmatchedIds };
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
  logger.debug('Alert parser metrics', { metrics });
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
   * Delegates to FileStorageService
   */
  private async readFileData(): Promise<FileData | null> {
    return this.fileStorage.readFileData();
  }

  // =============================================================================
  // PUBLIC API - READ OPERATIONS
  // =============================================================================

  /**
   * Get all cases (always reads fresh from file)
   * Delegates to CaseService
   */
  async getAllCases(): Promise<CaseDisplay[]> {
    return this.cases.getAllCases();
  }

  async getActivityLog(): Promise<CaseActivityEntry[]> {
    return this.activityLog.getActivityLog();
  }

  async clearActivityLogForDate(targetDate: string | Date): Promise<number> {
    return this.activityLog.clearActivityLogForDate(targetDate);
  }

  /**
   * Get a specific case by ID (always reads fresh from file)
   * Delegates to CaseService
   */
  async getCaseById(caseId: string): Promise<CaseDisplay | null> {
    return this.cases.getCaseById(caseId);
  }

  /**
   * Get cases count (always reads fresh from file)
   * Delegates to CaseService
   */
  async getCasesCount(): Promise<number> {
    return this.cases.getCasesCount();
  }

  // ==========================================================================
  // PUBLIC API - ALERT OPERATIONS
  // ==========================================================================

  async getAlertsIndex(options: { cases?: CaseDisplay[] } = {}): Promise<AlertsIndex> {
    const cases = options.cases ?? (await this.getAllCases());

    const loadResult = await this.loadAlertsFromStore();
    let alerts = loadResult.alerts ?? [];
    let shouldPersist = loadResult.needsMigration || loadResult.invalidJson;
    let sourceFile = loadResult.sourceFile;

    if (alerts.length === 0) {
      const imported = await this.importAlertsFromCsv(cases);
      alerts = imported.alerts;
      sourceFile = imported.sourceFile ?? sourceFile;

      if (alerts.length === 0) {
        if (shouldPersist) {
          const emptyIndex = createAlertsIndexFromAlerts([]);
          void this.saveAlerts(emptyIndex.alerts, emptyIndex.summary, { sourceFile });
        }
        return createEmptyAlertsIndex();
      }

      if (loadResult.legacyWorkflows.length > 0) {
        const applied = this.applyStoredAlertWorkflows(alerts, loadResult.legacyWorkflows);
        alerts = applied.alerts;
        if (applied.changed || applied.unmatchedIds.length > 0) {
          shouldPersist = true;
        }
      }

      shouldPersist = true;
    }

    const originalAlerts = alerts;
    const rematchedAlerts = this.rematchAlertsForCases(alerts, cases);
    const index = createAlertsIndexFromAlerts(rematchedAlerts);

    this.debugLogAlertsSample("alerts-active", index.alerts);

    if (!shouldPersist && this.haveAlertsChanged(originalAlerts, rematchedAlerts)) {
      shouldPersist = true;
    }

    if (shouldPersist) {
      logger.debug('Persisting alerts to store', {
        alertCount: index.alerts.length,
        sourceFile,
      });
      void this.saveAlerts(index.alerts, index.summary, { sourceFile });
    }

    return index;
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

    const loadResult = await this.loadAlertsFromStore();
    let alerts = loadResult.alerts ?? [];
    let sourceFile = loadResult.sourceFile;

    if (alerts.length === 0) {
      const imported = await this.importAlertsFromCsv(cases);
      alerts = imported.alerts;
      sourceFile = imported.sourceFile ?? sourceFile;

      if (alerts.length === 0) {
        logger.warn('No alerts available to update status', { alertId });
        return null;
      }

      if (loadResult.legacyWorkflows.length > 0) {
        const applied = this.applyStoredAlertWorkflows(alerts, loadResult.legacyWorkflows);
        alerts = applied.alerts;
      }
    }

    const normalizedAlertId = typeof alertId === "string" ? alertId.trim() : "";
    if (normalizedAlertId.length === 0) {
      logger.warn('Invalid alert identifier for status update', { alertId });
      return null;
    }

    let targetIndex = alerts.findIndex(alert => alert.id === normalizedAlertId);

    if (targetIndex === -1) {
      const strongMatches: number[] = [];
      const fallbackMatches: number[] = [];

      alerts.forEach((alert, index) => {
        const candidates = this.buildAlertLookupCandidates(alert);
        candidates.forEach(candidate => {
          if (candidate.key !== normalizedAlertId) {
            return;
          }

          if (candidate.fallback) {
            if (!fallbackMatches.includes(index)) {
              fallbackMatches.push(index);
            }
            return;
          }

          if (!strongMatches.includes(index)) {
            strongMatches.push(index);
          }
        });
      });

      if (strongMatches.length === 1) {
        targetIndex = strongMatches[0];
      } else if (strongMatches.length > 1) {
        logger.warn('Multiple alerts matched status update request by strong key', {
          alertId,
          matchedCount: strongMatches.length,
        });
        return null;
      } else if (fallbackMatches.length === 1) {
        targetIndex = fallbackMatches[0];
      } else if (fallbackMatches.length > 1) {
        logger.warn('Multiple alerts matched status update request by fallback key', {
          alertId,
          matchedCount: fallbackMatches.length,
        });
        return null;
      }
    }

    if (targetIndex === -1) {
      logger.warn('Could not find alert to update', { alertId });
      return null;
    }

    const targetAlert = alerts[targetIndex];
    const nextStatus: AlertWorkflowStatus = updates.status ?? targetAlert.status ?? "new";
    let nextResolvedAt: string | null =
      updates.resolvedAt !== undefined ? updates.resolvedAt : targetAlert.resolvedAt ?? null;

    if (nextStatus === "resolved" && !nextResolvedAt) {
      nextResolvedAt = new Date().toISOString();
    }

    if (nextStatus !== "resolved") {
      nextResolvedAt = updates.resolvedAt !== undefined ? updates.resolvedAt : null;
    }

    const updatedAlertBase: AlertWithMatch = {
      ...targetAlert,
      status: nextStatus,
      resolvedAt: nextResolvedAt,
      resolutionNotes: updates.resolutionNotes ?? targetAlert.resolutionNotes,
      updatedAt: new Date().toISOString(),
    };

    alerts[targetIndex] = updatedAlertBase;

    const rematchedAlerts = this.rematchAlertsForCases(alerts, cases);
    const index = createAlertsIndexFromAlerts(rematchedAlerts);

    await this.saveAlerts(index.alerts, index.summary, { sourceFile });

    const rematchedAlert = rematchedAlerts.find(alert => alert.id === updatedAlertBase.id);
    if (!rematchedAlert) {
      logger.warn('Updated alert missing after rematch', {
        alertId,
        alertKey: this.alertKey(updatedAlertBase),
      });
      return null;
    }

    return rematchedAlert;
  }

  async saveAlerts(
    alerts: AlertWithMatch[],
    summary?: AlertsSummary,
    options: { sourceFile?: string } = {},
  ): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const index = summary
        ? { alerts, summary }
        : createAlertsIndexFromAlerts(alerts);

      const normalizedAlerts = index.alerts;
      const payload: Record<string, unknown> = {
        version: DataManager.ALERTS_STORAGE_VERSION,
        generatedAt: now,
        updatedAt: now,
        summary: index.summary,
        alerts: normalizedAlerts,
        uniqueAlerts: this.countUniqueAlertKeys(normalizedAlerts),
      };

      if (options.sourceFile) {
        payload.sourceFile = options.sourceFile;
      }

      logger.debug('Saving alerts to alerts.json', {
        alertCount: normalizedAlerts.length,
        sourceFile: options.sourceFile,
      });

      const success = await this.fileService.writeNamedFile(DataManager.ALERTS_JSON_NAME, payload);
      if (!success) {
        throw new Error("Alerts write operation failed");
      }

      try {
        if (typeof this.fileService.notifyDataChange === "function") {
          this.fileService.notifyDataChange();
        }
      } catch (notifyError) {
        logger.warn('Failed to notify file storage change after saving alerts', {
          error: notifyError instanceof Error ? notifyError.message : 'Unknown error',
        });
      }

      return true;
    } catch (error) {
      this.reportStorageError("writeData", error, {
        fileName: DataManager.ALERTS_JSON_NAME,
      }, "We couldn’t save the alerts file. Try again after reconnecting.");
      return false;
    }
  }

  async mergeAlertsFromCsvContent(
    csvContent: string,
    options: { cases?: CaseDisplay[]; sourceFileName?: string } = {},
  ): Promise<MergeAlertsResult> {
    const cases = options.cases ?? (await this.getAllCases());

    const loadResult = await this.loadAlertsFromStore();
    const storedAlerts = loadResult.alerts ?? [];
    let shouldPersist = loadResult.needsMigration || loadResult.invalidJson;
    let sourceFileName = loadResult.sourceFile ?? DataManager.ALERTS_FILE_NAME;

    const requestedSourceFile = options.sourceFileName?.trim();
    if (requestedSourceFile && requestedSourceFile !== sourceFileName) {
      sourceFileName = requestedSourceFile;
      shouldPersist = true;
    } else if (requestedSourceFile) {
      sourceFileName = requestedSourceFile;
    }

    let workingAlerts = storedAlerts.length > 0
      ? this.rematchAlertsForCases(storedAlerts, cases)
      : [];
    const existingAlertCount = workingAlerts.length;
    const matchedExistingIndices = new Set<number>();

    const incomingIndex =
      csvContent && csvContent.trim().length > 0
        ? this.parseAlertsWithFallback(csvContent, cases)
        : createEmptyAlertsIndex();
    const incomingAlerts = incomingIndex.alerts;

    const existingMap = new Map<string, Set<number>>();
    const registerCandidateKey = (key: string, index: number) => {
      if (!key) {
        return;
      }

      if (!existingMap.has(key)) {
        existingMap.set(key, new Set());
      }

      existingMap.get(key)!.add(index);
    };

    const registerAlertCandidates = (alert: AlertWithMatch, index: number) => {
      this.buildAlertLookupCandidates(alert).forEach(candidate => {
        registerCandidateKey(candidate.key, index);
      });
    };

    workingAlerts.forEach((alert, index) => {
      registerAlertCandidates(alert, index);
    });

    const fallbackLockedIndices = new Set<number>();

    let added = 0;
    let updated = 0;

    incomingAlerts.forEach(incoming => {
      const candidates = this.buildAlertLookupCandidates(incoming);
      if (candidates.length === 0) {
        return;
      }

      const incomingStrongKeys = candidates.filter(candidate => !candidate.fallback).map(candidate => candidate.key);

      let matchedIndex: number | undefined;
      let matchedUsingFallback = false;

      for (const candidate of candidates) {
        const mappedSet = existingMap.get(candidate.key);
        if (!mappedSet || mappedSet.size === 0) {
          continue;
        }

        for (const index of mappedSet) {
          if (candidate.fallback && fallbackLockedIndices.has(index)) {
            continue;
          }

          const existingAlert = workingAlerts[index];
          if (!existingAlert) {
            continue;
          }

          if (candidate.fallback) {
            if (!this.shouldMatchUsingFallback(incoming, existingAlert, incomingStrongKeys)) {
              continue;
            }
            matchedIndex = index;
            matchedUsingFallback = true;
            break;
          }

          matchedIndex = index;
          matchedUsingFallback = false;
          break;
        }

        if (matchedIndex !== undefined) {
          break;
        }
      }

      if (matchedIndex === undefined) {
        const newIndex = workingAlerts.push(incoming) - 1;
        registerAlertCandidates(incoming, newIndex);
        added += 1;
        shouldPersist = true;
        return;
      }

      if (matchedIndex < existingAlertCount) {
        matchedExistingIndices.add(matchedIndex);
      }

      if (matchedUsingFallback) {
        fallbackLockedIndices.add(matchedIndex);
      }

      const existingAlert = workingAlerts[matchedIndex];
      const { alert: mergedAlert, changed } = this.mergeAlertDetails(existingAlert, incoming);
      const resultingAlert = changed ? mergedAlert : existingAlert;

      if (changed) {
        workingAlerts[matchedIndex] = mergedAlert;
        updated += 1;
        shouldPersist = true;
      }

      registerAlertCandidates(resultingAlert, matchedIndex);
    });

    if (loadResult.legacyWorkflows.length > 0 && workingAlerts.length > 0) {
      const applied = this.applyStoredAlertWorkflows(workingAlerts, loadResult.legacyWorkflows);
      workingAlerts = applied.alerts;
      if (applied.changed || applied.unmatchedIds.length > 0) {
        shouldPersist = true;
      }
    }

    if (existingAlertCount > 0) {
      const resolutionTimestamp = new Date().toISOString();

      for (let index = 0; index < existingAlertCount; index += 1) {
        if (matchedExistingIndices.has(index)) {
          continue;
        }

        const alert = workingAlerts[index];
        if (!alert) {
          continue;
        }

        const alreadyResolved = (alert.status ?? "new").toLowerCase() === "resolved";
        const hasResolution = alreadyResolved && alert.resolvedAt && String(alert.resolvedAt).trim().length > 0;

        if (alreadyResolved && hasResolution) {
          continue;
        }

        const resolvedAt = hasResolution ? alert.resolvedAt : resolutionTimestamp;
        const nextAlert: AlertWithMatch = {
          ...alert,
          status: "resolved",
          resolvedAt: resolvedAt ?? resolutionTimestamp,
          updatedAt: resolutionTimestamp,
        };

        if (!this.alertsAreEqual(alert, nextAlert) || alert.updatedAt !== nextAlert.updatedAt) {
          workingAlerts[index] = nextAlert;
          updated += 1;
          shouldPersist = true;
        }
      }
    }

    const rematchedAlerts = this.rematchAlertsForCases(workingAlerts, cases);
    const index = createAlertsIndexFromAlerts(rematchedAlerts);

    shouldPersist = shouldPersist || added > 0 || updated > 0;

    if (shouldPersist) {
      await this.saveAlerts(index.alerts, index.summary, { sourceFile: sourceFileName });
    }

    this.debugLogAlertsSample("alerts-merge", index.alerts);

    return {
      added,
      updated,
      total: index.alerts.length,
    };
  }

  // =============================================================================
  // PUBLIC API - CATEGORY CONFIGURATION
  // =============================================================================

  async getCategoryConfig(): Promise<CategoryConfig> {
    return this.categoryConfig.getCategoryConfig();
  }

  async updateCategoryConfig(categoryConfig: CategoryConfig): Promise<CategoryConfig> {
    return this.categoryConfig.updateCategoryConfig(categoryConfig);
  }

  async updateCategoryValues(key: CategoryKey, values: string[]): Promise<CategoryConfig> {
    return this.categoryConfig.updateCategoryValues(key, values);
  }

  async resetCategoryConfig(): Promise<CategoryConfig> {
    return this.categoryConfig.resetCategoryConfig();
  }

  // =============================================================================
  // PUBLIC API - WRITE OPERATIONS
  // =============================================================================

  /**
   * Create a new complete case
   * Delegates to CaseService
   */
  async createCompleteCase(caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<CaseDisplay> {
    return this.cases.createCompleteCase(caseData);
  }

  /**
   * Update an existing complete case
   * Delegates to CaseService
   */
  async updateCompleteCase(caseId: string, caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<CaseDisplay> {
    return this.cases.updateCompleteCase(caseId, caseData);
  }

  /**
   * Update case status
   * Delegates to CaseService
   */
  async updateCaseStatus(caseId: string, status: CaseDisplay["status"]): Promise<CaseDisplay> {
    return this.cases.updateCaseStatus(caseId, status);
  }

  /**
   * Delete a case
   * Delegates to CaseService
   */
  async deleteCase(caseId: string): Promise<void> {
    return this.cases.deleteCase(caseId);
  }

  // =============================================================================
  // FINANCIAL ITEM OPERATIONS
  // =============================================================================

  /**
   * Add financial item to a case
   * Delegates to FinancialsService
   */
  async addItem(caseId: string, category: CaseCategory, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<CaseDisplay> {
    return this.financials.addItem(caseId, category, itemData);
  }

  /**
   * Update financial item in a case
   * Delegates to FinancialsService
   */
  async updateItem(
    caseId: string,
    category: CaseCategory,
    itemId: string,
    updatedItem: Partial<FinancialItem>,
  ): Promise<CaseDisplay> {
    return this.financials.updateItem(caseId, category, itemId, updatedItem);
  }

  /**
   * Delete financial item from a case
   * Delegates to FinancialsService
   */
  async deleteItem(caseId: string, category: CaseCategory, itemId: string): Promise<CaseDisplay> {
    return this.financials.deleteItem(caseId, category, itemId);
  }

  // =============================================================================
  // NOTE OPERATIONS
  // =============================================================================

  /**
   * Add note to a case
   * Delegates to NotesService
   */
  async addNote(caseId: string, noteData: NewNoteData): Promise<CaseDisplay> {
    return this.notes.addNote(caseId, noteData);
  }

  /**
   * Update note in a case
   * Delegates to NotesService
   */
  async updateNote(caseId: string, noteId: string, noteData: NewNoteData): Promise<CaseDisplay> {
    return this.notes.updateNote(caseId, noteId, noteData);
  }

  /**
   * Delete note from a case
   * Delegates to NotesService
   */
  async deleteNote(caseId: string, noteId: string): Promise<CaseDisplay> {
    return this.notes.deleteNote(caseId, noteId);
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  /**
   * Import multiple cases at once
   * Delegates to CaseService
   */
  async importCases(cases: CaseDisplay[]): Promise<void> {
    return this.cases.importCases(cases);
  }

  /**
   * Clear all data
   * Delegates to CaseService
   */
  async clearAllData(): Promise<void> {
    let categoryConfig = mergeCategoryConfig();
    try {
      const currentData = await this.readFileData();
      if (currentData) {
        categoryConfig = mergeCategoryConfig(currentData.categoryConfig);
      }
    } catch (error) {
      logger.warn('Failed to read existing data before clearing; falling back to default category config', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return this.cases.clearAllData(categoryConfig);
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