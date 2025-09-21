import { useState, useEffect, useCallback, useMemo, memo, lazy, Suspense } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { FileStorageProvider, useFileStorage } from "./contexts/FileStorageContext";
import { MainLayout } from "./components/MainLayout";
import { Toaster } from "./components/ui/sonner";
import { CaseDisplay, CaseCategory, FinancialItem, NewPersonData, NewCaseRecordData, NewNoteData } from "./types/case";
import { fileDataProvider } from "./utils/fileDataProvider";
import { toast } from "sonner";
import ErrorBoundary from "./components/ErrorBoundary";
import FileSystemErrorBoundary from "./components/FileSystemErrorBoundary";
import { ErrorRecoveryProvider } from "./components/ErrorRecovery";
import { DataManagerProvider, useDataManagerSafe } from "./contexts/DataManagerContext";
import { useCaseManagement } from "./hooks/useCaseManagement";
import { useNotes } from "./hooks/useNotes";

// Lazy load heavy components
const Dashboard = lazy(() => import("./components/Dashboard").then(m => ({ default: m.Dashboard })));
const CaseList = lazy(() => import("./components/CaseList").then(m => ({ default: m.CaseList })));
const CaseDetails = lazy(() => import("./components/CaseDetails"));
const CaseForm = lazy(() => import("./components/CaseForm"));
const Settings = lazy(() => import("./components/Settings").then(m => ({ default: m.Settings })));
const FinancialItemModal = lazy(() => import("./components/FinancialItemModal").then(m => ({ default: m.FinancialItemModal })));
const NoteModal = lazy(() => import("./components/NoteModal").then(m => ({ default: m.NoteModal })));
const ConnectToExistingModal = lazy(() => import("./components/ConnectToExistingModal").then(m => ({ default: m.ConnectToExistingModal })));

type View = 'dashboard' | 'list' | 'details' | 'form' | 'settings';
type ItemFormState = {
  isOpen: boolean;
  category?: CaseCategory;
  item?: FinancialItem;
  caseId?: string;
};
type FormState = {
  previousView: View;
  returnToCaseId?: string;
};
// NoteFormState moved to useNotes hook

