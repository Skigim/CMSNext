import { useState } from 'react';
import { useIsMounted } from './useIsMounted';
import { useCaseOperations } from './useCaseOperations';
import { NewPersonData, NewCaseRecordData, NewNoteData, StoredCase, StoredNote } from '@/types/case';
import { useDataManagerSafe } from '@/contexts/DataManagerContext';

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
  deleteCases: (caseIds: string[]) => Promise<number>;
  saveNote: (noteData: NewNoteData, caseId: string, editingNote?: { id: string } | null) => Promise<StoredNote | null>;
  importCases: (importedCases: StoredCase[]) => Promise<void>;
  updateCaseStatus: (caseId: string, status: StoredCase["status"]) => Promise<StoredCase | null>;
  updateCasesStatus: (caseIds: string[], status: StoredCase["status"]) => Promise<number>;
  updateCasesPriority: (caseIds: string[], priority: boolean) => Promise<number>;
  
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
  const dataManager = useDataManagerSafe();
  
  const [cases, setCases] = useState<StoredCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedData, setHasLoadedData] = useState(false);

  // Extract all operations to dedicated hook
  const operations = useCaseOperations({
    dataManager,
    isMounted,
    cases,
    setError,
    setLoading,
    setCases,
    setHasLoadedData,
  });

  return {
    // State
    cases,
    loading,
    error,
    hasLoadedData,
    
    // Actions (delegated to useCaseOperations)
    loadCases: operations.loadCases,
    saveCase: operations.saveCase,
    deleteCase: operations.deleteCase,
    deleteCases: operations.deleteCases,
    saveNote: operations.saveNote,
    importCases: operations.importCases,
    updateCaseStatus: operations.updateCaseStatus,
    updateCasesStatus: operations.updateCasesStatus,
    updateCasesPriority: operations.updateCasesPriority,
    
    // State setters for external control
    setCases,
    setError,
    setHasLoadedData,
  };
}
