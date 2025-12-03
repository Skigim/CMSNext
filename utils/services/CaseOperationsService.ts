import { NewPersonData, NewCaseRecordData, NewNoteData, StoredCase, StoredNote } from '@/types/case';
import { DataManager } from '@/utils/DataManager';
import { getFileStorageFlags, updateFileStorageFlags } from '@/utils/fileStorageFlags';
import { createLogger } from '@/utils/logger';
import { LegacyFormatError } from '@/utils/services/FileStorageService';

const logger = createLogger('CaseOperationsService');

/** Result type for service operations */
export type OperationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; isLegacyFormat?: boolean; isAborted?: boolean };

/**
 * Pure business logic service for case operations.
 * No React dependencies, no UI concerns (toasts, mounted checks).
 * Handles DataManager interactions, error handling, and logging.
 */
export class CaseOperationsService {
  constructor(private dataManager: DataManager) {}

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

  async saveCase(
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCaseId?: string
  ): Promise<OperationResult<void>> {
    const isEditing = !!editingCaseId;
    
    try {
      if (editingCaseId) {
        await this.dataManager.updateCompleteCase(editingCaseId, caseData);
      } else {
        await this.dataManager.createCompleteCase(caseData);
      }

      return { success: true, data: undefined };
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
