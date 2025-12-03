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

interface DataManagerConfig {
  fileService: AutosaveFileService;
  fileStorageService?: FileStorageService;
}

const logger = createLogger('DataManager');

// ============================================================================
// Type Definitions
// ============================================================================

interface AlertsMergeSummary {
  added: number;
  updated: number;
  total: number;
  error?: string;
  casesCreated?: number;
}

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
  private alerts: AlertsService;

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
   * Read current data from file system in normalized v2.0 format
   * Delegates to FileStorageService
   */
  private async readFileData(): Promise<NormalizedFileData | null> {
    return this.fileStorage.readFileData();
  }

  // =============================================================================
  // PUBLIC API - READ OPERATIONS
  // =============================================================================

  /**
   * Get all cases (always reads fresh from file)
   * Returns StoredCase[] - normalized format without nested financials/notes
   * Delegates to CaseService
   */
  async getAllCases(): Promise<StoredCase[]> {
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
   * Returns StoredCase - normalized format without nested financials/notes
   * Delegates to CaseService
   */
  async getCaseById(caseId: string): Promise<StoredCase | null> {
    return this.cases.getCaseById(caseId);
  }

  /**
   * Get cases count (always reads fresh from file)
   * Delegates to CaseService
   */
  async getCasesCount(): Promise<number> {
    return this.cases.getCasesCount();
  }

  /**
   * Get all financial items for a specific case
   */
  async getFinancialItemsForCase(caseId: string): Promise<StoredFinancialItem[]> {
    return this.financials.getItemsForCase(caseId);
  }

  /**
   * Get financial items for a case grouped by category
   */
  async getFinancialItemsForCaseGrouped(caseId: string): Promise<{
    resources: StoredFinancialItem[];
    income: StoredFinancialItem[];
    expenses: StoredFinancialItem[];
  }> {
    return this.financials.getItemsForCaseGrouped(caseId);
  }

  /**
   * Get all notes for a specific case
   */
  async getNotesForCase(caseId: string): Promise<StoredNote[]> {
    return this.notes.getNotesForCase(caseId);
  }

  // ==========================================================================
  // PUBLIC API - ALERT OPERATIONS
  // ==========================================================================

  async getAlertsIndex(options: { cases?: StoredCase[] } = {}): Promise<AlertsIndex> {
    let data = await this.readFileData();

    // Check for pending CSV import
    try {
      const csvContent = await this.fileService.readTextFile(STORAGE_CONSTANTS.ALERTS.CSV_NAME);
      if (csvContent) {
        const cases = options.cases ?? data?.cases ?? [];
        await this.mergeAlertsFromCsvContent(csvContent, { cases, sourceFileName: STORAGE_CONSTANTS.ALERTS.CSV_NAME });
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

    // Replace the alert in a new array to avoid mutating rawAlerts
    const newAlerts = [...rawAlerts];
    const index = newAlerts.findIndex(a => a.id === updatedAlert.id);
    if (index !== -1) {
      newAlerts[index] = updatedAlert;
    } else {
      // Should not happen if updateAlertStatus found it, but safe fallback
      newAlerts.push(updatedAlert);
    }

    // Save updated alerts to storage using normalized format
    // Note: writeNormalizedData handles broadcasting data changes
    await this.fileStorage.writeNormalizedData({
      ...data,
      alerts: newAlerts,
    });

    return updatedAlert;
  }

  async mergeAlertsFromCsvContent(
    csvContent: string,
    options: { cases?: StoredCase[]; sourceFileName?: string } = {},
  ): Promise<AlertsMergeSummary> {
    const data = await this.readFileData();
    if (!data) {
      logger.warn('Cannot merge alerts: No data loaded');
      return { added: 0, updated: 0, total: 0 };
    }

    let cases = options.cases ?? data.cases ?? [];
    const rawAlerts = data.alerts ?? [];
    
    const existingAlerts: AlertWithMatch[] = rawAlerts.map(toAlertWithMatch);

    try {
      // First pass: merge alerts with existing cases
      const result = await this.alerts.mergeAlertsFromCsvContent(csvContent, existingAlerts, cases);

      // Find unmatched alerts that have MCNs - these need skeleton cases
      const unmatchedWithMcn = result.alerts.filter(
        alert => alert.matchStatus === "unmatched" && alert.mcNumber
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
        const { firstName, lastName } = parseNameFromImport(alert.personName);
        
        // Only create if we have at least a name or MCN
        if (!firstName && !lastName) {
          logger.warn('Skipping skeleton case creation: no name available', { mcn: alert.mcNumber });
          continue;
        }

        try {
          const skeletonCase = await this.cases.createCompleteCase({
            person: {
              firstName: firstName || "Unknown",
              lastName: lastName || "Unknown",
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

  async getCategoryConfig(): Promise<CategoryConfig> {
    return this.categoryConfig.getCategoryConfig();
  }

  async updateCategoryConfig(categoryConfig: CategoryConfig): Promise<CategoryConfig> {
    return this.categoryConfig.updateCategoryConfig(categoryConfig);
  }

  async updateCategoryValues(key: CategoryKey, values: string[]): Promise<CategoryConfig> {
    return this.categoryConfig.updateCategoryValues(key, values);
  }

  async updateCaseStatuses(statuses: StatusConfig[]): Promise<CategoryConfig> {
    return this.categoryConfig.updateCaseStatuses(statuses);
  }

  async updateAlertTypes(alertTypes: AlertTypeConfig[]): Promise<CategoryConfig> {
    return this.categoryConfig.updateAlertTypes(alertTypes);
  }

  async resetCategoryConfig(): Promise<CategoryConfig> {
    return this.categoryConfig.resetCategoryConfig();
  }

  // =============================================================================
  // PUBLIC API - WRITE OPERATIONS
  // =============================================================================

  /**
   * Create a new complete case
   * Returns StoredCase - normalized format without nested financials/notes
   * Delegates to CaseService
   */
  async createCompleteCase(caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<StoredCase> {
    return this.cases.createCompleteCase(caseData);
  }

  /**
   * Update an existing complete case
   * Returns StoredCase - normalized format without nested financials/notes
   * Delegates to CaseService
   */
  async updateCompleteCase(caseId: string, caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<StoredCase> {
    return this.cases.updateCompleteCase(caseId, caseData);
  }

  /**
   * Update case status
   * Returns StoredCase - normalized format without nested financials/notes
   * Delegates to CaseService
   */
  async updateCaseStatus(caseId: string, status: CaseDisplay["status"]): Promise<StoredCase> {
    return this.cases.updateCaseStatus(caseId, status);
  }

  /**
   * Delete a case
   * Delegates to CaseService
   */
  async deleteCase(caseId: string): Promise<void> {
    return this.cases.deleteCase(caseId);
  }

  /**
   * Delete multiple cases at once
   * Delegates to CaseService
   */
  async deleteCases(caseIds: string[]): Promise<{ deleted: number; notFound: string[] }> {
    return this.cases.deleteCases(caseIds);
  }

  /**
   * Update status for multiple cases at once
   * Delegates to CaseService
   */
  async updateCasesStatus(caseIds: string[], status: CaseStatus): Promise<{ updated: StoredCase[]; notFound: string[] }> {
    return this.cases.updateCasesStatus(caseIds, status);
  }

  /**
   * Update priority for multiple cases at once
   * Delegates to CaseService
   */
  async updateCasesPriority(caseIds: string[], priority: boolean): Promise<{ updated: StoredCase[]; notFound: string[] }> {
    return this.cases.updateCasesPriority(caseIds, priority);
  }

  // =============================================================================
  // FINANCIAL ITEM OPERATIONS
  // =============================================================================

  /**
   * Add financial item to a case
   * Returns StoredFinancialItem with caseId and category foreign keys
   * Delegates to FinancialsService
   */
  async addItem(caseId: string, category: CaseCategory, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoredFinancialItem> {
    return this.financials.addItem(caseId, category, itemData);
  }

  /**
   * Update financial item in a case
   * Returns StoredFinancialItem with caseId and category foreign keys
   * Delegates to FinancialsService
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
   * Delete financial item from a case
   * Delegates to FinancialsService
   */
  async deleteItem(caseId: string, category: CaseCategory, itemId: string): Promise<void> {
    return this.financials.deleteItem(caseId, category, itemId);
  }

  // =============================================================================
  // NOTE OPERATIONS
  // =============================================================================

  /**
   * Add note to a case
   * Returns StoredNote with caseId foreign key
   * Delegates to NotesService
   */
  async addNote(caseId: string, noteData: NewNoteData): Promise<StoredNote> {
    return this.notes.addNote(caseId, noteData);
  }

  /**
   * Update note in a case
   * Returns StoredNote with caseId foreign key
   * Delegates to NotesService
   */
  async updateNote(caseId: string, noteId: string, noteData: NewNoteData): Promise<StoredNote> {
    return this.notes.updateNote(caseId, noteId, noteData);
  }

  /**
   * Delete note from a case
   * Delegates to NotesService
   */
  async deleteNote(caseId: string, noteId: string): Promise<void> {
    return this.notes.deleteNote(caseId, noteId);
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  /**
   * Import multiple cases at once
   * Delegates to CaseService
   */
  async importCases(cases: StoredCase[]): Promise<void> {
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

  /**
   * Read raw file data without format validation.
   * Used for migration utilities that need to read legacy formats.
   */
  async readRawFileData(): Promise<unknown | null> {
    return this.fileStorage.readRawFileData();
  }

  /**
   * Write normalized data to file system.
   * Used by migration utilities to save converted data.
   */
  async writeNormalizedData(data: NormalizedFileData): Promise<NormalizedFileData> {
    return this.fileStorage.writeNormalizedData(data);
  }
}

export default DataManager;