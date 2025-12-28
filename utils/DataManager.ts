import {
  CaseDisplay,
  CaseCategory,
  CaseStatus,
  FinancialItem,
  NewPersonData,
  NewCaseRecordData,
  NewNoteData,
  AlertWorkflowStatus,
  AlertRecord,
} from "../types/case";
import type { CaseActivityEntry } from "../types/activityLog";
import AutosaveFileService from './AutosaveFileService';
import { createLogger } from './logger';
import {
  CategoryConfig,
  CategoryKey,
  StatusConfig,
  AlertTypeConfig,
  mergeCategoryConfig,
} from "../types/categoryConfig";
import type { VRScript } from "../types/vr";
import { STORAGE_CONSTANTS } from "./constants/storage";
import {
  AlertsIndex,
  AlertWithMatch,
  createEmptyAlertsIndex,
  parseNameFromImport,
  normalizeMcn,
} from "./alertsData";
import { 
  FileStorageService, 
  type NormalizedFileData, 
  type StoredCase, 
  type StoredFinancialItem, 
  type StoredNote,
} from "./services/FileStorageService";
import { ActivityLogService } from "./services/ActivityLogService";
import { CategoryConfigService } from "./services/CategoryConfigService";
import { NotesService } from "./services/NotesService";
import { FinancialsService } from "./services/FinancialsService";
import { CaseService } from "./services/CaseService";
import { AlertsService } from "./services/AlertsService";

// ============================================================================
// Configuration & Logging
// ============================================================================

/**
 * Configuration options for DataManager initialization.
 * @interface DataManagerConfig
 */
interface DataManagerConfig {
  /** The file service instance that handles file system operations and autosave functionality */
  fileService: AutosaveFileService;
  /** Optional file storage service instance. If not provided, a new instance will be created */
  fileStorageService?: FileStorageService;
}

const logger = createLogger('DataManager');

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Summary of alert merge operations, including counts and any errors encountered.
 * @interface AlertsMergeSummary
 */
interface AlertsMergeSummary {
  /** Number of new alerts added to the system */
  added: number;
  /** Number of existing alerts that were updated */
  updated: number;
  /** Total number of alerts after the merge operation */
  total: number;
  /** Error message if the merge operation failed */
  error?: string;
  /** Number of skeleton cases created for unmatched alerts with MCNs */
  casesCreated?: number;
}

/**
 * Convert an AlertRecord to AlertWithMatch by adding match status fields.
 * 
 * @private
 * @param {AlertRecord} record - The alert record to convert
 * @returns {AlertWithMatch} The alert with match status information
 */
function toAlertWithMatch(record: AlertRecord): AlertWithMatch {
  const candidate = record as unknown as Partial<AlertWithMatch>;
  return {
    ...record,
    matchStatus: candidate.matchStatus ?? (record.mcNumber ? 'unmatched' : 'missing-mcn'),
    matchedCaseId: candidate.matchedCaseId,
    matchedCaseName: candidate.matchedCaseName,
    matchedCaseStatus: candidate.matchedCaseStatus,
  };
}

/**
 * DataManager - Central orchestrator for all case data operations
 * 
 * This is the primary API surface for managing case data in the application.
 * It follows a stateless, file-first architecture where the file system is
 * the single source of truth.
 * 
 * ## Architecture Pattern
 * 
 * The DataManager orchestrates multiple specialized services:
 * - **FileStorageService**: Low-level file I/O and format validation
 * - **CaseService**: Case CRUD operations
 * - **FinancialsService**: Financial item management
 * - **NotesService**: Note management
 * - **AlertsService**: Alert management and matching
 * - **ActivityLogService**: Activity logging and history
 * - **CategoryConfigService**: Status/category configuration
 * 
 * ## Core Principles
 * 
 * 1. **Stateless Operations**: No data is cached or stored in memory
 * 2. **File System as Source of Truth**: All operations read fresh data from disk
 * 3. **Read-Modify-Write Pattern**: Every mutation follows: read file → modify → write file
 * 4. **Service Delegation**: Business logic is delegated to specialized services
 * 5. **Normalized Data Format**: Uses v2.0 normalized format with flat arrays and foreign keys
 * 
 * ## Data Format (v2.0 Normalized)
 * 
 * ```typescript
 * {
 *   version: "2.0",
 *   cases: StoredCase[],        // Flat array without nested relations
 *   financials: StoredFinancialItem[],  // With caseId foreign key
 *   notes: StoredNote[],        // With caseId foreign key
 *   alerts: AlertRecord[],      // Flat array
 *   categoryConfig: CategoryConfig,
 *   activityLog: CaseActivityEntry[]
 * }
 * ```
 * 
 * ## Usage Example
 * 
 * ```typescript
 * // Creating a case
 * const newCase = await dataManager.createCompleteCase({
 *   person: { firstName: "John", lastName: "Doe", ... },
 *   caseRecord: { status: "Active", mcn: "12345", ... }
 * });
 * 
 * // Adding a financial item
 * const item = await dataManager.addItem(
 *   newCase.id,
 *   'resources',
 *   { name: "SNAP", amount: 500, ... }
 * );
 * 
 * // Updating case status
 * await dataManager.updateCaseStatus(newCase.id, "Closed");
 * ```
 * 
 * @class DataManager
 * @see {@link FileStorageService} for low-level file operations
 * @see {@link CaseService} for case-specific operations
 */
