import { NewPersonData, NewCaseRecordData, NewNoteData, StoredCase, StoredNote } from '@/types/case';
import { DataManager } from '@/utils/DataManager';
import { getFileStorageFlags, updateFileStorageFlags } from '@/utils/fileStorageFlags';
import { createLogger } from '@/utils/logger';
import { LegacyFormatError } from '@/utils/services/FileStorageService';

const logger = createLogger('CaseOperationsService');

/**
 * Result type for service operations.
 * 
 * Provides a discriminated union for operation results with success/failure
 * states and additional metadata for special cases (legacy format, abort).
 * 
 * @template T - The data type returned on success
 */
export type OperationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; isLegacyFormat?: boolean; isAborted?: boolean };

/**
 * CaseOperationsService - UI-agnostic orchestration layer
 * 
 * This service provides a clean separation between UI components and the
 * DataManager layer. It handles all case-related operations with consistent
 * error handling, logging, and result formatting.
 * 
 * ## Architecture
 * 
 * ```
 * React Components/Hooks
 *     ↓
 * CaseOperationsService (orchestration & error handling)
 *     ↓
 * DataManager (business logic)
 *     ↓
 * Domain Services (CaseService, NotesService, etc.)
 * ```
 * 
 * ## Design Principles
 * 
 * ### UI-Agnostic
 * - No React dependencies
 * - No toast notifications
 * - No component state management
 * - Returns structured results for UI to handle
 * 
 * ### Consistent Error Handling
 * - All methods return OperationResult<T>
 * - Errors are caught, logged, and formatted
 * - Special cases flagged (legacy format, abort)
 * - User-friendly error messages
 * 
 * ### Logging & Observability
 * - Logs all operations with context
 * - Tracks success/failure rates
 * - Records error details for debugging
 * 
 * ### File Storage Flag Management
 * - Updates dataBaseline flag after successful loads
 * - Sets sessionHadData flag when data exists
 * - Manages connection flow state
 * 
 * ## Core Responsibilities
 * 
 * ### Case Operations
 * - Load all cases
 * - Save case (create or update)
 * - Delete single case
 * - Update case status
 * - Import multiple cases
 * 
 * ### Bulk Operations
 * - Delete multiple cases
 * - Update status for multiple cases
 * - Update priority for multiple cases
 * 
 * ### Note Operations
 * - Save note (create or update)
 * 
 * ## Pattern: Result-Oriented Architecture
 * 
 * All methods follow a consistent pattern:
 * 1. Try operation via DataManager
 * 2. Log the operation (success or failure)
 * 3. Update file storage flags if needed
 * 4. Return OperationResult with data or error
 * 5. Let caller handle UI feedback
 * 
 * ## Error Handling
 * 
 * Errors are categorized and handled appropriately:
 * - **LegacyFormatError:** Flagged with isLegacyFormat=true
 * - **AbortError:** Flagged with isAborted=true
 * - **Other errors:** Logged with context, user-friendly message returned
 * 
 * @class CaseOperationsService
 * @see {@link DataManager} for business logic layer
 * @see {@link OperationResult} for result type structure
 */
export class CaseOperationsService {
  /**
   * Create a new CaseOperationsService instance.
   * 
   * @param {DataManager} dataManager - The data manager instance for operations
   */
  constructor(private dataManager: DataManager) {}

  /**
   * Load all cases from storage.
   * 
   * This method:
   * 1. Loads all cases via DataManager
   * 2. Updates file storage flags (dataBaseline, sessionHadData)
   * 3. Checks for empty state outside connection flow
   * 4. Handles legacy format errors
   * 5. Returns structured result with data or error
   * 
   * **Special Handling:**
   * - LegacyFormatError flagged with isLegacyFormat=true
   * - Empty state outside connection flow flagged with isEmpty=true
   * 
   * @returns {Promise<OperationResult<StoredCase[]>>} Result with cases array or error
   * 
   * @example
   * const result = await caseOps.loadCases();
   * if (result.success) {
   *   console.log(`Loaded ${result.data.length} cases`);
   *   if ('isEmpty' in result && result.isEmpty) {
   *     console.log('No data found');
   *   }
   * } else if (result.isLegacyFormat) {
   *   console.error('Legacy format detected:', result.error);
   * }
   */
  async loadCases(): Promise<OperationResult<StoredCase[]>> {
    try {
      const data = await this.dataManager.getAllCases();
      
      updateFileStorageFlags({ dataBaseline: true });
      
      if (data.length > 0) {
        updateFileStorageFlags({ sessionHadData: true });
        logger.info('Cases loaded', { caseCount: data.length });
      }

      const isEmptyAndNotInFlow = data.length === 0 && !getFileStorageFlags().inConnectionFlow;

      return { 
        success: true, 
        data,
        // Expose this for UI layer to show appropriate message
        ...(isEmptyAndNotInFlow && { isEmpty: true }),
      } as OperationResult<StoredCase[]> & { isEmpty?: boolean };
    } catch (err) {
      if (err instanceof LegacyFormatError) {
        return { success: false, error: err.message, isLegacyFormat: true };
      }
      logger.error('Failed to load cases', { error: err instanceof Error ? err.message : String(err) });
      return { success: false, error: 'Failed to load cases. Please try again.' };
    }
  }

