import { lazy, Suspense } from "react";
import { CaseDisplay, NewPersonData, NewCaseRecordData } from "../../types/case";

// Enhanced lazy loading with cache-miss fallback handling
const createLazyComponent = (importFn: () => Promise<any>, componentName: string) => {
  return lazy(async () => {
    const maxRetries = 3;
    const retryDelays = [1000, 2000, 3000]; // Progressive delays
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[ViewRenderer] Loading ${componentName} (attempt ${attempt + 1}/${maxRetries})`);
        return await importFn();
      } catch (error) {
        console.warn(`[ViewRenderer] Failed to load ${componentName} (attempt ${attempt + 1}/${maxRetries})`, error);
        
        if (attempt < maxRetries - 1) {
          // Wait with progressive backoff before retry
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
          
          // Try to clear any module cache issues by creating a new import
          try {
            // Force module re-evaluation by clearing any cached references
            if (typeof window !== 'undefined' && (window as any).__webpack_require__) {
              // Webpack module cache clearing
              delete (window as any).__webpack_require__.cache[componentName];
            }
          } catch (cacheError) {
            // Ignore cache clearing errors
          }
        } else {
          // Final attempt failed, show graceful fallback
          console.error(`[ViewRenderer] All attempts failed for ${componentName}`, error);
          
          // Return a functional fallback component that doesn't disrupt workflow
          return {
            default: () => (
              <div className="flex flex-col items-center justify-center p-8 space-y-4 border-2 border-dashed border-yellow-300 bg-yellow-50 rounded-lg">
                <div className="text-lg font-medium text-yellow-800">
                  {componentName} Temporarily Unavailable
                </div>
                <div className="text-sm text-yellow-700 text-center max-w-md">
                  This component couldn't load due to a temporary network issue. 
                  Your data and current session are safe.
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      // Try to re-import the component
                      window.location.hash = Math.random().toString();
                      window.location.reload();
                    }}
                    className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                  >
                    Try Again
                  </button>
                  <button 
                    onClick={() => {
                      // Go back to previous view without losing data
                      window.history.back();
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                  >
                    Go Back
                  </button>
                </div>
                <div className="text-xs text-yellow-600 text-center">
                  This is usually temporary and resolves automatically in 1-2 minutes.
                </div>
              </div>
            )
          };
        }
      }
    }
    
    // This should never be reached, but TypeScript needs it
    throw new Error(`Failed to load ${componentName} after ${maxRetries} attempts`);
  });
};

// Lazy load heavy components with fallback handling
const Dashboard = createLazyComponent(() => import("../Dashboard"), "Dashboard");
const CaseList = createLazyComponent(() => import("../CaseList"), "CaseList");
const CaseDetails = createLazyComponent(() => import("../CaseDetails"), "CaseDetails");
const CaseForm = createLazyComponent(() => import("../CaseForm"), "CaseForm");
const Settings = createLazyComponent(() => import("../Settings"), "Settings");

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