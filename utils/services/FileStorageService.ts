import type { AlertRecord, StoredCase, StoredFinancialItem, StoredNote } from "../../types/case";
import type { CaseActivityEntry } from "../../types/activityLog";
import type { CategoryConfig } from "../../types/categoryConfig";
import { mergeCategoryConfig } from "../../types/categoryConfig";
import { discoverStatusesFromCases } from "../categoryConfigMigration";
import AutosaveFileService from "../AutosaveFileService";
import { createLogger } from "../logger";
import { reportFileStorageError, type FileStorageOperation } from "../fileStorageErrorReporter";

const logger = createLogger("FileStorageService");
const NORMALIZED_VERSION = "2.0";

// ============================================================================
// Type Definitions
// ============================================================================

// Re-export types from types/case.ts for convenience
export type { StoredCase, StoredFinancialItem, StoredNote };

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

export function isNormalizedFileData(data: unknown): data is NormalizedFileData {
  return (
    data !== null &&
    typeof data === "object" &&
    "version" in data &&
    (data as { version: unknown }).version === NORMALIZED_VERSION
  );
}

/**
 * Error thrown when attempting to load a legacy (pre-v2.0) data file
 */
export class LegacyFormatError extends Error {
  constructor(detectedFormat: string) {
    super(
      `This data file uses a legacy format (${detectedFormat}) that is no longer supported. ` +
        `Please contact support for assistance migrating your data to the current format (v${NORMALIZED_VERSION}).`
    );
    this.name = "LegacyFormatError";
  }
}

interface FileStorageServiceConfig {
  fileService: AutosaveFileService;
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

  constructor(config: FileStorageServiceConfig) {
    this.fileService = config.fileService;
  }

  /**
   * Read current data from file system in normalized v2.0 format
   * Returns NormalizedFileData directly
   *
   * @throws {LegacyFormatError} if file contains legacy format data
   */
  async readFileData(): Promise<NormalizedFileData | null> {
    try {
      const rawData = await this.fileService.readFile();

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

      // Validate format - only v2.0 is supported
      if (isNormalizedFileData(rawData)) {
        logger.debug("Detected normalized data format (v2.0)");
        return rawData;
      }

      // Detect legacy format and throw user-friendly error
      const detectedFormat = this.detectLegacyFormat(rawData);
      logger.error("Legacy data format detected", { detectedFormat });
      throw new LegacyFormatError(detectedFormat);
    } catch (error) {
      // Re-throw LegacyFormatError as-is
      if (error instanceof LegacyFormatError) {
        throw error;
      }

      logger.error("Failed to read file data", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      this.reportStorageError("readData", error, { method: "readFileData" });
      throw new Error(
        `Failed to read case data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Detect which legacy format the data is in (for error messaging)
   */
  private detectLegacyFormat(data: unknown): string {
    if (!data || typeof data !== "object") {
      return "unknown";
    }

    const obj = data as Record<string, unknown>;

    // Check for Nightingale raw format
    if (Array.isArray(obj.people) && Array.isArray(obj.caseRecords)) {
      return "Nightingale raw export";
    }

    // Check for legacy CaseDisplay format (v1.x)
    if (Array.isArray(obj.cases) && !("version" in obj)) {
      const firstCase = obj.cases[0] as Record<string, unknown> | undefined;
      if (firstCase?.caseRecord && typeof firstCase.caseRecord === "object") {
        const caseRecord = firstCase.caseRecord as Record<string, unknown>;
        if ("financials" in caseRecord || "notes" in caseRecord) {
          return "v1.x nested format";
        }
      }
      return "v1.x format";
    }

    // Check for old version numbers
    if ("version" in obj && obj.version !== NORMALIZED_VERSION) {
      return `v${obj.version}`;
    }

    return "unknown legacy format";
  }

  /**
   * Write normalized data to file system
   * This is the primary write method - accepts NormalizedFileData directly
   * 
   * Includes rollback mechanism: if write fails, broadcasts the previous
   * file state to keep UI in sync with actual persisted data.
   */
  async writeNormalizedData(data: NormalizedFileData): Promise<NormalizedFileData> {
    // Capture previous state for potential rollback
    let previousData: NormalizedFileData | null = null;
    try {
      previousData = await this.fileService.readFile();
    } catch {
      // If we can't read previous state, rollback won't be possible
      // but we should still attempt the write
      logger.warn("Could not capture previous state for rollback");
    }

    try {
      // Merge category config and discover any statuses used in cases
      const mergedConfig = mergeCategoryConfig(data.categoryConfig);
      const enrichedStatuses = discoverStatusesFromCases(mergedConfig.caseStatuses, data.cases);
      const categoryConfig: CategoryConfig = {
        ...mergedConfig,
        caseStatuses: enrichedStatuses,
      };

      // Validate and clean data before writing
      const finalData: NormalizedFileData = {
        version: NORMALIZED_VERSION as "2.0",
        cases: data.cases.map(c => ({ ...c })),
        financials: data.financials.map(f => ({ ...f })),
        notes: data.notes.map(n => ({ ...n })),
        alerts: data.alerts.map(a => ({ ...a })),
        exported_at: new Date().toISOString(),
        total_cases: data.cases.length,
        categoryConfig,
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
      // ROLLBACK: If write failed, broadcast previous data to resync UI with file state
      if (previousData && isNormalizedFileData(previousData)) {
        logger.warn("Write failed, broadcasting previous state to resync UI");
        this.fileService.broadcastDataUpdate(previousData);
      }
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
  // Private Helpers
  // ==========================================================================

  private reportStorageError(operation: FileStorageOperation, error: unknown, context?: Record<string, unknown>) {
    reportFileStorageError({
      operation,
      error,
      source: "FileStorageService",
      context,
    });
  }
}