  /**
   * Save a case (create new or update existing).
   * 
   * Delegates to DataManager's createCompleteCase or updateCompleteCase
   * based on whether editingCaseId is provided.
   * 
   * @param {Object} caseData - The case data
   * @param {NewPersonData} caseData.person - Person information
   * @param {NewCaseRecordData} caseData.caseRecord - Case record information
   * @param {string} [editingCaseId] - ID of case to update (omit for create)
   * @returns {Promise<OperationResult<StoredCase>>} Result with saved case or error
   * 
   * @example
   * // Create new case
   * const result = await caseOps.saveCase({
   *   person: { firstName: "John", lastName: "Doe", ... },
   *   caseRecord: { mcn: "12345", status: "Active", ... }
   * });
   * 
   * // Update existing case
   * const updateResult = await caseOps.saveCase(caseData, caseId);
   */
  async saveCase(
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCaseId?: string
  ): Promise<OperationResult<StoredCase>> {
    const isEditing = !!editingCaseId;
    
    try {
      let savedCase: StoredCase;
      if (editingCaseId) {
        savedCase = await this.dataManager.updateCompleteCase(editingCaseId, caseData);
      } else {
        savedCase = await this.dataManager.createCompleteCase(caseData);
      }

      return { success: true, data: savedCase };
    } catch (err) {
      logger.error('Failed to save case', {
        error: err instanceof Error ? err.message : String(err),
        isEditing,
      });
      return { 
        success: false, 
        error: `Failed to ${isEditing ? 'update' : 'create'} case. Please try again.` 
      };
    }
  }

  /**
   * Delete a single case.
   * 
   * Delegates to DataManager's deleteCase which also removes associated
   * financials, notes, and alerts.
   * 
   * @param {string} caseId - The ID of the case to delete
   * @returns {Promise<OperationResult<void>>} Result with success or error
   * 
   * @example
   * const result = await caseOps.deleteCase(caseId);
   * if (result.success) {
   *   console.log('Case deleted successfully');
   * }
   */
  async deleteCase(caseId: string): Promise<OperationResult<void>> {
    try {
      await this.dataManager.deleteCase(caseId);
      return { success: true, data: undefined };
    } catch (err) {
      logger.error('Failed to delete case', {
        error: err instanceof Error ? err.message : String(err),
        caseId,
      });
      return { success: false, error: 'Failed to delete case. Please try again.' };
    }
  }

  /**
   * Save a note (create new or update existing).
   * 
   * Delegates to DataManager's addNote or updateNote based on whether
   * editingNoteId is provided.
   * 
   * @param {NewNoteData} noteData - The note data (content, category, etc.)
   * @param {string} caseId - The ID of the case to add/update note for
   * @param {string} [editingNoteId] - ID of note to update (omit for create)
   * @returns {Promise<OperationResult<StoredNote>>} Result with saved note or error
   * 
   * @example
   * // Add new note
   * const result = await caseOps.saveNote(
   *   { content: "Follow-up scheduled", category: "Contact" },
   *   caseId
   * );
   * 
   * // Update existing note
   * const updateResult = await caseOps.saveNote(noteData, caseId, noteId);
   */
  async saveNote(
    noteData: NewNoteData,
    caseId: string,
    editingNoteId?: string
  ): Promise<OperationResult<StoredNote>> {
    const isEditing = !!editingNoteId;
    
    try {
      const savedNote = editingNoteId
        ? await this.dataManager.updateNote(caseId, editingNoteId, noteData)
        : await this.dataManager.addNote(caseId, noteData);

      return { success: true, data: savedNote };
    } catch (err) {
      const action = isEditing ? 'update' : 'add';
      logger.error('Failed to save note', {
        error: err instanceof Error ? err.message : String(err),
        caseId,
      });
      return { success: false, error: `Failed to ${action} note. Please try again.` };
    }
  }

  /**
   * Update a case's status.
   * 
   * Delegates to DataManager's updateCaseStatus which creates an activity
   * log entry for the status change.
   * 
   * **Special Handling:** AbortError (user cancelled) flagged with isAborted=true
   * 
   * @param {string} caseId - The ID of the case to update
   * @param {CaseStatus} status - The new status value
   * @returns {Promise<OperationResult<StoredCase>>} Result with updated case or error
   * 
   * @example
   * const result = await caseOps.updateCaseStatus(caseId, "Approved");
   * if (result.success) {
   *   console.log('Status updated:', result.data.status);
   * } else if (result.isAborted) {
   *   console.log('User cancelled operation');
   * }
   */
  async updateCaseStatus(
    caseId: string,
    status: StoredCase["status"]
  ): Promise<OperationResult<StoredCase>> {
    try {
      const updatedCase = await this.dataManager.updateCaseStatus(caseId, status);
      return { success: true, data: updatedCase };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, error: '', isAborted: true };
      }

