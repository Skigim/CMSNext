import { toast } from 'sonner';
import type { CaseDisplay, NewPersonData, NewCaseRecordData, NewNoteData } from '@/types/case';
import type DataManager from '@/utils/DataManager';
import { createLogger } from '@/utils/logger';
import {
  getFileStorageFlags,
  updateFileStorageFlags,
} from '@/utils/fileStorageFlags';

const logger = createLogger('CaseManagementAdapter');

/**
 * Service adapter for case management operations.
 * 
 * This adapter wraps DataManager and provides a clean service interface
 * for case management operations. It extracts business logic from the
 * useCaseManagement hook, making the hook a thin wrapper.
 * 
 * @remarks
 * This is a transitional adapter that bridges the legacy DataManager
 * (which uses CaseDisplay types) and the future domain-based service
 * (which will use Case entities). It follows the Strangler Fig pattern
 * for gradual migration.
 * 
 * @example
 * ```typescript
 * const adapter = new CaseManagementAdapter(dataManager);
 * if (adapter.isAvailable()) {
 *   const cases = await adapter.loadCases();
 * }
 * ```
 * 
 * @see {@link CaseManagementService} for the domain-based implementation
 */
export class CaseManagementAdapter {
  /**
   * Creates a new CaseManagementAdapter instance.
   * 
   * @param dataManager - The DataManager instance to wrap. Can be null if not connected.
   */
  constructor(private readonly dataManager: DataManager | null) {}

  /**
   * Checks if the service is available for operations.
   * 
   * @returns true if DataManager is connected and operations can be performed
   * 
   * @example
   * ```typescript
   * if (!adapter.isAvailable()) {
   *   console.error('Please connect to a folder first');
   * }
   * ```
   */
  isAvailable(): boolean {
    return this.dataManager !== null;
  }

