import type {
  AlertRecord,
  Person,
  PersistedCase,
  StoredCase,
  StoredFinancialItem,
  StoredNote,
} from "@/types/case";
import type { Application } from "@/types/application";
import type { CaseActivityEntry } from "@/types/activityLog";
import type { CategoryConfig } from "@/types/categoryConfig";
import type { Template } from "@/types/template";
import { getCompletionStatusNames, mergeCategoryConfig } from "@/types/categoryConfig";
import { selectOldestNonTerminalApplication } from "@/domain/applications";
import { discoverStatusesFromCases, discoverAlertTypesFromAlerts } from "../categoryConfigMigration";
import AutosaveFileService from "../AutosaveFileService";
import { createLogger } from "../logger";
import { reportFileStorageError, type FileStorageOperation } from "../fileStorageErrorReporter";
import {
  dehydrateNormalizedData,
  hydrateNormalizedData,
  hydrateStoredCase,
  isPersistedNormalizedFileDataV22,
  selectDeterministicCanonicalApplication,
  type PersistedNormalizedFileDataV22,
} from "../persistedV22Storage";

const logger = createLogger("FileStorageService");
const NORMALIZED_VERSION = "2.2";
const LEGACY_FORMAT_V2_0 = "v2.0";
const LEGACY_FORMAT_V2_1 = "v2.1";
const INVALID_V2_2_FORMAT_PREFIX = "invalid v2.2 workspace";

/**
 * Deep-copy a single activity log entry, ensuring payload objects are new references.
 */
function deepCopyActivityEntry(entry: CaseActivityEntry): CaseActivityEntry {
  if ('payload' in entry && entry.payload && typeof entry.payload === 'object') {
    return { ...entry, payload: { ...entry.payload } } as CaseActivityEntry;
  }
  return { ...entry };
}

/**
 * Classify a write error into a user-friendly message.
 */
function classifyWriteError(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error";
  if (error.name === "AbortError") {
    return "Operation cancelled.";
  }
  if (
    error.message.includes("state cached in an interface object") ||
    error.message.includes("state had changed")
  ) {
    return "File was modified by another process. Please try again.";
  }
  if (error.message.includes("permission")) {
    return "Permission denied. Please check file permissions.";
  }
  return error.message;
}

// ============================================================================
// Type Definitions
// ============================================================================

// Re-export types from types/case.ts for convenience
export type {
  PersistedCase,
  StoredCase,
  StoredFinancialItem,
  StoredNote,
  StoredPerson,
} from "../../types/case";

/**
 * Normalized file data format (current runtime shape).
 *
 * This is the current runtime-ready data format used for file operations.
 * It uses a normalized structure with flat arrays and foreign key references
 * instead of nested objects.
 *
 * @interface NormalizedFileData
 */
