import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CaseDisplay, NewCaseRecordData, NewPersonData } from "../types/case";
import { AppView } from "../types/view";
import type { FileStorageLifecycleSelectors } from "../contexts/FileStorageContext";

const RESTRICTED_VIEWS: readonly AppView[] = ["list", "details", "form"];

interface FormState {
  previousView: AppView;
  returnToCaseId?: string;
}

interface UseNavigationFlowParams {
  cases: CaseDisplay[];
  connectionState: FileStorageLifecycleSelectors;
  saveCase: (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: CaseDisplay | null
  ) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;
}

type LockTone = "info" | "warning" | "error";

interface NavigationLock {
  locked: boolean;
  reason: string;
  tone: LockTone;
}

interface NavigationHandlers {
  currentView: AppView;
  selectedCaseId: string | null;
  selectedCase: CaseDisplay | undefined;
  editingCase: CaseDisplay | null;
  sidebarOpen: boolean;
  breadcrumbTitle?: string;
  navigationLock: NavigationLock;
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
  connectionState,
  saveCase,
  deleteCase,
}: UseNavigationFlowParams): NavigationHandlers {
  const navigationToastId = "navigation-lock";
  const [currentView, setCurrentView] = useState<AppView>("dashboard");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<CaseDisplay | null>(null);
  const [formState, setFormState] = useState<FormState>({ previousView: "list" });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const forcedViewRef = useRef<AppView | null>(null);

  const {
    isReady,
    isBlocked,
    isErrored,
    isRecovering,
    isAwaitingUserChoice,
    permissionStatus,
    lastError,
  } = connectionState;

  const navigationLock = useMemo<NavigationLock>(() => {
    if (isBlocked) {
      const message =
        permissionStatus === "denied"
          ? "Permission to the data folder was denied. Reconnect to continue managing cases."
          : "Access to the data folder is blocked. Review the browser prompt and try again.";
      return { locked: true, reason: message, tone: "error" };
    }

    if (isErrored) {
      return {
        locked: true,
        reason: lastError?.message ?? "File storage encountered an unexpected error.",
        tone: "error",
      };
    }

    if (isRecovering) {
      return {
        locked: true,
        reason: "File storage is reconnecting. Case actions are temporarily paused.",
        tone: "info",
      };
    }

    if (!isReady) {
      if (isAwaitingUserChoice) {
        return {
          locked: true,
          reason: "Choose a data folder to unlock case management.",
          tone: "warning",
        };
      }

      return {
        locked: true,
        reason: "Preparing file storage. Case actions will be available shortly.",
        tone: "info",
      };
    }

    return { locked: false, reason: "", tone: "info" };
  }, [isBlocked, isErrored, isReady, isRecovering, isAwaitingUserChoice, permissionStatus, lastError]);

  const showNavigationLockToast = useCallback(() => {
    if (!navigationLock.locked) {
      toast.dismiss(navigationToastId);
      return;
    }

    const toastFnMap: Record<LockTone, typeof toast.info> = {
      error: toast.error,
      warning: toast.warning,
      info: toast.info,
    };
    const toastFn = toastFnMap[navigationLock.tone] ?? toast.info;
    toastFn(navigationLock.reason, { id: navigationToastId });
  }, [navigationLock]);

  const guardCaseInteraction = useCallback((): boolean => {
    if (!navigationLock.locked) {
      return false;
    }
    showNavigationLockToast();
    return true;
  }, [navigationLock, showNavigationLockToast]);

  useEffect(() => {
    if (navigationLock.locked) {
      showNavigationLockToast();
    } else {
      toast.dismiss(navigationToastId);
    }
  }, [navigationLock.locked, showNavigationLockToast]);

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

  useEffect(() => {
    if (navigationLock.locked && RESTRICTED_VIEWS.includes(currentView)) {
      if (!forcedViewRef.current) {
        forcedViewRef.current = currentView;
      }
      setCurrentView("settings");
      setSelectedCaseId(null);
      setEditingCase(null);
      setSidebarOpen(true);
      return;
    }

    if (!navigationLock.locked && forcedViewRef.current) {
      const returnView = forcedViewRef.current === "form" ? "list" : forcedViewRef.current;
      // Form view relies on ephemeral draft state; returning users to the list avoids showing an empty form shell.
      setCurrentView(returnView);
      forcedViewRef.current = null;
    }
  }, [currentView, navigationLock.locked]);

  const backToList = useCallback(() => {
    setCurrentView("list");
    setSelectedCaseId(null);
  }, []);

  const backToDashboard = useCallback(() => {
    setCurrentView("dashboard");
    setSelectedCaseId(null);
  }, []);

  const viewCase = useCallback((caseId: string) => {
    if (guardCaseInteraction()) {
      return;
    }
    setSelectedCaseId(caseId);
    setCurrentView("details");
    setSidebarOpen(false);
  }, [guardCaseInteraction]);

  const editCase = useCallback(
    (caseId: string) => {
      if (guardCaseInteraction()) {
        return;
      }
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
    [cases, currentView, guardCaseInteraction]
  );

  const newCase = useCallback(() => {
    if (guardCaseInteraction()) {
      return;
    }
    setEditingCase(null);
    setFormState({
      previousView: currentView,
      returnToCaseId: undefined,
    });
    setCurrentView("form");
    setSidebarOpen(false);
  }, [currentView, guardCaseInteraction]);

  const saveCaseWithNavigation = useCallback(
    async (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => {
      if (guardCaseInteraction()) {
        throw new Error(navigationLock.reason);
      }
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
    [editingCase, formState, guardCaseInteraction, navigationLock.reason, saveCase]
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
      if (guardCaseInteraction()) {
        throw new Error(navigationLock.reason);
      }
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
    [deleteCase, guardCaseInteraction, navigationLock.reason, selectedCaseId]
  );

  const navigate = useCallback(
    (view: AppView) => {
      if (RESTRICTED_VIEWS.includes(view) && guardCaseInteraction()) {
        forcedViewRef.current = view;
        setSidebarOpen(true);
        setCurrentView("settings");
        setSelectedCaseId(null);
        return;
      }

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
    [backToDashboard, backToList, guardCaseInteraction, newCase, selectedCaseId]
  );

  return {
    currentView,
    selectedCaseId,
    selectedCase,
    editingCase,
    sidebarOpen,
    breadcrumbTitle,
    navigationLock,
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