export class DataManager {
  /** File service instance for file system operations and autosave */
  private fileService: AutosaveFileService;
  /** File storage service for low-level I/O operations */
  private fileStorage: FileStorageService;
  /** Activity log service for tracking case operations */
  private activityLog: ActivityLogService;
  /** Category configuration service for managing statuses and categories */
  private categoryConfig: CategoryConfigService;
  /** Notes service for note operations */
  private notes: NotesService;
  /** Financials service for financial item operations */
  private financials: FinancialsService;
  /** Case service for case CRUD operations */
  private cases: CaseService;
  /** Alerts service for alert management and matching */
  private alerts: AlertsService;

  /**
   * Creates a new DataManager instance.
   * 
   * Initializes all underlying services with dependency injection.
   * If fileStorageService is not provided, creates a new instance.
   * 
   * @param {DataManagerConfig} config - Configuration object
   * @param {AutosaveFileService} config.fileService - Required file service instance
   * @param {FileStorageService} [config.fileStorageService] - Optional file storage service
   */
  constructor(config: DataManagerConfig) {
    this.fileService = config.fileService;
    this.fileStorage = config.fileStorageService || new FileStorageService({
      fileService: config.fileService,
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
    this.alerts = new AlertsService();
  }

  // =============================================================================
  // CORE FILE OPERATIONS (Private)
  // =============================================================================

  /**
   * Read current data from file system in normalized v2.0 format.
   * 
   * This is a private helper method that delegates to FileStorageService.
   * Always reads fresh data from disk - no caching.
   * 
   * @private
   * @returns {Promise<NormalizedFileData | null>} The normalized file data, or null if no file exists
   * @throws {LegacyFormatError} If file contains legacy (pre-v2.0) format data
   */
  private async readFileData(): Promise<NormalizedFileData | null> {
    return this.fileStorage.readFileData();
  }

  // =============================================================================
  // PUBLIC API - READ OPERATIONS
  // =============================================================================

  /**
   * Get all cases from the file system.
   * 
   * Returns cases in normalized format (StoredCase[]) without nested
   * financials or notes. Always reads fresh data from disk.
   * 
   * @returns {Promise<StoredCase[]>} Array of all cases, or empty array if no data exists
   * @example
   * const cases = await dataManager.getAllCases();
   * console.log(`Found ${cases.length} cases`);
   */
  async getAllCases(): Promise<StoredCase[]> {
    return this.cases.getAllCases();
  }

  /**
   * Get the activity log entries.
   * 
   * Returns all activity log entries sorted by timestamp (newest first).
   * 
   * @returns {Promise<CaseActivityEntry[]>} Array of activity log entries
   */
  async getActivityLog(): Promise<CaseActivityEntry[]> {
    return this.activityLog.getActivityLog();
  }

  /**
   * Clear activity log entries for a specific date.
   * 
   * Removes all activity log entries that occurred on the target date.
   * 
   * @param {string | Date} targetDate - The date to clear entries for
   * @returns {Promise<number>} Number of entries cleared
   */
  async clearActivityLogForDate(targetDate: string | Date): Promise<number> {
    return this.activityLog.clearActivityLogForDate(targetDate);
  }

  /**
   * Get a specific case by its ID.
   * 
   * Returns a single case in normalized format without nested relations.
   * Always reads fresh data from disk.
   * 
   * @param {string} caseId - The unique identifier of the case
   * @returns {Promise<StoredCase | null>} The case if found, null otherwise
   * @example
   * const case = await dataManager.getCaseById("abc-123");
   * if (case) {
   *   console.log(`Case: ${case.name}`);
   * }
   */
  async getCaseById(caseId: string): Promise<StoredCase | null> {
    return this.cases.getCaseById(caseId);
  }

  /**
   * Get the total count of cases.
   * 
   * @returns {Promise<number>} The number of cases in the system
   */
  async getCasesCount(): Promise<number> {
    return this.cases.getCasesCount();
  }

  /**
   * Get all financial items for a specific case.
   * 
   * Returns financial items with caseId foreign key reference.
   * Items are not nested within the case object.
   * 
   * @param {string} caseId - The case ID to get financial items for
   * @returns {Promise<StoredFinancialItem[]>} Array of financial items for the case
   */
  async getFinancialItemsForCase(caseId: string): Promise<StoredFinancialItem[]> {
    return this.financials.getItemsForCase(caseId);
  }

  /**
   * Get financial items for a case grouped by category.
   * 
   * Organizes financial items into three categories: resources, income, and expenses.
   * 
   * @param {string} caseId - The case ID to get financial items for
   * @returns {Promise<{resources: StoredFinancialItem[], income: StoredFinancialItem[], expenses: StoredFinancialItem[]}>}
   *   Object with financial items grouped by category
   */
  async getFinancialItemsForCaseGrouped(caseId: string): Promise<{
    resources: StoredFinancialItem[];
    income: StoredFinancialItem[];
    expenses: StoredFinancialItem[];
  }> {
    return this.financials.getItemsForCaseGrouped(caseId);
  }

  /**
   * Get all notes for a specific case.
   * 
   * Returns notes with caseId foreign key reference.
   * Notes are not nested within the case object.
   * 
   * @param {string} caseId - The case ID to get notes for
   * @returns {Promise<StoredNote[]>} Array of notes for the case
   */
  async getNotesForCase(caseId: string): Promise<StoredNote[]> {
    return this.notes.getNotesForCase(caseId);
  }

  // ==========================================================================
  // PUBLIC API - ALERT OPERATIONS
  // ==========================================================================

  /**
   * Get the alerts index with matching information.
   * 
   * This method:
   * 1. Checks for pending CSV import and processes it if found
   * 2. Matches alerts to cases by MCN (Medical Case Number)
   * 3. Categorizes alerts as matched, unmatched, or missing-mcn
   * 
   * @param {Object} [options] - Optional configuration
   * @param {StoredCase[]} [options.cases] - Pre-loaded cases to use for matching (optimization)
   * @returns {Promise<AlertsIndex>} Index containing all alerts organized by match status
   * @example
   * const alertsIndex = await dataManager.getAlertsIndex();
   * console.log(`Matched: ${alertsIndex.matched.length}`);
   * console.log(`Unmatched: ${alertsIndex.unmatched.length}`);
   */
  async getAlertsIndex(options: { cases?: StoredCase[] } = {}): Promise<AlertsIndex> {
    let data = await this.readFileData();

    // Check for pending CSV import
    try {
      const csvContent = await this.fileService.readTextFile(STORAGE_CONSTANTS.ALERTS.CSV_NAME);
      if (csvContent) {
        const cases = options.cases ?? data?.cases ?? [];
        await this.mergeAlertsFromCsvContent(csvContent, { cases, sourceFileName: STORAGE_CONSTANTS.ALERTS.CSV_NAME });
        // Delete the CSV file after successful import to prevent re-processing
        const deleted = await this.fileService.deleteFile(STORAGE_CONSTANTS.ALERTS.CSV_NAME);
        if (deleted) {
          logger.info('Alerts CSV file deleted after successful import');
        }
        // Refresh data after import
        data = await this.readFileData();
      }
    } catch (error) {
      logger.warn('Failed to check/import alerts CSV', { error });
      // If the error is critical, do not continue with potentially stale data
      if (error instanceof Error && error.message.includes('Critical')) {
         return createEmptyAlertsIndex();
      }
    }

    if (!data) {
      return createEmptyAlertsIndex();
    }

    const cases = options.cases ?? data.cases ?? [];
    const rawAlerts = data.alerts ?? [];
    
    const alerts: AlertWithMatch[] = rawAlerts.map(toAlertWithMatch);

    return this.alerts.getAlertsIndex(alerts, cases);
  }

  /**
   * Update the status of a specific alert.
   * 
   * Handles alerts with duplicate IDs (from CSV imports) by updating all matching alerts.
   * Writes the updated alerts back to the file system.
   * 
   * @param {string} alertId - The unique identifier of the alert to update
   * @param {Object} updates - The status updates to apply
   * @param {AlertWorkflowStatus} [updates.status] - New workflow status
   * @param {string | null} [updates.resolvedAt] - Resolution timestamp
   * @param {string} [updates.resolutionNotes] - Notes about the resolution
   * @param {Object} [options] - Optional configuration
   * @param {StoredCase[]} [options.cases] - Pre-loaded cases for matching
   * @returns {Promise<AlertWithMatch | null>} The updated alert with match info, or null if not found
   * @example
   * const updated = await dataManager.updateAlertStatus(
   *   "alert-123",
   *   { status: "resolved", resolvedAt: new Date().toISOString() }
   * );
   */
  async updateAlertStatus(
    alertId: string,
    updates: {
      status?: AlertWorkflowStatus;
      resolvedAt?: string | null;
      resolutionNotes?: string;
    },
    options: { cases?: StoredCase[] } = {},
  ): Promise<AlertWithMatch | null> {
    const data = await this.readFileData();
    if (!data) {
      logger.warn('Cannot update alert status: No data loaded');
      return null;
    }

    const cases = options.cases ?? data.cases ?? [];
    const rawAlerts = data.alerts ?? [];
    
    const alerts: AlertWithMatch[] = rawAlerts.map(toAlertWithMatch);

    const updatedAlert = this.alerts.updateAlertStatus(alerts, alertId, updates, cases);
    if (!updatedAlert) {
      return null;
    }

    // Replace ALL alerts with matching ID (handles duplicate IDs from CSV import)
    // findIndex only finds the first occurrence, but there may be duplicates
    let foundCount = 0;
    const newAlerts = rawAlerts.map(a => {
      if (a.id === updatedAlert.id) {
        foundCount++;
        return updatedAlert;
      }
      return a;
    });
    
    if (foundCount === 0) {
      // Should not happen if updateAlertStatus found it, but safe fallback
      newAlerts.push(updatedAlert);
    } else if (foundCount > 1) {
      logger.warn('Multiple alerts with same ID updated', { alertId, count: foundCount });
    }

    // Save updated alerts to storage using normalized format
    // Note: writeNormalizedData handles broadcasting data changes
    await this.fileStorage.writeNormalizedData({
      ...data,
      alerts: newAlerts,
    });

    return updatedAlert;
  }

  /**
   * Merge alerts from CSV content into the system.
   * 
   * This method performs a complete alert import workflow:
   * 1. Parses CSV content and converts to alert records
   * 2. Matches alerts to existing cases by MCN
   * 3. Creates skeleton cases for unmatched alerts with valid MCNs
   * 4. Re-matches alerts after case creation
   * 5. Writes all changes to the file system
   * 
   * Skeleton cases include minimal information (name from alert, MCN) and
   * are created with "Active" status for easy identification.
   * 
   * @param {string} csvContent - Raw CSV content to parse
   * @param {Object} [options] - Optional configuration
   * @param {StoredCase[]} [options.cases] - Pre-loaded cases for matching
   * @param {string} [options.sourceFileName] - Name of the source CSV file for logging
   * @returns {Promise<AlertsMergeSummary>} Summary of the merge operation including counts
   * @example
   * const result = await dataManager.mergeAlertsFromCsvContent(csvContent);
   * console.log(`Added: ${result.added}, Updated: ${result.updated}`);
   * if (result.casesCreated) {
   *   console.log(`Created ${result.casesCreated} skeleton cases`);
   * }
   */
  async mergeAlertsFromCsvContent(
    csvContent: string,
    options: { cases?: StoredCase[]; sourceFileName?: string } = {},
  ): Promise<AlertsMergeSummary> {
    const data = await this.readFileData();
    if (!data) {
      logger.warn('Cannot merge alerts: No data loaded');
      return { added: 0, updated: 0, total: 0 };
    }

    const cases = options.cases ?? data.cases ?? [];
    const rawAlerts = data.alerts ?? [];
    
    const existingAlerts: AlertWithMatch[] = rawAlerts.map(toAlertWithMatch);

    try {
      // First pass: merge alerts with existing cases
      const result = await this.alerts.mergeAlertsFromCsvContent(csvContent, existingAlerts, cases);

      // Find unmatched alerts that have MCNs - these need skeleton cases
      // Also exclude alerts that already have a caseId (already linked to a case)
      const unmatchedWithMcn = result.alerts.filter(
        alert => alert.matchStatus === "unmatched" && alert.mcNumber && !alert.caseId
      );

      // Group by normalized MCN to avoid duplicate case creation
      const mcnToAlerts = new Map<string, AlertWithMatch[]>();
      for (const alert of unmatchedWithMcn) {
        const normalizedMcn = normalizeMcn(alert.mcNumber);
        if (normalizedMcn) {
          const existing = mcnToAlerts.get(normalizedMcn) ?? [];
          existing.push(alert);
          mcnToAlerts.set(normalizedMcn, existing);
        }
      }

      // Create skeleton cases for each unique MCN
      const createdCases: StoredCase[] = [];
      for (const [, alerts] of mcnToAlerts) {
        // Use the first alert's data for case creation
        const alert = alerts[0];
        // Use rawName from metadata (original "LASTNAME, FIRSTNAME" format) for proper parsing
        const rawName = alert.metadata?.rawName as string | undefined;
        const { firstName, lastName } = parseNameFromImport(rawName);
        
        // Only create if we have at least a name or MCN
        if (!firstName && !lastName) {
          logger.warn('Skipping skeleton case creation: no name available', { mcn: alert.mcNumber });
          continue;
        }

        try {
          const skeletonCase = await this.cases.createCompleteCase({
            person: {
              firstName: firstName || "",
              lastName: lastName || "",
              email: "",
              phone: "",
              dateOfBirth: "",
              ssn: "",
              livingArrangement: "",
              address: { street: "", city: "", state: "", zip: "" },
              mailingAddress: { street: "", city: "", state: "", zip: "", sameAsPhysical: true },
              status: "Active",
            },
            caseRecord: {
              mcn: alert.mcNumber ?? "",
              status: "Active" as CaseStatus,
              applicationDate: new Date().toISOString(),
              caseType: "",
              personId: "",
              description: "Auto-created from alert import",
              livingArrangement: "",
              admissionDate: "",
              organizationId: "",
            },
          });
          createdCases.push(skeletonCase);
          logger.info('Created skeleton case from unmatched alert', { 
            caseId: skeletonCase.id, 
            mcn: alert.mcNumber,
            name: `${firstName} ${lastName}`.trim(),
          });
        } catch (err) {
          logger.error('Failed to create skeleton case', { 
            mcn: alert.mcNumber, 
            error: err instanceof Error ? err.message : String(err) 
          });
        }
      }

      // If we created any cases, re-match the alerts against all cases
      if (createdCases.length > 0) {
        const allCases = [...cases, ...createdCases];
        const rematchedResult = await this.alerts.mergeAlertsFromCsvContent(
          csvContent, 
          existingAlerts, 
          allCases
        );
        
        // Write updated data with new cases already included from createCompleteCase
        // Just need to update alerts
        const freshData = await this.readFileData();
        if (freshData) {
          await this.fileStorage.writeNormalizedData({
            ...freshData,
            alerts: rematchedResult.alerts,
          });
        }

        return {
          added: result.added,
          updated: result.updated,
          total: rematchedResult.total,
          casesCreated: createdCases.length,
        };
      }

      if (result.added > 0 || result.updated > 0) {
        // Note: writeNormalizedData handles broadcasting data changes
        await this.fileStorage.writeNormalizedData({
          ...data,
          alerts: result.alerts,
        });
      }

      return {
        added: result.added,
        updated: result.updated,
        total: result.total,
      };
    } catch (error) {
      logger.error('Failed to merge alerts from CSV', { error });
      return { 
        added: 0, 
        updated: 0, 
        total: 0, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  // =============================================================================
  // PUBLIC API - CATEGORY CONFIGURATION
  // =============================================================================

  /**
   * Get the current category configuration.
   * 
   * Returns configuration for statuses, categories, alert types, and VR scripts.
   * 
   * @returns {Promise<CategoryConfig>} The current category configuration
   */
  async getCategoryConfig(): Promise<CategoryConfig> {
    return this.categoryConfig.getCategoryConfig();
  }

  /**
   * Update the entire category configuration.
   * 
   * Replaces the current category config with the provided configuration.
   * 
   * @param {CategoryConfig} categoryConfig - The new category configuration
   * @returns {Promise<CategoryConfig>} The updated category configuration
   */
  async updateCategoryConfig(categoryConfig: CategoryConfig): Promise<CategoryConfig> {
    return this.categoryConfig.updateCategoryConfig(categoryConfig);
  }

  /**
   * Update values for a specific category key.
   * 
   * @param {CategoryKey} key - The category key to update
   * @param {string[]} values - The new values for the category
   * @returns {Promise<CategoryConfig>} The updated category configuration
   */
  async updateCategoryValues(key: CategoryKey, values: string[]): Promise<CategoryConfig> {
    return this.categoryConfig.updateCategoryValues(key, values);
  }

  /**
   * Update case status configurations.
   * 
   * Updates the available case statuses and their color slot assignments.
   * 
   * @param {StatusConfig[]} statuses - Array of status configurations
   * @returns {Promise<CategoryConfig>} The updated category configuration
   */
  async updateCaseStatuses(statuses: StatusConfig[]): Promise<CategoryConfig> {
    return this.categoryConfig.updateCaseStatuses(statuses);
  }

  /**
   * Update alert type configurations.
   * 
   * @param {AlertTypeConfig[]} alertTypes - Array of alert type configurations
   * @returns {Promise<CategoryConfig>} The updated category configuration
   */
  async updateAlertTypes(alertTypes: AlertTypeConfig[]): Promise<CategoryConfig> {
    return this.categoryConfig.updateAlertTypes(alertTypes);
  }

  /**
   * Update VR (Verification Request) script templates.
   * 
   * @param {VRScript[]} scripts - Array of VR script configurations
   * @returns {Promise<CategoryConfig>} The updated category configuration
   */
  async updateVRScripts(scripts: VRScript[]): Promise<CategoryConfig> {
    return this.categoryConfig.updateVRScripts(scripts);
  }

  /**
   * Reset category configuration to defaults.
   * 
   * Clears all custom configurations and restores factory defaults.
   * 
   * @returns {Promise<CategoryConfig>} The reset category configuration
   */
  async resetCategoryConfig(): Promise<CategoryConfig> {
    return this.categoryConfig.resetCategoryConfig();
  }

  // =============================================================================
  // PUBLIC API - WRITE OPERATIONS
  // =============================================================================

  /**
   * Create a new complete case with person and case record data.
   * 
   * Creates a new case with all required information including person details
   * and case record. Returns the case in normalized format without nested relations.
   * 
   * @param {Object} caseData - The case data
   * @param {NewPersonData} caseData.person - Person information (name, contact, address, etc.)
   * @param {NewCaseRecordData} caseData.caseRecord - Case record information (status, MCN, dates, etc.)
   * @returns {Promise<StoredCase>} The created case in normalized format
   * @example
   * const newCase = await dataManager.createCompleteCase({
   *   person: {
   *     firstName: "John",
   *     lastName: "Doe",
   *     email: "john@example.com",
   *     phone: "555-1234",
   *     dateOfBirth: "1990-01-01",
   *     ssn: "123-45-6789",
   *     status: "Active",
   *     address: { street: "123 Main St", city: "Anytown", state: "CA", zip: "12345" }
   *   },
   *   caseRecord: {
   *     mcn: "12345",
   *     status: "Active",
   *     applicationDate: new Date().toISOString(),
   *     caseType: "Medical Assistance"
   *   }
   * });
   */
  async createCompleteCase(caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<StoredCase> {
    return this.cases.createCompleteCase(caseData);
  }

  /**
   * Update an existing complete case.
   * 
   * Updates both person and case record information for an existing case.
   * Returns the updated case in normalized format.
   * 
   * @param {string} caseId - The ID of the case to update
   * @param {Object} caseData - The updated case data
   * @param {NewPersonData} caseData.person - Updated person information
   * @param {NewCaseRecordData} caseData.caseRecord - Updated case record information
   * @returns {Promise<StoredCase>} The updated case in normalized format
   */
  async updateCompleteCase(caseId: string, caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<StoredCase> {
    return this.cases.updateCompleteCase(caseId, caseData);
  }

  /**
   * Update the status of a case.
   * 
   * Changes the case status and records the change in the activity log.
   * 
   * @param {string} caseId - The ID of the case to update
   * @param {CaseDisplay["status"]} status - The new status
   * @returns {Promise<StoredCase>} The updated case
   */
  async updateCaseStatus(caseId: string, status: CaseDisplay["status"]): Promise<StoredCase> {
    return this.cases.updateCaseStatus(caseId, status);
  }

  /**
   * Delete a case and all its associated data.
   * 
   * Removes the case and all related financials, notes, and alerts.
   * This operation cannot be undone.
   * 
   * @param {string} caseId - The ID of the case to delete
   * @returns {Promise<void>}
   */
  async deleteCase(caseId: string): Promise<void> {
    return this.cases.deleteCase(caseId);
  }

  /**
   * Delete multiple cases at once.
   * 
   * Batch deletion operation that removes multiple cases and their associated data.
   * 
   * @param {string[]} caseIds - Array of case IDs to delete
   * @returns {Promise<{deleted: number, notFound: string[]}>} Result with count of deleted cases and IDs not found
   */
  async deleteCases(caseIds: string[]): Promise<{ deleted: number; notFound: string[] }> {
    return this.cases.deleteCases(caseIds);
  }

  /**
   * Update status for multiple cases at once.
   * 
   * Batch update operation that changes the status of multiple cases.
   * 
   * @param {string[]} caseIds - Array of case IDs to update
   * @param {CaseStatus} status - The new status to apply
   * @returns {Promise<{updated: StoredCase[], notFound: string[]}>} Result with updated cases and IDs not found
   */
  async updateCasesStatus(caseIds: string[], status: CaseStatus): Promise<{ updated: StoredCase[]; notFound: string[] }> {
    return this.cases.updateCasesStatus(caseIds, status);
  }

  /**
   * Update priority for multiple cases at once.
   * 
   * Batch update operation that changes the priority flag of multiple cases.
   * 
   * @param {string[]} caseIds - Array of case IDs to update
   * @param {boolean} priority - Whether cases should be marked as priority
   * @returns {Promise<{updated: StoredCase[], notFound: string[]}>} Result with updated cases and IDs not found
   */
  async updateCasesPriority(caseIds: string[], priority: boolean): Promise<{ updated: StoredCase[]; notFound: string[] }> {
    return this.cases.updateCasesPriority(caseIds, priority);
  }

  // =============================================================================
  // FINANCIAL ITEM OPERATIONS
  // =============================================================================

  /**
   * Add a financial item to a case.
   * 
   * Creates a new financial item (resource, income, or expense) for a case.
   * The item is stored with caseId and category foreign keys in the normalized format.
   * 
   * @param {string} caseId - The ID of the case to add the item to
   * @param {CaseCategory} category - The category ('resources', 'income', or 'expenses')
   * @param {Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>} itemData - The financial item data
   * @returns {Promise<StoredFinancialItem>} The created financial item with caseId and category
   * @example
   * const item = await dataManager.addItem(caseId, 'resources', {
   *   name: "SNAP Benefits",
   *   amount: 500,
   *   frequency: "monthly",
   *   verified: true
   * });
   */
  async addItem(caseId: string, category: CaseCategory, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoredFinancialItem> {
    return this.financials.addItem(caseId, category, itemData);
  }

  /**
   * Update a financial item in a case.
   * 
   * Updates an existing financial item with new values.
   * 
   * @param {string} caseId - The ID of the case
   * @param {CaseCategory} category - The category of the item
   * @param {string} itemId - The ID of the item to update
   * @param {Partial<FinancialItem>} updatedItem - The fields to update
   * @returns {Promise<StoredFinancialItem>} The updated financial item
   */
  async updateItem(
    caseId: string,
    category: CaseCategory,
    itemId: string,
    updatedItem: Partial<FinancialItem>,
  ): Promise<StoredFinancialItem> {
    return this.financials.updateItem(caseId, category, itemId, updatedItem);
  }

  /**
   * Delete a financial item from a case.
   * 
   * Removes a financial item permanently. This operation cannot be undone.
   * 
   * @param {string} caseId - The ID of the case
   * @param {CaseCategory} category - The category of the item
   * @param {string} itemId - The ID of the item to delete
   * @returns {Promise<void>}
   */
  async deleteItem(caseId: string, category: CaseCategory, itemId: string): Promise<void> {
    return this.financials.deleteItem(caseId, category, itemId);
  }

  /**
   * Add an amount history entry to a financial item.
   * 
   * Records a change in amount for tracking historical values.
   * Used for auditing and tracking amount changes over time.
   * 
   * @param {string} caseId - The ID of the case
   * @param {CaseCategory} category - The category of the item
   * @param {string} itemId - The ID of the financial item
   * @param {Omit<AmountHistoryEntry, "id" | "createdAt">} entry - The history entry data
   * @returns {Promise<StoredFinancialItem>} The updated financial item with new history entry
   */
  async addAmountHistoryEntry(
    caseId: string,
    category: CaseCategory,
    itemId: string,
    entry: Omit<import("../types/case").AmountHistoryEntry, "id" | "createdAt">
  ): Promise<StoredFinancialItem> {
    return this.financials.addAmountHistoryEntry(caseId, category, itemId, entry);
  }

  /**
   * Update an amount history entry in a financial item.
   * 
   * Modifies an existing amount history entry.
   * 
   * @param {string} caseId - The ID of the case
   * @param {CaseCategory} category - The category of the item
   * @param {string} itemId - The ID of the financial item
   * @param {string} entryId - The ID of the history entry to update
   * @param {Partial<Omit<AmountHistoryEntry, "id" | "createdAt">>} updates - The fields to update
   * @returns {Promise<StoredFinancialItem>} The updated financial item
   */
  async updateAmountHistoryEntry(
    caseId: string,
    category: CaseCategory,
    itemId: string,
    entryId: string,
    updates: Partial<Omit<import("../types/case").AmountHistoryEntry, "id" | "createdAt">>
  ): Promise<StoredFinancialItem> {
    return this.financials.updateAmountHistoryEntry(caseId, category, itemId, entryId, updates);
  }

  /**
   * Delete an amount history entry from a financial item.
   * 
   * Removes a historical amount entry. This operation cannot be undone.
   * 
   * @param {string} caseId - The ID of the case
   * @param {CaseCategory} category - The category of the item
   * @param {string} itemId - The ID of the financial item
   * @param {string} entryId - The ID of the history entry to delete
   * @returns {Promise<StoredFinancialItem>} The updated financial item
   */
  async deleteAmountHistoryEntry(
    caseId: string,
    category: CaseCategory,
    itemId: string,
    entryId: string
  ): Promise<StoredFinancialItem> {
    return this.financials.deleteAmountHistoryEntry(caseId, category, itemId, entryId);
  }

  // =============================================================================
  // NOTE OPERATIONS
  // =============================================================================

  /**
   * Add a note to a case.
   * 
   * Creates a new note associated with a case. Notes are stored separately
   * from cases with a caseId foreign key reference.
   * 
   * @param {string} caseId - The ID of the case to add the note to
   * @param {NewNoteData} noteData - The note data (content, author, etc.)
   * @returns {Promise<StoredNote>} The created note with caseId foreign key
   * @example
   * const note = await dataManager.addNote(caseId, {
   *   content: "Called client to schedule follow-up",
   *   author: "John Smith"
   * });
   */
  async addNote(caseId: string, noteData: NewNoteData): Promise<StoredNote> {
    return this.notes.addNote(caseId, noteData);
  }

  /**
   * Update a note in a case.
   * 
   * Modifies an existing note's content or metadata.
   * 
   * @param {string} caseId - The ID of the case
   * @param {string} noteId - The ID of the note to update
   * @param {NewNoteData} noteData - The updated note data
   * @returns {Promise<StoredNote>} The updated note
   */
  async updateNote(caseId: string, noteId: string, noteData: NewNoteData): Promise<StoredNote> {
    return this.notes.updateNote(caseId, noteId, noteData);
  }

  /**
   * Delete a note from a case.
   * 
   * Permanently removes a note. This operation cannot be undone.
   * 
   * @param {string} caseId - The ID of the case
   * @param {string} noteId - The ID of the note to delete
   * @returns {Promise<void>}
   */
  async deleteNote(caseId: string, noteId: string): Promise<void> {
    return this.notes.deleteNote(caseId, noteId);
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  /**
   * Import multiple cases at once.
   * 
   * Batch import operation that adds multiple cases to the system.
   * Used for data migration and bulk data loading.
   * 
   * @param {StoredCase[]} cases - Array of cases to import in normalized format
   * @returns {Promise<void>}
   */
  async importCases(cases: StoredCase[]): Promise<void> {
    return this.cases.importCases(cases);
  }

  /**
   * Clear all data from the system.
   * 
   * Removes all cases, financials, notes, and alerts while preserving
   * category configuration. This is a destructive operation that cannot be undone.
   * 
   * Activity log is also cleared.
   * 
   * @returns {Promise<void>}
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
   * Check if the file service is available and has granted permissions.
   * 
   * @returns {boolean} true if connected with granted permissions, false otherwise
   */
  isConnected(): boolean {
    return this.fileService.getStatus().permissionStatus === 'granted';
  }

  /**
   * Get the current file service status.
   * 
   * Returns detailed status information including permission state,
   * last save time, and pending writes.
   * 
   * @returns {ServiceState} Current service state and status
   */
  getStatus() {
    return this.fileService.getStatus();
  }

  /**
   * Read raw file data without format validation.
   * 
   * This method bypasses normal validation and returns the raw file contents.
   * Used by migration utilities that need to read legacy formats.
   * 
   * **Warning:** This method should only be used by migration tools.
   * Normal application code should use the standard read methods.
   * 
   * @returns {Promise<unknown | null>} Raw file data or null if no file exists
   */
  async readRawFileData(): Promise<unknown | null> {
    return this.fileStorage.readRawFileData();
  }

  /**
   * Write normalized data to file system.
   * 
   * This method writes data in the normalized v2.0 format directly to disk.
   * Used by migration utilities to save converted data.
   * 
   * **Warning:** This method bypasses normal service operations and should
   * only be used by migration tools.
   * 
   * @param {NormalizedFileData} data - The normalized data to write
   * @returns {Promise<NormalizedFileData>} The written data after enrichment
   */
  async writeNormalizedData(data: NormalizedFileData): Promise<NormalizedFileData> {
    return this.fileStorage.writeNormalizedData(data);
  }

  // =============================================================================
  // MIGRATION OPERATIONS
  // =============================================================================

  /**
   * Migrate financial items that don't have amount history.
   * 
   * This migration creates a history entry from the item's dateAdded/createdAt
   * field for backward compatibility with older data formats.
   * 
   * Run this once after upgrading from a version that didn't support
   * amount history.
   * 
   * @returns {Promise<number>} Number of items migrated
   * @example
   * const migrated = await dataManager.migrateFinancialsWithoutHistory();
   * console.log(`Migrated ${migrated} financial items`);
   */
  async migrateFinancialsWithoutHistory(): Promise<number> {
    return this.financials.migrateItemsWithoutHistory();
  }
}

export default DataManager;