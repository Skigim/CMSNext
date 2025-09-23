import { CaseDisplay, NewPersonData, NewCaseRecordData } from "../../types/case";

// Direct imports for high-turnover components - no lazy loading for snappiness
import Dashboard from "../Dashboard";
import CaseList from "../CaseList";
import CaseDetails from "../CaseDetails";
import CaseForm from "../CaseForm";
import Settings from "../Settings";

export type View = 'dashboard' | 'list' | 'details' | 'form' | 'settings';

interface ViewRendererProps {
  // View state
  currentView: View;
  selectedCase: CaseDisplay | null | undefined;
  editingCase: CaseDisplay | null;
  
  // Data props
  cases: CaseDisplay[];
  
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
  handleDeleteItem: (category: any, itemId: string) => Promise<void>;
  handleBatchUpdateItem?: (category: any, itemId: string, updatedItem: Partial<any>) => Promise<void>;
  handleCreateItem?: (category: any, itemData: Omit<any, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  handleAddNote: (type?: string) => void;
  handleEditNote: (noteId: string) => void;
  handleDeleteNote: (noteId: string) => Promise<void>;
  handleBatchUpdateNote?: (noteId: string, updatedNote: any) => Promise<void>;
  handleBatchCreateNote?: (noteData: any) => Promise<void>;
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
  
  // Navigation handlers
  handleViewCase,
  handleEditCase,
  handleNewCase,
  handleBackToList,
  handleSaveCase,
  handleCancelForm,
  
  // Component handlers
  handleDeleteCase,
  handleDataPurged,
  handleAddItem,
  handleDeleteItem,
  handleBatchUpdateItem,
  handleCreateItem,
  handleAddNote,
  handleEditNote,
  handleDeleteNote,
  handleBatchUpdateNote,
  handleBatchCreateNote
}: ViewRendererProps) {
  
  switch (currentView) {
    case 'dashboard':
      return (
        <Dashboard
          cases={cases}
          onViewAllCases={handleBackToList}
          onNewCase={handleNewCase}
        />
      );

    case 'list':
      return (
        <CaseList
          cases={cases}
          onViewCase={handleViewCase}
          onEditCase={handleEditCase}
          onDeleteCase={handleDeleteCase}
          onNewCase={handleNewCase}
        />
      );

    case 'settings':
      return (
        <Settings
          cases={cases}
          onDataPurged={handleDataPurged}
        />
      );

    case 'details':
      return selectedCase ? (
        <CaseDetails
          case={selectedCase}
          onBack={handleBackToList}
          onEdit={() => handleEditCase(selectedCase.id)}
          onDelete={() => handleDeleteCase(selectedCase.id)}
          onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem}
          onBatchUpdateItem={handleBatchUpdateItem}
          onCreateItem={handleCreateItem}
          onAddNote={handleAddNote}
          onEditNote={handleEditNote}
          onDeleteNote={handleDeleteNote}
          onBatchUpdateNote={handleBatchUpdateNote}
          onBatchCreateNote={handleBatchCreateNote}
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