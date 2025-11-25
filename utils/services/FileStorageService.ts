import type { CaseDisplay, FinancialItem, Note, CaseRecord, AlertRecord } from "../../types/case";
import type { CaseActivityEntry } from "../../types/activityLog";
import type { CategoryConfig } from "../../types/categoryConfig";
import { mergeCategoryConfig } from "../../types/categoryConfig";
import AutosaveFileService from "../AutosaveFileService";
import { transformImportedData } from "../dataTransform";
import { createLogger } from "../logger";
import { reportFileStorageError, type FileStorageOperation } from "../fileStorageErrorReporter";
import { STORAGE_CONSTANTS } from "../constants/storage";
import { hydrateStoredAlert, parseStoredAlertsPayload } from "../alerts/alertMigrationUtils";
import type { AlertWithMatch } from "../alertsData";

const logger = createLogger("FileStorageService");
const NORMALIZED_VERSION = "2.0";

// ============================================================================
// Type Definitions
// ============================================================================

export interface LegacyFileData {
  cases: CaseDisplay[];
  alerts?: AlertRecord[]; // Added for top-level alerts support
  exported_at: string;
  total_cases: number;
  categoryConfig: CategoryConfig;
  activityLog: CaseActivityEntry[];
}

export interface StoredCase extends Omit<CaseDisplay, "caseRecord" | "alerts"> {
  caseRecord: Omit<CaseRecord, "financials" | "notes">;
}

export interface StoredFinancialItem extends FinancialItem {
  caseId: string;
  category: "resources" | "income" | "expenses";
}

export interface StoredNote extends Note {
  caseId: string;
}

export interface NormalizedFileData {
  version: "2.0";
  cases: StoredCase[];
  financials: StoredFinancialItem[];
  notes: StoredNote[];
  alerts: AlertRecord[];
  exported_at: string;
  total_cases: number;
  categoryConfig: CategoryConfig;
  activityLog: CaseActivityEntry[];
}

export type FileData = LegacyFileData | NormalizedFileData;

export function isNormalizedFileData(data: any): data is NormalizedFileData {
  return data && typeof data === 'object' && 'version' in data && data.version === NORMALIZED_VERSION;
}

interface FileStorageServiceConfig {
  fileService: AutosaveFileService;
  persistNormalizationFixes?: boolean;
  normalizeCaseNotes?: (cases: CaseDisplay[]) => { cases: CaseDisplay[]; changed: boolean };
}

// ============================================================================
// FileStorageService
// ============================================================================

/**
 * FileStorageService
 * 
 * Handles all file I/O operations for case data.
 * Abstracts storage format and provides clean interface for reading/writing.
 * 
 * Responsibilities:
 * - Read/write NormalizedFileData to/from disk
 * - Handle format transformations (legacy → normalized v2.0)
 * - Normalize activity logs
 * - Validate data integrity before writes
 * - Error handling and reporting
 * 
 * Data Format (v2.0 Normalized):
 * - cases: StoredCase[] (flat, without nested financials/notes)
 * - financials: StoredFinancialItem[] (flat with caseId + category foreign keys)
 * - notes: StoredNote[] (flat with caseId foreign key)
 * - alerts: AlertRecord[] (flat)
 */
export class FileStorageService {
  private fileService: AutosaveFileService;
  private persistNormalizationFixes: boolean;
  private normalizeCaseNotes: (cases: CaseDisplay[]) => { cases: CaseDisplay[]; changed: boolean };
  private migrationChecked = false;

  constructor(config: FileStorageServiceConfig) {
    this.fileService = config.fileService;
    this.persistNormalizationFixes = config.persistNormalizationFixes ?? true;
    this.normalizeCaseNotes = config.normalizeCaseNotes ?? ((cases) => ({ cases, changed: false }));
  }

