import { useCallback } from 'react';
import type { CaseDisplay, NewCaseRecordData, NewNoteData, NewPersonData } from '@/types/case';
import { useCaseService } from '@/contexts/CaseServiceContext';
import { useApplicationState } from '@/application/hooks/useApplicationState';
import { caseToLegacyCaseDisplay } from '@/application/services/caseLegacyMapper';

interface UseCaseManagementReturn {
  cases: CaseDisplay[];
  loading: boolean;
  error: string | null;
  hasLoadedData: boolean;
  loadCases: () => Promise<CaseDisplay[]>;
  saveCase: (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: CaseDisplay | null,
  ) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;
  saveNote: (
    noteData: NewNoteData,
    caseId: string,
    editingNote?: { id: string } | null,
  ) => Promise<CaseDisplay>;
  importCases: (importedCases: CaseDisplay[]) => Promise<void>;
  updateCaseStatus: (caseId: string, status: CaseDisplay['status']) => Promise<CaseDisplay>;
}

export function useCaseManagement(): UseCaseManagementReturn {
  const service = useCaseService();

  const cases = useApplicationState(state =>
    state.getCases().map(caseToLegacyCaseDisplay),
  );
  const loading = useApplicationState(state => state.getCasesLoading());
  const error = useApplicationState(state => state.getCasesError());
  const hasLoadedData = useApplicationState(state => state.getHasLoadedCases());

  const loadCases = useCallback(async () => {
    return await service.loadCases();
  }, [service]);

  const saveCase = useCallback(
    async (
      caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
      editingCase?: CaseDisplay | null,
    ) => {
      await service.saveCase(caseData, editingCase);
    },
    [service],
  );

  const deleteCase = useCallback(
    async (caseId: string) => {
      await service.deleteCase(caseId);
    },
    [service],
  );

  const saveNote = useCallback(
    async (
      noteData: NewNoteData,
      caseId: string,
      editingNote?: { id: string } | null,
    ) => {
      return await service.saveNote(noteData, caseId, editingNote);
    },
    [service],
  );

  const importCases = useCallback(
    async (importedCases: CaseDisplay[]) => {
      await service.importCases(importedCases);
    },
    [service],
  );

  const updateCaseStatus = useCallback(
    async (caseId: string, status: CaseDisplay['status']) => {
      return await service.updateCaseStatus(caseId, status);
    },
    [service],
  );

  return {
    cases,
    loading,
    error,
    hasLoadedData,
    loadCases,
    saveCase,
    deleteCase,
    saveNote,
    importCases,
    updateCaseStatus,
  };
}