  /**
   * Loads all cases from the file system.
   * 
   * Handles loading feedback and updates file storage flags to track
   * data baseline and session state. Shows appropriate toast notifications
   * based on the connection flow state.
   * 
   * @returns Promise resolving to array of all cases
   * @throws {Error} If DataManager is not available or loading fails
   * 
   * @example
   * ```typescript
   * try {
   *   const cases = await adapter.loadCases();
   *   console.log(`Loaded ${cases.length} cases`);
   * } catch (error) {
   *   console.error('Failed to load cases:', error);
   * }
   * ```
   */
  async loadCases(): Promise<CaseDisplay[]> {
    if (!this.dataManager) {
      const errorMsg = 'Data storage is not available. Please connect to a folder first.';
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const data = await this.dataManager.getAllCases();
      
      // Set baseline - we've now loaded data (even if empty)
      updateFileStorageFlags({ dataBaseline: true });
      
      if (data.length > 0) {
        updateFileStorageFlags({ sessionHadData: true });
        logger.info('Cases loaded', { caseCount: data.length });
      } else {
        // Only show toast for empty state if not during connection flow
        if (!getFileStorageFlags().inConnectionFlow) {
          toast.success(`Connected successfully - ready to start fresh`, {
            id: 'connected-empty',
            duration: 3000
          });
        }
        logger.debug('Cases loaded (empty)');
      }
      
      return data;
    } catch (err) {
      const errorContext = {
        error: err instanceof Error ? err.message : String(err),
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        operation: 'loadCases',
      };
      console.error('Failed to load cases:', errorContext);
      logger.error('Failed to load cases', errorContext);
      
      const errorMsg = `Failed to load cases: ${err instanceof Error ? err.message : 'Unknown error'}. Please check your connection and try again.`;
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Creates a new case or updates an existing one.
   * 
   * Provides loading feedback via toasts and handles both create and update
   * operations seamlessly. Updates are identified by the presence of editingCase.
   * 
   * @param caseData - The person and case record data to save
   * @param caseData.person - Person information (name, contact, etc.)
   * @param caseData.caseRecord - Case record information (MCN, status, etc.)
   * @param editingCase - Optional existing case to update. If null/undefined, creates new case.
   * 
   * @returns Promise resolving to the created or updated case
   * @throws {Error} If DataManager is not available or save operation fails
   * 
   * @example
   * ```typescript
   * // Create new case
   * const newCase = await adapter.saveCase({
   *   person: { firstName: 'John', lastName: 'Doe', ... },
   *   caseRecord: { mcn: 'MCN-001', status: 'Active', ... }
   * });
   * 
   * // Update existing case
   * const updated = await adapter.saveCase(formData, existingCase);
   * ```
   */
  async saveCase(
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: CaseDisplay | null
  ): Promise<CaseDisplay> {
    if (!this.dataManager) {
      const errorMsg = 'Data storage is not available. Please connect to a folder first.';
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    const isEditing = !!editingCase;
    const toastId = toast.loading(isEditing ? "Updating case..." : "Creating case...");

    try {
      let result: CaseDisplay;
      
      if (editingCase) {
        // Update existing case using DataManager
        result = await this.dataManager.updateCompleteCase(editingCase.id, caseData);
        toast.success(`Case for ${caseData.person.firstName} ${caseData.person.lastName} updated successfully`, { id: toastId });
      } else {
        // Create new case using DataManager
        result = await this.dataManager.createCompleteCase(caseData);
        toast.success(`Case for ${caseData.person.firstName} ${caseData.person.lastName} created successfully`, { id: toastId });
      }
      
      return result;
    } catch (err) {
      const errorContext = {
        error: err instanceof Error ? err.message : String(err),
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        operation: isEditing ? 'updateCase' : 'createCase',
        caseId: editingCase?.id,
      };
      logger.error('Failed to save case', errorContext);
      
      const errorMsg = `Failed to ${isEditing ? 'update' : 'create'} case: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`;
      toast.error(errorMsg, { id: toastId });
      throw err;
    }
  }

  /**
   * Deletes a case by its ID.
   * 
   * Permanently removes the case from storage and shows success feedback.
   * The person's name can be provided for a personalized success message.
   * 
   * @param caseId - The unique identifier of the case to delete
   * @param personName - Optional person name for personalized toast message
   * 
   * @returns Promise that resolves when deletion is complete
   * @throws {Error} If DataManager is not available or deletion fails
   * 
   * @example
   * ```typescript
   * // Delete with personalized message
   * await adapter.deleteCase('case-123', 'John Doe');
   * // Shows: "John Doe deleted successfully"
   * 
   * // Delete with generic message
   * await adapter.deleteCase('case-123');
   * // Shows: "Case deleted successfully"
   * ```
   */
  async deleteCase(caseId: string, personName?: string): Promise<void> {
    if (!this.dataManager) {
      const errorMsg = 'Data storage is not available. Please connect to a folder first.';
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    const displayName = personName || 'Case';
    
    try {
      await this.dataManager.deleteCase(caseId);
      toast.success(`${displayName} deleted successfully`);
    } catch (err) {
      const errorContext = {
        error: err instanceof Error ? err.message : String(err),
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        operation: 'deleteCase',
        caseId,
      };
      logger.error('Failed to delete case', errorContext);
      
      const errorMsg = `Failed to delete case: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`;
      toast.error(errorMsg);
      throw err;
    }
  }

  /**
   * Creates a new note or updates an existing note on a case.
   * 
   * Notes are associated with a specific case and can be created or updated
   * based on whether editingNote is provided.
   * 
   * @param noteData - The note content and metadata
   * @param caseId - The ID of the case to add/update the note on
   * @param editingNote - Optional existing note to update. If provided, updates; otherwise creates.
   * 
   * @returns Promise resolving to the updated case with the new/updated note
   * @throws {Error} If DataManager is not available or operation fails
   * 
   * @example
   * ```typescript
   * // Add new note
   * const updated = await adapter.saveNote(
   *   { category: 'General', content: 'Follow up needed' },
   *   'case-123'
   * );
   * 
   * // Update existing note
   * const updated = await adapter.saveNote(
   *   { category: 'General', content: 'Follow up completed' },
   *   'case-123',
   *   { id: 'note-456' }
   * );
   * ```
   */
  async saveNote(
    noteData: NewNoteData,
    caseId: string,
    editingNote?: { id: string } | null
  ): Promise<CaseDisplay> {
    if (!this.dataManager) {
      const errorMsg = 'Data storage is not available. Please connect to a folder first.';
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    const isEditing = !!editingNote;

    try {
      let updatedCase: CaseDisplay;
      
      if (editingNote) {
        // Update existing note
        updatedCase = await this.dataManager.updateNote(caseId, editingNote.id, noteData);
        toast.success("Note updated successfully");
      } else {
        // Add new note
        updatedCase = await this.dataManager.addNote(caseId, noteData);
        toast.success("Note added successfully");
      }
      
      return updatedCase;
    } catch (err) {
      const errorContext = {
        error: err instanceof Error ? err.message : String(err),
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        operation: isEditing ? 'updateNote' : 'addNote',
        caseId,
        noteId: editingNote?.id,
      };
      logger.error('Failed to save note', errorContext);
      
      const errorMsg = `Failed to ${isEditing ? 'update' : 'add'} note: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`;
      toast.error(errorMsg);
      throw err;
    }
  }

  /**
   * Updates the status of a case.
   * 
   * Handles status transitions with loading feedback and special handling
   * for AbortError (when user cancels the operation).
   * 
   * @param caseId - The ID of the case to update
   * @param status - The new status to set (Active, Pending, Closed, or Archived)
   * 
   * @returns Promise resolving to the updated case
   * @throws {Error} If DataManager is not available or update fails
   * @throws {AbortError} If user cancels the operation (rethrown without toast)
   * 
   * @example
   * ```typescript
   * try {
   *   const updated = await adapter.updateCaseStatus('case-123', 'Closed');
   *   console.log('Status updated to:', updated.status);
   * } catch (error) {
   *   if (error.name === 'AbortError') {
   *     // User cancelled - no action needed
   *   } else {
   *     // Handle other errors
   *   }
   * }
   * ```
   */
  async updateCaseStatus(caseId: string, status: CaseDisplay["status"]): Promise<CaseDisplay> {
    if (!this.dataManager) {
      const errorMsg = 'Data storage is not available. Please connect to a folder first.';
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    const toastId = toast.loading('Updating case status...');

    try {
      const updatedCase = await this.dataManager.updateCaseStatus(caseId, status);
      toast.success(`Status updated to ${status}`, { id: toastId, duration: 2000 });
      return updatedCase;
    } catch (err) {
      // Handle AbortError specially (user cancelled)
      if (err instanceof Error && err.name === 'AbortError') {
        toast.dismiss(toastId);
        throw err; // Rethrow without additional error handling
      }

      const errorContext = {
        error: err instanceof Error ? err.message : String(err),
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        operation: 'updateCaseStatus',
        caseId,
        targetStatus: status,
      };
      logger.error('Failed to update case status', errorContext);
      
      const errorMsg = `Failed to update case status to ${status}: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`;
      toast.error(errorMsg, { id: toastId });
      throw err;
    }
  }

  /**
   * Imports multiple cases from an external source.
   * 
   * This method sets file storage flags to indicate data has been imported
   * but does NOT persist the cases through DataManager - persistence is
   * handled at the import level by the calling code.
   * 
   * @param importedCases - Array of cases to import
   * 
   * @returns Promise that resolves when import flags are set
   * @throws {Error} If import operation fails
   * 
   * @remarks
   * This is a lightweight operation that only manages import state flags.
   * The actual persistence of imported cases is the responsibility of the
   * import workflow, not this service method.
   * 
   * @example
   * ```typescript
   * const casesToImport = [...]; // Cases from CSV or other source
   * await adapter.importCases(casesToImport);
   * // Cases are now flagged as imported, but persist them separately
   * ```
   */
  async importCases(importedCases: CaseDisplay[]): Promise<void> {
    try {
      // Set baseline - we now have data
      updateFileStorageFlags({ dataBaseline: true, sessionHadData: true });
      
      toast.success(`Imported ${importedCases.length} cases successfully`);
    } catch (err) {
      const errorContext = {
        error: err instanceof Error ? err.message : String(err),
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        operation: 'importCases',
        caseCount: importedCases.length,
      };
      logger.error('Failed to import cases', errorContext);
      
      const errorMsg = `Failed to import ${importedCases.length} cases: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`;
      toast.error(errorMsg);
      throw err;
    }
  }
}

export default CaseManagementAdapter;
