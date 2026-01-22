import { useState, useEffect, useRef, useCallback } from 'react';
import { useIsMounted } from './useIsMounted';
import { useCaseOperations } from './useCaseOperations';
import { useCaseArchival } from './useCaseArchival';
import { NewPersonData, NewCaseRecordData, NewNoteData, StoredCase, StoredNote } from '@/types/case';
import { useDataManagerSafe } from '@/contexts/DataManagerContext';
import type { UseCaseArchivalReturn } from './useCaseArchival';

/**
 * Return type for useCaseManagement hook.
 * @interface UseCaseManagementReturn
 */
interface UseCaseManagementReturn {
  // State
  /** All cases currently loaded in memory */
  cases: StoredCase[];
  /** Whether cases are currently loading from file */
  loading: boolean;
  /** Error message if load/save failed */
  error: string | null;
  /** Whether initial data load has completed */
  hasLoadedData: boolean;
  
  // Actions
  /** Load all cases from file system */
  loadCases: () => Promise<StoredCase[]>;
  /** Save or create a case (detects create vs update by editingCaseId) */
  saveCase: (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }, editingCaseId?: string) => Promise<StoredCase | undefined>;
  /** Delete a single case by ID */
  deleteCase: (caseId: string) => Promise<void>;
  /** Delete multiple cases in bulk */
  deleteCases: (caseIds: string[]) => Promise<number>;
  /** Save a note for a case (create or update) */
  saveNote: (noteData: NewNoteData, caseId: string, editingNote?: { id: string } | null) => Promise<StoredNote | null>;
  /** Import multiple cases from bulk data */
  importCases: (importedCases: StoredCase[]) => Promise<void>;
  /** Update status for a single case */
  updateCaseStatus: (caseId: string, status: StoredCase["status"]) => Promise<StoredCase | null>;
  /** Update status for multiple cases */
  updateCasesStatus: (caseIds: string[], status: StoredCase["status"]) => Promise<number>;
  /** Update priority flag for multiple cases */
  updateCasesPriority: (caseIds: string[], priority: boolean) => Promise<number>;
  
  // Archival operations
  /** Archival hook interface for queue management and archive operations */
  archival: UseCaseArchivalReturn;
  
  // State setters for external control
  /** Directly update cases array (use for UI optimism) */
  setCases: React.Dispatch<React.SetStateAction<StoredCase[]>>;
  /** Directly update error state */
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  /** Directly update load state */
  setHasLoadedData: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Secure case management hook using DataManager.
 * 
 * Provides complete case CRUD operations and state management.
 * Automatically persists all changes through DataManager to file system.
 * 
 * ## Core Principles
 * 
 * - Uses DataManager exclusively (no direct file access)
 * - File system is single source of truth
 * - No render-time data caching
 * - Automatic persistence on all mutations
 * - Safe to use outside DataManagerProvider (returns null, no errors)
 * 
 * ## Architecture
 * 
 * ```
 * useCaseManagement (state + orchestration)
 *     ↓
 * useCaseOperations (mutation logic)
 *     ↓
 * useDataManagerSafe (safe context access)
 *     ↓
 * DataManager (persistence layer)
 * ```
 * 
 * ## Operations
 * 
 * ### Read
 * - `loadCases()` - Load all cases from file
 * 
 * ### Create/Update
 * - `saveCase()` - Create new or update existing case
 * - `saveNote()` - Add/update note for case
 * 
 * ### Delete
 * - `deleteCase()` - Delete single case
 * - `deleteCases()` - Delete multiple cases
 * - (Notes deleted through case deletion)
 * 
 * ### Bulk Operations
 * - `importCases()` - Import multiple cases
 * - `updateCasesStatus()` - Bulk status update
 * - `updateCasesPriority()` - Bulk priority update
 * 
 * ## Usage Example
 * 
 * ```typescript
 * function CasesPanel() {
 *   const {
 *     cases,
 *     loading,
 *     error,
 *     loadCases,
 *     saveCase,
 *     deleteCase,
 *     updateCaseStatus
 *   } = useCaseManagement();
 *   
 *   useEffect(() => {
 *     loadCases();
 *   }, []);
 *   
 *   if (loading) return <Spinner />;
 *   if (error) return <Error message={error} />;
 *   
 *   const handleSave = async (caseData) => {
 *     const saved = await saveCase(caseData);
 *     if (saved) toast.success('Case saved');
 *   };
 * }
 * ```
 * 
 * ## State Management
 * 
 * State setters (`setCases`, `setError`, etc.) are exposed for advanced use cases:
 * - Optimistic UI updates
 * - Controlled rollback
 * - Manual state synchronization
 * 
 * Use sparingly - prefer direct operation methods for automatic persistence.
 * 
 * @hook
 * @returns {UseCaseManagementReturn} Case management state and operations
 * 
 * @see {@link useCaseOperations} for mutation logic
 * @see {@link useDataManagerSafe} for safe DataManager access
 * @see {@link DataManager} for underlying persistence
 */
export function useCaseManagement(): UseCaseManagementReturn {
  const isMounted = useIsMounted();
  const dataManager = useDataManagerSafe();
  
  const [cases, setCases] = useState<StoredCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  
  // Track if we've already triggered the archival refresh for this session
  const hasRefreshedArchivalQueue = useRef(false);

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

  // Callback to reload cases after archival operations
  const handleCasesChanged = useCallback(() => {
    operations.loadCases();
  }, [operations]);

  // Archival operations
  const archival = useCaseArchival({
    dataManager,
    isMounted,
    onCasesChanged: handleCasesChanged,
  });

  // Auto-refresh archival queue when data is first loaded
  // Use a ref for refreshQueue to avoid re-triggering when archival object changes
  const refreshQueueRef = useRef(archival.refreshQueue);
  refreshQueueRef.current = archival.refreshQueue;
  
  useEffect(() => {
    if (
      hasLoadedData && 
      dataManager && 
      !hasRefreshedArchivalQueue.current &&
      cases.length > 0
    ) {
      hasRefreshedArchivalQueue.current = true;
      // Defer to next tick to avoid blocking initial render
      const timer = setTimeout(() => {
        if (isMounted.current) {
          refreshQueueRef.current();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasLoadedData, dataManager, cases.length, isMounted]);

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
    
    // Archival operations
    archival,
    
    // State setters for external control
    setCases,
    setError,
    setHasLoadedData,
  };
}