      logger.error('Failed to update case status', {
        error: err instanceof Error ? err.message : String(err),
        caseId,
        status,
      });
      return { success: false, error: 'Failed to update case status. Please try again.' };
    }
  }

  /**
   * Import multiple cases at once.
   * 
   * Delegates to DataManager's importCases which handles deduplication
   * (skips cases with existing IDs). Updates file storage flags on success.
   * 
   * @param {StoredCase[]} importedCases - Array of cases to import
   * @returns {Promise<OperationResult<void>>} Result with success or error
   * 
   * @example
   * const result = await caseOps.importCases(parsedCases);
   * if (result.success) {
   *   console.log('Cases imported successfully');
   * }
   */
  async importCases(importedCases: StoredCase[]): Promise<OperationResult<void>> {
    try {
      await this.dataManager.importCases(importedCases);
      updateFileStorageFlags({ dataBaseline: true, sessionHadData: true });
      return { success: true, data: undefined };
    } catch (err) {
      logger.error('Failed to import cases', {
        error: err instanceof Error ? err.message : String(err),
        caseCount: importedCases.length,
      });
      return { success: false, error: 'Failed to import cases. Please try again.' };
    }
  }

  /**
   * Delete multiple cases at once (bulk operation).
   * 
   * Delegates to DataManager's deleteCases which removes all cases and their
   * associated data in a single operation.
   * 
   * @param {string[]} caseIds - Array of case IDs to delete
   * @returns {Promise<OperationResult<{deleted: number, notFound: string[]}>>}
   *   Result with deletion statistics or error
   * 
   * @example
   * const result = await caseOps.deleteCases([id1, id2, id3]);
   * if (result.success) {
   *   console.log(`Deleted ${result.data.deleted} cases`);
   *   if (result.data.notFound.length > 0) {
   *     console.log(`Not found: ${result.data.notFound.length}`);
   *   }
   * }
   */
  async deleteCases(caseIds: string[]): Promise<OperationResult<{ deleted: number; notFound: string[] }>> {
    try {
      const result = await this.dataManager.deleteCases(caseIds);
      logger.info('Bulk delete completed', { deleted: result.deleted, notFound: result.notFound.length });
      return { success: true, data: result };
    } catch (err) {
      logger.error('Failed to delete cases', {
        error: err instanceof Error ? err.message : String(err),
        caseCount: caseIds.length,
      });
      return { success: false, error: 'Failed to delete cases. Please try again.' };
    }
  }

  /**
   * Update status for multiple cases at once (bulk operation).
   * 
   * Delegates to DataManager's updateCasesStatus which updates all cases
   * and creates activity log entries in a single operation.
   * 
   * @param {string[]} caseIds - Array of case IDs to update
   * @param {CaseStatus} status - The new status to apply to all cases
   * @returns {Promise<OperationResult<{updated: StoredCase[], notFound: string[]}>>}
   *   Result with update statistics or error
   * 
   * @example
   * const result = await caseOps.updateCasesStatus([id1, id2, id3], "Pending");
   * if (result.success) {
   *   console.log(`Updated ${result.data.updated.length} cases`);
   * }
   */
  async updateCasesStatus(
    caseIds: string[],
    status: StoredCase["status"]
  ): Promise<OperationResult<{ updated: StoredCase[]; notFound: string[] }>> {
    try {
      const result = await this.dataManager.updateCasesStatus(caseIds, status);
      logger.info('Bulk status update completed', { updated: result.updated.length, notFound: result.notFound.length });
      return { success: true, data: result };
    } catch (err) {
      logger.error('Failed to update case statuses', {
        error: err instanceof Error ? err.message : String(err),
        caseCount: caseIds.length,
        status,
      });
      return { success: false, error: 'Failed to update case statuses. Please try again.' };
    }
  }

  /**
   * Update priority for multiple cases at once (bulk operation).
   * 
   * Delegates to DataManager's updateCasesPriority which updates all cases
   * and creates activity log entries in a single operation.
   * 
   * @param {string[]} caseIds - Array of case IDs to update
   * @param {boolean} priority - The priority flag to set (true = priority case)
   * @returns {Promise<OperationResult<{updated: StoredCase[], notFound: string[]}>>}
   *   Result with update statistics or error
   * 
   * @example
   * const result = await caseOps.updateCasesPriority([id1, id2], true);
   * if (result.success) {
   *   console.log(`Marked ${result.data.updated.length} cases as priority`);
   * }
   */
  async updateCasesPriority(
    caseIds: string[],
    priority: boolean
  ): Promise<OperationResult<{ updated: StoredCase[]; notFound: string[] }>> {
    try {
      const result = await this.dataManager.updateCasesPriority(caseIds, priority);
      logger.info('Bulk priority update completed', { updated: result.updated.length, notFound: result.notFound.length });
      return { success: true, data: result };
    } catch (err) {
      logger.error('Failed to update case priorities', {
        error: err instanceof Error ? err.message : String(err),
        caseCount: caseIds.length,
        priority,
      });
      return { success: false, error: 'Failed to update case priorities. Please try again.' };
    }
  }
}
