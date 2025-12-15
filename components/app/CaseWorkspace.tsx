import { lazy, memo, Suspense } from "react";
import { AlertCircle } from "lucide-react";
import type { AppNavigationConfig } from "./AppNavigationShell";
import { AppNavigationShell } from "./AppNavigationShell";
import { ViewRenderer } from "../routing/ViewRenderer";
import type {
  StoredCase,
  CaseCategory,
  FinancialItem,
  NewCaseRecordData,
  NewPersonData,
} from "../../types/case";
import type { ItemFormState, FinancialFormData, FinancialFormErrors } from "../../hooks/useFinancialItemFlow";
import type { AlertsIndex, AlertWithMatch } from "../../utils/alertsData";
import type { CaseActivityLogState } from "../../types/activityLog";
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";

const FinancialItemModal = lazy(() => import("../modals/FinancialItemModal"));

interface CaseWorkspaceViewHandlers {
  handleViewCase: (caseId: string) => void;
  handleEditCase: (caseId: string) => void;
  handleNewCase: () => void;
  handleBackToList: () => void;
  handleSaveCase: (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => Promise<void>;
  handleCancelForm: () => void;
  handleDeleteCase: (caseId: string) => Promise<void>;
  handleDeleteCases: (caseIds: string[]) => Promise<number>;
  handleUpdateCasesStatus: (caseIds: string[], status: StoredCase["status"]) => Promise<number>;
  handleUpdateCasesPriority: (caseIds: string[], priority: boolean) => Promise<number>;
}

interface CaseWorkspaceFinancialFlow {
  itemForm: ItemFormState;
  formData: FinancialFormData;
  formErrors: FinancialFormErrors;
  addAnother: boolean;
  isEditing: boolean;
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
  handleSaveItem: () => Promise<boolean>;
  updateFormField: <K extends keyof FinancialFormData>(field: K, value: FinancialFormData[K]) => void;
  setAddAnother: (value: boolean) => void;
}

export interface CaseWorkspaceProps {
  navigation: AppNavigationConfig;
  cases: StoredCase[];
  selectedCase: StoredCase | null | undefined;
  editingCase: StoredCase | null;
  error: string | null;
  onDismissError: () => void;
  viewHandlers: CaseWorkspaceViewHandlers;
  financialFlow: CaseWorkspaceFinancialFlow;
  alerts: AlertsIndex;
  onUpdateCaseStatus: (caseId: string, status: StoredCase["status"]) => Promise<StoredCase | null> | StoredCase | null | void;
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
  alerts,
  onUpdateCaseStatus,
  onResolveAlert,
  onAlertsCsvImported,
  activityLogState,
}: CaseWorkspaceProps) {
  return (
    <AppNavigationShell {...navigation}>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            <Button
              onClick={onDismissError}
              variant="ghost"
              size="sm"
              className="mt-2 h-auto px-2 py-1"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
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
        handleDeleteCase={viewHandlers.handleDeleteCase}
        handleDeleteCases={viewHandlers.handleDeleteCases}
        handleUpdateCasesStatus={viewHandlers.handleUpdateCasesStatus}
        handleUpdateCasesPriority={viewHandlers.handleUpdateCasesPriority}
        handleUpdateCaseStatus={onUpdateCaseStatus}
        handleResolveAlert={onResolveAlert}
        onAlertsCsvImported={onAlertsCsvImported}
        activityLogState={activityLogState}
      />

      {financialFlow.itemForm.isOpen && financialFlow.itemForm.category && selectedCase && (
        <Suspense fallback={null}>
          <FinancialItemModal
            isOpen={financialFlow.itemForm.isOpen}
            onClose={financialFlow.handleCancelItemForm}
            onSave={financialFlow.handleSaveItem}
            caseData={selectedCase}
            itemType={financialFlow.itemForm.category}
            isEditing={financialFlow.isEditing}
            formData={financialFlow.formData}
            formErrors={financialFlow.formErrors}
            addAnother={financialFlow.addAnother}
            onFormFieldChange={financialFlow.updateFormField}
            onAddAnotherChange={financialFlow.setAddAnother}
          />
        </Suspense>
      )}
    </AppNavigationShell>
  );
});
