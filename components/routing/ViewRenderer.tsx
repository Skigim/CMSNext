import { StoredCase, NewPersonData, NewCaseRecordData } from "../../types/case";
import { AppView } from "../../types/view";
import type { AlertsIndex, AlertWithMatch } from "../../utils/alertsData";
import type { CaseActivityLogState } from "../../types/activityLog";

// Direct imports for high-turnover components - no lazy loading for snappiness
import Dashboard from "../app/Dashboard";
import Reporting from "../reporting/Reporting";
import CaseList from "../case/CaseList";
import CaseDetails from "../case/CaseDetails";
import CaseForm from "../case/CaseForm";
import Settings from "../app/Settings";

export type View = AppView;

interface ViewRendererProps {
  // View state
  currentView: View;
  selectedCase: StoredCase | null | undefined;
  editingCase: StoredCase | null;

  // Data props
  cases: StoredCase[];
  alerts: AlertsIndex;
  activityLogState: CaseActivityLogState;
  
  // Navigation handlers
  handleViewCase: (caseId: string) => void;
  handleEditCase: (caseId: string) => void;
  handleNewCase: () => void;
  handleBackToList: () => void;
  handleSaveCase: (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => Promise<void>;
  handleCancelForm: () => void;
  handleNavigateToReports: () => void;
  
  // Component handlers
  handleDeleteCase: (caseId: string) => Promise<void>;
  handleDataPurged: () => void;
  handleAddItem: (category: any) => void;
  handleDeleteItem: (category: any, itemId: string) => Promise<void>;
  handleBatchUpdateItem?: (category: any, itemId: string, updatedItem: Partial<any>) => Promise<void>;
  handleCreateItem?: (category: any, itemData: Omit<any, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  handleDeleteNote: (noteId: string) => Promise<void>;
  handleBatchUpdateNote?: (noteId: string, updatedNote: any) => Promise<void>;
  handleBatchCreateNote?: (noteData: any) => Promise<void>;
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
  editingCase,

  // Data props
  cases,
  alerts,
  activityLogState,
  
  // Navigation handlers
  handleViewCase,
  handleEditCase,
  handleNewCase,
  handleBackToList,
  handleSaveCase,
  handleCancelForm,
  handleNavigateToReports,
  
  // Component handlers
  handleDeleteCase,
  handleDataPurged,
  handleAddItem,
  handleDeleteItem,
  handleBatchUpdateItem,
  handleCreateItem,
  handleDeleteNote,
  handleBatchUpdateNote,
  handleBatchCreateNote,
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
          onViewAllCases={handleBackToList}
          onNewCase={handleNewCase}
          onNavigateToReports={handleNavigateToReports}
        />
      );

    case 'reports':
      return (
        <Reporting
          alerts={alerts}
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
          onEditCase={handleEditCase}
          onDeleteCase={handleDeleteCase}
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
          onDataPurged={handleDataPurged}
          onAlertsCsvImported={onAlertsCsvImported}
        />
      );

    case 'details':
      return selectedCase ? (
        <CaseDetails
          case={selectedCase}
          alerts={alerts.alertsByCaseId.get(selectedCase.id) ?? []}
          onBack={handleBackToList}
          onEdit={() => handleEditCase(selectedCase.id)}
          onDelete={() => handleDeleteCase(selectedCase.id)}
          onUpdateStatus={handleUpdateCaseStatus}
          onResolveAlert={handleResolveAlert}
        />
      ) : (
        <div className="text-center p-8">Case not found</div>
      );

    case 'form':
      return (
        <CaseForm
          onSave={handleSaveCase}
          onCancel={handleCancelForm}
          case={editingCase || undefined}
        />
      );

    default:
      return <div>Unknown view: {currentView}</div>;
  }
}