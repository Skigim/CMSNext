import {
  CaseDisplay,
  CaseCategory,
  FinancialItem,
  NewPersonData,
  NewCaseRecordData,
  NewNoteData,
  AlertWorkflowStatus,
} from "../types/case";
import type { CaseActivityEntry } from "../types/activityLog";
import { v4 as uuidv4 } from 'uuid';
import AutosaveFileService from './AutosaveFileService';
import { createLogger } from './logger';
import {
  CategoryConfig,
  CategoryKey,
  mergeCategoryConfig,
} from "../types/categoryConfig";
import { STORAGE_CONSTANTS } from "./constants/storage";
import {
  AlertsIndex,
  AlertWithMatch,
  createEmptyAlertsIndex,
} from "./alertsData";
import { FileStorageService, type LegacyFileData } from "./services/FileStorageService";
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
  persistNormalizationFixes?: boolean;
}

const logger = createLogger('DataManager');

// ============================================================================
// Type Definitions
// ============================================================================

interface AlertsMergeSummary {
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
  private alerts: AlertsService;

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
    this.alerts = new AlertsService();
  }

  // =============================================================================
  // CORE FILE OPERATIONS (Private)
  // =============================================================================

  /**
   * Read current data from file system
   * Delegates to FileStorageService
   */
  private async readFileData(): Promise<LegacyFileData | null> {
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
    }

    if (!data) {
      return createEmptyAlertsIndex();
    }

    const cases = options.cases ?? data.cases ?? [];
    const rawAlerts = data.alerts ?? [];
    
    const alerts: AlertWithMatch[] = rawAlerts.map(record => ({
      ...record,
      matchStatus: (record as any).matchStatus ?? (record.mcNumber ? 'unmatched' : 'missing-mcn'),
      matchedCaseId: (record as any).matchedCaseId,
      matchedCaseName: (record as any).matchedCaseName,
      matchedCaseStatus: (record as any).matchedCaseStatus,
    }));

    return this.alerts.getAlertsIndex(alerts, cases);
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
    const data = await this.readFileData();
    if (!data) {
      logger.warn('Cannot update alert status: No data loaded');
      return null;
    }

    const cases = options.cases ?? data.cases ?? [];
    const rawAlerts = data.alerts ?? [];
    
    const alerts: AlertWithMatch[] = rawAlerts.map(record => ({
      ...record,
      matchStatus: (record as any).matchStatus ?? (record.mcNumber ? 'unmatched' : 'missing-mcn'),
      matchedCaseId: (record as any).matchedCaseId,
      matchedCaseName: (record as any).matchedCaseName,
      matchedCaseStatus: (record as any).matchedCaseStatus,
    }));

    const updatedAlert = this.alerts.updateAlertStatus(alerts, alertId, updates, cases);
    if (!updatedAlert) {
      return null;
    }

    // Replace the alert in the array
    const index = rawAlerts.findIndex(a => a.id === updatedAlert.id);
    if (index !== -1) {
      rawAlerts[index] = updatedAlert;
    } else {
      // Should not happen if updateAlertStatus found it, but safe fallback
      rawAlerts.push(updatedAlert);
    }

    // Save updated alerts to storage
    await this.fileStorage.writeFileData({
      ...data,
      alerts: rawAlerts,
    });

    this.fileService.notifyDataChange();

    return updatedAlert;
  }

  async mergeAlertsFromCsvContent(
    csvContent: string,
    options: { cases?: CaseDisplay[]; sourceFileName?: string } = {},
  ): Promise<AlertsMergeSummary> {
    const data = await this.readFileData();
    if (!data) {
      logger.warn('Cannot merge alerts: No data loaded');
      return { added: 0, updated: 0, total: 0 };
    }

    const cases = options.cases ?? data.cases ?? [];
    const rawAlerts = data.alerts ?? [];
    
    const existingAlerts: AlertWithMatch[] = rawAlerts.map(record => ({
      ...record,
      matchStatus: (record as any).matchStatus ?? (record.mcNumber ? 'unmatched' : 'missing-mcn'),
      matchedCaseId: (record as any).matchedCaseId,
      matchedCaseName: (record as any).matchedCaseName,
      matchedCaseStatus: (record as any).matchedCaseStatus,
    }));

    const result = await this.alerts.mergeAlertsFromCsvContent(csvContent, existingAlerts, cases);

    if (result.added > 0 || result.updated > 0) {
      await this.fileStorage.writeFileData({
        ...data,
        alerts: result.alerts,
      });
      this.fileService.notifyDataChange();
    }

    return {
      added: result.added,
      updated: result.updated,
      total: result.total,
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