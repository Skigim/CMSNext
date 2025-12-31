import { StoredCase, NewPersonData, NewCaseRecordData } from "../../types/case";
import { AppView } from "../../types/view";
import type { AlertsIndex, AlertWithMatch } from "../../utils/alertsData";
import type { CaseActivityLogState } from "../../types/activityLog";

// Direct imports for high-turnover components - no lazy loading for snappiness
import Dashboard from "../app/Dashboard";
import CaseList from "../case/CaseList";
import CaseDetails from "../case/CaseDetails";
import { QuickCaseModal } from "../modals/QuickCaseModal";
import Settings from "../app/Settings";

export type View = AppView;

interface ViewRendererProps {
  // View state
  currentView: View;
  selectedCase: StoredCase | null | undefined;
  showNewCaseModal: boolean;

  // Data props
  cases: StoredCase[];
  alerts: AlertsIndex;
  activityLogState: CaseActivityLogState;
  
  // Navigation handlers
  handleViewCase: (caseId: string) => void;
  handleNewCase: () => void;
  handleCloseNewCaseModal: () => void;
  handleBackToList: () => void;
  handleSaveCase: (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => Promise<void>;
  
  // Component handlers
  handleDeleteCase: (caseId: string) => Promise<void>;
  handleDeleteCases: (caseIds: string[]) => Promise<number>;
  handleUpdateCasesStatus: (caseIds: string[], status: StoredCase["status"]) => Promise<number>;
  handleUpdateCasesPriority: (caseIds: string[], priority: boolean) => Promise<number>;
  handleUpdateCaseStatus?: (caseId: string, status: StoredCase["status"]) =>
    | Promise<StoredCase | null>
    | StoredCase
    | null
    | void;
  handleResolveAlert?: (alert: AlertWithMatch) => Promise<void> | void;
  onAlertsCsvImported?: (index: AlertsIndex) => void;
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

  // Data props
  cases,
  alerts,
  activityLogState,
  
  // Navigation handlers
  handleViewCase,
  handleNewCase,
  handleCloseNewCaseModal: _handleCloseNewCaseModal,
  handleBackToList,
  handleSaveCase,
  
  // Component handlers
  handleDeleteCase,
  handleDeleteCases,
  handleUpdateCasesStatus,
  handleUpdateCasesPriority,
  handleUpdateCaseStatus,
  handleResolveAlert,
  onAlertsCsvImported,
}: ViewRendererProps) {
  
  switch (currentView) {
    case 'dashboard':
      return (
        <Dashboard
          cases={cases}
          alerts={alerts}
          activityLogState={activityLogState}
          onNewCase={handleNewCase}
          onViewCase={handleViewCase}
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
          onEditCase={handleViewCase}
          onDeleteCase={handleDeleteCase}
          onDeleteCases={handleDeleteCases}
          onUpdateCasesStatus={handleUpdateCasesStatus}
          onUpdateCasesPriority={handleUpdateCasesPriority}
          onNewCase={handleNewCase}
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
        <CaseDetails
          case={selectedCase}
          alerts={alerts.alertsByCaseId.get(selectedCase.id) ?? []}
          onBack={handleBackToList}
          onSave={handleSaveCase}
          onDelete={() => handleDeleteCase(selectedCase.id)}
          onUpdateStatus={handleUpdateCaseStatus}
          onResolveAlert={handleResolveAlert}
          onUpdatePriority={handleUpdateCasesPriority}
        />
      ) : (
        <div className="text-center p-8">Case not found</div>
      );

    default:
      return <div>Unknown view: {currentView}</div>;
  }
}

/**
 * Wrapper component that renders ViewRenderer plus the QuickCaseModal overlay
 */
export function ViewRendererWithModal(props: ViewRendererProps) {
  return (
    <>
      <ViewRenderer {...props} />
      <QuickCaseModal
        isOpen={props.showNewCaseModal}
        onClose={props.handleCloseNewCaseModal}
        onSave={props.handleSaveCase}
      />
    </>
  );
}