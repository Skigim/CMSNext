import { useState, useEffect, useCallback, useMemo, memo, lazy, Suspense } from "react";
import { MainLayout } from "./components/MainLayout";
import { Toaster } from "./components/ui/sonner";
import { CaseDisplay, CaseCategory, FinancialItem, NewPersonData, NewCaseRecordData, NewNoteData } from "./types/case";
import { toast } from "sonner";
import { useFileStorage } from "./contexts/FileStorageContext";
import { useDataManagerSafe } from "./contexts/DataManagerContext";
import { useCaseManagement } from "./hooks/useCaseManagement";
import { useNotes } from "./hooks/useNotes";
import { AppProviders } from "./components/providers/AppProviders";
import { FileStorageIntegrator } from "./components/providers/FileStorageIntegrator";
import { ViewRenderer } from "./components/routing/ViewRenderer";

// Lazy load modals only (main views are now in ViewRenderer)
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
  const { isSupported, isConnected, hasStoredHandle, status, connectToFolder, connectToExisting, loadExistingData, service } = useFileStorage();
  
  // Get DataManager instance at component level
  const dataManager = useDataManagerSafe();
  
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
  
  // Central file data handler that maintains file provider sync
  const handleFileDataLoaded = useCallback((fileData: any) => {
    try {
      console.log('🔧 handleFileDataLoaded called with:', fileData);
      
      // Data might be in cases format (transformed) or people+caseRecords format (raw)
      let casesToSet: any[] = [];
      
      if (fileData?.cases) {
        // Already transformed data (CaseDisplay format)
        casesToSet = fileData.cases;
        console.log(`✅ File data loaded with transformed cases: ${casesToSet.length} cases`);
      } else if (fileData?.people && fileData?.caseRecords) {
        // Raw data format - let DataManager handle the transformation by reloading
        console.log(`🔄 Raw file data detected: ${fileData.people.length} people, ${fileData.caseRecords.length} case records. Triggering DataManager reload...`);
        
        // Trigger a reload through DataManager to get proper transformed data
        setTimeout(() => {
          loadCases().catch(err => console.error('Failed to reload cases after file load:', err));
        }, 100);
        
        // Set flag that data has been loaded
        setHasLoadedData(true);
        return;
      } else if (fileData && Object.keys(fileData).length === 0) {
        // Empty data
        casesToSet = [];
        console.log('✅ Empty file data loaded and synced to UI');
      } else {
        console.warn('⚠️ Unexpected file data format:', fileData);
        casesToSet = [];
      }
      
      // Update React state with the processed data
      setCases(casesToSet);
      setHasLoadedData(true);
      
      // Set baseline - we've now loaded data through the file storage system
      (window as any).fileStorageDataBaseline = true;
      
      if (casesToSet.length > 0) {
        (window as any).fileStorageSessionHadData = true;
      }
    } catch (err) {
      console.error('Failed to handle file data loaded:', err);
      toast.error('Failed to load data');
    }
  }, [setCases, setHasLoadedData, loadCases]);

  // Expose the function globally so App component can use it
  useEffect(() => {
    (window as any).handleFileDataLoaded = handleFileDataLoaded;
    return () => {
      delete (window as any).handleFileDataLoaded;
    };
  }, [handleFileDataLoaded]);
  
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
      console.log('[App] handleConnectToExisting started');
      
      // Set flags to prevent any interference from automatic processing
      window.location.hash = '#connect-to-existing';
      (window as any).fileStorageInSetupPhase = true;
      (window as any).fileStorageInConnectionFlow = true;
      
      // Temporarily disable autosave during connect flow
      if (!dataManager) {
        console.error('[App] DataManager not available');
        toast.error('Data storage is not available. Please connect to a folder first.');
        return false;
      }
      
      setError(null);
      
      // Use stored directory handle with explicit user permission request
      const success = hasStoredHandle ? await connectToExisting() : await connectToFolder();
      console.log('[App] Connection attempt result:', success);
      if (!success) {
        toast.error("Failed to connect to directory");
        return false;
      }
      
      // Small delay to ensure directory connection is stable
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Load existing data directly - this will verify the connection works
      let existingData;
      try {
        console.log('[App] Loading existing data...');
        existingData = await loadExistingData();
        console.log('[App] Loaded existing data:', existingData ? `${existingData.cases?.length || 0} cases` : 'null');
      } catch (loadError) {
        console.error('[App] Failed to load existing data:', loadError);
        throw new Error(`Failed to access connected directory: ${loadError instanceof Error ? loadError.message : 'Unknown error'}`);
      }
      
      // Always initialize with the actual loaded data first
      const actualData = existingData || { 
        exported_at: new Date().toISOString(), 
        total_cases: 0, 
        cases: [] 
      };
      
      // CRITICAL: Load actual data from file system
      console.log(`[App] About to load data from file system. Expected from loadExistingData: ${actualData?.cases?.length || actualData?.caseRecords?.length || 0} cases`);
      
      // Load cases using DataManager which reads from file system
      console.log('[App] Calling loadCases()...');
      const loadedCases = await loadCases();
      console.log('[App] loadCases() completed');
      
      // Use the cases data returned from loadCases()
      console.log(`[App] Initial file data: ${actualData?.cases?.length || actualData?.caseRecords?.length || 0} records`);
      console.log(`[App] Cases loaded by DataManager: ${loadedCases.length} cases`);
      
      if (loadedCases.length > 0) {
        // We have actual data from the file
        console.log('[App] Setting cases and hasLoadedData=true for non-empty data');
        // Cases are already set by loadCases(), no need to set again
        setHasLoadedData(true);
        setShowConnectModal(false);
        
        // Set baseline - we now have established data
        (window as any).fileStorageDataBaseline = true;
        (window as any).fileStorageSessionHadData = true;
        
        toast.success(`Connected and loaded ${loadedCases.length} cases`, {
          id: 'connection-success',
          duration: 3000
        });
      } else {
        // No data in file - start fresh
        console.log('[App] Setting empty cases and hasLoadedData=true for empty data');
        setCases([]);
        setHasLoadedData(true);
        setShowConnectModal(false);
        
        // Set baseline - we've explicitly loaded empty data
        (window as any).fileStorageDataBaseline = true;
        
        toast.success("Connected successfully - ready to start fresh", {
          id: 'connection-empty',
          duration: 3000
        });
      }
      
      console.log('[App] handleConnectToExisting completed successfully');
      
      // Clear connection flow flags
      (window as any).fileStorageInConnectionFlow = false;
      (window as any).fileStorageInSetupPhase = false;
      
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
      // Clear setup phase flags
      (window as any).fileStorageInSetupPhase = false;
      (window as any).fileStorageInConnectionFlow = false;
      
      // Re-enable autosave if it was running before
      if (service && !service.getStatus().isRunning) {
        setTimeout(() => {
          service.startAutosave();
        }, 500);
      }
      
      // Always clear the flag and loading state (with small delay to ensure stability)
      setTimeout(() => {
        if (window.location.hash === '#connect-to-existing') {
          window.location.hash = '';
        }
      }, 300);
    }
  }, [hasStoredHandle, connectToExisting, connectToFolder, loadExistingData, dataManager, service]);

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
    console.log('[App] Connection status check:', {
      isSupported,
      isConnected,
      hasLoadedData,
      showConnectModal
    });
    
    const timeoutId = setTimeout(() => {
      // Check if File System Access API is not supported
      if (isSupported === false) {
        setError('File System Access API is not supported in this browser. Please use a modern browser like Chrome, Edge, or Opera.');
        return;
      }
      
      // Only proceed if we have a definitive support status
      if (isSupported === undefined) {
        console.log('[App] Still initializing file system support...');
        return; // Still initializing
      }
      
      // For file storage mode, check if setup is needed
      if (isSupported && !isConnected && !hasLoadedData) {
        console.log('[App] Showing connect modal: not connected and no data loaded');
        setShowConnectModal(true);
      } else if (isConnected && !hasLoadedData) {
        // Directory connected but no data loaded yet - show modal for user to load
        console.log('[App] Showing connect modal: connected but no data loaded');
        setShowConnectModal(true);
      } else if (isConnected && hasLoadedData) {
        // Everything is set up and ready
        console.log('[App] Hiding connect modal: connected and data loaded');
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

      <ViewRenderer
        currentView={currentView}
        selectedCase={selectedCase}
        editingCase={editingCase}
        cases={cases}
        loadCases={loadCases}
        handleViewCase={handleViewCase}
        handleEditCase={handleEditCase}
        handleNewCase={handleNewCase}
        handleBackToList={handleBackToList}
        handleSaveCase={handleSaveCase}
        handleCancelForm={handleCancelForm}
        handleDeleteCase={handleDeleteCase}
        handleDataPurged={handleDataPurged}
        handleAddItem={handleAddItem}
        handleEditItem={handleEditItem}
        handleDeleteItem={handleDeleteItem}
        handleAddNote={handleAddNote}
        handleEditNote={handleEditNote}
        handleDeleteNote={handleDeleteNote}
      />

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
  console.log('[App] Rendering main App component');
  
  return (
    <AppProviders>
      <FileStorageIntegrator>
        <AppContent />
        <Toaster />
      </FileStorageIntegrator>
    </AppProviders>
  );
}