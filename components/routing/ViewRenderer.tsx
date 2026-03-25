import { StoredCase, NewPersonData, NewCaseRecordData, CaseStatus } from "../../types/case";
import { AppView } from "../../types/view";
import type { AlertsIndex, AlertWithMatch } from "../../utils/alertsData";
import type { CaseActivityLogState } from "../../types/activityLog";
import { exportCasesToJSON, triggerImportDialog, triggerAlertsCsvImport } from "../../utils/dataExportImport";
import { caseNeedsIntake } from "@/domain/cases";
import type { IntakeFormData } from "@/domain/validation/intake.schema";

// Direct imports for high-turnover components - no lazy loading for snappiness
import { Dashboard } from "../app/Dashboard";
import { CaseList } from "../case/CaseList";
import CaseDetails from "../case/CaseDetails";
import { QuickCaseModal } from "../modals/QuickCaseModal";
import { MarkdownCaseImportModal } from "../modals/MarkdownCaseImportModal";
import { Settings } from "../app/Settings";
import { IntakeFormView } from "../case/IntakeFormView";
import type { MarkdownCaseImportState } from "@/hooks/useMarkdownCaseImportFlow";

export type View = AppView;

/**
 * The shared case-management action handlers used by both ViewRenderer and
 * CaseWorkspace.  Exporting this type allows CaseWorkspace to reference it
 * instead of duplicating the same 15 signatures.
 */
export interface CaseViewHandlers {
  handleViewCase: (caseId: string) => void;
  handleNewCase: () => void;
  handleQuickAdd: () => void;
  handleCancelNewCase: () => void;
  handleCompleteNewCase: (caseId: string, savedCase?: StoredCase) => void;
  handleCloseNewCaseModal: () => void;
  handleBackToList: () => void;
  handleSaveCase: (
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    options?: { skipNavigation?: boolean }
  ) => Promise<void>;
  handleDeleteCase: (caseId: string) => Promise<void>;
  handleDeleteCases: (caseIds: string[]) => Promise<number>;
  handleUpdateCasesStatus: (caseIds: string[], status: StoredCase["status"]) => Promise<number>;
  handleUpdateCasesPriority: (caseIds: string[], priority: boolean) => Promise<number>;
  handleBulkResolveAlerts?: (caseIds: string[], alerts: AlertWithMatch[], descriptionFilter: string) => Promise<{ resolvedCount: number; caseCount: number }>;
  handleApproveArchival?: (caseIds: string[]) => Promise<unknown>;
  handleCancelArchival?: (caseIds: string[]) => Promise<number>;
  isArchiving?: boolean;
}

interface ViewRendererProps extends CaseViewHandlers {
  // View state
  currentView: View;
  selectedCase: StoredCase | null | undefined;
  showNewCaseModal: boolean;
  importDraft?: Partial<IntakeFormData> | null;
  markdownImportState: MarkdownCaseImportState;

  // Data props
  cases: StoredCase[];
  alerts: AlertsIndex;
  activityLogState: CaseActivityLogState;

  // Extended handlers not needed by CaseWorkspace directly
  handleUpdateCaseStatus?: (caseId: string, status: StoredCase["status"]) =>
    | Promise<StoredCase | null>
    | StoredCase
    | null
    | void;
  handleResolveAlert?: (alert: AlertWithMatch) => Promise<void> | void;
  onAlertsCsvImported?: (index: AlertsIndex) => void;
  handleOpenMarkdownImport: () => void;
  handleMarkdownImportInputChange: (input: string) => void;
  handleCloseMarkdownImport: () => void;
  handleConfirmMarkdownImport: () => void;
  handleClearMarkdownImport: () => void;
  canConfirmMarkdownImport: boolean;
}

function DetailsViewContent({
  selectedCase,
  alerts,
  handleCompleteNewCase,
  handleCancelNewCase,
  handleBackToList,
  handleDeleteCase,
  handleApproveArchival,
  isArchiving,
  handleUpdateCaseStatus,
  handleResolveAlert,
  handleUpdateCasesPriority,
}: Readonly<{
  selectedCase: StoredCase;
  alerts: AlertsIndex;
  handleCompleteNewCase: (caseId: string, savedCase?: StoredCase) => void;
  handleCancelNewCase: () => void;
  handleBackToList: () => void;
  handleDeleteCase: (caseId: string) => Promise<void>;
  handleApproveArchival?: (caseIds: string[]) => Promise<unknown>;
  isArchiving?: boolean;
  handleUpdateCaseStatus?: (caseId: string, status: StoredCase["status"]) =>
    | Promise<StoredCase | null>
    | StoredCase
    | null
    | void;
  handleResolveAlert?: (alert: AlertWithMatch) => Promise<void> | void;
  handleUpdateCasesPriority: (caseIds: string[], priority: boolean) => Promise<number>;
}>) {
  if (caseNeedsIntake(selectedCase)) {
    return (
      <IntakeFormView
        existingCase={selectedCase}
        onSuccess={(savedCase) => {
          handleCompleteNewCase(savedCase.id, savedCase);
        }}
        onCancel={handleCancelNewCase}
      />
    );
  }

  return (
    <CaseDetails
      case={selectedCase}
      alerts={alerts.alertsByCaseId.get(selectedCase.id) ?? []}
      onBack={handleBackToList}
      onDelete={() => handleDeleteCase(selectedCase.id)}
      onArchive={handleApproveArchival ? async () => {
        await handleApproveArchival([selectedCase.id]);
        handleBackToList();
      } : undefined}
      isArchiving={isArchiving}
      onUpdateStatus={handleUpdateCaseStatus}
      onResolveAlert={handleResolveAlert}
      onUpdatePriority={handleUpdateCasesPriority}
    />
  );
}

