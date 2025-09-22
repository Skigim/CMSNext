import { lazy, Suspense } from "react";
import { CaseDisplay, NewPersonData, NewCaseRecordData } from "../../types/case";

// Lazy load heavy components
const Dashboard = lazy(() => import("../Dashboard"));
const CaseList = lazy(() => import("../CaseList"));
const CaseDetails = lazy(() => import("../CaseDetails"));
const CaseForm = lazy(() => import("../CaseForm"));
const Settings = lazy(() => import("../Settings"));

export type View = 'dashboard' | 'list' | 'details' | 'form' | 'settings';

interface ViewRendererProps {
  // View state
  currentView: View;
  selectedCase: CaseDisplay | null | undefined;
  editingCase: CaseDisplay | null;
  
  // Data props
  cases: CaseDisplay[];
  loadCases: () => Promise<CaseDisplay[]>;
  
  // Navigation handlers
  handleViewCase: (caseId: string) => void;
  handleEditCase: (caseId: string) => void;
  handleNewCase: () => void;
  handleBackToList: () => void;
  handleSaveCase: (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => Promise<void>;
  handleCancelForm: () => void;
  
  // Component handlers
  handleDeleteCase: (caseId: string) => Promise<void>;
  handleDataPurged: () => void;
  handleAddItem: (category: any) => void;
  handleEditItem: (category: any, itemId: string) => void;
  handleDeleteItem: (category: any, itemId: string) => Promise<void>;
  handleUpdateItem?: (category: any, itemId: string, field: string, value: string) => Promise<void>;
  handleAddNote: (type?: string) => void;
  handleEditNote: (noteId: string) => void;
  handleDeleteNote: (noteId: string) => Promise<void>;
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
  currentView,
  selectedCase,
  editingCase,
  cases,
  loadCases,
  handleViewCase,
  handleEditCase,
  handleNewCase,
  handleBackToList,
  handleSaveCase,
  handleCancelForm,
  handleDeleteCase,
  handleDataPurged,
  handleAddItem,
  handleEditItem,
  handleDeleteItem,
  handleUpdateItem,
  handleAddNote,
  handleEditNote,
  handleDeleteNote
}: ViewRendererProps) {
  
  switch (currentView) {
    case 'dashboard':
      return (
        <Suspense fallback={<div className="flex items-center justify-center p-8">Loading dashboard...</div>}>
          <Dashboard
            cases={cases}
            onViewAllCases={handleBackToList}
            onNewCase={handleNewCase}
          />
        </Suspense>
      );

    case 'list':
      return (
        <Suspense fallback={<div className="flex items-center justify-center p-8">Loading cases...</div>}>
          <CaseList
            cases={cases}
            onViewCase={handleViewCase}
            onEditCase={handleEditCase}
            onDeleteCase={handleDeleteCase}
            onNewCase={handleNewCase}
            onRefresh={loadCases}
          />
        </Suspense>
      );

    case 'settings':
      return (
        <Suspense fallback={<div className="flex items-center justify-center p-8">Loading settings...</div>}>
          <Settings
            cases={cases}
            onDataPurged={handleDataPurged}
          />
        </Suspense>
      );

    case 'details':
      return selectedCase ? (
        <Suspense fallback={<div className="flex items-center justify-center p-8">Loading case details...</div>}>
          <CaseDetails
            case={selectedCase}
            onBack={handleBackToList}
            onEdit={() => handleEditCase(selectedCase.id)}
            onDelete={() => handleDeleteCase(selectedCase.id)}
            onAddItem={handleAddItem}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
            onUpdateItem={handleUpdateItem}
            onAddNote={handleAddNote}
            onEditNote={handleEditNote}
            onDeleteNote={handleDeleteNote}
          />
        </Suspense>
      ) : null;

    case 'form':
      return (
        <Suspense fallback={<div className="flex items-center justify-center p-8">Loading form...</div>}>
          <CaseForm
            case={editingCase || undefined}
            onSave={handleSaveCase}
            onCancel={handleCancelForm}
          />
        </Suspense>
      );

    default:
      return null;
  }
}