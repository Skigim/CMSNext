import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useIsMounted } from './useIsMounted';
import { NewPersonData, NewCaseRecordData, NewNoteData, StoredCase, StoredNote } from '@/types/case';
import { useDataManagerSafe } from '@/contexts/DataManagerContext';
import {
  getFileStorageFlags,
  updateFileStorageFlags,
} from '@/utils/fileStorageFlags';
import { createLogger } from '@/utils/logger';
import { LegacyFormatError } from '@/utils/services/FileStorageService';

const logger = createLogger('CaseManagement');
interface UseCaseManagementReturn {
  // State
  cases: StoredCase[];
  loading: boolean;
  error: string | null;
  hasLoadedData: boolean;
  
  // Actions
  loadCases: () => Promise<StoredCase[]>;
  saveCase: (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }, editingCase?: StoredCase | null) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;
  saveNote: (noteData: NewNoteData, caseId: string, editingNote?: { id: string } | null) => Promise<StoredNote | null>;
  importCases: (importedCases: StoredCase[]) => Promise<void>;
  updateCaseStatus: (caseId: string, status: StoredCase["status"]) => Promise<StoredCase | null>;
  
  // State setters for external control
  setCases: React.Dispatch<React.SetStateAction<StoredCase[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setHasLoadedData: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Secure case management hook using DataManager only
 * 
 * Core Principles:
 * - Uses DataManager exclusively (no fileDataProvider fallback)
 * - File system is single source of truth
 * - No render-time data storage
 * - Automatic persistence through DataManager
 */
export function useCaseManagement(): UseCaseManagementReturn {
  const isMounted = useIsMounted();
  const dataManager = useDataManagerSafe(); // Returns null if not available - safe fallback
  
  const [cases, setCases] = useState<StoredCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedData, setHasLoadedData] = useState(false);

  /**
   * Load all cases from file system via DataManager
   */
  const loadCases = useCallback(async (): Promise<StoredCase[]> => {
    if (!dataManager) {
      const errorMsg = 'Data storage is not available. Please connect to a folder first.';
      setError(errorMsg);
      toast.error(errorMsg);
      return [];
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await dataManager.getAllCases();
      
      // Check if still mounted after async operation
      if (!isMounted.current) return [];
      
      setCases(data);
      setHasLoadedData(true);
      
      // Set baseline - we've now loaded data (even if empty)
      updateFileStorageFlags({ dataBaseline: true });
      
      if (data.length > 0) {
        updateFileStorageFlags({ sessionHadData: true });
        // Don't show toast here - let the connection flow handle user feedback
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
      
      return data; // Return the loaded data
    } catch (err) {
      // LegacyFormatError is expected when opening old data files - handle gracefully
      if (err instanceof LegacyFormatError) {
        logger.warn('Legacy format detected', { message: err.message });
        setError(err.message);
        toast.error(err.message, { duration: 8000 });
        return [];
      }
      console.error('Failed to load cases:', err);
      const errorMsg = 'Failed to load cases. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
      return []; // Return empty array on error
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [dataManager, isMounted]);

  /**
   * Save (create or update) a case
   */
  const saveCase = useCallback(async (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: StoredCase | null
  ) => {
    if (!dataManager) {
      const errorMsg = 'Data storage is not available. Please connect to a folder first.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    const isEditing = !!editingCase;
    const toastId = toast.loading(isEditing ? "Updating case..." : "Creating case...");

    try {
      setError(null);
      
      if (editingCase) {
        // Update existing case using DataManager
        // Note: State updates are handled by the file storage broadcast via useFileDataSync
        await dataManager.updateCompleteCase(editingCase.id, caseData);
        
        // Check if still mounted after async operation
        if (!isMounted.current) return;
        
        toast.success(`Case for ${caseData.person.firstName} ${caseData.person.lastName} updated successfully`, { id: toastId });
      } else {
        // Create new case using DataManager
        // Note: State updates are handled by the file storage broadcast via useFileDataSync
        // Do not add optimistic updates here as they cause ephemeral duplicate entries
        await dataManager.createCompleteCase(caseData);
        
        // Check if still mounted after async operation
        if (!isMounted.current) return;
        
        toast.success(`Case for ${caseData.person.firstName} ${caseData.person.lastName} created successfully`, { id: toastId });
      }
      
      // DataManager handles file system persistence automatically
    } catch (err) {
      logger.error('Failed to save case', {
        error: err instanceof Error ? err.message : String(err),
        isEditing,
      });
      const errorMsg = `Failed to ${isEditing ? 'update' : 'create'} case. Please try again.`;
      setError(errorMsg);
      toast.error(errorMsg, { id: toastId });
      throw err; // Re-throw to allow caller to handle
    }
  }, [dataManager, isMounted]);

  /**
   * Delete a case by ID
   */
  const deleteCase = useCallback(async (caseId: string) => {
    if (!dataManager) {
      const errorMsg = 'Data storage is not available. Please connect to a folder first.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Find the case to get the person's name for the toast
    const caseToDelete = cases.find(c => c.id === caseId);
    const personName = caseToDelete ? `${caseToDelete.person.firstName} ${caseToDelete.person.lastName}` : 'Case';
    
    try {
      setError(null);
      // Note: State updates are handled by the file storage broadcast via useFileDataSync
      await dataManager.deleteCase(caseId);
      
      // Check if still mounted after async operation
      if (!isMounted.current) return;
      
      toast.success(`${personName} case deleted successfully`);
    } catch (err) {
      logger.error('Failed to delete case', {
        error: err instanceof Error ? err.message : String(err),
        caseId,
      });
      const errorMsg = 'Failed to delete case. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
      throw err; // Re-throw to allow caller to handle
    }
  }, [dataManager, cases, isMounted]);

  /**
   * Save (create or update) a note on a case
   */
  const saveNote = useCallback(async (
    noteData: NewNoteData,
    caseId: string,
    editingNote?: { id: string } | null
  ): Promise<StoredNote | null> => {
    if (!dataManager) {
      const errorMsg = 'Data storage is not available. Please connect to a folder first.';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }

    const isEditing = !!editingNote;

    try {
      setError(null);
      let savedNote: StoredNote;
      
      if (editingNote) {
        // Update existing note
        savedNote = await dataManager.updateNote(caseId, editingNote.id, noteData);
        toast.success("Note updated successfully");
      } else {
        // Add new note
        savedNote = await dataManager.addNote(caseId, noteData);
        toast.success("Note added successfully");
      }
      
      // Note: We don't update local cases state because notes are no longer nested in cases
      // Components should use useNotes() or getNotesForCase() to fetch notes
      
      // DataManager handles file system persistence automatically
      return savedNote;
    } catch (err) {
      logger.error('Failed to save note', {
        error: err instanceof Error ? err.message : String(err),
        caseId,
        isEditing,
      });
      const errorMsg = `Failed to ${isEditing ? 'update' : 'add'} note. Please try again.`;
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }
  }, [dataManager]);

  const updateCaseStatus = useCallback(
    async (caseId: string, status: StoredCase["status"]): Promise<StoredCase | null> => {
      if (!dataManager) {
        const errorMsg = 'Data storage is not available. Please connect to a folder first.';
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      }

      const toastId = toast.loading('Updating case status...');

      try {
        setError(null);
        // Note: State updates are handled by the file storage broadcast via useFileDataSync
        const updatedCase = await dataManager.updateCaseStatus(caseId, status);
        
        // Check if still mounted after async operation
        if (!isMounted.current) return null;
        
        toast.success(`Status updated to ${status}`, { id: toastId, duration: 2000 });
        return updatedCase;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          toast.dismiss(toastId);
          return null;
        }

        logger.error('Failed to update case status', {
          error: err instanceof Error ? err.message : String(err),
          caseId,
          status,
        });
        const errorMsg = 'Failed to update case status. Please try again.';
        setError(errorMsg);
        toast.error(errorMsg, { id: toastId });
        return null;
      }
    },
    [dataManager, isMounted, setError],
  );

  /**
   * Import multiple cases from external source
   */
  const importCases = useCallback(async (importedCases: StoredCase[]) => {
    try {
      setError(null);
      
      if (!dataManager) {
        throw new Error('Data storage is not available');
      }

      // Use DataManager to import cases
      // Note: State updates are handled by the file storage broadcast via useFileDataSync
      await dataManager.importCases(importedCases);
      
      // Check if still mounted after async operation
      if (!isMounted.current) return;
      
      setHasLoadedData(true);
      
  // Set baseline - we now have data
  updateFileStorageFlags({ dataBaseline: true, sessionHadData: true });
      
      toast.success(`Imported ${importedCases.length} cases successfully`);
    } catch (err) {
      logger.error('Failed to import cases', {
        error: err instanceof Error ? err.message : String(err),
        caseCount: importedCases.length,
      });
      const errorMsg = 'Failed to import cases. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
      throw err;
    }
  }, [dataManager, isMounted]);

  return {
    // State
    cases,
    loading,
    error,
    hasLoadedData,
    
    // Actions
    loadCases,
    saveCase,
    deleteCase,
    saveNote,
  importCases,
  updateCaseStatus,
    
    // State setters for external control
    setCases,
    setError,
    setHasLoadedData,
  };
}