const AppContent = memo(function AppContent() {
  const { isSupported, isConnected, hasStoredHandle, status, connectToFolder, connectToExisting, loadExistingData } = useFileStorage();
  
  // Use the secure case management hook
  const {
    cases,
    loading,
    error,
    hasLoadedData,
    loadCases,
    saveCase,
    deleteCase,
    setCases,
    setError,
    setHasLoadedData,
  } = useCaseManagement();
  
  // Use the secure notes management hook
  const {
    noteForm,
    openAddNote,
    openEditNote,
    saveNote: saveNoteHook,
    deleteNote: deleteNoteHook,
    closeNoteForm,
  } = useNotes();
  
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<CaseDisplay | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>({ isOpen: false });
  const [formState, setFormState] = useState<FormState>({ previousView: 'list' });
  const [showConnectModal, setShowConnectModal] = useState(false);
  
  // Always use file storage - no more API switching
  // Remove old getDataAPI function - replaced by DataManager-only pattern
  
  // Memoize selectedCase to prevent unnecessary recalculations
  const selectedCase = useMemo(() => 
    cases.find(c => c.id === selectedCaseId), 
    [cases, selectedCaseId]
  );

  // Note: loadCases is now provided by useCaseManagement hook

  const handleConnectToExisting = useCallback(async (): Promise<boolean> => {
    try {
      // Set flags to prevent any interference from automatic processing
      window.location.hash = '#connect-to-existing';
      (window as any).fileStorageInSetupPhase = true;
      
      // Temporarily disable autosave during connect flow
      const fileService = fileDataProvider.getFileService();
      const wasAutosaveRunning = fileService?.getStatus().isRunning;
      if (fileService && wasAutosaveRunning) {
        fileService.stopAutosave();
      }
      
      setError(null);
      
      // Use stored directory handle with explicit user permission request
      const success = hasStoredHandle ? await connectToExisting() : await connectToFolder();
      if (!success) {
        toast.error("Failed to connect to directory");
        return false;
      }
      
      // Small delay to ensure directory connection is stable
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Load existing data directly - this will verify the connection works
      let existingData;
      try {
        existingData = await loadExistingData();
      } catch (loadError) {
        throw new Error(`Failed to access connected directory: ${loadError instanceof Error ? loadError.message : 'Unknown error'}`);
      }
      
      // Always initialize with the actual loaded data first
      const actualData = existingData || { 
        exported_at: new Date().toISOString(), 
        total_cases: 0, 
        cases: [] 
      };
      
      // CRITICAL: Clear any stale data first, then load actual data
      console.log(`[App] About to clear and load data. Loaded from file: ${actualData.cases.length} cases`);
      fileDataProvider.clearInternalData(); // Force clear first
      fileDataProvider.handleFileDataLoaded(actualData);
      
      // Verify the data was actually loaded into the provider
      const verifyAPI = fileDataProvider.getAPI();
      if (!verifyAPI || !verifyAPI.internalData) {
        throw new Error('Data provider update failed');
      }
      
      // Make sure internal data matches what we just loaded
      console.log(`[App] File data loaded: ${actualData.cases.length} cases`);
      console.log(`[App] Provider internal data: ${verifyAPI.internalData.cases?.length || 0} cases`);
      
      if (actualData.cases.length > 0) {
        // We have actual data from the file
        setCases(actualData.cases);
        setHasLoadedData(true);
        setShowConnectModal(false);
        
        // Set baseline - we now have established data
        (window as any).fileStorageDataBaseline = true;
        (window as any).fileStorageSessionHadData = true;
        
        toast.success(`Connected and loaded ${actualData.cases.length} cases`);
      } else {
        // No data in file - start fresh
        setCases([]);
        setHasLoadedData(true);
        setShowConnectModal(false);
        
        // Set baseline - we've explicitly loaded empty data
        (window as any).fileStorageDataBaseline = true;
        
        toast.success("Connected successfully - ready to start fresh");
      }
      
      return true;
    } catch (error) {
      console.error('Failed to connect and load data:', error);
      
      let errorMsg = 'Failed to connect and load existing data. Please try again.';
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('User activation')) {
          errorMsg = 'Directory selection was cancelled. Please try again.';
        } else if (error.message.includes('permission')) {
          errorMsg = 'Permission denied for the selected directory. Please choose a different folder.';
        } else if (error.message.includes('connection')) {
          errorMsg = 'Lost connection to directory. Please reconnect and try again.';
        } else if (error.message.includes('AbortError')) {
          errorMsg = 'Directory selection was cancelled.';
          // Don't show error toast for cancellation
          return false;
        }
      }
      
      setError(errorMsg);
      toast.error(errorMsg);
      return false;
    } finally {
      // Clear setup phase flag
      (window as any).fileStorageInSetupPhase = false;
      
      // Re-enable autosave if it was running before
      const fileService = fileDataProvider.getFileService();
      if (fileService && !fileService.getStatus().isRunning) {
        setTimeout(() => {
          fileService.startAutosave();
        }, 500);
      }
      
      // Always clear the flag and loading state (with small delay to ensure stability)
      setTimeout(() => {
        if (window.location.hash === '#connect-to-existing') {
          window.location.hash = '';
        }
      }, 300);
    }
  }, [hasStoredHandle, connectToExisting, connectToFolder, loadExistingData]);

  const handleViewCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    setCurrentView('details');
  }, []);

  const handleEditCase = useCallback((caseId: string) => {
    const caseToEdit = cases.find(c => c.id === caseId);
    if (caseToEdit) {
      setEditingCase(caseToEdit);
      // Track where we came from so we can return there on cancel
      setFormState({
        previousView: currentView,
        returnToCaseId: currentView === 'details' ? caseId : undefined
      });
      setCurrentView('form');
    }
  }, [cases, currentView]);

  const handleNewCase = useCallback(() => {
    setEditingCase(null);
    // Track where we came from for new case creation
    setFormState({
      previousView: currentView,
      returnToCaseId: undefined
    });
    setCurrentView('form');
  }, [currentView]);

  const handleSaveCase = useCallback(async (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => {
    try {
      await saveCase(caseData, editingCase);
      
      // Navigation logic after successful save
      const isEditing = !!editingCase;
      if (isEditing) {
        // Return to the previous view after saving
        if (formState.previousView === 'details' && formState.returnToCaseId) {
          setSelectedCaseId(formState.returnToCaseId);
          setCurrentView('details');
        } else {
          setCurrentView(formState.previousView);
        }
      } else {
        // Create new case - always go to list after creating
        setCurrentView('list');
      }
      
      setEditingCase(null);
      setFormState({ previousView: 'list' });
    } catch (err) {
      // Error handling is done in the hook
      console.error('Failed to save case in handleSaveCase wrapper:', err);
    }
  }, [saveCase, editingCase, formState, setSelectedCaseId, setCurrentView, setEditingCase, setFormState]);

  const handleCancelForm = useCallback(() => {
    // Return to the previous view when cancelling the form
    // If we came from case details, restore the selected case and return to details
    if (formState.previousView === 'details' && formState.returnToCaseId) {
      setSelectedCaseId(formState.returnToCaseId);
      setCurrentView('details');
    } else {
      // Otherwise return to whatever view we came from (dashboard, list, etc.)
      setCurrentView(formState.previousView);
    }
    setEditingCase(null);
    setFormState({ previousView: 'list' });
  }, [formState]);

  const handleAddItem = (category: CaseCategory) => {
    setItemForm({
      isOpen: true,
      category,
      caseId: selectedCaseId || undefined
    });
  };

  const handleEditItem = (category: CaseCategory, itemId: string) => {
    if (!selectedCase) return;
    
    const item = selectedCase.caseRecord.financials[category].find(item => item.id === itemId);
    if (item) {
      setItemForm({
        isOpen: true,
        category,
        item,
        caseId: selectedCase.id
      });
    }
  };

  const handleDeleteItem = async (category: CaseCategory, itemId: string) => {
    const dataManager = useDataManagerSafe();
    if (!selectedCase || !dataManager) {
      if (!dataManager) {
        const errorMsg = 'Data storage is not available. Please check your connection.';
        setError(errorMsg);
        toast.error(errorMsg);
      }
      return;
    }
    
    try {
      setError(null);
      const updatedCase = await dataManager.deleteItem(selectedCase.id, category, itemId);
      setCases(prevCases =>
        prevCases.map(c =>
          c.id === selectedCase.id ? updatedCase : c
        )
      );
      
      toast.success(`${category.charAt(0).toUpperCase() + category.slice(1)} item deleted successfully`);
      
      // DataManager handles file system persistence automatically
    } catch (err) {
      console.error('Failed to delete item:', err);
      const errorMsg = 'Failed to delete item. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleCancelItemForm = () => {
    setItemForm({ isOpen: false });
  };

  const handleAddNote = () => {
    if (!selectedCase) return;
    openAddNote(selectedCase.id);
  };

  const handleEditNote = (noteId: string) => {
    if (!selectedCase) return;
    openEditNote(selectedCase.id, noteId, cases);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedCase) return;
    
    try {
      const updatedCase = await deleteNoteHook(selectedCase.id, noteId);
      if (updatedCase) {
        setCases(prevCases =>
          prevCases.map(c =>
            c.id === selectedCase.id ? updatedCase : c
          )
        );
      }
    } catch (err) {
      // Error handling is done in the hook
      console.error('Failed to delete note in handleDeleteNote wrapper:', err);
    }
  };

  const handleDeleteCase = useCallback(async (caseId: string) => {
    try {
      await deleteCase(caseId);
      
      // If we're currently viewing this case, redirect to list
      if (selectedCaseId === caseId) {
        setCurrentView('list');
        setSelectedCaseId(null);
      }
    } catch (err) {
      // Error handling is done in the hook
      console.error('Failed to delete case in handleDeleteCase wrapper:', err);
    }
  }, [deleteCase, selectedCaseId, setCurrentView, setSelectedCaseId]);

  const handleSaveNote = useCallback(async (noteData: NewNoteData) => {
    try {
      const updatedCase = await saveNoteHook(noteData);
      if (updatedCase) {
        setCases(prevCases =>
          prevCases.map(c =>
            c.id === updatedCase.id ? updatedCase : c
          )
        );
      }
    } catch (err) {
      // Error handling is done in the hook
      console.error('Failed to save note in handleSaveNote wrapper:', err);
    }
  }, [saveNoteHook, setCases]);

  const handleCancelNoteForm = () => {
    closeNoteForm();
  };

  const handleImportCases = async (importedCases: CaseDisplay[]) => {
    try {
      setError(null);
      // Add imported cases to the current list
      setCases(prevCases => [...prevCases, ...importedCases]);
      setHasLoadedData(true);
      
      // Set baseline - we now have data
      (window as any).fileStorageDataBaseline = true;
      (window as any).fileStorageSessionHadData = true;
      
      toast.success(`Successfully imported ${importedCases.length} cases`);
      
      // DataManager handles file system persistence automatically
    } catch (err) {
      console.error('Failed to handle imported cases:', err);
      const errorMsg = 'Failed to process imported cases. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleDataPurged = async () => {
    try {
      setError(null);
      // Clear local state only - do not reload data after purge
      setCases([]);
      setHasLoadedData(false);
      
      // Clear baseline flags - we're starting fresh
      delete (window as any).fileStorageDataBaseline;
      delete (window as any).fileStorageSessionHadData;
      
      toast.success("All data has been purged successfully");
    } catch (err) {
      console.error('Failed to handle data purge:', err);
      const errorMsg = 'Failed to complete data purge. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  // Listen for file import events
  useEffect(() => {
    const handleFileImported = () => {
      // Skip if we're in direct data loading mode
      if (window.location.hash === '#connect-to-existing') {
        return;
      }
      
      loadCases();
      setError(null);
    };

    const handleFileImportError = (event: CustomEvent) => {
      setError(event.detail);
      toast.error(event.detail);
    };

    window.addEventListener('fileDataImported', handleFileImported);
    window.addEventListener('fileImportError', handleFileImportError as EventListener);

    return () => {
      window.removeEventListener('fileDataImported', handleFileImported);
      window.removeEventListener('fileImportError', handleFileImportError as EventListener);
    };
  }, [loadCases]);

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedCaseId(null);
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedCaseId(null);
  };

  const handleNavigate = (view: string) => {
    switch (view) {
      case 'dashboard':
        handleBackToDashboard();
        break;
      case 'list':
      case 'cases':
        handleBackToList();
        break;
      case 'form':
        handleNewCase();
        break;
      case 'settings':
        setCurrentView('settings');
        setSelectedCaseId(null);
        break;
      default:
        handleBackToDashboard();
    }
  };

  const getBreadcrumbTitle = useMemo(() => {
    if (currentView === 'details' && selectedCase) {
      return `${selectedCase.person.firstName} ${selectedCase.person.lastName}`;
    }
    return undefined;
  }, [currentView, selectedCase]);



  // Monitor file storage connection status
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Check if File System Access API is not supported
      if (isSupported === false) {
        setError('File System Access API is not supported in this browser. Please use a modern browser like Chrome, Edge, or Opera.');
        return;
      }
      
      // Only proceed if we have a definitive support status
      if (isSupported === undefined) {
        return; // Still initializing
      }
      
      // For file storage mode, check if setup is needed
      if (isSupported && !isConnected && !hasLoadedData) {
        setShowConnectModal(true);
      } else if (isConnected && !hasLoadedData) {
        // Directory connected but no data loaded yet - show modal for user to load
        setShowConnectModal(true);
      } else if (isConnected && hasLoadedData) {
        // Everything is set up and ready
        setShowConnectModal(false);
      }
    }, 100); // Small delay to prevent excessive re-renders

    return () => clearTimeout(timeoutId);
  }, [isSupported, isConnected, hasLoadedData]);

  // Show connect to existing modal if needed
  if (showConnectModal) {
    return (
      <>
        <MainLayout
          currentView={currentView}
          onNavigate={handleNavigate}
          onNewCase={handleNewCase}
          breadcrumbTitle="Setup Required"
        >
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <p className="text-muted-foreground">Setting up data storage...</p>
            </div>
          </div>
        </MainLayout>
        
        <Suspense fallback={<div>Loading...</div>}>
          <ConnectToExistingModal
            isOpen={showConnectModal}
            isSupported={isSupported ?? false}
            onConnectToExisting={handleConnectToExisting}
            onGoToSettings={() => {
              setShowConnectModal(false);
              setHasLoadedData(true); // Mark as handled
              handleNavigate('settings');
            }}
            permissionStatus={status?.permissionStatus}
            hasStoredHandle={hasStoredHandle}
          />
        </Suspense>
      </>
    );
  }

  if (loading) {
    return (
      <MainLayout
        currentView={currentView}
        onNavigate={handleNavigate}
        onNewCase={handleNewCase}
        breadcrumbTitle="Loading..."
      >
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading cases...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      currentView={currentView}
      onNavigate={handleNavigate}
      onNewCase={handleNewCase}
      breadcrumbTitle={getBreadcrumbTitle}
    >
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md mb-4">
          <p>{error}</p>
          <button 
            onClick={() => setError(null)}
            className="text-destructive/80 hover:text-destructive underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {currentView === 'dashboard' && (
        <Suspense fallback={<div className="flex items-center justify-center p-8">Loading dashboard...</div>}>
          <Dashboard
            cases={cases}
            onViewAllCases={handleBackToList}
            onNewCase={handleNewCase}
          />
        </Suspense>
      )}

      {currentView === 'list' && (
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
      )}

      {currentView === 'settings' && (
        <Suspense fallback={<div className="flex items-center justify-center p-8">Loading settings...</div>}>
          <Settings
            cases={cases}
            onImportCases={handleImportCases}
            onDataPurged={handleDataPurged}
          />
        </Suspense>
      )}

      {currentView === 'details' && selectedCase && (
        <Suspense fallback={<div className="flex items-center justify-center p-8">Loading case details...</div>}>
          <CaseDetails
            case={selectedCase}
            onBack={handleBackToList}
            onEdit={() => handleEditCase(selectedCase.id)}
            onDelete={() => handleDeleteCase(selectedCase.id)}
            onAddItem={handleAddItem}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
            onAddNote={handleAddNote}
            onEditNote={handleEditNote}
            onDeleteNote={handleDeleteNote}
          />
        </Suspense>
      )}

      {currentView === 'form' && (
        <Suspense fallback={<div className="flex items-center justify-center p-8">Loading form...</div>}>
          <CaseForm
            case={editingCase || undefined}
            onSave={handleSaveCase}
            onCancel={handleCancelForm}
          />
        </Suspense>
      )}

      {itemForm.isOpen && itemForm.category && selectedCase && (
        <Suspense fallback={<div>Loading...</div>}>
          <FinancialItemModal
            isOpen={itemForm.isOpen}
            onClose={handleCancelItemForm}
            caseData={selectedCase}
            onUpdateCase={(updatedCase) => {
              setCases(prevCases =>
                prevCases.map(c =>
                  c.id === updatedCase.id ? updatedCase : c
                )
              );
              setItemForm({ isOpen: false });
            }}
            itemType={itemForm.category}
            editingItem={itemForm.item}
          />
        </Suspense>
      )}

      {noteForm.isOpen && (
        <Suspense fallback={<div>Loading...</div>}>
          <NoteModal
            isOpen={noteForm.isOpen}
            onClose={handleCancelNoteForm}
            onSave={handleSaveNote}
            editingNote={noteForm.editingNote}
          />
        </Suspense>
      )}
    </MainLayout>
  );
});

