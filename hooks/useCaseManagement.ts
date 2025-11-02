import { useCallback, useRef, useEffect } from 'react';
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
  const serviceRef = useRef(service);

  // Keep service ref up to date without triggering callback recreation
  useEffect(() => {
    serviceRef.current = service;
  }, [service]);

  const cases = useApplicationState(state =>
    state.getCases().map(caseToLegacyCaseDisplay),
  );
  const loading = useApplicationState(state => state.getCasesLoading());
  const error = useApplicationState(state => state.getCasesError());
  const hasLoadedData = useApplicationState(state => state.getHasLoadedCases());

  const loadCases = useCallback(async () => {
    return await serviceRef.current.loadCases();
  }, []);

  const saveCase = useCallback(
    async (
      caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
      editingCase?: CaseDisplay | null,
    ) => {
      await serviceRef.current.saveCase(caseData, editingCase);
    },
    [],
  );

  const deleteCase = useCallback(
    async (caseId: string) => {
      await serviceRef.current.deleteCase(caseId);
    },
    [],
  );

  const saveNote = useCallback(
    async (
      noteData: NewNoteData,
      caseId: string,
      editingNote?: { id: string } | null,
    ) => {
      return await serviceRef.current.saveNote(noteData, caseId, editingNote);
    },
    [],
  );

  const importCases = useCallback(
    async (importedCases: CaseDisplay[]) => {
      await serviceRef.current.importCases(importedCases);
    },
    [],
  );

  const updateCaseStatus = useCallback(
    async (caseId: string, status: CaseDisplay['status']) => {
      return await serviceRef.current.updateCaseStatus(caseId, status);
    },
    [],
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