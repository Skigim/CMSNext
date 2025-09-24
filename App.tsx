import { useState, useEffect, useCallback, useMemo, memo, lazy, Suspense } from "react";
import { MainLayout } from "./components/MainLayout";
import { Toaster } from "./components/ui/sonner";
import { CaseDisplay, CaseCategory, FinancialItem, NewPersonData, NewCaseRecordData, NewNoteData } from "./types/case";
import { toast } from "sonner";
import { useFileStorage } from "./contexts/FileStorageContext";
import { useDataManagerSafe } from "./contexts/DataManagerContext";
import { useCaseManagement, useNotes, useConnectionFlow, useFinancialItemFlow } from "./hooks";
import { AppProviders } from "./components/providers/AppProviders";
import { FileStorageIntegrator } from "./components/providers/FileStorageIntegrator";
import { ViewRenderer } from "./components/routing/ViewRenderer";

// Simplified lazy loading for modals only - more conservative approach
const FinancialItemModal = lazy(() => import("./components/FinancialItemModal"));
const NoteModal = lazy(() => import("./components/NoteModal"));
const ConnectToExistingModal = lazy(() => import("./components/ConnectToExistingModal"));

type View = 'dashboard' | 'list' | 'details' | 'form' | 'settings';
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
  const [formState, setFormState] = useState<FormState>({ previousView: 'list' });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  const {
    showConnectModal,
    handleChooseNewFolder,
    handleConnectToExisting,
    dismissConnectModal,
  } = useConnectionFlow({
    isSupported,
    isConnected,
    hasStoredHandle,
    hasLoadedData,
    connectToFolder,
    connectToExisting,
    loadExistingData,
    service,
    dataManager,
    loadCases,
    setCases,
    setError,
    setHasLoadedData,
  });
  
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

  const {
    itemForm,
    openItemForm,
    closeItemForm,
    handleDeleteItem: deleteFinancialItem,
    handleBatchUpdateItem: batchUpdateFinancialItem,
    handleCreateItem: createFinancialItem,
  } = useFinancialItemFlow({
    selectedCase: selectedCase ?? null,
    setCases,
    setError,
  });

  // Note: loadCases is now provided by useCaseManagement hook

  const handleViewCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    setCurrentView('details');
    // Auto-collapse sidebar for better case detail view experience
    setSidebarOpen(false);
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
      // Auto-collapse sidebar for better form experience
      setSidebarOpen(false);
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
    // Auto-collapse sidebar for better form experience
    setSidebarOpen(false);
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

  const handleAddItem = useCallback(
    (category: CaseCategory) => {
      openItemForm(category);
    },
    [openItemForm],
  );

  const handleDeleteItem = useCallback(
    (category: CaseCategory, itemId: string) => deleteFinancialItem(category, itemId),
    [deleteFinancialItem],
  );

  const handleBatchUpdateItem = useCallback(
    (category: CaseCategory, itemId: string, updatedItem: Partial<FinancialItem>) =>
      batchUpdateFinancialItem(category, itemId, updatedItem),
    [batchUpdateFinancialItem],
  );

  const handleCreateItem = useCallback(
    (category: CaseCategory, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>) =>
      createFinancialItem(category, itemData),
    [createFinancialItem],
  );

  const handleCancelItemForm = useCallback(() => {
    closeItemForm();
  }, [closeItemForm]);

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

  const handleBatchUpdateNote = async (noteId: string, updatedNote: NewNoteData) => {
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
      
      // Single update operation for note
      const updatedCase = await dataManager.updateNote(selectedCase.id, noteId, updatedNote);
      setCases(prevCases =>
        prevCases.map(c =>
          c.id === selectedCase.id ? updatedCase : c
        )
      );
      
      // Success message for the batch update
      toast.success('Note updated successfully', { duration: 2000 });
      
    } catch (err) {
      console.error('Failed to update note:', err);
      
      // Provide specific error messaging based on error type
      let errorMsg = 'Failed to update note. Please try again.';
      if (err instanceof Error) {
        if (err.message.includes('File was modified by another process')) {
          errorMsg = 'File was modified by another process. Your changes were not saved. Please refresh and try again.';
        } else if (err.message.includes('Permission denied')) {
          errorMsg = 'Permission denied. Please check that you have write access to the data folder.';
        } else if (err.message.includes('state cached in an interface object') || 
                   err.message.includes('state had changed')) {
          errorMsg = 'Data sync issue detected. Please refresh the page and try again.';
        }
      }
      
      setError(errorMsg);
      toast.error(errorMsg, { duration: 5000 });
      throw err; // Re-throw to let the component handle fallback
    }
  };

  const handleBatchCreateNote = async (noteData: NewNoteData) => {
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
      
      // Single create operation for note
      const updatedCase = await dataManager.addNote(selectedCase.id, noteData);
      setCases(prevCases =>
        prevCases.map(c =>
          c.id === selectedCase.id ? updatedCase : c
        )
      );
      
      // Success message for the creation
      toast.success('Note added successfully', { duration: 2000 });
      
    } catch (err) {
      console.error('Failed to create note:', err);
      
      // Provide specific error messaging based on error type
      let errorMsg = 'Failed to create note. Please try again.';
      if (err instanceof Error) {
        if (err.message.includes('File was modified by another process')) {
          errorMsg = 'File was modified by another process. Your note was not saved. Please refresh and try again.';
        } else if (err.message.includes('Permission denied')) {
          errorMsg = 'Permission denied. Please check that you have write access to the data folder.';
        } else if (err.message.includes('state cached in an interface object') || 
                   err.message.includes('state had changed')) {
          errorMsg = 'Data sync issue detected. Please refresh the page and try again.';
        }
      }
      
      setError(errorMsg);
      toast.error(errorMsg, { duration: 5000 });
      throw err; // Re-throw to let the component handle fallback
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
  }, [loadCases, setError]);

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedCaseId(null);
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedCaseId(null);
  };

  const handleNavigate = (view: string) => {
    // Auto-collapse sidebar for case details view
    if (view === 'details' || view === 'form') {
      setSidebarOpen(false);
    } else {
      // Auto-expand sidebar for other views if it was collapsed for details
      setSidebarOpen(true);
    }

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
  // Removed modal visibility effect since useConnectionFlow hook manages it

  // Show connect to existing modal if needed
  if (showConnectModal) {
    return (
      <>
        <MainLayout
          currentView={currentView}
          onNavigate={handleNavigate}
          onNewCase={handleNewCase}
          breadcrumbTitle="Setup Required"
          sidebarOpen={sidebarOpen}
          onSidebarOpenChange={setSidebarOpen}
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
            onChooseNewFolder={handleChooseNewFolder}
            onGoToSettings={() => {
              dismissConnectModal();
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
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
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
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
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
        handleViewCase={handleViewCase}
        handleEditCase={handleEditCase}
        handleNewCase={handleNewCase}
        handleBackToList={handleBackToList}
        handleSaveCase={handleSaveCase}
        handleCancelForm={handleCancelForm}
        handleDeleteCase={handleDeleteCase}
        handleDataPurged={handleDataPurged}
        handleAddItem={handleAddItem}
        handleDeleteItem={handleDeleteItem}
        handleBatchUpdateItem={handleBatchUpdateItem}
        handleCreateItem={handleCreateItem}
        handleAddNote={handleAddNote}
        handleEditNote={handleEditNote}
        handleDeleteNote={handleDeleteNote}
        handleBatchUpdateNote={handleBatchUpdateNote}
        handleBatchCreateNote={handleBatchCreateNote}
      />

      {itemForm.isOpen && itemForm.category && selectedCase && (
        <Suspense fallback={<div>Loading...</div>}>
          <FinancialItemModal
            isOpen={itemForm.isOpen}
            onClose={handleCancelItemForm}
            caseData={selectedCase}
            onUpdateCase={(updatedCase: CaseDisplay) => {
              setCases(prevCases =>
                prevCases.map(c =>
                  c.id === updatedCase.id ? updatedCase : c
                )
              );
              closeItemForm();
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