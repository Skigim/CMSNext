import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { CaseDisplay, NewPersonData, NewCaseRecordData, NewNoteData } from '@/types/case';
import { useDataManagerSafe } from '@/contexts/DataManagerContext';
import {
  getFileStorageFlags,
  updateFileStorageFlags,
} from '@/utils/fileStorageFlags';

interface UseCaseManagementReturn {
  // State
  cases: CaseDisplay[];
  loading: boolean;
  error: string | null;
  hasLoadedData: boolean;
  
  // Actions
  loadCases: () => Promise<CaseDisplay[]>;
  saveCase: (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }, editingCase?: CaseDisplay | null) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;
  saveNote: (noteData: NewNoteData, caseId: string, editingNote?: { id: string } | null) => Promise<CaseDisplay | null>;
  importCases: (importedCases: CaseDisplay[]) => Promise<void>;
  updateCaseStatus: (caseId: string, status: CaseDisplay["status"]) => Promise<CaseDisplay | null>;
  
  // State setters for external control
  setCases: React.Dispatch<React.SetStateAction<CaseDisplay[]>>;
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
  const dataManager = useDataManagerSafe(); // Returns null if not available - safe fallback
  
  const [cases, setCases] = useState<CaseDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedData, setHasLoadedData] = useState(false);

  /**
   * Load all cases from file system via DataManager
   */
  const loadCases = useCallback(async (): Promise<CaseDisplay[]> => {
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
      setCases(data);
      setHasLoadedData(true);
      
      // Set baseline - we've now loaded data (even if empty)
      updateFileStorageFlags({ dataBaseline: true });
      
      if (data.length > 0) {
        updateFileStorageFlags({ sessionHadData: true });
        // Don't show toast here - let the connection flow handle user feedback
        console.log(`[DataManager] Successfully loaded ${data.length} cases`);
      } else {
        // Only show toast for empty state if not during connection flow
        if (!getFileStorageFlags().inConnectionFlow) {
          toast.success(`Connected successfully - ready to start fresh`, {
            id: 'connected-empty',
            duration: 3000
          });
        }
        console.log(`[DataManager] Successfully loaded ${data.length} cases (empty)`);
      }
      
      return data; // Return the loaded data
    } catch (err) {
      console.error('Failed to load cases:', err);
      const errorMsg = 'Failed to load cases. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
      return []; // Return empty array on error
    } finally {
      setLoading(false);
    }
  }, [dataManager]);

  /**
   * Save (create or update) a case
   */
  const saveCase = useCallback(async (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: CaseDisplay | null
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
        const updatedCase = await dataManager.updateCompleteCase(editingCase.id, caseData);
        
        // Update local state to reflect changes immediately
        setCases(prevCases => 
          prevCases.map(c => 
            c.id === editingCase.id ? updatedCase : c
          )
        );
        
        toast.success(`Case for ${caseData.person.firstName} ${caseData.person.lastName} updated successfully`, { id: toastId });
      } else {
        // Create new case using DataManager
        const newCase = await dataManager.createCompleteCase(caseData);
        setCases(prevCases => [...prevCases, newCase]);
        
        toast.success(`Case for ${caseData.person.firstName} ${caseData.person.lastName} created successfully`, { id: toastId });
      }
      
      // DataManager handles file system persistence automatically
    } catch (err) {
      console.error('Failed to save case:', err);
      const errorMsg = `Failed to ${isEditing ? 'update' : 'create'} case. Please try again.`;
      setError(errorMsg);
      toast.error(errorMsg, { id: toastId });
      throw err; // Re-throw to allow caller to handle
    }
  }, [dataManager]);

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
      await dataManager.deleteCase(caseId);
      
      // Remove the case from the local state
      setCases(prevCases => prevCases.filter(c => c.id !== caseId));
      
      toast.success(`${personName} case deleted successfully`);
      
      // DataManager handles file system persistence automatically
    } catch (err) {
      console.error('Failed to delete case:', err);
      const errorMsg = 'Failed to delete case. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
      throw err; // Re-throw to allow caller to handle
    }
  }, [dataManager, cases]);

  /**
   * Save (create or update) a note on a case
   */
  const saveNote = useCallback(async (
    noteData: NewNoteData,
    caseId: string,
    editingNote?: { id: string } | null
  ): Promise<CaseDisplay | null> => {
    if (!dataManager) {
      const errorMsg = 'Data storage is not available. Please connect to a folder first.';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }

    const isEditing = !!editingNote;

    try {
      setError(null);
      let updatedCase: CaseDisplay;
      
      if (editingNote) {
        // Update existing note
        updatedCase = await dataManager.updateNote(caseId, editingNote.id, noteData);
        toast.success("Note updated successfully");
      } else {
        // Add new note
        updatedCase = await dataManager.addNote(caseId, noteData);
        toast.success("Note added successfully");
      }
      
      setCases(prevCases =>
        prevCases.map(c =>
          c.id === caseId ? updatedCase : c
        )
      );
      
      // DataManager handles file system persistence automatically
      return updatedCase;
    } catch (err) {
      console.error('Failed to save note:', err);
      const errorMsg = `Failed to ${isEditing ? 'update' : 'add'} note. Please try again.`;
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }
  }, [dataManager]);

  const updateCaseStatus = useCallback(
    async (caseId: string, status: CaseDisplay["status"]): Promise<CaseDisplay | null> => {
      if (!dataManager) {
        const errorMsg = 'Data storage is not available. Please connect to a folder first.';
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      }

      const toastId = toast.loading('Updating case status...');

      try {
        setError(null);
        const updatedCase = await dataManager.updateCaseStatus(caseId, status);
        setCases(prevCases => prevCases.map(c => (c.id === caseId ? updatedCase : c)));
        toast.success(`Status updated to ${status}`, { id: toastId, duration: 2000 });
        return updatedCase;
      } catch (err) {
        console.error('Failed to update case status:', err);
        const errorMsg = 'Failed to update case status. Please try again.';
        setError(errorMsg);
        toast.error(errorMsg, { id: toastId });
        return null;
      }
    },
    [dataManager, setCases, setError],
  );

  /**
   * Import multiple cases from external source
   */
  const importCases = useCallback(async (importedCases: CaseDisplay[]) => {
    try {
      setError(null);
      
      // Add imported cases to the current list
      setCases(prevCases => [...prevCases, ...importedCases]);
      setHasLoadedData(true);
      
  // Set baseline - we now have data
  updateFileStorageFlags({ dataBaseline: true, sessionHadData: true });
      
      toast.success(`Imported ${importedCases.length} cases successfully`);
      
      // Note: Import process should handle DataManager persistence at the import level
    } catch (err) {
      console.error('Failed to import cases:', err);
      const errorMsg = 'Failed to import cases. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
      throw err;
    }
  }, []);

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