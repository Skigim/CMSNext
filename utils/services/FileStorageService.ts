import type { CaseDisplay, FinancialItem, Note, CaseRecord, AlertRecord } from "../../types/case";
import type { CaseActivityEntry } from "../../types/activityLog";
import type { CategoryConfig } from "../../types/categoryConfig";
import { mergeCategoryConfig } from "../../types/categoryConfig";
import AutosaveFileService from "../AutosaveFileService";
import { transformImportedData } from "../dataTransform";
import { createLogger } from "../logger";
import { reportFileStorageError, type FileStorageOperation } from "../fileStorageErrorReporter";

const logger = createLogger("FileStorageService");

// ============================================================================
// Type Definitions
// ============================================================================

export interface LegacyFileData {
  cases: CaseDisplay[];
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
 * - Read/write FileData to/from disk
 * - Handle format transformations (raw → CaseDisplay)
 * - Normalize activity logs
 * - Validate data integrity before writes
 * - Error handling and reporting
 */
export class FileStorageService {
  private fileService: AutosaveFileService;
  private persistNormalizationFixes: boolean;
  private normalizeCaseNotes: (cases: CaseDisplay[]) => { cases: CaseDisplay[]; changed: boolean };

  constructor(config: FileStorageServiceConfig) {
    this.fileService = config.fileService;
    this.persistNormalizationFixes = config.persistNormalizationFixes ?? true;
    this.normalizeCaseNotes = config.normalizeCaseNotes ?? ((cases) => ({ cases, changed: false }));
  }

  /**
   * Read current data from file system
   * Returns null if no file exists or error occurs
   */
  async readFileData(): Promise<LegacyFileData | null> {
    try {
      const rawData = await this.fileService.readFile();

      if (!rawData) {
        // No file exists yet - return empty structure
        return {
          cases: [],
          exported_at: new Date().toISOString(),
          total_cases: 0,
          categoryConfig: mergeCategoryConfig(),
          activityLog: [],
        };
      }

      // Handle different data formats
      let cases: CaseDisplay[] = [];

      // Check for normalized format (v2.0)
      if ((rawData as any).version === "2.0") {
        logger.info("Detected normalized data format (v2.0)");
        const legacyData = this.denormalizeForRuntime(rawData as NormalizedFileData);
        cases = legacyData.cases;
        // Use other properties from legacyData if needed, but mainly we need cases for now
        // Note: We'll reconstruct the full object structure at the end
      } else if (rawData.cases && Array.isArray(rawData.cases)) {
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

      let finalCases = normalizedCases;
      let finalExportedAt = rawData.exported_at || rawData.exportedAt || new Date().toISOString();

      // Persist if notes were normalized
      if (changed && this.persistNormalizationFixes) {
        const persistedData = await this.writeFileData({
          cases: normalizedCases,
          exported_at: finalExportedAt,
          total_cases: normalizedCases.length,
          categoryConfig,
          activityLog,
        });

        // persistedData is now guaranteed to be LegacyFileData by the updated signature
        finalCases = persistedData.cases;
        finalExportedAt = persistedData.exported_at;
      } else if (changed) {
        logger.warn("Note normalization needed but persistence disabled");
      }

      return {
        cases: finalCases,
        exported_at: finalExportedAt,
        total_cases: finalCases.length,
        categoryConfig,
        activityLog,
      };
    } catch (error) {
      logger.error("Failed to read file data", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      this.reportStorageError("readData", error, { method: "readFileData" });
      throw new Error(`Failed to read case data: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Write data to file system with retry logic
   * Throws error if write fails after retries
   */
  async writeFileData(data: LegacyFileData): Promise<LegacyFileData> {
    try {
      // Ensure data integrity before writing
      
      // If the input 'data' is NormalizedFileData, we first need to denormalize it to process it 
      // (because the logic above assumes data.cases is CaseDisplay[]).
      let legacyData: LegacyFileData;
      if ('version' in data && (data as any).version === "2.0") {
          legacyData = this.denormalizeForRuntime(data as unknown as NormalizedFileData);
      } else {
          legacyData = data as LegacyFileData;
      }

      // Re-construct validated data using legacyData
      const finalData: LegacyFileData = {
        cases: legacyData.cases.map((caseItem) => ({ ...caseItem })),
        exported_at: new Date().toISOString(),
        total_cases: legacyData.cases.length,
        categoryConfig: mergeCategoryConfig(legacyData.categoryConfig),
        activityLog: [...(legacyData.activityLog ?? [])]
          .map(
            (entry): CaseActivityEntry =>
              entry.type === "status-change"
                ? {
                    ...entry,
                    payload: { ...entry.payload },
                  }
                : {
                    ...entry,
                    payload: { ...entry.payload },
                  },
          )
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      };

      // Normalize before writing to storage (Phase B3)
      const normalizedData = this.normalizeForStorage(finalData);
      const success = await this.fileService.writeFile(normalizedData);

      if (!success) {
        throw new Error("File write operation failed");
      }

      return finalData;
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
  touchCaseTimestamps(cases: CaseDisplay[], touchedCaseIds?: Iterable<string>): CaseDisplay[] {
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
  // Private Helpers
  // ==========================================================================

  private normalizeForStorage(data: LegacyFileData): NormalizedFileData {
    const cases: StoredCase[] = [];
    const financials: StoredFinancialItem[] = [];
    const notes: StoredNote[] = [];
    const alerts: AlertRecord[] = [];

    for (const caseItem of data.cases) {
      // Extract financials
      if (caseItem.caseRecord.financials) {
        const { resources, income, expenses } = caseItem.caseRecord.financials;
        
        resources.forEach(item => {
          financials.push({ ...item, caseId: caseItem.id, category: "resources" });
        });
        
        income.forEach(item => {
          financials.push({ ...item, caseId: caseItem.id, category: "income" });
        });
        
        expenses.forEach(item => {
          financials.push({ ...item, caseId: caseItem.id, category: "expenses" });
        });
      }

      // Extract notes
      if (caseItem.caseRecord.notes) {
        caseItem.caseRecord.notes.forEach(note => {
          notes.push({ ...note, caseId: caseItem.id });
        });
      }

      // Extract alerts
      if (caseItem.alerts) {
        alerts.push(...caseItem.alerts);
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
      version: "2.0",
      cases,
      financials,
      notes,
      alerts,
      exported_at: data.exported_at,
      total_cases: cases.length,
      categoryConfig: data.categoryConfig,
      activityLog: data.activityLog
    };
  }

  private denormalizeForRuntime(data: NormalizedFileData): LegacyFileData {
    const cases: CaseDisplay[] = data.cases.map(storedCase => {
      const caseFinancials = data.financials.filter(f => f.caseId === storedCase.id);
      const caseNotes = data.notes.filter(n => n.caseId === storedCase.id);
      const caseAlerts = data.alerts.filter(a => a.mcNumber === storedCase.mcn); // Match alerts by MCN

      return {
        ...storedCase,
        alerts: caseAlerts,
        caseRecord: {
          ...storedCase.caseRecord,
          financials: {
            resources: caseFinancials.filter(f => f.category === "resources"),
            income: caseFinancials.filter(f => f.category === "income"),
            expenses: caseFinancials.filter(f => f.category === "expenses")
          },
          notes: caseNotes
        }
      };
    });

    return {
      cases,
      exported_at: data.exported_at,
      total_cases: data.total_cases,
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
}
