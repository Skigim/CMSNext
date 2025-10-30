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
 * Future: This adapter will be replaced with proper domain-based service
 * once type adapters between CaseDisplay and Case entities are created.
 */
export class CaseManagementAdapter {
  constructor(private readonly dataManager: DataManager | null) {}

  /**
   * Check if the service is available (DataManager connected)
   */
  isAvailable(): boolean {
    return this.dataManager !== null;
  }

  /**
   * Load all cases from file system
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
      console.error('Failed to load cases:', err);
      const errorMsg = 'Failed to load cases. Please try again.';
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Create or update a case
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
      logger.error('Failed to save case', {
        error: err instanceof Error ? err.message : String(err),
        isEditing,
      });
      const errorMsg = `Failed to ${isEditing ? 'update' : 'create'} case. Please try again.`;
      toast.error(errorMsg, { id: toastId });
      throw err;
    }
  }

  /**
   * Delete a case by ID
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
      logger.error('Failed to delete case', {
        error: err instanceof Error ? err.message : String(err),
        caseId,
      });
      const errorMsg = 'Failed to delete case. Please try again.';
      toast.error(errorMsg);
      throw err;
    }
  }

  /**
   * Save (create or update) a note on a case
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
      logger.error('Failed to save note', {
        error: err instanceof Error ? err.message : String(err),
        caseId,
        isEditing,
      });
      const errorMsg = `Failed to ${isEditing ? 'update' : 'add'} note. Please try again.`;
      toast.error(errorMsg);
      throw err;
    }
  }

  /**
   * Update case status
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
        throw err;
      }

      logger.error('Failed to update case status', {
        error: err instanceof Error ? err.message : String(err),
        caseId,
        status,
      });
      const errorMsg = 'Failed to update case status. Please try again.';
      toast.error(errorMsg, { id: toastId });
      throw err;
    }
  }

  /**
   * Import multiple cases from external source
   * Note: This method doesn't persist through DataManager - that's handled at import level
   */
  async importCases(importedCases: CaseDisplay[]): Promise<void> {
    try {
      // Set baseline - we now have data
      updateFileStorageFlags({ dataBaseline: true, sessionHadData: true });
      
      toast.success(`Imported ${importedCases.length} cases successfully`);
    } catch (err) {
      logger.error('Failed to import cases', {
        error: err instanceof Error ? err.message : String(err),
        caseCount: importedCases.length,
      });
      const errorMsg = 'Failed to import cases. Please try again.';
      toast.error(errorMsg);
      throw err;
    }
  }
}

export default CaseManagementAdapter;
