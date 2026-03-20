import { useCallback } from "react";
import { useIsMounted } from "./useIsMounted";
import { NewCaseRecordData, NewPersonData, StoredCase } from "../types/case";
import { AppView } from "../types/view";
import { startMeasurement, endMeasurement } from "../utils/performanceTracker";
import { createLogger } from "@/utils/logger";
import { extractErrorMessage } from "@/utils/errorUtils";
import { caseNeedsIntake } from "@/domain/cases";

const logger = createLogger("useNavigationActions");

const RESTRICTED_VIEWS: readonly AppView[] = ["list", "details", "form", "intake"];

export interface FormState {
  previousView: AppView;
  returnToCaseId?: string;
  /** Tracks which view we came from when viewing case details (for back navigation) */
  detailsSourceView?: AppView;
}

function resolveCreatedCaseSourceView(formState: FormState): AppView {
  if (formState.previousView === "details") {
    return formState.detailsSourceView ?? "list";
  }

  return formState.previousView;
}

function clearDetailsSourceView(formState: FormState): FormState {
  return {
    ...formState,
    detailsSourceView: undefined,
  };
}

function buildIntakeRedirectState(
  formState: FormState,
  currentView: AppView,
  selectedCaseId: string | null,
): FormState {
  return {
    ...formState,
    previousView: currentView,
    returnToCaseId: currentView === "details" ? selectedCaseId ?? undefined : undefined,
    detailsSourceView: undefined,
  };
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
  setForcedView: (view: AppView | null) => void;
}

