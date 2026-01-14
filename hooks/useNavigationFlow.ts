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
    editingCaseId?: string
  ) => Promise<StoredCase | undefined>;
  deleteCase: (caseId: string) => Promise<void>;
}

interface NavigationHandlers {
  currentView: AppView;
  selectedCaseId: string | null;
  selectedCase: StoredCase | undefined;
  showNewCaseModal: boolean;
  sidebarOpen: boolean;
  breadcrumbTitle?: string;
  navigationLock: NavigationLock;
  navigate: (view: AppView) => void;
  viewCase: (caseId: string) => void;
  newCase: () => void;
  closeNewCaseModal: () => void;
  saveCaseWithNavigation: (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }
  ) => Promise<void>;
  deleteCaseWithNavigation: (caseId: string) => Promise<void>;
  backToList: () => void;
  backToDashboard: () => void;
  setSidebarOpen: (open: boolean) => void;
}

/**
 * Hook for managing application navigation with connection-aware locking
 * 
 * Orchestrates complete navigation flow:
 * - View and case selection state
 * - Navigation lock (disabled when offline/connecting)
 * - Case save/delete with navigation side-effects
 * - Sidebar and breadcrumb management
 * - Form state tracking for back navigation
 * 
 * **Navigation Lock:**
 * Based on FileStorageContext connection state:
 * - DISCONNECTED: Lock all case operations, show error message
 * - CONNECTING: Lock, show reconnecting message
 * - CONNECTED: Unlock, allow case operations
 * - ERROR: Lock, show error with details
 * 
 * **Views and Transitions:**
 * - dashboard → list/details: Normal navigation
 * - list → details (caseId): Select case, show sidebar
 * - details → new: Create case from details context
 * - * → form: Track previousView + returnToCaseId for back button
 * - form → previousView: Return with new/updated caseId
 * 
 * **Sidebar Behavior:**
 * - Open when viewing case details
 * - Close when returning to list
 * - Persists across view changes
 * 
 * **Usage Example:**
 * ```typescript
 * const nav = useNavigationFlow({\n *   cases: allCases,\n *   connectionState: fileStorageState,\n *   saveCase,\n *   deleteCase\n * });\n * \n * if (nav.navigationLock.locked) {\n *   return <LockedView reason={nav.navigationLock.reason} />;\n * }\n * \n * // Navigate
 * nav.viewCase(\"case-123\");\n * nav.newCase();\n * nav.backToList();\n * \n * // Save case (with nav side-effects)
 * await nav.saveCaseWithNavigation(caseData);\n * ```
 * 
 * @param {UseNavigationFlowParams} params
 *   - `cases`: All available cases for lookup
 *   - `connectionState`: FileStorageLifecycleSelectors for lock determination
 *   - `saveCase`: Async function to persist case
 *   - `deleteCase`: Async function to delete case
 * 
 * @returns {NavigationHandlers} Complete navigation interface
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
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
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
    state: { currentView, selectedCaseId, showNewCaseModal, formState },
    setters: { setCurrentView, setSelectedCaseId, setShowNewCaseModal, setFormState, setForcedView },
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
      setShowNewCaseModal(false);
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
    showNewCaseModal,
    sidebarOpen,
    breadcrumbTitle,
    navigationLock,
    setSidebarOpen,
    ...actions,
  };
}
