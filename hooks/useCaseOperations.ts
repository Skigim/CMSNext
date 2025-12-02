import { useCallback } from 'react';
import { toast } from 'sonner';
import { NewPersonData, NewCaseRecordData, NewNoteData, StoredCase, StoredNote } from '@/types/case';
import { DataManager } from '@/utils/DataManager';
import { getFileStorageFlags, updateFileStorageFlags } from '@/utils/fileStorageFlags';
import { createLogger } from '@/utils/logger';
import { LegacyFormatError } from '@/utils/services/FileStorageService';

const logger = createLogger('CaseOperations');
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

/** Case operation handlers - provides all CRUD operations for cases and notes */
export function useCaseOperations(config: CaseOperationsConfig) {
  const { dataManager, isMounted, cases, setError, setLoading, setCases, setHasLoadedData } = config;

  const guardDataManager = useCallback(() => {
    if (!dataManager) { setError(NOT_AVAILABLE_MSG); toast.error(NOT_AVAILABLE_MSG); return false; }
    return true;
  }, [dataManager, setError]);

  const loadCases = useCallback(async (): Promise<StoredCase[]> => {
    if (!guardDataManager()) return [];
    try {
      setLoading(true); setError(null);
      const data = await dataManager!.getAllCases();
      if (!isMounted.current) return [];
      setCases(data); setHasLoadedData(true);
      updateFileStorageFlags({ dataBaseline: true });
      if (data.length > 0) { updateFileStorageFlags({ sessionHadData: true }); logger.info('Cases loaded', { caseCount: data.length }); }
      else if (!getFileStorageFlags().inConnectionFlow) { toast.success('Connected successfully - ready to start fresh', { id: 'connected-empty', duration: 3000 }); }
      return data;
    } catch (err) {
      if (err instanceof LegacyFormatError) { setError(err.message); toast.error(err.message, { duration: 8000 }); return []; }
      setError('Failed to load cases. Please try again.'); toast.error('Failed to load cases. Please try again.'); return [];
    } finally { if (isMounted.current) setLoading(false); }
  }, [guardDataManager, dataManager, isMounted, setError, setLoading, setCases, setHasLoadedData]);

  const saveCase = useCallback(async (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }, editingCase?: StoredCase | null) => {
    if (!guardDataManager()) return;
    const isEditing = !!editingCase;
    const toastId = toast.loading(isEditing ? "Updating case..." : "Creating case...");
    try {
      setError(null);
      if (editingCase) await dataManager!.updateCompleteCase(editingCase.id, caseData);
      else await dataManager!.createCompleteCase(caseData);
      if (!isMounted.current) return;
      toast.success(`Case for ${caseData.person.firstName} ${caseData.person.lastName} ${isEditing ? 'updated' : 'created'} successfully`, { id: toastId });
    } catch (err) {
      logger.error('Failed to save case', { error: err instanceof Error ? err.message : String(err), isEditing });
      setError(`Failed to ${isEditing ? 'update' : 'create'} case. Please try again.`);
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} case. Please try again.`, { id: toastId }); throw err;
    }
  }, [guardDataManager, dataManager, isMounted, setError]);

  const deleteCase = useCallback(async (caseId: string) => {
    if (!guardDataManager()) return;
    const caseToDelete = cases.find(c => c.id === caseId);
    const name = caseToDelete ? `${caseToDelete.person.firstName} ${caseToDelete.person.lastName}` : 'Case';
    try {
      setError(null); await dataManager!.deleteCase(caseId);
      if (!isMounted.current) return;
      toast.success(`${name} case deleted successfully`);
    } catch (err) {
      logger.error('Failed to delete case', { error: err instanceof Error ? err.message : String(err), caseId });
      setError('Failed to delete case. Please try again.'); toast.error('Failed to delete case. Please try again.'); throw err;
    }
  }, [guardDataManager, dataManager, cases, isMounted, setError]);

  const saveNote = useCallback(async (noteData: NewNoteData, caseId: string, editingNote?: { id: string } | null): Promise<StoredNote | null> => {
    if (!guardDataManager()) return null;
    try {
      setError(null);
      const savedNote = editingNote
        ? await dataManager!.updateNote(caseId, editingNote.id, noteData)
        : await dataManager!.addNote(caseId, noteData);
      toast.success(editingNote ? "Note updated successfully" : "Note added successfully");
      return savedNote;
    } catch (err) {
      const action = editingNote ? 'update' : 'add';
      logger.error('Failed to save note', { error: err instanceof Error ? err.message : String(err), caseId });
      setError(`Failed to ${action} note. Please try again.`); toast.error(`Failed to ${action} note. Please try again.`); return null;
    }
  }, [guardDataManager, dataManager, setError]);

  const updateCaseStatus = useCallback(async (caseId: string, status: StoredCase["status"]): Promise<StoredCase | null> => {
    if (!guardDataManager()) return null;
    const toastId = toast.loading('Updating case status...');
    try {
      setError(null);
      const updatedCase = await dataManager!.updateCaseStatus(caseId, status);
      if (!isMounted.current) return null;
      toast.success(`Status updated to ${status}`, { id: toastId, duration: 2000 }); return updatedCase;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') { toast.dismiss(toastId); return null; }
      logger.error('Failed to update case status', { error: err instanceof Error ? err.message : String(err), caseId, status });
      setError('Failed to update case status. Please try again.'); toast.error('Failed to update case status. Please try again.', { id: toastId }); return null;
    }
  }, [guardDataManager, dataManager, isMounted, setError]);

  const importCases = useCallback(async (importedCases: StoredCase[]) => {
    if (!guardDataManager()) return;
    try {
      setError(null); await dataManager!.importCases(importedCases);
      if (!isMounted.current) return;
      setHasLoadedData(true); updateFileStorageFlags({ dataBaseline: true, sessionHadData: true });
      toast.success(`Imported ${importedCases.length} cases successfully`);
    } catch (err) {
      logger.error('Failed to import cases', { error: err instanceof Error ? err.message : String(err), caseCount: importedCases.length });
      setError('Failed to import cases. Please try again.'); toast.error('Failed to import cases. Please try again.'); throw err;
    }
  }, [guardDataManager, dataManager, isMounted, setError, setHasLoadedData]);

  return { loadCases, saveCase, deleteCase, saveNote, importCases, updateCaseStatus };
}
