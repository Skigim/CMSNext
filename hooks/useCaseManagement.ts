import { useState, useCallback } from 'react';
import type { CaseDisplay, NewPersonData, NewCaseRecordData, NewNoteData } from '@/types/case';
import { useCaseService } from '@/contexts/CaseServiceContext';

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
 * Case management hook - thin wrapper around CaseManagementAdapter service.
 * 
 * Maintains React state for UI components while delegating all business logic
 * to the service layer. This hook is now ~50 lines instead of 326 lines.
 * 
 * The service layer (CaseManagementAdapter) handles:
 * - Business logic validation
 * - Toast notifications
 * - Error handling
 * - DataManager integration
 */
export function useCaseManagement(): UseCaseManagementReturn {
  const service = useCaseService();
  
  const [cases, setCases] = useState<CaseDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedData, setHasLoadedData] = useState(false);

  const loadCases = useCallback(async (): Promise<CaseDisplay[]> => {
    if (!service.isAvailable()) {
      setError('Data storage is not available. Please connect to a folder first.');
      return [];
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await service.loadCases();
      setCases(data);
      setHasLoadedData(true);
      
      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load cases';
      setError(errorMsg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [service]);

  const saveCase = useCallback(async (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: CaseDisplay | null
  ) => {
    try {
      setError(null);
      const result = await service.saveCase(caseData, editingCase);
      
      if (editingCase) {
        setCases(prevCases => 
          prevCases.map(c => c.id === editingCase.id ? result : c)
        );
      } else {
        setCases(prevCases => [...prevCases, result]);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save case';
      setError(errorMsg);
      throw err;
    }
  }, [service]);

  const deleteCase = useCallback(async (caseId: string) => {
    const caseToDelete = cases.find(c => c.id === caseId);
    const personName = caseToDelete ? `${caseToDelete.person.firstName} ${caseToDelete.person.lastName}` : undefined;
    
    try {
      setError(null);
      await service.deleteCase(caseId, personName);
      setCases(prevCases => prevCases.filter(c => c.id !== caseId));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete case';
      setError(errorMsg);
      throw err;
    }
  }, [service, cases]);

  const saveNote = useCallback(async (
    noteData: NewNoteData,
    caseId: string,
    editingNote?: { id: string } | null
  ): Promise<CaseDisplay | null> => {
    try {
      setError(null);
      const updatedCase = await service.saveNote(noteData, caseId, editingNote);
      setCases(prevCases =>
        prevCases.map(c => c.id === caseId ? updatedCase : c)
      );
      return updatedCase;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save note';
      setError(errorMsg);
      return null;
    }
  }, [service]);

  const updateCaseStatus = useCallback(
    async (caseId: string, status: CaseDisplay["status"]): Promise<CaseDisplay | null> => {
      try {
        setError(null);
        const updatedCase = await service.updateCaseStatus(caseId, status);
        setCases(prevCases => prevCases.map(c => (c.id === caseId ? updatedCase : c)));
        return updatedCase;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        
        const errorMsg = err instanceof Error ? err.message : 'Failed to update case status';
        setError(errorMsg);
        return null;
      }
    },
    [service],
  );

  const importCases = useCallback(async (importedCases: CaseDisplay[]) => {
    try {
      setError(null);
      await service.importCases(importedCases);
      setCases(prevCases => [...prevCases, ...importedCases]);
      setHasLoadedData(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to import cases';
      setError(errorMsg);
      throw err;
    }
  }, [service]);

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