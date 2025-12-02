import { useCallback } from "react";
import { useIsMounted } from "./useIsMounted";
import { NewCaseRecordData, NewPersonData, StoredCase } from "../types/case";
import { AppView } from "../types/view";
import { startMeasurement, endMeasurement } from "../utils/performanceTracker";

const RESTRICTED_VIEWS: readonly AppView[] = ["list", "details", "form"];

export interface FormState {
  previousView: AppView;
  returnToCaseId?: string;
}

export interface NavigationState {
  currentView: AppView;
  selectedCaseId: string | null;
  editingCase: StoredCase | null;
  formState: FormState;
}

export interface NavigationStateSetters {
  setCurrentView: (view: AppView) => void;
  setSelectedCaseId: (id: string | null) => void;
  setEditingCase: (c: StoredCase | null) => void;
  setFormState: (state: FormState) => void;
  setSidebarOpen: (open: boolean) => void;
  setForcedView: (view: AppView | null) => void;
}

export interface UseNavigationActionsParams {
  state: NavigationState;
  setters: NavigationStateSetters;
  cases: StoredCase[];
  guardCaseInteraction: () => boolean;
  isLocked: boolean;
  lockReason: string;
  saveCase: (data: { person: NewPersonData; caseRecord: NewCaseRecordData }, editing?: StoredCase | null) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;
}

/**
 * Provides navigation action callbacks.
 * Separated from state management for cleaner organization.
 */
export function useNavigationActions({
  state, setters, cases, guardCaseInteraction, isLocked, lockReason, saveCase, deleteCase,
}: UseNavigationActionsParams) {
  const isMounted = useIsMounted();
  const { currentView, selectedCaseId, editingCase, formState } = state;
  const { setCurrentView, setSelectedCaseId, setEditingCase, setFormState, setSidebarOpen, setForcedView } = setters;

  const backToList = useCallback(() => {
    startMeasurement("navigation:backToList");
    setCurrentView("list");
    setSelectedCaseId(null);
    endMeasurement("navigation:backToList", { result: "list" });
  }, [setCurrentView, setSelectedCaseId]);

  const backToDashboard = useCallback(() => {
    startMeasurement("navigation:backToDashboard");
    setCurrentView("dashboard");
    setSelectedCaseId(null);
    endMeasurement("navigation:backToDashboard", { result: "dashboard" });
  }, [setCurrentView, setSelectedCaseId]);

  const viewCase = useCallback((caseId: string) => {
    startMeasurement("navigation:viewCase", { caseId, locked: isLocked });
    if (guardCaseInteraction()) return endMeasurement("navigation:viewCase", { caseId, blocked: true });
    setSelectedCaseId(caseId);
    setCurrentView("details");
    setSidebarOpen(false);
    endMeasurement("navigation:viewCase", { caseId, blocked: false });
  }, [guardCaseInteraction, isLocked, setCurrentView, setSelectedCaseId, setSidebarOpen]);

  const editCase = useCallback((caseId: string) => {
    startMeasurement("navigation:editCase", { caseId });
    if (guardCaseInteraction()) return endMeasurement("navigation:editCase", { blocked: true });
    const caseToEdit = cases.find((c) => c.id === caseId);
    if (!caseToEdit) return endMeasurement("navigation:editCase", { result: "missing" });
    setEditingCase(caseToEdit);
    setFormState({ previousView: currentView, returnToCaseId: currentView === "details" ? caseId : undefined });
    setCurrentView("form");
    setSidebarOpen(false);
    endMeasurement("navigation:editCase", { result: "form" });
  }, [cases, currentView, guardCaseInteraction, setCurrentView, setEditingCase, setFormState, setSidebarOpen]);

  const newCase = useCallback(() => {
    startMeasurement("navigation:newCase", { locked: isLocked });
    if (guardCaseInteraction()) return endMeasurement("navigation:newCase", { blocked: true });
    setEditingCase(null);
    setFormState({ previousView: currentView, returnToCaseId: undefined });
    setCurrentView("form");
    setSidebarOpen(false);
    endMeasurement("navigation:newCase", { result: "form" });
  }, [currentView, guardCaseInteraction, isLocked, setCurrentView, setEditingCase, setFormState, setSidebarOpen]);

  const cancelForm = useCallback(() => {
    startMeasurement("navigation:cancelForm");
    if (formState.previousView === "details" && formState.returnToCaseId) {
      setSelectedCaseId(formState.returnToCaseId);
      setCurrentView("details");
    } else {
      setCurrentView(formState.previousView);
    }
    setEditingCase(null);
    setFormState({ previousView: "list" });
    endMeasurement("navigation:cancelForm", { result: formState.previousView });
  }, [formState, setCurrentView, setEditingCase, setFormState, setSelectedCaseId]);

  const saveCaseWithNavigation = useCallback(async (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => {
    startMeasurement("navigation:saveCase", { editing: Boolean(editingCase) });
    if (guardCaseInteraction()) {
      endMeasurement("navigation:saveCase", { blocked: true });
      throw new Error(lockReason);
    }
    try {
      await saveCase(caseData, editingCase);
      if (!isMounted.current) return;
      if (editingCase && formState.previousView === "details" && formState.returnToCaseId) {
        setSelectedCaseId(formState.returnToCaseId);
        setCurrentView("details");
      } else {
        setCurrentView(editingCase ? formState.previousView : "list");
      }
      setEditingCase(null);
      setFormState({ previousView: "list" });
      endMeasurement("navigation:saveCase", { result: editingCase ? "update" : "create" });
    } catch (err) {
      console.error("Failed to save case:", err);
      endMeasurement("navigation:saveCase", { result: "error" });
      throw err;
    }
  }, [editingCase, formState, guardCaseInteraction, isMounted, lockReason, saveCase, setCurrentView, setEditingCase, setFormState, setSelectedCaseId]);

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

  return { navigate, viewCase, editCase, newCase, saveCaseWithNavigation, cancelForm, deleteCaseWithNavigation, backToList, backToDashboard };
}

export { RESTRICTED_VIEWS };
