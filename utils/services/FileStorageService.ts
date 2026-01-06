import type { AlertRecord, StoredCase, StoredFinancialItem, StoredNote } from "../../types/case";
import type { CaseActivityEntry } from "../../types/activityLog";
import type { CategoryConfig } from "../../types/categoryConfig";
import type { Template } from "../../types/template";
import { mergeCategoryConfig } from "../../types/categoryConfig";
import { discoverStatusesFromCases, discoverAlertTypesFromAlerts } from "../categoryConfigMigration";
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

/**
 * Normalized file data format (v2.0).
 * 
 * This is the current data format used for all file operations.
 * It uses a normalized structure with flat arrays and foreign key references
 * instead of nested objects.
 * 
 * @interface NormalizedFileData
 */
export interface NormalizedFileData {
  /** Data format version (always "2.0") */
  version: "2.0";
  /** Flat array of cases without nested relations */
  cases: StoredCase[];
  /** Flat array of financial items with caseId foreign keys */
  financials: StoredFinancialItem[];
  /** Flat array of notes with caseId foreign keys */
  notes: StoredNote[];
  /** Flat array of alert records */
  alerts: AlertRecord[];
  /** ISO timestamp of when data was last exported/saved */
  exported_at: string;
  /** Total number of cases (for validation) */
  total_cases: number;
  /** Category configuration (statuses, categories, alert types) */
  categoryConfig: CategoryConfig;
  /** Activity log entries sorted by timestamp */
  activityLog: CaseActivityEntry[];
  /** Unified templates (VR, Summary, Narrative) */
  templates?: Template[];
}

/**
 * Type guard to check if data matches the normalized v2.0 format.
 * 
 * @param {unknown} data - Data to check
 * @returns {boolean} true if data is NormalizedFileData
 */
export function isNormalizedFileData(data: unknown): data is NormalizedFileData {
  return (
    data !== null &&
    typeof data === "object" &&
    "version" in data &&
    (data as { version: unknown }).version === NORMALIZED_VERSION
  );
}

/**
 * Error thrown when attempting to load a legacy (pre-v2.0) data file.
 * 
 * This error is thrown when the file format is detected as a legacy version
 * that is no longer supported. It provides a user-friendly message instructing
 * users to contact support for migration assistance.
 * 
 * @class LegacyFormatError
 * @extends Error
 */
export class LegacyFormatError extends Error {
  /**
   * Create a new LegacyFormatError.
   * 
   * @param {string} detectedFormat - The detected legacy format version
   */
  constructor(detectedFormat: string) {
    super(
      `This data file uses a legacy format (${detectedFormat}) that is no longer supported. ` +
        `Please contact support for assistance migrating your data to the current format (v${NORMALIZED_VERSION}).`
    );
    this.name = "LegacyFormatError";
  }
}

/**
 * Configuration for FileStorageService initialization.
 * @interface FileStorageServiceConfig
 */
interface FileStorageServiceConfig {
  /** The file service instance that handles actual file I/O */
  fileService: AutosaveFileService;
}

// ============================================================================
// FileStorageService
// ============================================================================