  /**
   * Read current data from file system in normalized v2.0 format
   * Returns NormalizedFileData directly - no denormalization
   */
  async readFileData(): Promise<NormalizedFileData | null> {
    try {
      let rawData = await this.fileService.readFile();

      if (!rawData) {
        // No file exists yet - return empty normalized structure
        return {
          version: NORMALIZED_VERSION as "2.0",
          cases: [],
          financials: [],
          notes: [],
          alerts: [],
          exported_at: new Date().toISOString(),
          total_cases: 0,
          categoryConfig: mergeCategoryConfig(),
          activityLog: [],
        };
      }

      // --- MIGRATION START ---
      // Check for legacy alerts.json and migrate if needed
      const migrationResult = await this.migrateLegacyAlerts(rawData);
      if (migrationResult.migrated) {
        rawData = migrationResult.data;
        // Persist the migration immediately
        await this.writeNormalizedData(rawData);
        logger.info("Legacy alerts migration completed and persisted");
      }
      // --- MIGRATION END ---

      // Already in normalized format (v2.0) - return directly
      if (isNormalizedFileData(rawData)) {
        logger.debug("Detected normalized data format (v2.0)");
        return rawData;
      }

      // Handle legacy formats - convert to normalized
      logger.info("Converting legacy data format to normalized v2.0");
      let cases: CaseDisplay[] = [];

      if (rawData.cases && Array.isArray(rawData.cases)) {
        // Already in CaseDisplay array format - use directly
        cases = rawData.cases;
      } else if (rawData.people && rawData.caseRecords) {
        // Raw format - transform using the data transformer
        logger.info("Transforming raw data format to cases");
        cases = transformImportedData(rawData);
      } else {
        // Try to transform whatever format this is
        cases = transformImportedData(rawData);
      }

      const categoryConfig = mergeCategoryConfig(rawData.categoryConfig);
      const activityLog = this.normalizeActivityLog((rawData as { activityLog?: unknown })?.activityLog);

      const { cases: normalizedCases, changed } = this.normalizeCaseNotes(cases);

      const finalExportedAt = rawData.exported_at || rawData.exportedAt || new Date().toISOString();

      // Extract alerts from cases if not present at top level (Legacy support)
      let finalAlerts: AlertRecord[] = rawData.alerts ?? [];
      if (finalAlerts.length === 0 && normalizedCases.length > 0) {
        normalizedCases.forEach(c => {
          if (c.alerts && Array.isArray(c.alerts)) {
            finalAlerts.push(...c.alerts);
          }
        });
      }

      // Build legacy data for normalization
      const legacyData: LegacyFileData = {
        cases: normalizedCases,
        alerts: finalAlerts,
        exported_at: finalExportedAt,
        total_cases: normalizedCases.length,
        categoryConfig,
        activityLog,
      };

      // Convert to normalized format
      const normalizedData = this.normalizeForStorage(legacyData);

      // Persist if notes were normalized or if converting from legacy format
      if ((changed && this.persistNormalizationFixes) || !isNormalizedFileData(rawData)) {
        await this.writeNormalizedData(normalizedData);
        logger.info("Legacy data migrated to normalized v2.0 format");
      }

      return normalizedData;
    } catch (error) {
      logger.error("Failed to read file data", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      this.reportStorageError("readData", error, { method: "readFileData" });
      throw new Error(`Failed to read case data: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * @deprecated Use writeNormalizedData() instead
   * Legacy method for backward compatibility during migration
   */
  async readFileDataLegacy(): Promise<LegacyFileData | null> {
    const normalized = await this.readFileData();
    if (!normalized) return null;
    return this.denormalizeForRuntime(normalized);
  }

  /**
   * Write normalized data to file system
   * This is the primary write method - accepts NormalizedFileData directly
   */
  async writeNormalizedData(data: NormalizedFileData): Promise<NormalizedFileData> {
    try {
      // Validate and clean data before writing
      const finalData: NormalizedFileData = {
        version: NORMALIZED_VERSION as "2.0",
        cases: data.cases.map(c => ({ ...c })),
        financials: data.financials.map(f => ({ ...f })),
        notes: data.notes.map(n => ({ ...n })),
        alerts: data.alerts.map(a => ({ ...a })),
        exported_at: new Date().toISOString(),
        total_cases: data.cases.length,
        categoryConfig: mergeCategoryConfig(data.categoryConfig),
        activityLog: [...(data.activityLog ?? [])]
          .map((entry): CaseActivityEntry =>
            entry.type === "status-change"
              ? { ...entry, payload: { ...entry.payload } }
              : { ...entry, payload: { ...entry.payload } }
          )
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      };

      const success = await this.fileService.writeFile(finalData);

      if (!success) {
        throw new Error("File write operation failed");
      }

      // Notify listeners that data has changed
      this.fileService.broadcastDataUpdate(finalData);

      return finalData;
    } catch (error) {
      logger.error("Failed to write normalized data", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        if (
          error.message.includes("state cached in an interface object") ||
          error.message.includes("state had changed")
        ) {
          errorMessage = "File was modified by another process. Please try again.";
        } else if (error.message.includes("permission")) {
          errorMessage = "Permission denied. Please check file permissions.";
        } else {
          errorMessage = error.message;
        }
      }

      this.reportStorageError("writeData", error, {
        method: "writeNormalizedData",
        errorMessage,
      });

      throw new Error(`Failed to save case data: ${errorMessage}`);
    }
  }

  /**
   * @deprecated Use writeNormalizedData() instead
   * Write data to file system - accepts LegacyFileData and converts to normalized
   */
  async writeFileData(data: FileData): Promise<LegacyFileData> {
    try {
      // If the input 'data' is NormalizedFileData, convert to legacy for return
      let legacyData: LegacyFileData;
      let normalizedData: NormalizedFileData;

      if (isNormalizedFileData(data)) {
        normalizedData = data;
        legacyData = this.denormalizeForRuntime(data);
      } else {
        legacyData = data as LegacyFileData;
        normalizedData = this.normalizeForStorage(legacyData);
      }

      await this.writeNormalizedData(normalizedData);

      return legacyData;
    } catch (error) {
      logger.error("Failed to write file data", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Provide specific error messaging based on error type
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        if (
          error.message.includes("state cached in an interface object") ||
          error.message.includes("state had changed")
        ) {
          errorMessage = "File was modified by another process. Please try again.";
        } else if (error.message.includes("permission")) {
          errorMessage = "Permission denied. Please check file permissions.";
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

  /**
   * Update case timestamps for modified cases
   */
  touchCaseTimestamps(cases: StoredCase[], touchedCaseIds?: Iterable<string>): StoredCase[] {
    if (!touchedCaseIds) {
      return cases;
    }

    const ids = touchedCaseIds instanceof Set ? touchedCaseIds : new Set(touchedCaseIds);
    if (ids.size === 0) {
      return cases;
    }

    const timestamp = new Date().toISOString();

    return cases.map((caseItem) => (ids.has(caseItem.id) ? { ...caseItem, updatedAt: timestamp } : caseItem));
  }

  // ==========================================================================
  // Normalized Data Access Helpers
  // ==========================================================================

  /**
   * Get all financial items for a specific case
   */
  getFinancialsForCase(data: NormalizedFileData, caseId: string): StoredFinancialItem[] {
    return data.financials.filter(f => f.caseId === caseId);
  }

  /**
   * Get financial items for a case grouped by category
   */
  getFinancialsForCaseGrouped(data: NormalizedFileData, caseId: string): {
    resources: StoredFinancialItem[];
    income: StoredFinancialItem[];
    expenses: StoredFinancialItem[];
  } {
    const items = this.getFinancialsForCase(data, caseId);
    return {
      resources: items.filter(f => f.category === 'resources'),
      income: items.filter(f => f.category === 'income'),
      expenses: items.filter(f => f.category === 'expenses'),
    };
  }

  /**
   * Get all notes for a specific case
   */
  getNotesForCase(data: NormalizedFileData, caseId: string): StoredNote[] {
    return data.notes.filter(n => n.caseId === caseId);
  }

  /**
   * Get all alerts for a specific case (by MCN)
   */
  getAlertsForCase(data: NormalizedFileData, mcn: string): AlertRecord[] {
    return data.alerts.filter(a => a.mcNumber === mcn);
  }

  /**
   * Get a specific case by ID
   */
  getCaseById(data: NormalizedFileData, caseId: string): StoredCase | undefined {
    return data.cases.find(c => c.id === caseId);
  }

  // ==========================================================================
  // Legacy Support - Denormalization (for backward compatibility)
  // ==========================================================================

  /**
   * Convert normalized data to legacy nested format
   * Use this only when interfacing with components not yet migrated
   */
  denormalizeForRuntime(data: NormalizedFileData): LegacyFileData {
    // Create lookup maps for O(1) access
    const financialsByCaseId = new Map<string, { resources: FinancialItem[], income: FinancialItem[], expenses: FinancialItem[] }>();
    const notesByCaseId = new Map<string, Note[]>();
    const alertsByMcn = new Map<string, AlertRecord[]>();

    // Group financials
    for (const item of data.financials) {
      const { caseId, category, ...financial } = item;
      if (!financialsByCaseId.has(caseId)) {
        financialsByCaseId.set(caseId, { resources: [], income: [], expenses: [] });
      }
      const group = financialsByCaseId.get(caseId)!;
      if (category === 'resources' || category === 'income' || category === 'expenses') {
        group[category].push(financial);
      }
    }

    // Group notes
    for (const item of data.notes) {
      const { caseId, ...note } = item;
      if (!notesByCaseId.has(caseId)) {
        notesByCaseId.set(caseId, []);
      }
      notesByCaseId.get(caseId)!.push(note);
    }

    // Group alerts (normalize MCN for matching)
    for (const alert of data.alerts) {
      const mcn = alert.mcNumber;
      if (mcn) {
        if (!alertsByMcn.has(mcn)) {
          alertsByMcn.set(mcn, []);
        }
        alertsByMcn.get(mcn)!.push(alert);
      }
    }

    const cases: CaseDisplay[] = data.cases.map(storedCase => {
      const financials = financialsByCaseId.get(storedCase.id) ?? { resources: [], income: [], expenses: [] };
      const notes = notesByCaseId.get(storedCase.id) ?? [];
      const alerts = alertsByMcn.get(storedCase.mcn) ?? [];

      return {
        ...storedCase,
        alerts,
        caseRecord: {
          ...storedCase.caseRecord,
          financials,
          notes
        }
      };
    });

    return {
      cases,
      alerts: data.alerts,
      exported_at: data.exported_at,
      total_cases: data.total_cases,
      categoryConfig: data.categoryConfig,
      activityLog: data.activityLog
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Convert legacy nested format to normalized storage format
   */
  private normalizeForStorage(data: LegacyFileData): NormalizedFileData {
    const cases: StoredCase[] = [];
    const financials: StoredFinancialItem[] = [];
    const notes: StoredNote[] = [];
    const alerts: AlertRecord[] = data.alerts ? [...data.alerts] : [];
    const extractedAlerts: AlertRecord[] = [];

    for (const caseItem of data.cases) {
      // Extract financials
      if (caseItem.caseRecord.financials) {
        const { resources, income, expenses } = caseItem.caseRecord.financials;
        
        if (resources) {
          resources.forEach(item => {
            financials.push({ ...item, caseId: caseItem.id, category: "resources" });
          });
        }
        
        if (income) {
          income.forEach(item => {
            financials.push({ ...item, caseId: caseItem.id, category: "income" });
          });
        }
        
        if (expenses) {
          expenses.forEach(item => {
            financials.push({ ...item, caseId: caseItem.id, category: "expenses" });
          });
        }
      }

      // Extract notes
      if (caseItem.caseRecord.notes) {
        caseItem.caseRecord.notes.forEach(note => {
          notes.push({ ...note, caseId: caseItem.id });
        });
      }

      // Extract alerts (only if top-level alerts not provided)
      if (!data.alerts && caseItem.alerts) {
        extractedAlerts.push(...caseItem.alerts);
      }

      // Create stored case (without nested data)
      const { financials: _, notes: __, ...caseRecordWithoutNested } = caseItem.caseRecord;
      const { alerts: ___, ...caseWithoutAlerts } = caseItem;

      cases.push({
        ...caseWithoutAlerts,
        caseRecord: caseRecordWithoutNested
      });
    }

    return {
      version: NORMALIZED_VERSION as "2.0",
      cases,
      financials,
      notes,
      alerts: data.alerts ? alerts : extractedAlerts,
      exported_at: data.exported_at,
      total_cases: cases.length,
      categoryConfig: data.categoryConfig,
      activityLog: data.activityLog
    };
  }

  private normalizeActivityLog(rawActivityLog: unknown): CaseActivityEntry[] {
    if (!Array.isArray(rawActivityLog)) {
      return [];
    }

    const normalized: CaseActivityEntry[] = [];

    for (const candidate of rawActivityLog) {
      if (!candidate || typeof candidate !== "object") {
        continue;
      }

      const base = candidate as Partial<CaseActivityEntry> & { payload?: unknown };
      if (
        typeof base.id !== "string" ||
        typeof base.timestamp !== "string" ||
        typeof base.caseId !== "string" ||
        typeof base.caseName !== "string" ||
        typeof base.type !== "string"
      ) {
        continue;
      }

      const parsedTimestamp = new Date(base.timestamp);
      if (Number.isNaN(parsedTimestamp.getTime())) {
        continue;
      }
      const normalizedTimestamp = parsedTimestamp.toISOString();

      if (base.type === "status-change") {
        const payload = base.payload as CaseActivityEntry["payload"] | undefined;
        if (!payload || typeof payload !== "object") {
          continue;
        }

        const fromStatus = (payload as any).fromStatus;
        const toStatus = (payload as any).toStatus;

        if (typeof toStatus !== "string") {
          continue;
        }

        normalized.push({
          id: base.id,
          timestamp: normalizedTimestamp,
          caseId: base.caseId,
          caseName: base.caseName,
          caseMcn: base.caseMcn ?? null,
          type: "status-change",
          payload: {
            fromStatus: typeof fromStatus === "string" || fromStatus === null ? fromStatus ?? null : undefined,
            toStatus,
          },
        });
        continue;
      }

      if (base.type === "note-added") {
        const payload = base.payload as CaseActivityEntry["payload"] | undefined;
        if (!payload || typeof payload !== "object") {
          continue;
        }

        const noteId = (payload as any).noteId;
        const category = (payload as any).category;
        const preview = (payload as any).preview;

        if (typeof noteId !== "string" || typeof category !== "string" || typeof preview !== "string") {
          continue;
        }

        normalized.push({
          id: base.id,
          timestamp: normalizedTimestamp,
          caseId: base.caseId,
          caseName: base.caseName,
          caseMcn: base.caseMcn ?? null,
          type: "note-added",
          payload: {
            noteId,
            category,
            preview,
          },
        });
      }
    }

    return normalized.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private reportStorageError(operation: FileStorageOperation, error: unknown, context?: Record<string, unknown>) {
    reportFileStorageError({
      operation,
      error,
      source: "FileStorageService",
      context,
    });
  }

  private async migrateLegacyAlerts(rawData: any): Promise<{ data: any; migrated: boolean }> {
    if (this.migrationChecked) {
      return { data: rawData, migrated: false };
    }

    try {
      const alertsContent = await this.fileService.readNamedFile(STORAGE_CONSTANTS.ALERTS.FILE_NAME);
      
      if (!alertsContent || typeof alertsContent !== 'object') {
        // File doesn't exist or is invalid - mark checked so we don't keep trying
        this.migrationChecked = true;
        return { data: rawData, migrated: false };
      }

      // Check for tombstone
      if (alertsContent.migrated === true) {
        this.migrationChecked = true;
        return { data: rawData, migrated: false };
      }

      logger.info("Found legacy alerts.json, starting migration...");

      // Parse alerts
      let alertsToMerge: AlertRecord[] = [];
      const version = typeof alertsContent.version === 'number' ? alertsContent.version : 1;

      if (version >= 2 && Array.isArray(alertsContent.alerts)) {
        // V2+ format
        alertsToMerge = (alertsContent.alerts as unknown[])
          .map(entry => hydrateStoredAlert(entry))
          .filter((alert): alert is AlertWithMatch => alert !== null);
      } else {
        // V1 format - extract workflows
        const { workflows } = parseStoredAlertsPayload(alertsContent);
        
        if (workflows.length > 0) {
           const msg = "V1 alerts.json detected with workflow states. Automatic migration is not supported. To avoid data loss, please follow manual migration instructions.";
           logger.warn(msg);
           throw new Error(msg);
        }
      }

      if (alertsToMerge.length === 0) {
        return { data: rawData, migrated: false };
      }

      // Merge into rawData
      const newData = { ...rawData };
      let mergedCount = 0;

      // Check if rawData is Normalized (v2.0)
      if (isNormalizedFileData(newData) && Array.isArray(newData.alerts)) {
        // Merge into root alerts array
        // Create a map of existing alerts by ID
        const existingAlertsMap = new Map<string, AlertRecord>();
        newData.alerts.forEach((a: AlertRecord) => existingAlertsMap.set(a.id, a));

        alertsToMerge.forEach(alert => {
          // Overwrite or add
          existingAlertsMap.set(alert.id, alert);
        });

        newData.alerts = Array.from(existingAlertsMap.values());
        mergedCount = alertsToMerge.length;
      } 
      // Check if rawData is Legacy (cases array)
      else if (Array.isArray(newData.cases)) {
        // Distribute alerts to cases
        const alertsByCaseId = new Map<string, AlertRecord[]>();
        const alertsByMcn = new Map<string, AlertRecord[]>();

        alertsToMerge.forEach(alert => {
          if ((alert as any).matchedCaseId) {
            const cid = (alert as any).matchedCaseId;
            if (!alertsByCaseId.has(cid)) alertsByCaseId.set(cid, []);
            alertsByCaseId.get(cid)!.push(alert);
          } else if (alert.mcNumber) {
             if (!alertsByMcn.has(alert.mcNumber)) alertsByMcn.set(alert.mcNumber, []);
             alertsByMcn.get(alert.mcNumber)!.push(alert);
          }
        });

        newData.cases = newData.cases.map((c: any) => {
          const caseAlerts = [...(c.alerts || [])];
          const updates = [
            ...(alertsByCaseId.get(c.id) || []),
            ...(c.caseRecord?.mcn ? alertsByMcn.get(c.caseRecord.mcn) || [] : [])
          ];

          // Merge updates into caseAlerts
          updates.forEach(update => {
            const idx = caseAlerts.findIndex((ca: any) => ca.id === update.id);
            if (idx >= 0) {
              caseAlerts[idx] = update;
            } else {
              caseAlerts.push(update);
            }
          });

          return { ...c, alerts: caseAlerts };
        });
        mergedCount = alertsToMerge.length;
      }

      if (mergedCount > 0) {
        // Write tombstone
        await this.fileService.writeNamedFile(STORAGE_CONSTANTS.ALERTS.FILE_NAME, {
          migrated: true,
          migratedAt: new Date().toISOString(),
          originalVersion: version
        });
        
        this.migrationChecked = true;
        logger.info(`Migrated ${mergedCount} alerts from alerts.json to data.json`);
        return { data: newData, migrated: true };
      }

      // No alerts to merge, but file exists and isn't migrated? 
      // Mark checked to avoid repeated reads if we decided not to migrate
      this.migrationChecked = true;
      return { data: rawData, migrated: false };

    } catch (error) {
      logger.error("Error during alerts migration", { error });
      return { data: rawData, migrated: false };
    }
  }
}
