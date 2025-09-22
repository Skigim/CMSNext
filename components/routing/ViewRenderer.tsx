import { lazy, Suspense } from "react";
import { CaseDisplay, NewPersonData, NewCaseRecordData } from "../../types/case";

// Direct imports as fallbacks (will be bundled with main app)
import DashboardDirect from "../Dashboard";
import CaseListDirect from "../CaseList";
import CaseDetailsDirect from "../CaseDetails";
import CaseFormDirect from "../CaseForm";
import SettingsDirect from "../Settings";

// Enhanced lazy loading with direct import fallback and better error handling
const createLazyComponent = (importFn: () => Promise<any>, DirectComponent: any, componentName: string) => {
  return lazy(async () => {
    const maxRetries = 3;
    const retryDelays = [500, 1000, 2000]; // Faster initial retry
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[ViewRenderer] Loading ${componentName} (attempt ${attempt + 1}/${maxRetries})`);
        const module = await importFn();
        console.log(`[ViewRenderer] Successfully loaded ${componentName} via lazy import`);
        return module;
      } catch (error) {
        console.warn(`[ViewRenderer] Failed to load ${componentName} (attempt ${attempt + 1}/${maxRetries})`, error);
        
        if (attempt < maxRetries - 1) {
          // Wait with progressive backoff before retry
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
          
          // Clear any cached failed module attempts
          if (typeof window !== 'undefined' && (window as any).__webpack_require__?.cache) {
            delete (window as any).__webpack_require__.cache[importFn.toString()];
          }
        } else {
          // Final attempt failed, use direct import fallback
          console.warn(`[ViewRenderer] All lazy loading attempts failed for ${componentName}, using direct import fallback`);
          
          try {
            // Return the directly imported component
            console.log(`[ViewRenderer] Successfully loaded ${componentName} via direct import fallback`);
            return { default: DirectComponent };
          } catch (directError) {
            console.error(`[ViewRenderer] Direct import fallback also failed for ${componentName}`, directError);
            
            // Return a functional fallback component
            return {
              default: () => (
                <div className="flex flex-col items-center justify-center p-8 space-y-4 border-2 border-dashed border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 rounded-lg">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                    <span className="text-red-600 dark:text-red-400 text-xl">⚠</span>
                  </div>
                  <div className="text-lg font-medium text-red-800 dark:text-red-200">
                    {componentName} Failed to Load
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300 text-center max-w-md">
                    Both lazy loading and direct import failed. This indicates a serious module loading issue.
                    Please refresh the page to resolve this.
                  </div>
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                  >
                    Refresh Page
                  </button>
                  <div className="text-xs text-red-600 dark:text-red-400 text-center mt-2">
                    Your data is safe. This is a temporary loading issue.
                  </div>
                </div>
              )
            };
          }
        }
      }
    }
    
    // This should never be reached, but TypeScript needs it
    throw new Error(`Failed to load ${componentName} after ${maxRetries} attempts`);
  });
};

// Lazy load heavy components with direct import fallbacks
const Dashboard = createLazyComponent(() => import("../Dashboard"), DashboardDirect, "Dashboard");
const CaseList = createLazyComponent(() => import("../CaseList"), CaseListDirect, "CaseList");
const CaseDetails = createLazyComponent(() => import("../CaseDetails"), CaseDetailsDirect, "CaseDetails");
const CaseForm = createLazyComponent(() => import("../CaseForm"), CaseFormDirect, "CaseForm");
const Settings = createLazyComponent(() => import("../Settings"), SettingsDirect, "Settings");

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