import type { CaseDisplay, NewCaseRecordData, NewNoteData, NewPersonData } from '@/types/case';
import { useCaseService } from '@/contexts/CaseServiceContext';
import { useApplicationState } from '@/application/hooks/useApplicationState';
import { caseToLegacyCaseDisplay } from '@/application/services/caseLegacyMapper';

/**
 * Thin wrapper hook for case management operations.
 * 
 * Delegates all business logic to CaseManagementService.
 * Provides reactive state from ApplicationState.
 */
interface UseCaseManagementReturn {
  cases: CaseDisplay[];
  loading: boolean;
  error: string | null;
  hasLoadedData: boolean;
  loadCases: () => Promise<CaseDisplay[]>;
  saveCase: (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: CaseDisplay | null,
  ) => Promise<CaseDisplay>;
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

  // Reactive state from ApplicationState
  const cases = useApplicationState(state =>
    state.getCases().map(caseToLegacyCaseDisplay),
  );
  const loading = useApplicationState(state => state.getCasesLoading());
  const error = useApplicationState(state => state.getCasesError());
  const hasLoadedData = useApplicationState(state => state.getHasLoadedCases());

  // Direct service delegation - no wrapper callbacks needed
  return {
    cases,
    loading,
    error,
    hasLoadedData,
    loadCases: service.loadCases.bind(service),
    saveCase: service.saveCase.bind(service),
    deleteCase: service.deleteCase.bind(service),
    saveNote: service.saveNote.bind(service),
    importCases: service.importCases.bind(service),
    updateCaseStatus: service.updateCaseStatus.bind(service),
  };
}