/**
 * FileStorageService - Low-level file I/O and format management
 * 
 * This service handles all file system operations for case data, providing
 * a clean abstraction over the File System Access API via AutosaveFileService.
 * 
 * ## Architecture Layer
 * 
 * ```
 * DataManager (orchestrator)
 *     ↓
 * FileStorageService (format & validation)
 *     ↓
 * AutosaveFileService (file I/O & autosave)
 *     ↓
 * File System Access API (browser native)
 * ```
 * 
 * ## Core Responsibilities
 * 
 * ### Data Format Management
 * - **Version Control**: Enforces v2.0 normalized format
 * - **Legacy Detection**: Identifies and rejects pre-v2.0 formats
 * - **Format Validation**: Ensures data integrity before writes
 * - **Auto-enrichment**: Discovers statuses and alert types from data
 * 
 * ### Read Operations
 * - Returns NormalizedFileData or creates empty structure
 * - Validates format version
 * - Provides raw data access for migration utilities
 * - Handles missing files gracefully
 * 
 * ### Write Operations
 * - Enriches category config with discovered values
 * - Normalizes activity log (sorts by timestamp)
 * - Validates data before writing
 * - Implements rollback on write failure
 * - Broadcasts data changes to listeners
 * 
 * ### Helper Methods
 * - Query operations (get case by ID, get financials for case, etc.)
 * - Timestamp updates for modified cases
 * - Data access helpers for normalized format
 * 
 * ## Data Format (v2.0 Normalized)
 * 
 * The service enforces a normalized data structure:
 * 
 * ```typescript
 * {
 *   version: "2.0",
 *   cases: StoredCase[],              // No nested relations
 *   financials: StoredFinancialItem[], // Foreign key: caseId
 *   notes: StoredNote[],               // Foreign key: caseId
 *   alerts: AlertRecord[],             // Flat array
 *   categoryConfig: CategoryConfig,
 *   activityLog: CaseActivityEntry[]
 * }
 * ```
 * 
 * ## Error Handling
 * 
 * - **LegacyFormatError**: Thrown for pre-v2.0 data files
 * - **Write Failures**: Rolls back UI to previous state
 * - **Permission Errors**: Provides user-friendly error messages
 * - **State Conflicts**: Detected and reported
 * 
 * ## Usage Pattern
 * 
 * ```typescript
 * const service = new FileStorageService({ fileService });
 * 
 * // Read data
 * const data = await service.readFileData();
 * 
 * // Modify data
 * const updatedData = {
 *   ...data,
 *   cases: [...data.cases, newCase]
 * };
 * 
 * // Write back
 * await service.writeNormalizedData(updatedData);
 * ```
 * 
 * @class FileStorageService
 */
export class FileStorageService {
  /** The underlying file service for I/O operations */
  private fileService: AutosaveFileService;

  /**
   * Create a new FileStorageService instance.
   * 
   * @param {FileStorageServiceConfig} config - Configuration object
   * @param {AutosaveFileService} config.fileService - File service for I/O operations
   */
  constructor(config: FileStorageServiceConfig) {
    this.fileService = config.fileService;
  }

