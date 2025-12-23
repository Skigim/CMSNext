import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { NewPersonData, NewCaseRecordData, NewNoteData, StoredCase, StoredNote } from '@/types/case';
import { DataManager } from '@/utils/DataManager';
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
 * React hook for case operations - handles UI concerns only.
 * Delegates business logic to CaseOperationsService.
 * Manages: toast notifications, mounted guards, loading states.
 */
export function useCaseOperations(config: CaseOperationsConfig) {
  const { dataManager, isMounted, cases, setError, setLoading, setCases, setHasLoadedData } = config;

  const service = useMemo(
    () => dataManager ? new CaseOperationsService(dataManager) : null,
    [dataManager]
  );

  const guardService = useCallback(() => {
    if (!service) {
      setError(NOT_AVAILABLE_MSG);
      toast.error(NOT_AVAILABLE_MSG);
      return false;
    }
    return true;
  }, [service, setError]);

  const loadCases = useCallback(async (): Promise<StoredCase[]> => {
    if (!guardService()) return [];

    setLoading(true);
    setError(null);

    const result = await service!.loadCases();

    if (!isMounted.current) return [];

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      toast.error(result.error, { duration: result.isLegacyFormat ? 8000 : undefined });
      return [];
    }

    setCases(result.data);
    setHasLoadedData(true);

    // Show empty state message if applicable
    if ('isEmpty' in result && result.isEmpty) {
      toast.success('Connected successfully - ready to start fresh', {
        id: 'connected-empty',
        duration: 3000,
      });
    }

    return result.data;
  }, [guardService, service, isMounted, setError, setLoading, setCases, setHasLoadedData]);

  const saveCase = useCallback(async (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCaseId?: string
  ): Promise<StoredCase | undefined> => {
    if (!guardService()) return undefined;

    const isEditing = !!editingCaseId;
    const toastId = toast.loading(isEditing ? "Updating case..." : "Creating case...");
    setError(null);

    const result = await service!.saveCase(caseData, editingCaseId);

    if (!isMounted.current) return undefined;

    if (!result.success) {
      setError(result.error);
      toast.error(result.error, { id: toastId });
      throw new Error(result.error);
    }

    toast.success(
      `Case for ${caseData.person.firstName} ${caseData.person.lastName} ${isEditing ? 'updated' : 'created'} successfully`,
      { id: toastId }
    );

    return result.data;
  }, [guardService, service, isMounted, setError]);

  const deleteCase = useCallback(async (caseId: string) => {
    if (!guardService()) return;

    const caseToDelete = cases.find(c => c.id === caseId);
    const name = caseToDelete
      ? `${caseToDelete.person.firstName} ${caseToDelete.person.lastName}`
      : 'Case';

    setError(null);

    const result = await service!.deleteCase(caseId);

    if (!isMounted.current) return;

    if (!result.success) {
      setError(result.error);
      toast.error(result.error);
      throw new Error(result.error);
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

    const result = await service!.saveNote(noteData, caseId, editingNote?.id);

    if (!result.success) {
      setError(result.error);
      toast.error(result.error);
      return null;
    }

    toast.success(editingNote ? "Note updated successfully" : "Note added successfully");
    return result.data;
  }, [guardService, service, setError]);

  const updateCaseStatus = useCallback(async (
    caseId: string,
    status: StoredCase["status"]
  ): Promise<StoredCase | null> => {
    if (!guardService()) return null;

    const toastId = toast.loading('Updating case status...');
    setError(null);

    const result = await service!.updateCaseStatus(caseId, status);

    if (!isMounted.current) return null;

    if (!result.success) {
      if (result.isAborted) {
        toast.dismiss(toastId);
        return null;
      }
      setError(result.error);
      toast.error(result.error, { id: toastId });
      return null;
    }

    toast.success(`Status updated to ${status}`, { id: toastId, duration: 2000 });
    return result.data;
  }, [guardService, service, isMounted, setError]);

  const importCases = useCallback(async (importedCases: StoredCase[]) => {
    if (!guardService()) return;

    setError(null);

    const result = await service!.importCases(importedCases);

    if (!isMounted.current) return;

    if (!result.success) {
      setError(result.error);
      toast.error(result.error);
      throw new Error(result.error);
    }

    setHasLoadedData(true);
    toast.success(`Imported ${importedCases.length} cases successfully`);
  }, [guardService, service, isMounted, setError, setHasLoadedData]);

  const deleteCases = useCallback(async (caseIds: string[]): Promise<number> => {
    if (!guardService()) return 0;

    const toastId = toast.loading(`Deleting ${caseIds.length} case${caseIds.length === 1 ? '' : 's'}...`);
    setError(null);

    const result = await service!.deleteCases(caseIds);

    if (!isMounted.current) return 0;

    if (!result.success) {
      setError(result.error);
      toast.error(result.error, { id: toastId });
      return 0;
    }

    const { deleted } = result.data;
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

    const result = await service!.updateCasesStatus(caseIds, status);

    if (!isMounted.current) return 0;

    if (!result.success) {
      setError(result.error);
      toast.error(result.error, { id: toastId });
      return 0;
    }

    const { updated } = result.data;
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

    const result = await service!.updateCasesPriority(caseIds, priority);

    if (!isMounted.current) return 0;

    if (!result.success) {
      setError(result.error);
      toast.error(result.error, { id: toastId });
      return 0;
    }

    const { updated } = result.data;
    toast.success(`Updated ${updated.length} case${updated.length === 1 ? '' : 's'} to ${label}`, { id: toastId, duration: 2000 });
    return updated.length;
  }, [guardService, service, isMounted, setError]);

  return { loadCases, saveCase, deleteCase, deleteCases, saveNote, importCases, updateCaseStatus, updateCasesStatus, updateCasesPriority };
}
