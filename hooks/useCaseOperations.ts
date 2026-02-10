import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { NewPersonData, NewCaseRecordData, NewNoteData, StoredCase, StoredNote } from '@/types/case';
import { DataManager } from '@/utils/DataManager';
import { createDataManagerGuard } from '@/utils/guardUtils';
import { CaseOperationsService } from '@/utils/services/CaseOperationsService';

const NOT_AVAILABLE_MSG = 'Data storage is not available. Please connect to a folder first.';

export interface CaseOperationsConfig {
  dataManager: DataManager | null;
  isMounted: React.MutableRefObject<boolean>;
  cases: StoredCase[];
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setCases: React.Dispatch<React.SetStateAction<StoredCase[]>>;
  setHasLoadedData: (loaded: boolean) => void;
}

/**
 * React hook for case CRUD operations with UI integration
 * 
 * Bridges React state management and CaseOperationsService business logic.
 * Handles: toast notifications, error messages, loading states, mounted guards.
 * 
 * **Operations:**
 * - `loadCases()`: Fetch all cases from file storage, update React state
 * - `addCase(person, caseRecord)`: Create new case
 * - `updateCase(caseId, updates)`: Modify existing case
 * - `deleteCase(caseId)`: Remove case (with soft delete option)
 * - `savePerson(caseId, person)`: Update person info
 * - `updateCaseStatus(caseId, status)`: Change case status
 * - `exportCase(caseId)`: Download case as JSON/PDF
 * 
 * **State Management:**
 * - Updates setCases after mutations
 * - Clears setError on success, sets on failure
 * - Shows appropriate toast notifications (success/error/info)
 * - Guards with isMounted to prevent updates after unmount
 * - Manages setLoading flag for UI feedback
 * 
 * **Error Handling:**
 * - Missing dataManager: Shows error toast, returns early
 * - Failed operations: Logs error, displays user-friendly message
 * - Unmounted during async: Silently ignores state updates
 * - Toast format: Success/error with operation-specific messages
 * 
 * **Usage Example:**
 * ```typescript
 * const ops = useCaseOperations({\n *   dataManager: dm,\n *   isMounted: isMountedRef,\n *   cases: allCases,\n *   setError,\n *   setLoading,\n *   setCases,\n *   setHasLoadedData\n * });\n * \n * // Load initial data
 * const cases = await ops.loadCases();\n * 
 * // Create new case
 * await ops.addCase(\n *   { firstName: \"John\", lastName: \"Doe\" },\n *   { caseNumber: \"2024-001\" }\n * );\n * ```
 * 
 * @param {CaseOperationsConfig} config Injected dependencies
 * @returns Case operation handlers
 */