/**
 * ViewRenderer component handles rendering of different views based on current route
 * 
 * Features:
 * - Lazy-loaded view components with Suspense fallbacks
 * - Clean separation of view rendering logic from App.tsx
 * - Proper prop passing to each view component
 * 
 * This component isolates the view rendering complexity from the main App component,
 * making it easier to manage and maintain the different application views.
 * 
 * @param props - All the required props for rendering the appropriate view
 */
export function ViewRenderer({
  // View state
  currentView,
  selectedCase,
  showNewCaseModal: _showNewCaseModal,
  importDraft,
  markdownImportState: _markdownImportState,

  // Data props
  cases,
  alerts,
  activityLogState,
  
  // Navigation handlers
  handleViewCase,
  handleNewCase,
  handleQuickAdd,
  handleCancelNewCase,
  handleCompleteNewCase,
  handleCloseNewCaseModal: _handleCloseNewCaseModal,
  handleBackToList,
  
  // Component handlers
  handleDeleteCase,
  handleDeleteCases,
  handleUpdateCasesStatus,
  handleUpdateCasesPriority,
  handleBulkResolveAlerts,
  handleApproveArchival,
  handleCancelArchival,
  isArchiving,
  handleUpdateCaseStatus,
  handleResolveAlert,
  onAlertsCsvImported,
  handleOpenMarkdownImport,
  handleMarkdownImportInputChange: _handleMarkdownImportInputChange,
  handleCloseMarkdownImport: _handleCloseMarkdownImport,
  handleConfirmMarkdownImport: _handleConfirmMarkdownImport,
  handleClearMarkdownImport: _handleClearMarkdownImport,
  canConfirmMarkdownImport: _canConfirmMarkdownImport,
}: Readonly<ViewRendererProps>) {
  
  switch (currentView) {
    case 'dashboard':
      return (
        <Dashboard
          cases={cases}
          alerts={alerts}
          activityLogState={activityLogState}
          onNewCase={handleNewCase}
          onImportMarkdown={handleOpenMarkdownImport}
          onViewCase={handleViewCase}
          onBulkStatusUpdate={(status: CaseStatus) => {
            // Note: This is a placeholder - actual implementation would need case selection
            // For now, this just shows the pattern. Full implementation in Phase 4.
            console.log('Bulk status update requested:', status);
          }}
          onExport={() => exportCasesToJSON(cases)}
          onImport={triggerImportDialog}
          onImportAlerts={triggerAlertsCsvImport}
        />
      );

    case 'list':
      return (
        <CaseList
          cases={cases}
          alertsSummary={alerts.summary}
          alertsByCaseId={alerts.alertsByCaseId}
          alerts={alerts.alerts}
          onViewCase={handleViewCase}
          onDeleteCases={handleDeleteCases}
          onUpdateCasesStatus={handleUpdateCasesStatus}
          onUpdateCasesPriority={handleUpdateCasesPriority}
          onBulkResolveAlerts={handleBulkResolveAlerts}
          onApproveArchival={handleApproveArchival}
          onCancelArchival={handleCancelArchival}
          isArchiving={isArchiving}
          onNewCase={handleNewCase}
          onImportMarkdown={handleOpenMarkdownImport}
          onQuickAdd={handleQuickAdd}
          onResolveAlert={handleResolveAlert}
          onUpdateCaseStatus={handleUpdateCaseStatus}
        />
      );

    case 'settings':
      return (
        <Settings
          cases={cases}
          activityLogState={activityLogState}
          onAlertsCsvImported={onAlertsCsvImported}
        />
      );

    case 'details':
      return selectedCase ? (
        <DetailsViewContent
          selectedCase={selectedCase}
          alerts={alerts}
          handleCompleteNewCase={handleCompleteNewCase}
          handleCancelNewCase={handleCancelNewCase}
          handleBackToList={handleBackToList}
          handleDeleteCase={handleDeleteCase}
          handleApproveArchival={handleApproveArchival}
          isArchiving={isArchiving}
          handleUpdateCaseStatus={handleUpdateCaseStatus}
          handleResolveAlert={handleResolveAlert}
          handleUpdateCasesPriority={handleUpdateCasesPriority}
        />
      ) : (
        <div className="text-center p-8">Case not found</div>
      );

    case 'intake':
      return (
        <IntakeFormView
          existingCase={caseNeedsIntake(selectedCase) ? selectedCase ?? undefined : undefined}
          initialData={selectedCase ? undefined : importDraft ?? undefined}
          onSuccess={(createdCase) => {
            handleCompleteNewCase(createdCase.id, createdCase);
          }}
          onCancel={handleCancelNewCase}
        />
      );

    default:
      return <div>Unknown view: {currentView}</div>;
  }
}

/**
 * Wrapper component that renders ViewRenderer plus the QuickCaseModal overlay
 */
export function ViewRendererWithModal(props: Readonly<ViewRendererProps>) {
  return (
    <>
      <ViewRenderer {...props} />
      <QuickCaseModal
        isOpen={props.showNewCaseModal}
        onClose={props.handleCloseNewCaseModal}
        onSave={props.handleSaveCase}
      />
      <MarkdownCaseImportModal
        importState={props.markdownImportState}
        onInputChange={props.handleMarkdownImportInputChange}
        onClear={props.handleClearMarkdownImport}
        onClose={props.handleCloseMarkdownImport}
        onConfirm={props.handleConfirmMarkdownImport}
        canConfirm={props.canConfirmMarkdownImport}
      />
    </>
  );
}