export default function App() {
  // Central file data handler that maintains file provider sync
  const handleFileDataLoaded = useCallback((fileData: any) => {
    try {
      console.log('🔧 handleFileDataLoaded called with:', fileData);
      
      // Always update the file data provider cache (this is safe and necessary)
      fileDataProvider.handleFileDataLoaded(fileData);
      
      // Note: React state is now managed by useCaseManagement hook
      console.log('✅ File data loaded and synced to provider');
      
      // Set baseline - we've now loaded data through the file storage system
      (window as any).fileStorageDataBaseline = true;
      
      if (fileData && fileData.cases && fileData.cases.length > 0) {
        (window as any).fileStorageSessionHadData = true;
      }
    } catch (err) {
      console.error('Failed to handle file data loaded:', err);
      toast.error('Failed to load data');
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <FileSystemErrorBoundary>
          <FileStorageProvider 
            enabled={true} // Always enabled - filesystem only
            getDataFunction={() => {
              // Skip during connect flow to prevent empty data from being saved
              if (window.location.hash === '#connect-to-existing') {
                return null;
              }
              
              // Don't save if we're still in loading/setup phase
              if ((window as any).fileStorageInSetupPhase) {
                return null;
              }
              
              const api = fileDataProvider.getAPI();
              if (!api || !api.internalData || !Array.isArray(api.internalData.cases)) {
                return null; // No valid data structure
              }
              
              const caseCount = api.internalData.cases.length;
              
              // Only return null for empty data if we haven't established a baseline yet
              if (caseCount === 0) {
                // If we've never had data in this session and haven't explicitly loaded empty data, don't save
                if (!(window as any).fileStorageDataBaseline) {
                    return null;
                  }
                }
            
            return {
              exported_at: new Date().toISOString(),
              total_cases: caseCount,
              cases: api.internalData.cases
            };
          }}
          onDataLoaded={handleFileDataLoaded}
        >
          <ErrorRecoveryProvider>
            <DataManagerProvider>
              <FileStorageIntegrator>
              <AppContent />
              <Toaster />
            </FileStorageIntegrator>
            </DataManagerProvider>
          </ErrorRecoveryProvider>
        </FileStorageProvider>
        </FileSystemErrorBoundary>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

// Component to integrate file storage service with data provider
function FileStorageIntegrator({ children }: { children: React.ReactNode }) {
  const { service } = useFileStorage();

  useEffect(() => {
    // Only set the service if we have one and it's different from current
    if (service) {
      fileDataProvider.setFileService(service);
    }
    
    // Clean up any leftover flags from previous sessions on startup
    if (!(window as any).fileStorageInitialized) {
      delete (window as any).fileStorageDataBaseline;
      delete (window as any).fileStorageSessionHadData;
      delete (window as any).fileStorageInSetupPhase;
      (window as any).fileStorageInitialized = true;
    }
  }, [service]);

  return <>{children}</>;
}