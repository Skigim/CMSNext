import { useCallback, useMemo, useState } from "react";
import { CaseDisplay, NewCaseRecordData, NewPersonData } from "../types/case";
import { AppView } from "../types/view";

interface FormState {
  previousView: AppView;
  returnToCaseId?: string;
}

interface UseNavigationFlowParams {
  cases: CaseDisplay[];
  saveCase: (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: CaseDisplay | null
  ) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;
}

interface NavigationHandlers {
  currentView: AppView;
  selectedCaseId: string | null;
  selectedCase: CaseDisplay | undefined;
  editingCase: CaseDisplay | null;
  sidebarOpen: boolean;
  breadcrumbTitle?: string;
  navigate: (view: AppView) => void;
  viewCase: (caseId: string) => void;
  editCase: (caseId: string) => void;
  newCase: () => void;
  saveCaseWithNavigation: (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }
  ) => Promise<void>;
  cancelForm: () => void;
  deleteCaseWithNavigation: (caseId: string) => Promise<void>;
  backToList: () => void;
  backToDashboard: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export function useNavigationFlow({
  cases,
  saveCase,
  deleteCase,
}: UseNavigationFlowParams): NavigationHandlers {
  const [currentView, setCurrentView] = useState<AppView>("dashboard");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<CaseDisplay | null>(null);
  const [formState, setFormState] = useState<FormState>({ previousView: "list" });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId),
    [cases, selectedCaseId]
  );

  const breadcrumbTitle = useMemo(() => {
    if (currentView === "details" && selectedCase) {
      return `${selectedCase.person.firstName} ${selectedCase.person.lastName}`;
    }
    return undefined;
  }, [currentView, selectedCase]);

  const backToList = useCallback(() => {
    setCurrentView("list");
    setSelectedCaseId(null);
  }, []);

  const backToDashboard = useCallback(() => {
    setCurrentView("dashboard");
    setSelectedCaseId(null);
  }, []);

  const viewCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    setCurrentView("details");
    setSidebarOpen(false);
  }, []);

  const editCase = useCallback(
    (caseId: string) => {
      const caseToEdit = cases.find((c) => c.id === caseId);
      if (!caseToEdit) {
        return;
      }

      setEditingCase(caseToEdit);
      setFormState({
        previousView: currentView,
        returnToCaseId: currentView === "details" ? caseId : undefined,
      });
      setCurrentView("form");
      setSidebarOpen(false);
    },
    [cases, currentView]
  );

  const newCase = useCallback(() => {
    setEditingCase(null);
    setFormState({
      previousView: currentView,
      returnToCaseId: undefined,
    });
    setCurrentView("form");
    setSidebarOpen(false);
  }, [currentView]);

  const saveCaseWithNavigation = useCallback(
    async (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => {
      try {
        await saveCase(caseData, editingCase);

        if (editingCase) {
          if (formState.previousView === "details" && formState.returnToCaseId) {
            setSelectedCaseId(formState.returnToCaseId);
            setCurrentView("details");
          } else {
            setCurrentView(formState.previousView);
          }
        } else {
          setCurrentView("list");
        }

        setEditingCase(null);
        setFormState({ previousView: "list" });
      } catch (err) {
        console.error("Failed to save case in navigation flow wrapper:", err);
        throw err;
      }
    },
    [editingCase, formState, saveCase]
  );

  const cancelForm = useCallback(() => {
    if (formState.previousView === "details" && formState.returnToCaseId) {
      setSelectedCaseId(formState.returnToCaseId);
      setCurrentView("details");
    } else {
      setCurrentView(formState.previousView);
    }

    setEditingCase(null);
    setFormState({ previousView: "list" });
  }, [formState]);

  const deleteCaseWithNavigation = useCallback(
    async (caseId: string) => {
      try {
        await deleteCase(caseId);

        if (selectedCaseId === caseId) {
          setCurrentView("list");
          setSelectedCaseId(null);
        }
      } catch (err) {
        console.error("Failed to delete case in navigation flow wrapper:", err);
        throw err;
      }
    },
    [deleteCase, selectedCaseId]
  );

  const navigate = useCallback(
    (view: AppView) => {
      switch (view) {
        case "dashboard":
          setSidebarOpen(true);
          backToDashboard();
          return;
        case "list":
          setSidebarOpen(true);
          backToList();
          return;
        case "details":
          if (selectedCaseId) {
            setSidebarOpen(false);
            setCurrentView("details");
          } else {
            setSidebarOpen(true);
            backToList();
          }
          return;
        case "form":
          setSidebarOpen(false);
          newCase();
          return;
        case "settings":
          setSidebarOpen(true);
          setCurrentView("settings");
          setSelectedCaseId(null);
          return;
        default: {
          const exhaustiveCheck: never = view;
          return exhaustiveCheck;
        }
      }
    },
    [backToDashboard, backToList, newCase, selectedCaseId]
  );

  return {
    currentView,
    selectedCaseId,
    selectedCase,
    editingCase,
    sidebarOpen,
    breadcrumbTitle,
    navigate,
    viewCase,
    editCase,
    newCase,
    saveCaseWithNavigation,
    cancelForm,
    deleteCaseWithNavigation,
    backToList,
    backToDashboard,
    setSidebarOpen,
  };
}