export interface NormalizedFileData {
  /** Data format version (current canonical writes persist as "2.2") */
  version: "2.2";
  /** Global people registry available to services and future UI flows */
  people: Person[];
  /** Runtime-hydrated cases */
  cases: StoredCase[];
  /** Canonical application records keyed by caseId */
  applications?: Application[];
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

export interface CaseDehydratedNormalizedFileData extends Omit<NormalizedFileData, "cases"> {
  cases: PersistedCase[];
}

type NormalizedWriteData =
  | NormalizedFileData
  | PersistedNormalizedFileDataV22
  | CaseDehydratedNormalizedFileData;

function cloneApplicationForWrite(application: Application): Application {
  return {
    ...application,
    retroMonths: [...application.retroMonths],
    statusHistory: application.statusHistory.map((entry) => ({ ...entry })),
    verification: { ...application.verification },
  };
}

function isRuntimeNormalizedWriteData(
  data: NormalizedWriteData,
): data is NormalizedFileData {
  const firstCase = data.cases[0];
  if (firstCase) {
    return "person" in firstCase;
  }

  const firstPerson = data.people[0];
  if (firstPerson) {
    return "familyMembers" in firstPerson;
  }

  // Empty datasets are shape-compatible across runtime and persisted forms, so
  // treat them as runtime input and let the canonical writer normalize them.
  return true;
}

function isCaseDehydratedNormalizedWriteData(
  data: NormalizedWriteData,
): data is CaseDehydratedNormalizedFileData {
  const firstCase = data.cases[0];
  if (!firstCase || "person" in firstCase) {
    return false;
  }

  const firstPerson = data.people[0];
  return firstPerson ? "familyMembers" in firstPerson : false;
}

/**
 * Type guard to check if data matches the persisted normalized v2.2 format.
 * 
 * @param {unknown} data - Data to check
 * @returns {boolean} true if data is NormalizedFileData
 */
export function isNormalizedFileData(data: unknown): data is PersistedNormalizedFileDataV22 {
  return isPersistedNormalizedFileDataV22(data);
}

/**
 * Error thrown when attempting to load a workspace file outside the canonical
 * persisted v2.2 format accepted by the normal app runtime.
 * 
 * This error is thrown when the file format is detected as legacy, v2.0, or an
 * invalid/non-canonical v2.2 payload. It provides a user-facing message that
 * points users toward the current upgrade flow instead of silently rewriting
 * the workspace during normal reads.
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
    const message = detectedFormat.startsWith(INVALID_V2_2_FORMAT_PREFIX)
      ? `This workspace file is not in a valid canonical v${NORMALIZED_VERSION} format.`
      : "This workspace is using an outdated schema (v2.1 or older). To load this file, it must be upgraded using a previous version of CMSNext.";

    super(message);
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
 * - **Version Control**: Enforces the current v2.2 normalized format
 * - **Format Enforcement**: Rejects outdated schemas and invalid canonical v2.2 payloads
 * - **Format Validation**: Ensures data integrity before writes
 * - **Auto-enrichment**: Discovers statuses and alert types from data
 * 
 * ### Read Operations
 * - Returns NormalizedFileData or creates empty structure
 * - Validates format version
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
 * ## Data Format (v2.2 Normalized)
 * 
 * The service enforces a normalized data structure:
 * 
 * ```typescript
 * {
 *   version: "2.2",
 *   people: Person[],                 // Global people registry
 *   cases: StoredCase[],              // Runtime-hydrated cases
 *   applications?: Application[],     // Canonical application records by caseId
 *   financials: StoredFinancialItem[], // Foreign key: caseId
 *   notes: StoredNote[],               // Foreign key: caseId
 *   alerts: AlertRecord[],             // Flat array
 *   exported_at: string,
 *   total_cases: number,
 *   categoryConfig: CategoryConfig,
 *   activityLog: CaseActivityEntry[],
 *   templates?: Template[]
 * }
 * ```
 * 
 * ## Error Handling
 * 
 * - **LegacyFormatError**: Thrown for any non-canonical runtime read payload
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
  private readonly fileService: AutosaveFileService;

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
 * Read current data from file system in canonical normalized v2.2 runtime format.
 *
   * This is the primary read method that:
   * 1. Reads file via AutosaveFileService
   * 2. Validates format version
 * 3. Hydrates persisted v2.2 data for runtime consumers
  * 4. Rejects v2.1/v2.0/legacy/non-canonical payloads with LegacyFormatError
  * 5. Keeps upgrade tooling on the explicit migration path only
 *
   * **Behavior:**
   * - Returns null if no workspace file exists yet
  * - Throws LegacyFormatError for v2.1, v2.0, pre-v2.0, or invalid persisted v2.2 formats
 * - Throws Error for other read failures
 *
   * @returns {Promise<NormalizedFileData | null>} Normalized data or null
  * @throws {LegacyFormatError} If file is not canonical persisted v2.2 data
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
        return null;
      }

      if (isNormalizedFileData(rawData)) {
        return await this.readCanonicalNormalizedData(rawData);
      }

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

  private async readCanonicalNormalizedData(
    rawData: PersistedNormalizedFileDataV22,
  ): Promise<NormalizedFileData> {
    logger.debug("Detected normalized data format (v2.2)");

    return this.hydratePersistedRuntimeData(rawData);
  }

  private hydratePersistedRuntimeData(
    rawData: PersistedNormalizedFileDataV22,
  ): NormalizedFileData {
    try {
      return hydrateNormalizedData(rawData);
    } catch (error) {
      logger.error("Persisted v2.2 data failed canonical hydration", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      const hydrationError =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "unknown hydration error";
      throw new LegacyFormatError(`${INVALID_V2_2_FORMAT_PREFIX}: ${hydrationError}`);
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

    if (this.isNightingaleRawExport(obj)) {
      return "Nightingale raw export";
    }

    const legacyCaseFormat = this.detectLegacyCaseFormat(obj);
    if (legacyCaseFormat) {
      return legacyCaseFormat;
    }

    const versionFormat = this.detectVersionFormat(obj);
    if (versionFormat) {
      return versionFormat;
    }

    return "unknown legacy format";
  }

  private isNightingaleRawExport(obj: Record<string, unknown>): boolean {
    return Array.isArray(obj.people) && Array.isArray(obj.caseRecords);
  }

  private detectLegacyCaseFormat(obj: Record<string, unknown>): string | null {
    if (!Array.isArray(obj.cases) || "version" in obj) {
      return null;
    }

    const firstCase = obj.cases[0] as Record<string, unknown> | undefined;
    if (firstCase?.caseRecord && typeof firstCase.caseRecord === "object") {
      const caseRecord = firstCase.caseRecord as Record<string, unknown>;
      if ("financials" in caseRecord || "notes" in caseRecord) {
        return "v1.x nested format";
      }
    }

    return "v1.x format";
  }

  private detectVersionFormat(obj: Record<string, unknown>): string | null {
    if (!("version" in obj)) {
      return null;
    }

    if (obj.version === LEGACY_FORMAT_V2_0) {
      return LEGACY_FORMAT_V2_0;
    }

    if (obj.version === LEGACY_FORMAT_V2_1) {
      return LEGACY_FORMAT_V2_1;
    }

    if (obj.version === NORMALIZED_VERSION) {
      return INVALID_V2_2_FORMAT_PREFIX;
    }

    return `v${obj.version}`;
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
   * The `data` argument can be provided in three closely related shapes:
   * - `NormalizedFileData`: runtime-ready normalized data used throughout the app.
  * - `PersistedNormalizedFileDataV22`: canonical persisted v2.2 storage shape.
   * - `CaseDehydratedNormalizedFileData`: normalized data where cases have been
   *   "dehydrated" to their persisted form (typically produced by
   *   `dehydrateNormalizedData` for efficient writes/broadcasts and usually not
   *   hand-authored by callers).
   *
  * @param {NormalizedFileData | PersistedNormalizedFileDataV22 | CaseDehydratedNormalizedFileData} data - Normalized
  *   runtime data, persisted-style v2.2 data, or case-dehydrated normalized data
   *   to write through the canonical storage path
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
  async writeNormalizedData(
    data: NormalizedWriteData,
  ): Promise<NormalizedFileData> {
    const previousData = await this.capturePreviousRuntimeData();

    try {
      const runtimeData = this.toRuntimeWriteData(data);
      const finalData = this.buildFinalWriteData(runtimeData);
      return await this.persistRuntimeData(finalData);
    } catch (error) {
      this.handleWriteFailure(previousData, error);
    }
  }

  private async capturePreviousRuntimeData(): Promise<NormalizedFileData | null> {
    try {
      const previousRawData = await this.fileService.readFile();
      return isNormalizedFileData(previousRawData)
        ? hydrateNormalizedData(previousRawData)
        : null;
    } catch {
      logger.warn("Could not capture previous state for rollback");
      return null;
    }
  }

  private toRuntimeWriteData(data: NormalizedWriteData): NormalizedFileData {
    if (isRuntimeNormalizedWriteData(data)) {
      return data;
    }

    if (isCaseDehydratedNormalizedWriteData(data)) {
      return {
        ...data,
        cases: this.hydrateDehydratedCases(data),
      };
    }

    return hydrateNormalizedData(data);
  }

  private hydrateDehydratedCases(
    data: CaseDehydratedNormalizedFileData,
  ): StoredCase[] {
    const completionStatuses = getCompletionStatusNames(data.categoryConfig);

    return data.cases.map((caseItem) => {
      const caseApplications =
        data.applications?.filter((application) => application.caseId === caseItem.id) ?? [];
      const primaryApplication =
        selectOldestNonTerminalApplication(caseApplications, completionStatuses) ??
        selectDeterministicCanonicalApplication(caseApplications);

      return hydrateStoredCase(
        caseItem,
        data.people,
        primaryApplication,
      );
    });
  }

  private buildEnrichedCategoryConfig(runtimeData: NormalizedFileData): CategoryConfig {
    const mergedConfig = mergeCategoryConfig(runtimeData.categoryConfig);
    return {
      ...mergedConfig,
      caseStatuses: discoverStatusesFromCases(
        mergedConfig.caseStatuses,
        runtimeData.cases,
      ),
      alertTypes: discoverAlertTypesFromAlerts(
        mergedConfig.alertTypes ?? [],
        runtimeData.alerts,
      ),
    };
  }

  private buildFinalWriteData(runtimeData: NormalizedFileData): NormalizedFileData {
    return {
      version: NORMALIZED_VERSION as "2.2",
      people: runtimeData.people.map((person) => ({ ...person })),
      cases: runtimeData.cases.map((caseItem) => ({ ...caseItem })),
      applications: runtimeData.applications?.map(cloneApplicationForWrite),
      financials: runtimeData.financials.map((financial) => ({ ...financial })),
      notes: runtimeData.notes.map((note) => ({ ...note })),
      alerts: runtimeData.alerts.map((alert) => ({ ...alert })),
      exported_at: new Date().toISOString(),
      total_cases: runtimeData.cases.length,
      categoryConfig: this.buildEnrichedCategoryConfig(runtimeData),
      activityLog: [...(runtimeData.activityLog ?? [])]
        .map(deepCopyActivityEntry)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      templates: runtimeData.templates ? [...runtimeData.templates] : undefined,
    };
  }

  private async persistRuntimeData(finalData: NormalizedFileData): Promise<NormalizedFileData> {
    const persistedData = dehydrateNormalizedData(finalData);
    const success = await this.fileService.writeFile(persistedData);

    if (!success) {
      throw new Error("File write operation failed");
    }

    const canonicalRuntimeData = hydrateNormalizedData(persistedData);
    this.fileService.broadcastDataUpdate(canonicalRuntimeData);
    return canonicalRuntimeData;
  }

  private handleWriteFailure(
    previousData: NormalizedFileData | null,
    error: unknown,
  ): never {
    if (previousData) {
      logger.warn("Write failed, broadcasting previous state to resync UI");
      this.fileService.broadcastDataUpdate(previousData);
    }

    logger.error("Failed to write normalized data", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    const errorMessage = classifyWriteError(error);
    this.reportStorageError("writeData", error, {
      method: "writeNormalizedData",
      errorMessage,
    });

    throw new Error(`Failed to save case data: ${errorMessage}`);
  }

  /**
   * Update case timestamps for modified cases.
   * 
   * Sets the updatedAt timestamp to the current time for all cases
   * whose IDs are in the provided set/iterable.
   * 
   * @param {StoredCase[]} cases - Array of cases to update
   * @param {Iterable<string>} [touchedCaseIds] - IDs of cases to update timestamps for
   * @param {string} [timestampOverride] - Transaction timestamp to reuse instead of reading a new clock value
   * @returns {StoredCase[]} Cases with updated timestamps
   */
  touchCaseTimestamps(
    cases: StoredCase[],
    touchedCaseIds?: Iterable<string>,
    timestampOverride?: string,
  ): StoredCase[] {
    if (!touchedCaseIds) {
      return cases;
    }

    const ids = touchedCaseIds instanceof Set ? touchedCaseIds : new Set(touchedCaseIds);
    if (ids.size === 0) {
      return cases;
    }

    const timestamp = timestampOverride ?? new Date().toISOString();

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
   * Get all applications for a specific case.
   * 
   * @param {NormalizedFileData} data - The normalized data to query
   * @param {string} caseId - The case ID to filter by
   * @returns {Application[]} Applications for the case
   */
  getApplicationsForCase(data: NormalizedFileData, caseId: string): Application[] {
    return (data.applications ?? []).filter((application) => application.caseId === caseId);
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