export interface UseNavigationActionsParams {
  state: NavigationState;
  setters: NavigationStateSetters;
  cases: StoredCase[];
  guardCaseInteraction: () => boolean;
  isLocked: boolean;
  lockReason: string;
  saveCase: (data: { person: NewPersonData; caseRecord: NewCaseRecordData }, editingCaseId?: string) => Promise<StoredCase | undefined>;
  deleteCase: (caseId: string) => Promise<void>;
  /** Optional callback to log case view activity */
  logCaseView?: (caseData: StoredCase) => void;
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
  state, setters, cases, guardCaseInteraction, isLocked, lockReason, saveCase, deleteCase, logCaseView,
}: UseNavigationActionsParams) {
  const isMounted = useIsMounted();
  const { currentView, selectedCaseId, showNewCaseModal, formState } = state;
  const { setCurrentView, setSelectedCaseId, setShowNewCaseModal, setFormState, setForcedView } = setters;

  const backToList = useCallback(() => {
    startMeasurement("navigation:backToList");
    // If we have a tracked source view, return there; otherwise default to list
    const targetView = formState.detailsSourceView === "details"
      ? "list"
      : (formState.detailsSourceView ?? "list");
    setCurrentView(targetView);
    setSelectedCaseId(null);
    // Clear the source view after navigating back
    setFormState(clearDetailsSourceView(formState));
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
    const caseData = cases.find((c) => c.id === caseId);
    const nextView = caseNeedsIntake(caseData) ? "intake" : "details";

    if (nextView === "intake") {
      setFormState(buildIntakeRedirectState(formState, currentView, selectedCaseId));
    } else {
      setFormState({ ...formState, detailsSourceView: currentView });
    }

    setSelectedCaseId(caseId);
    setCurrentView(nextView);
    // Log case view activity (replaces localStorage-based recent cases)
    if (caseData && logCaseView) {
      logCaseView(caseData);
    }
    endMeasurement("navigation:viewCase", {
      caseId,
      blocked: false,
      result: nextView,
    });
  }, [cases, currentView, formState, guardCaseInteraction, isLocked, logCaseView, selectedCaseId, setCurrentView, setFormState, setSelectedCaseId]);

  const newCase = useCallback(() => {
    startMeasurement("navigation:newCase", { locked: isLocked });
    if (guardCaseInteraction()) return endMeasurement("navigation:newCase", { blocked: true });

    setFormState({
      ...formState,
      previousView: currentView,
      returnToCaseId: currentView === "details" ? selectedCaseId ?? undefined : undefined,
    });
    setSelectedCaseId(null);
    setCurrentView("intake");
    endMeasurement("navigation:newCase", { result: "intake", source: currentView });
  }, [currentView, formState, guardCaseInteraction, isLocked, selectedCaseId, setCurrentView, setFormState, setSelectedCaseId]);

  const quickAdd = useCallback(() => {
    startMeasurement("navigation:quickAdd", { locked: isLocked });
    if (guardCaseInteraction()) return endMeasurement("navigation:quickAdd", { blocked: true });

    setShowNewCaseModal(true);
    endMeasurement("navigation:quickAdd", { result: "modal", source: currentView });
  }, [currentView, guardCaseInteraction, isLocked, setShowNewCaseModal]);

  const cancelNewCase = useCallback(() => {
    startMeasurement("navigation:cancelNewCase");

    if (formState.previousView === "details" && formState.returnToCaseId) {
      setSelectedCaseId(formState.returnToCaseId);
      setCurrentView("details");
      endMeasurement("navigation:cancelNewCase", { result: "details" });
      return;
    }

    setSelectedCaseId(null);
    setCurrentView(formState.previousView);
    setFormState(clearDetailsSourceView(formState));
    endMeasurement("navigation:cancelNewCase", { result: formState.previousView });
  }, [formState, setCurrentView, setFormState, setSelectedCaseId]);

  const completeNewCase = useCallback((caseId: string, savedCase?: StoredCase) => {
    startMeasurement("navigation:completeNewCase", { caseId });

    const detailsSourceView = resolveCreatedCaseSourceView(formState);
    const nextCase = savedCase ?? cases.find((caseData) => caseData.id === caseId);
    const nextView = caseNeedsIntake(nextCase) ? "intake" : "details";

    setFormState({
      ...formState,
      detailsSourceView,
      previousView: detailsSourceView,
      returnToCaseId: undefined,
    });
    setSelectedCaseId(caseId);
    setCurrentView(nextView);

    endMeasurement("navigation:completeNewCase", {
      caseId,
      result: nextView,
      source: detailsSourceView,
    });
  }, [cases, formState, setCurrentView, setFormState, setSelectedCaseId]);

  const closeNewCaseModal = useCallback(() => {
    startMeasurement("navigation:closeNewCaseModal");
    setShowNewCaseModal(false);
    endMeasurement("navigation:closeNewCaseModal", { result: "closed" });
  }, [setShowNewCaseModal]);

  const saveCaseWithNavigation = useCallback(async (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    options?: { skipNavigation?: boolean }
  ) => {
    startMeasurement("navigation:saveCase");
    if (guardCaseInteraction()) {
      endMeasurement("navigation:saveCase", { blocked: true });
      throw new Error(lockReason);
    }
    try {
      // Creating a new case: either via the new intake workflow view or the legacy
      // QuickCaseModal (showNewCaseModal).  Both paths produce a new case and
      // navigate to its details.  The QuickCaseModal path is retained for
      // programmatic use (e.g. tests, "Add Another" flow) until fully replaced.
      const isCreating = showNewCaseModal || currentView === "intake";
      // Pass selectedCaseId if editing, otherwise omit for create
      const editingCaseId = isCreating ? undefined : (state.selectedCaseId ?? undefined);
      const savedCase = editingCaseId === undefined
        ? await saveCase(caseData)
        : await saveCase(caseData, editingCaseId);
      if (!isMounted.current) return;
      
      // Skip navigation if requested (e.g., "add another" mode)
      if (options?.skipNavigation) {
        endMeasurement("navigation:saveCase", { result: "create-no-nav" });
        return;
      }
      
      // Close modal if open
      if (showNewCaseModal) {
        setShowNewCaseModal(false);
      }
      
      // If we created a new case, navigate to it
      if (savedCase && isCreating) {
        completeNewCase(savedCase.id, savedCase);
      }
      
      endMeasurement("navigation:saveCase", { result: isCreating ? "create" : "update" });
    } catch (error) {
      logger.error("Failed to save case", { error: extractErrorMessage(error) });
      endMeasurement("navigation:saveCase", { result: "error" });
      throw error;
    }
  }, [completeNewCase, currentView, guardCaseInteraction, isMounted, lockReason, saveCase, setShowNewCaseModal, showNewCaseModal, state.selectedCaseId]);

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
    } catch (error) {
      logger.error("Failed to delete case", { error: extractErrorMessage(error) });
      endMeasurement("navigation:deleteCase", { result: "error" });
      throw error;
    }
  }, [deleteCase, guardCaseInteraction, isMounted, lockReason, selectedCaseId, setCurrentView, setSelectedCaseId]);

  const navigate = useCallback((view: AppView) => {
    startMeasurement("navigation:navigate", { view });
    if (RESTRICTED_VIEWS.includes(view) && guardCaseInteraction()) {
      setForcedView(view);
      setCurrentView("settings");
      setSelectedCaseId(null);
      return endMeasurement("navigation:navigate", { redirected: "settings" });
    }
    switch (view) {
      case "dashboard": backToDashboard(); break;
      case "list":
        setCurrentView("list");
        setSelectedCaseId(null);
        setFormState(clearDetailsSourceView(formState));
        break;
      case "details": if (selectedCaseId) { setCurrentView("details"); } else { backToList(); } break;
      case "form": newCase(); break;
      case "intake": newCase(); break;
      case "settings": setCurrentView(view); setSelectedCaseId(null); break;
    }
    endMeasurement("navigation:navigate", { target: view });
  }, [backToDashboard, backToList, formState, guardCaseInteraction, newCase, selectedCaseId, setCurrentView, setForcedView, setFormState, setSelectedCaseId]);

  return { navigate, viewCase, newCase, quickAdd, cancelNewCase, completeNewCase, closeNewCaseModal, saveCaseWithNavigation, deleteCaseWithNavigation, backToList, backToDashboard };
}

export { RESTRICTED_VIEWS };