export function useCaseOperations(config: CaseOperationsConfig) {
  const { dataManager, isMounted, cases, setError, setLoading, setCases, setHasLoadedData } = config;

  const service = useMemo(
    () => dataManager ? new CaseOperationsService(dataManager) : null,
    [dataManager]
  );

  const guardDataManager = useMemo(
    () => createDataManagerGuard(dataManager, "useCaseOperations"),
    [dataManager]
  );

  const guardService = useCallback(() => {
    try {
      guardDataManager();
    } catch (error) {
      setError(NOT_AVAILABLE_MSG);
      toast.error(NOT_AVAILABLE_MSG);
      return false;
    }

    if (!service) {
      setError(NOT_AVAILABLE_MSG);
      toast.error(NOT_AVAILABLE_MSG);
      return false;
    }
    return true;
  }, [guardDataManager, service, setError]);

  const loadCases = useCallback(async (): Promise<StoredCase[]> => {
    if (!guardService()) return [];

    setLoading(true);
    setError(null);

    const loadResult = await service!.loadCases();

    if (!isMounted.current) return [];

    setLoading(false);

    if (!loadResult.success) {
      setError(loadResult.error);
      toast.error(loadResult.error, { duration: loadResult.isLegacyFormat ? 8000 : undefined });
      return [];
    }

    setCases(loadResult.data);
    setHasLoadedData(true);

    // Show empty state message if applicable
    if ('isEmpty' in loadResult && loadResult.isEmpty) {
      toast.success('Connected successfully - ready to start fresh', {
        id: 'connected-empty',
        duration: 3000,
      });
    }

    return loadResult.data;
  }, [guardService, service, isMounted, setError, setLoading, setCases, setHasLoadedData]);

  const saveCase = useCallback(async (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCaseId?: string
  ): Promise<StoredCase | undefined> => {
    if (!guardService()) return undefined;

    const isEditing = !!editingCaseId;
    const toastId = toast.loading(isEditing ? "Updating case..." : "Creating case...");
    setError(null);

    const saveResult = await service!.saveCase(caseData, editingCaseId);

    if (!isMounted.current) return undefined;

    if (!saveResult.success) {
      setError(saveResult.error);
      toast.error(saveResult.error, { id: toastId });
      throw new Error(saveResult.error);
    }

    toast.success(
      `Case for ${caseData.person.firstName} ${caseData.person.lastName} ${isEditing ? 'updated' : 'created'} successfully`,
      { id: toastId }
    );

    return saveResult.data;
  }, [guardService, service, isMounted, setError]);

  const deleteCase = useCallback(async (caseId: string) => {
    if (!guardService()) return;

    const caseToDelete = cases.find(c => c.id === caseId);
    const name = caseToDelete
      ? `${caseToDelete.person.firstName} ${caseToDelete.person.lastName}`
      : 'Case';

    setError(null);

    const deleteResult = await service!.deleteCase(caseId);

    if (!isMounted.current) return;

    if (!deleteResult.success) {
      setError(deleteResult.error);
      toast.error(deleteResult.error);
      throw new Error(deleteResult.error);
    }

    toast.success(`${name} case deleted successfully`);
  }, [guardService, service, cases, isMounted, setError]);

  const saveNote = useCallback(async (
    noteData: NewNoteData,
    caseId: string,
    editingNote?: { id: string } | null
  ): Promise<StoredNote | null> => {
    if (!guardService()) return null;

    setError(null);

    const noteResult = await service!.saveNote(noteData, caseId, editingNote?.id);

    if (!noteResult.success) {
      setError(noteResult.error);
      toast.error(noteResult.error);
      return null;
    }

    toast.success(editingNote ? "Note updated successfully" : "Note added successfully");
    return noteResult.data;
  }, [guardService, service, setError]);

  const updateCaseStatus = useCallback(async (
    caseId: string,
    status: StoredCase["status"]
  ): Promise<StoredCase | null> => {
    if (!guardService()) return null;

    const toastId = toast.loading('Updating case status...');
    setError(null);

    const statusResult = await service!.updateCaseStatus(caseId, status);

    if (!isMounted.current) return null;

    if (!statusResult.success) {
      if (statusResult.isAborted) {
        toast.dismiss(toastId);
        return null;
      }
      setError(statusResult.error);
      toast.error(statusResult.error, { id: toastId });
      return null;
    }

    toast.success(`Status updated to ${status}`, { id: toastId, duration: 2000 });
    return statusResult.data;
  }, [guardService, service, isMounted, setError]);

  const importCases = useCallback(async (importedCases: StoredCase[]) => {
    if (!guardService()) return;

    setError(null);

    const importResult = await service!.importCases(importedCases);

    if (!isMounted.current) return;

    if (!importResult.success) {
      setError(importResult.error);
      toast.error(importResult.error);
      throw new Error(importResult.error);
    }

    setHasLoadedData(true);
    toast.success(`Imported ${importedCases.length} cases successfully`);
  }, [guardService, service, isMounted, setError, setHasLoadedData]);

  const deleteCases = useCallback(async (caseIds: string[]): Promise<number> => {
    if (!guardService()) return 0;

    const toastId = toast.loading(`Deleting ${caseIds.length} case${caseIds.length === 1 ? '' : 's'}...`);
    setError(null);

    const bulkDeleteResult = await service!.deleteCases(caseIds);

    if (!isMounted.current) return 0;

    if (!bulkDeleteResult.success) {
      setError(bulkDeleteResult.error);
      toast.error(bulkDeleteResult.error, { id: toastId });
      return 0;
    }

    const { deleted } = bulkDeleteResult.data;
    toast.success(`Deleted ${deleted} case${deleted === 1 ? '' : 's'}`, { id: toastId });
    return deleted;
  }, [guardService, service, isMounted, setError]);

  const updateCasesStatus = useCallback(async (
    caseIds: string[],
    status: StoredCase["status"]
  ): Promise<number> => {
    if (!guardService()) return 0;

    const toastId = toast.loading(`Updating ${caseIds.length} case${caseIds.length === 1 ? '' : 's'}...`);
    setError(null);

    const bulkStatusResult = await service!.updateCasesStatus(caseIds, status);

    if (!isMounted.current) return 0;

    if (!bulkStatusResult.success) {
      setError(bulkStatusResult.error);
      toast.error(bulkStatusResult.error, { id: toastId });
      return 0;
    }

    const { updated } = bulkStatusResult.data;
    toast.success(`Updated ${updated.length} case${updated.length === 1 ? '' : 's'} to ${status}`, { id: toastId, duration: 2000 });
    return updated.length;
  }, [guardService, service, isMounted, setError]);

  const updateCasesPriority = useCallback(async (
    caseIds: string[],
    priority: boolean
  ): Promise<number> => {
    if (!guardService()) return 0;

    const label = priority ? 'priority' : 'normal';
    const toastId = toast.loading(`Updating ${caseIds.length} case${caseIds.length === 1 ? '' : 's'}...`);
    setError(null);

    const priorityResult = await service!.updateCasesPriority(caseIds, priority);

    if (!isMounted.current) return 0;

    if (!priorityResult.success) {
      setError(priorityResult.error);
      toast.error(priorityResult.error, { id: toastId });
      return 0;
    }

    const { updated } = priorityResult.data;
    toast.success(`Updated ${updated.length} case${updated.length === 1 ? '' : 's'} to ${label}`, { id: toastId, duration: 2000 });
    return updated.length;
  }, [guardService, service, isMounted, setError]);

  return { loadCases, saveCase, deleteCase, deleteCases, saveNote, importCases, updateCaseStatus, updateCasesStatus, updateCasesPriority };
}
