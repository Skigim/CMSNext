import { useCallback } from "react";
import { useIsMounted } from "./useIsMounted";
import { NewCaseRecordData, NewPersonData, StoredCase } from "../types/case";
import { AppView } from "../types/view";
import { startMeasurement, endMeasurement } from "../utils/performanceTracker";

const RESTRICTED_VIEWS: readonly AppView[] = ["list", "details", "form"];

export interface FormState {
  previousView: AppView;
  returnToCaseId?: string;
  /** Tracks which view we came from when viewing case details (for back navigation) */
  detailsSourceView?: AppView;
}

export interface NavigationState {
  currentView: AppView;
  selectedCaseId: string | null;
  showNewCaseModal: boolean;
  formState: FormState;
}

export interface NavigationStateSetters {
  setCurrentView: (view: AppView) => void;
  setSelectedCaseId: (id: string | null) => void;
  setShowNewCaseModal: (show: boolean) => void;
  setFormState: (state: FormState) => void;
  setSidebarOpen: (open: boolean) => void;
  setForcedView: (view: AppView | null) => void;
}

export interface UseNavigationActionsParams {
  state: NavigationState;
  setters: NavigationStateSetters;
  guardCaseInteraction: () => boolean;
  isLocked: boolean;
  lockReason: string;
  saveCase: (data: { person: NewPersonData; caseRecord: NewCaseRecordData }, editingCaseId?: string) => Promise<StoredCase | undefined>;
  deleteCase: (caseId: string) => Promise<void>;
}

/**
 * Provides navigation action callbacks with locked state awareness
 * 
 * Handles all navigation mutations:
 * - View transitions (navigate, viewCase, newCase, etc.)
 * - Case operations with navigation (saveCaseWithNavigation, deleteCaseWithNavigation)
 * - Form state management for back navigation
 * - Breadcrumb and sidebar control
 * 
 * **Lock-Aware Actions:**
 * - All case interactions check `guardCaseInteraction()` (blocks if locked)
 * - Shows toast with lockReason if action blocked
 * - Navigation still works (view transitions allowed)
 * - Prevents data mutations during disconnection
 * 
 * **Form State Tracking:**
 * - `previousView`: Where user came from (list/details)
 * - `returnToCaseId`: Case to return to when form closes
 * - `detailsSourceView`: Track if details view opened from list or form
 * 
 * **Save/Delete with Navigation:**
 * - `saveCaseWithNavigation(caseData)`: Save → navigate to details → open sidebar
 * - `deleteCaseWithNavigation(caseId)`: Delete → close sidebar → navigate to list
 * - Both have performance tracking (startMeasurement/endMeasurement)
 * 
 * **Usage Example:**
 * ```typescript
 * const actions = useNavigationActions({\n *   state: navState,\n *   setters: navSetters,\n *   guardCaseInteraction: () => !isLocked,\n *   isLocked,\n *   lockReason: \"Offline\",\n *   saveCase,\n *   deleteCase\n * });\n * \n * // Navigate
 * actions.navigate(\"details\");\n * actions.viewCase(\"case-123\");\n * \n * // Save and navigate
 * await actions.saveCaseWithNavigation(caseData);\n * // Auto-navigates to details, opens sidebar
 * \n * // Restricted actions
 * if (actions.isLocked) {\n *   <button onClick={actions.newCase} disabled>\n *     {actions.lockReason} - Can't create case\n *   </button>\n * }\n * ```
 * 
 * @param {UseNavigationActionsParams} params Configuration
 * @returns Navigation action handlers
 */