  /**
   * Read current data from file system in normalized v2.0 format.
   * 
   * This is the primary read method that:
   * 1. Reads file via AutosaveFileService
   * 2. Validates format version
   * 3. Returns normalized data or creates empty structure
   * 4. Rejects legacy formats with LegacyFormatError
   * 
   * **Behavior:**
   * - Returns empty structure if no file exists (first run)
   * - Throws LegacyFormatError for pre-v2.0 formats
   * - Throws Error for other read failures
   * 
   * @returns {Promise<NormalizedFileData | null>} Normalized data or null
   * @throws {LegacyFormatError} If file contains legacy (pre-v2.0) format
   * @throws {Error} If file read fails for other reasons
   * 
   * @example
   * try {
   *   const data = await fileStorage.readFileData();
   *   if (data) {
   *     console.log(`Loaded ${data.cases.length} cases`);
   *   } else {
   *     console.log('No existing data file');
   *   }
   * } catch (error) {
   *   if (error instanceof LegacyFormatError) {
   *     // Handle legacy format...
   *   }
   * }
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
   * Read raw data from file system without format validation.
   * 
   * This method bypasses format validation and returns the raw file contents.
   * **Only for use by migration utilities** that need to read legacy formats.
   * 
   * Normal application code should use readFileData() which enforces v2.0 format.
   * 
   * @returns {Promise<unknown | null>} Raw file data or null if no file exists
   * @throws {Error} If file read fails
   */
  async readRawFileData(): Promise<unknown | null> {
    try {
      const rawData = await this.fileService.readFile();
      return rawData;
    } catch (error) {
      logger.error("Failed to read raw file data", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
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
   * Write normalized data to file system.
   * 
   * This is the primary write method that:
   * 1. Captures previous state for rollback
   * 2. Enriches category config with discovered statuses/alert types
   * 3. Validates and cleans data
   * 4. Normalizes activity log (sorts by timestamp)
   * 5. Writes to file
   * 6. Broadcasts data change to listeners
   * 7. Rolls back UI on failure
   * 
   * ## Rollback Mechanism
   * 
   * If the write operation fails, the service broadcasts the previous file
   * state to all listeners. This keeps the UI in sync with the actual
   * persisted data, preventing data loss scenarios.
   * 
   * ## Auto-enrichment
   * 
   * The method automatically:
   * - Discovers case statuses from existing cases
   * - Discovers alert types from existing alerts
   * - Adds them to categoryConfig if not already present
   * 
   * ## Activity Log Normalization
   * 
   * Activity log entries are:
   * - Deep cloned to prevent reference issues
   * - Sorted by timestamp (newest first)
   * 
   * @param {NormalizedFileData} data - The data to write in normalized v2.0 format
   * @returns {Promise<NormalizedFileData>} The written data after enrichment
   * @throws {Error} If write operation fails
   * 
   * @example
   * const updatedData = {
   *   ...currentData,
   *   cases: [...currentData.cases, newCase]
   * };
   * 
   * try {
   *   const written = await service.writeNormalizedData(updatedData);
   *   console.log('Data saved successfully');
   * } catch (error) {
   *   console.error('Save failed:', error.message);
   *   // UI already rolled back to previous state
   * }
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
      // Merge category config and discover any statuses/alert types from data
      const mergedConfig = mergeCategoryConfig(data.categoryConfig);
      const enrichedStatuses = discoverStatusesFromCases(mergedConfig.caseStatuses, data.cases);
      const enrichedAlertTypes = discoverAlertTypesFromAlerts(mergedConfig.alertTypes ?? [], data.alerts);
      const categoryConfig: CategoryConfig = {
        ...mergedConfig,
        caseStatuses: enrichedStatuses,
        alertTypes: enrichedAlertTypes,
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
          .map((entry): CaseActivityEntry => {
            if (entry.type === "status-change") {
              return { ...entry, payload: { ...entry.payload } };
            } else if (entry.type === "priority-change") {
              return { ...entry, payload: { ...entry.payload } };
            } else {
              return { ...entry, payload: { ...entry.payload } };
            }
          })
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
   * Update case timestamps for modified cases.
   * 
   * Sets the updatedAt timestamp to the current time for all cases
   * whose IDs are in the provided set/iterable.
   * 
   * @param {StoredCase[]} cases - Array of cases to update
   * @param {Iterable<string>} [touchedCaseIds] - IDs of cases to update timestamps for
   * @returns {StoredCase[]} Cases with updated timestamps
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
   * Get all financial items for a specific case.
   * 
   * @param {NormalizedFileData} data - The normalized data to query
   * @param {string} caseId - The case ID to filter by
   * @returns {StoredFinancialItem[]} Financial items for the case
   */
  getFinancialsForCase(data: NormalizedFileData, caseId: string): StoredFinancialItem[] {
    return data.financials.filter(f => f.caseId === caseId);
  }

  /**
   * Get financial items for a case grouped by category.
   * 
   * @param {NormalizedFileData} data - The normalized data to query
   * @param {string} caseId - The case ID to filter by
   * @returns {Object} Financial items grouped into resources, income, and expenses
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
   * Get all notes for a specific case.
   * 
   * @param {NormalizedFileData} data - The normalized data to query
   * @param {string} caseId - The case ID to filter by
   * @returns {StoredNote[]} Notes for the case
   */
  getNotesForCase(data: NormalizedFileData, caseId: string): StoredNote[] {
    return data.notes.filter(n => n.caseId === caseId);
  }

  /**
   * Get all alerts for a specific case by MCN (Medical Case Number).
   * 
   * @param {NormalizedFileData} data - The normalized data to query
   * @param {string} mcn - The medical case number to match
   * @returns {AlertRecord[]} Alerts matching the MCN
   */
  getAlertsForCase(data: NormalizedFileData, mcn: string): AlertRecord[] {
    return data.alerts.filter(a => a.mcNumber === mcn);
  }

  /**
   * Get a specific case by its ID.
   * 
   * @param {NormalizedFileData} data - The normalized data to query
   * @param {string} caseId - The case ID to find
   * @returns {StoredCase | undefined} The case if found, undefined otherwise
   */
  getCaseById(data: NormalizedFileData, caseId: string): StoredCase | undefined {
    return data.cases.find(c => c.id === caseId);
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Report a storage error through the error reporting system.
   * 
   * @private
   * @param {FileStorageOperation} operation - The operation that failed
   * @param {unknown} error - The error that occurred
   * @param {Record<string, unknown>} [context] - Additional context
   */
  private reportStorageError(operation: FileStorageOperation, error: unknown, context?: Record<string, unknown>) {
    reportFileStorageError({
      operation,
      error,
      source: "FileStorageService",
      context,
    });
  }
}
