import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { NewCaseRecordData, NewPersonData, StoredCase } from "../types/case";
import { AppView } from "../types/view";
import type { FileStorageLifecycleSelectors } from "../contexts/FileStorageContext";
import { startMeasurement, endMeasurement } from "../utils/performanceTracker";

const RESTRICTED_VIEWS: readonly AppView[] = ["list", "details", "form"];

interface FormState {
  previousView: AppView;
  returnToCaseId?: string;
}

interface UseNavigationFlowParams {
  cases: StoredCase[];
  connectionState: FileStorageLifecycleSelectors;
  saveCase: (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: StoredCase | null
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
  selectedCase: StoredCase | undefined;
  editingCase: StoredCase | null;
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
  const [editingCase, setEditingCase] = useState<StoredCase | null>(null);
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

  const navigationLockedRef = useRef(navigationLock.locked);
  useEffect(() => {
    navigationLockedRef.current = navigationLock.locked;
  }, [navigationLock.locked]);

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
    const locked = navigationLockedRef.current;
    startMeasurement("navigation:guard", { locked, reason: navigationLock.reason });
    if (!locked) {
      endMeasurement("navigation:guard", { locked: false });
      return false;
    }
    showNavigationLockToast();
    endMeasurement("navigation:guard", { locked: true, reason: navigationLock.reason });
    return true;
  }, [navigationLock.reason, showNavigationLockToast]);

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
    startMeasurement("navigation:backToList");
    setCurrentView("list");
    setSelectedCaseId(null);
    endMeasurement("navigation:backToList", { result: "list" });
  }, []);

  const backToDashboard = useCallback(() => {
    startMeasurement("navigation:backToDashboard");
    setCurrentView("dashboard");
    setSelectedCaseId(null);
    endMeasurement("navigation:backToDashboard", { result: "dashboard" });
  }, []);

  const viewCase = useCallback((caseId: string) => {
    startMeasurement("navigation:viewCase", { caseId, locked: navigationLockedRef.current });
    if (guardCaseInteraction()) {
      endMeasurement("navigation:viewCase", { caseId, blocked: true });
      return;
    }
    setSelectedCaseId(caseId);
    setCurrentView("details");
    setSidebarOpen(false);
    endMeasurement("navigation:viewCase", { caseId, blocked: false });
  }, [guardCaseInteraction]);

  const editCase = useCallback(
    (caseId: string) => {
      startMeasurement("navigation:editCase", { caseId, locked: navigationLockedRef.current });
      if (guardCaseInteraction()) {
        endMeasurement("navigation:editCase", { caseId, blocked: true });
        return;
      }
      const caseToEdit = cases.find((c) => c.id === caseId);
      if (!caseToEdit) {
        endMeasurement("navigation:editCase", { caseId, blocked: false, result: "missing" });
        return;
      }

      setEditingCase(caseToEdit);
      setFormState({
        previousView: currentView,
        returnToCaseId: currentView === "details" ? caseId : undefined,
      });
      setCurrentView("form");
      setSidebarOpen(false);
      endMeasurement("navigation:editCase", { caseId, blocked: false, result: "form" });
    },
    [cases, currentView, guardCaseInteraction]
  );

  const newCase = useCallback(() => {
    startMeasurement("navigation:newCase", { locked: navigationLockedRef.current });
    if (guardCaseInteraction()) {
      endMeasurement("navigation:newCase", { blocked: true });
      return;
    }
    setEditingCase(null);
    setFormState({
      previousView: currentView,
      returnToCaseId: undefined,
    });
    setCurrentView("form");
    setSidebarOpen(false);
    endMeasurement("navigation:newCase", { blocked: false, result: "form" });
  }, [currentView, guardCaseInteraction]);

  const saveCaseWithNavigation = useCallback(
    async (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => {
      startMeasurement("navigation:saveCase", { editing: Boolean(editingCase) });
      if (guardCaseInteraction()) {
        endMeasurement("navigation:saveCase", { blocked: true });
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
        endMeasurement("navigation:saveCase", {
          blocked: false,
          result: editingCase ? "update" : "create",
        });
      } catch (err) {
        console.error("Failed to save case in navigation flow wrapper:", err);
        endMeasurement("navigation:saveCase", { blocked: false, result: "error" });
        throw err;
      }
    },
    [editingCase, formState, guardCaseInteraction, navigationLock.reason, saveCase]
  );

  const cancelForm = useCallback(() => {
    startMeasurement("navigation:cancelForm", { previousView: formState.previousView });
    if (formState.previousView === "details" && formState.returnToCaseId) {
      setSelectedCaseId(formState.returnToCaseId);
      setCurrentView("details");
    } else {
      setCurrentView(formState.previousView);
    }

    setEditingCase(null);
    setFormState({ previousView: "list" });
    endMeasurement("navigation:cancelForm", { result: formState.previousView });
  }, [formState]);

  const deleteCaseWithNavigation = useCallback(
    async (caseId: string) => {
      startMeasurement("navigation:deleteCase", { caseId });
      if (guardCaseInteraction()) {
        endMeasurement("navigation:deleteCase", { caseId, blocked: true });
        throw new Error(navigationLock.reason);
      }
      try {
        await deleteCase(caseId);

        if (selectedCaseId === caseId) {
          setCurrentView("list");
          setSelectedCaseId(null);
        }
        endMeasurement("navigation:deleteCase", { caseId, blocked: false, result: "deleted" });
      } catch (err) {
        console.error("Failed to delete case in navigation flow wrapper:", err);
        endMeasurement("navigation:deleteCase", { caseId, blocked: false, result: "error" });
        throw err;
      }
    },
    [deleteCase, guardCaseInteraction, navigationLock.reason, selectedCaseId]
  );

  const navigate = useCallback(
    (view: AppView) => {
      startMeasurement("navigation:navigate", { view, locked: navigationLockedRef.current });
      if (RESTRICTED_VIEWS.includes(view) && guardCaseInteraction()) {
        forcedViewRef.current = view;
        setSidebarOpen(true);
        setCurrentView("settings");
        setSelectedCaseId(null);
        endMeasurement("navigation:navigate", { view, blocked: true, redirected: "settings" });
        return;
      }

      switch (view) {
        case "dashboard":
          setSidebarOpen(true);
          backToDashboard();
          endMeasurement("navigation:navigate", { view, blocked: false, target: "dashboard" });
          return;
        case "list":
          setSidebarOpen(true);
          backToList();
          endMeasurement("navigation:navigate", { view, blocked: false, target: "list" });
          return;
        case "details":
          if (selectedCaseId) {
            setSidebarOpen(false);
            setCurrentView("details");
            endMeasurement("navigation:navigate", { view, blocked: false, target: "details" });
          } else {
            setSidebarOpen(true);
            backToList();
            endMeasurement("navigation:navigate", { view, blocked: false, target: "list" });
          }
          return;
        case "form":
          setSidebarOpen(false);
          newCase();
          endMeasurement("navigation:navigate", { view, blocked: false, target: "form" });
          return;
        case "reports":
          setSidebarOpen(true);
          setCurrentView("reports");
          setSelectedCaseId(null);
          endMeasurement("navigation:navigate", { view, blocked: false, target: "reports" });
          return;
        case "settings":
          setSidebarOpen(true);
          setCurrentView("settings");
          setSelectedCaseId(null);
          endMeasurement("navigation:navigate", { view, blocked: false, target: "settings" });
          return;
        default: {
          const exhaustiveCheck: never = view;
          endMeasurement("navigation:navigate", { view, blocked: false, target: "unknown" });
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