export function useNavigationActions({
  state, setters, guardCaseInteraction, isLocked, lockReason, saveCase, deleteCase,
}: UseNavigationActionsParams) {
  const isMounted = useIsMounted();
  const { currentView, selectedCaseId, showNewCaseModal, formState } = state;
  const { setCurrentView, setSelectedCaseId, setShowNewCaseModal, setFormState, setSidebarOpen, setForcedView } = setters;

  const backToList = useCallback(() => {
    startMeasurement("navigation:backToList");
    // If we have a tracked source view, return there; otherwise default to list
    const targetView = formState.detailsSourceView ?? "list";
    setCurrentView(targetView);
    setSelectedCaseId(null);
    // Clear the source view after navigating back
    setFormState({ ...formState, detailsSourceView: undefined });
    endMeasurement("navigation:backToList", { result: targetView });
  }, [formState, setCurrentView, setFormState, setSelectedCaseId]);

  const backToDashboard = useCallback(() => {
    startMeasurement("navigation:backToDashboard");
    setCurrentView("dashboard");
    setSelectedCaseId(null);
    endMeasurement("navigation:backToDashboard", { result: "dashboard" });
  }, [setCurrentView, setSelectedCaseId]);

  const viewCase = useCallback((caseId: string) => {
    startMeasurement("navigation:viewCase", { caseId, locked: isLocked });
    if (guardCaseInteraction()) return endMeasurement("navigation:viewCase", { caseId, blocked: true });
    // Track where we came from for back navigation
    setFormState({ ...formState, detailsSourceView: currentView });
    setSelectedCaseId(caseId);
    setCurrentView("details");
    setSidebarOpen(false);
    endMeasurement("navigation:viewCase", { caseId, blocked: false });
  }, [currentView, formState, guardCaseInteraction, isLocked, setCurrentView, setFormState, setSelectedCaseId, setSidebarOpen]);

  const newCase = useCallback(() => {
    startMeasurement("navigation:newCase", { locked: isLocked });
    if (guardCaseInteraction()) return endMeasurement("navigation:newCase", { blocked: true });
    setShowNewCaseModal(true);
    endMeasurement("navigation:newCase", { result: "modal" });
  }, [guardCaseInteraction, isLocked, setShowNewCaseModal]);

  const closeNewCaseModal = useCallback(() => {
    startMeasurement("navigation:closeNewCaseModal");
    setShowNewCaseModal(false);
    endMeasurement("navigation:closeNewCaseModal", { result: "closed" });
  }, [setShowNewCaseModal]);

  const saveCaseWithNavigation = useCallback(async (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => {
    startMeasurement("navigation:saveCase");
    if (guardCaseInteraction()) {
      endMeasurement("navigation:saveCase", { blocked: true });
      throw new Error(lockReason);
    }
    try {
      // Pass selectedCaseId if editing, otherwise omit for create
      const editingCaseId = !showNewCaseModal ? state.selectedCaseId ?? undefined : undefined;
      const savedCase = editingCaseId !== undefined 
        ? await saveCase(caseData, editingCaseId)
        : await saveCase(caseData);
      if (!isMounted.current) return;
      
      // Close modal if open
      if (showNewCaseModal) {
        setShowNewCaseModal(false);
      }
      
      // If we created a new case, navigate to it
      if (savedCase && showNewCaseModal) {
        setSelectedCaseId(savedCase.id);
        setCurrentView("details");
        setSidebarOpen(false);
      }
      
      endMeasurement("navigation:saveCase", { result: showNewCaseModal ? "create" : "update" });
    } catch (err) {
      console.error("Failed to save case:", err);
      endMeasurement("navigation:saveCase", { result: "error" });
      throw err;
    }
  }, [guardCaseInteraction, isMounted, lockReason, saveCase, setCurrentView, setSelectedCaseId, setShowNewCaseModal, setSidebarOpen, showNewCaseModal, state.selectedCaseId]);

  const deleteCaseWithNavigation = useCallback(async (caseId: string) => {
    startMeasurement("navigation:deleteCase", { caseId });
    if (guardCaseInteraction()) {
      endMeasurement("navigation:deleteCase", { blocked: true });
      throw new Error(lockReason);
    }
    try {
      await deleteCase(caseId);
      if (!isMounted.current) return;
      if (selectedCaseId === caseId) {
        setCurrentView("list");
        setSelectedCaseId(null);
      }
      endMeasurement("navigation:deleteCase", { result: "deleted" });
    } catch (err) {
      console.error("Failed to delete case:", err);
      endMeasurement("navigation:deleteCase", { result: "error" });
      throw err;
    }
  }, [deleteCase, guardCaseInteraction, isMounted, lockReason, selectedCaseId, setCurrentView, setSelectedCaseId]);

  const navigate = useCallback((view: AppView) => {
    startMeasurement("navigation:navigate", { view });
    if (RESTRICTED_VIEWS.includes(view) && guardCaseInteraction()) {
      setForcedView(view);
      setSidebarOpen(true);
      setCurrentView("settings");
      setSelectedCaseId(null);
      return endMeasurement("navigation:navigate", { redirected: "settings" });
    }
    setSidebarOpen(view !== "details" && view !== "form");
    switch (view) {
      case "dashboard": backToDashboard(); break;
      case "list": backToList(); break;
      case "details": if (selectedCaseId) { setCurrentView("details"); } else { backToList(); } break;
      case "form": newCase(); break;
      case "reports":
      case "settings": setCurrentView(view); setSelectedCaseId(null); break;
    }
    endMeasurement("navigation:navigate", { target: view });
  }, [backToDashboard, backToList, guardCaseInteraction, newCase, selectedCaseId, setCurrentView, setForcedView, setSelectedCaseId, setSidebarOpen]);

  return { navigate, viewCase, newCase, closeNewCaseModal, saveCaseWithNavigation, deleteCaseWithNavigation, backToList, backToDashboard };
}

export { RESTRICTED_VIEWS };
