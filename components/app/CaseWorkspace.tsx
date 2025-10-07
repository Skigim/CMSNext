import { lazy, memo, Suspense } from "react";
import type { AppNavigationConfig } from "./AppNavigationShell";
import { AppNavigationShell } from "./AppNavigationShell";
import { ViewRenderer } from "../routing/ViewRenderer";
import type {
  CaseCategory,
  CaseDisplay,
  FinancialItem,
  NewCaseRecordData,
  NewNoteData,
  NewPersonData,
} from "../../types/case";
import type { ItemFormState } from "../../hooks/useFinancialItemFlow";
import type { useNotes } from "../../hooks/useNotes";
import type { AlertsIndex, AlertWithMatch } from "../../utils/alertsData";
import type { CaseActivityLogState } from "../../types/activityLog";

const FinancialItemModal = lazy(() => import("../modals/FinancialItemModal"));
const NoteModal = lazy(() => import("../modals/NoteModal"));

interface CaseWorkspaceViewHandlers {
  handleViewCase: (caseId: string) => void;
  handleEditCase: (caseId: string) => void;
  handleNewCase: () => void;
  handleBackToList: () => void;
  handleSaveCase: (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => Promise<void>;
  handleCancelForm: () => void;
  handleDeleteCase: (caseId: string) => Promise<void>;
  handleDataPurged: () => Promise<void> | void;
}

interface CaseWorkspaceFinancialFlow {
  itemForm: ItemFormState;
  handleAddItem: (category: CaseCategory) => void;
  handleDeleteItem: (category: CaseCategory, itemId: string) => Promise<void>;
  handleBatchUpdateItem: (
    category: CaseCategory,
    itemId: string,
    updatedItem: Partial<FinancialItem>,
  ) => Promise<void>;
  handleCreateItem: (
    category: CaseCategory,
    itemData: Omit<FinancialItem, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  handleCancelItemForm: () => void;
  closeItemForm: () => void;
  onCaseUpdated: (updatedCase: CaseDisplay) => void;
}

type NoteFormState = ReturnType<typeof useNotes>["noteForm"];

interface CaseWorkspaceNoteFlow {
  noteForm: NoteFormState;
  handleAddNote: () => void;
  handleEditNote: (noteId: string) => void;
  handleDeleteNote: (noteId: string) => Promise<void>;
  handleSaveNote: (noteData: NewNoteData) => Promise<void>;
  handleCancelNoteForm: () => void;
  handleBatchUpdateNote: (noteId: string, noteData: NewNoteData) => Promise<void>;
  handleBatchCreateNote: (noteData: NewNoteData) => Promise<void>;
}

export interface CaseWorkspaceProps {
  navigation: AppNavigationConfig;
  cases: CaseDisplay[];
  selectedCase: CaseDisplay | null | undefined;
  editingCase: CaseDisplay | null;
  error: string | null;
  onDismissError: () => void;
  viewHandlers: CaseWorkspaceViewHandlers;
  financialFlow: CaseWorkspaceFinancialFlow;
  noteFlow: CaseWorkspaceNoteFlow;
  alerts: AlertsIndex;
  onUpdateCaseStatus: (caseId: string, status: CaseDisplay["status"]) => Promise<CaseDisplay | null> | CaseDisplay | null | void;
  onResolveAlert?: (alert: AlertWithMatch) => Promise<void> | void;
  onAlertsCsvImported?: (index: AlertsIndex) => void;
  activityLogState: CaseActivityLogState;
}

/**
 * Encapsulates the primary case workspace view, including the view renderer,
 * error banners, and auxiliary modals. This keeps the parent App component
 * focused on wiring data and state flows together.
 */
export const CaseWorkspace = memo(function CaseWorkspace({
  navigation,
  cases,
  selectedCase,
  editingCase,
  error,
  onDismissError,
  viewHandlers,
  financialFlow,
  noteFlow,
  alerts,
  onUpdateCaseStatus,
  onResolveAlert,
  onAlertsCsvImported,
  activityLogState,
}: CaseWorkspaceProps) {
  return (
    <AppNavigationShell {...navigation}>
      {error && (
        <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-destructive">
          <p>{error}</p>
          <button
            onClick={onDismissError}
            className="ml-2 text-destructive/80 underline hover:text-destructive"
          >
            Dismiss
          </button>
        </div>
      )}

      <ViewRenderer
        currentView={navigation.currentView}
        selectedCase={selectedCase}
        editingCase={editingCase}
        cases={cases}
        alerts={alerts}
        handleViewCase={viewHandlers.handleViewCase}
        handleEditCase={viewHandlers.handleEditCase}
        handleNewCase={viewHandlers.handleNewCase}
        handleBackToList={viewHandlers.handleBackToList}
        handleSaveCase={viewHandlers.handleSaveCase}
        handleCancelForm={viewHandlers.handleCancelForm}
  handleNavigateToReports={() => navigation.onNavigate('reports')}
        handleDeleteCase={viewHandlers.handleDeleteCase}
        handleDataPurged={viewHandlers.handleDataPurged}
        handleAddItem={financialFlow.handleAddItem}
        handleDeleteItem={financialFlow.handleDeleteItem}
        handleBatchUpdateItem={financialFlow.handleBatchUpdateItem}
        handleCreateItem={financialFlow.handleCreateItem}
        handleAddNote={noteFlow.handleAddNote}
        handleEditNote={noteFlow.handleEditNote}
        handleDeleteNote={noteFlow.handleDeleteNote}
        handleBatchUpdateNote={noteFlow.handleBatchUpdateNote}
        handleBatchCreateNote={noteFlow.handleBatchCreateNote}
        handleUpdateCaseStatus={onUpdateCaseStatus}
        handleResolveAlert={onResolveAlert}
        onAlertsCsvImported={onAlertsCsvImported}
        activityLogState={activityLogState}
      />

      {financialFlow.itemForm.isOpen && financialFlow.itemForm.category && selectedCase && (
        <Suspense fallback={<div>Loading...</div>}>
          <FinancialItemModal
            isOpen={financialFlow.itemForm.isOpen}
            onClose={financialFlow.handleCancelItemForm}
            caseData={selectedCase}
            onUpdateCase={(updatedCase: CaseDisplay) => {
              financialFlow.onCaseUpdated(updatedCase);
              financialFlow.closeItemForm();
            }}
            itemType={financialFlow.itemForm.category}
            editingItem={financialFlow.itemForm.item}
          />
        </Suspense>
      )}

      {noteFlow.noteForm.isOpen && (
        <Suspense fallback={<div>Loading...</div>}>
          <NoteModal
            isOpen={noteFlow.noteForm.isOpen}
            onClose={noteFlow.handleCancelNoteForm}
            onSave={noteFlow.handleSaveNote}
            editingNote={noteFlow.noteForm.editingNote}
          />
        </Suspense>
      )}
    </AppNavigationShell>
  );
});
