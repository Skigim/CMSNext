import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigationLock, type NavigationLock } from "./useNavigationLock";
import { useNavigationActions, RESTRICTED_VIEWS, type FormState } from "./useNavigationActions";
import { NewCaseRecordData, NewPersonData, StoredCase } from "../types/case";
import { AppView } from "../types/view";
import type { FileStorageLifecycleSelectors } from "../contexts/FileStorageContext";

interface UseNavigationFlowParams {
  cases: StoredCase[];
  connectionState: FileStorageLifecycleSelectors;
  saveCase: (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: StoredCase | null
  ) => Promise<StoredCase | undefined>;
  deleteCase: (caseId: string) => Promise<void>;
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

/**
 * Orchestrates navigation state and actions for the application.
 * 
 * Delegates to:
 * - useNavigationLock: Lock state based on file storage connection
 * - useNavigationActions: Navigation action callbacks
 */
export function useNavigationFlow({
  cases,
  connectionState,
  saveCase,
  deleteCase,
}: UseNavigationFlowParams): NavigationHandlers {
  // Core navigation state
  const [currentView, setCurrentView] = useState<AppView>("dashboard");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<StoredCase | null>(null);
  const [formState, setFormState] = useState<FormState>({ previousView: "list" });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const forcedViewRef = useRef<AppView | null>(null);

  // Lock state from connection
  const { navigationLock, guardCaseInteraction } = useNavigationLock({ connectionState });

  // Derived state
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

  // Setters for actions hook
  const setForcedView = useCallback((view: AppView | null) => {
    forcedViewRef.current = view;
  }, []);

  // Navigation actions
  const actions = useNavigationActions({
    state: { currentView, selectedCaseId, editingCase, formState },
    setters: { setCurrentView, setSelectedCaseId, setEditingCase, setFormState, setSidebarOpen, setForcedView },
    cases,
    guardCaseInteraction,
    isLocked: navigationLock.locked,
    lockReason: navigationLock.reason,
    saveCase,
    deleteCase,
  });

  // Auto-redirect when locked/unlocked
  // Loop-safe: When locked + currentView ∈ RESTRICTED_VIEWS, we set currentView to "settings"
  // which is NOT in RESTRICTED_VIEWS, so the effect short-circuits on next render.
  // When unlocked, we restore the prior view then clear the ref, exiting on next run.
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
      setCurrentView(returnView);
      forcedViewRef.current = null;
    }
  }, [currentView, navigationLock.locked]);

  return {
    currentView,
    selectedCaseId,
    selectedCase,
    editingCase,
    sidebarOpen,
    breadcrumbTitle,
    navigationLock,
    setSidebarOpen,
    ...actions,
  };
}
