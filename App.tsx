import { useEffect, useCallback, memo, lazy, Suspense } from "react";
import { MainLayout } from "./components/MainLayout";
import { Toaster } from "./components/ui/sonner";
import { CaseDisplay, CaseCategory, FinancialItem } from "./types/case";
import { toast } from "sonner";
import { useFileStorage } from "./contexts/FileStorageContext";
import { useDataManagerSafe } from "./contexts/DataManagerContext";
import { useCaseManagement, useConnectionFlow, useFinancialItemFlow, useNavigationFlow, useNoteFlow } from "./hooks";
import { AppProviders } from "./components/providers/AppProviders";
import { FileStorageIntegrator } from "./components/providers/FileStorageIntegrator";
import { ViewRenderer } from "./components/routing/ViewRenderer";
import { clearFileStorageFlags, updateFileStorageFlags } from "./utils/fileStorageFlags";

// Simplified lazy loading for modals only - more conservative approach
const FinancialItemModal = lazy(() => import("./components/FinancialItemModal"));
const NoteModal = lazy(() => import("./components/NoteModal"));
const ConnectToExistingModal = lazy(() => import("./components/ConnectToExistingModal"));

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
  
  const {
    currentView,
    selectedCase,
    editingCase,
    sidebarOpen,
    breadcrumbTitle,
  navigate: handleNavigate,
    viewCase: handleViewCase,
    editCase: handleEditCase,
    newCase: handleNewCase,
    saveCaseWithNavigation: handleSaveCase,
    cancelForm: handleCancelForm,
    deleteCaseWithNavigation: handleDeleteCase,
    backToList: handleBackToList,
    setSidebarOpen,
  } = useNavigationFlow({
    cases,
    saveCase,
    deleteCase,
  });

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
      updateFileStorageFlags({ dataBaseline: true });
      
      if (casesToSet.length > 0) {
        updateFileStorageFlags({ sessionHadData: true });
      }
    } catch (err) {
      console.error('Failed to handle file data loaded:', err);
      toast.error('Failed to load data');
    }
  }, [setCases, setHasLoadedData, loadCases]);

  // Expose the function globally so App component can use it
  useEffect(() => {
    window.handleFileDataLoaded = handleFileDataLoaded;
    return () => {
      delete window.handleFileDataLoaded;
    };
  }, [handleFileDataLoaded]);
  
  // Always use file storage - no more API switching
  // Remove old getDataAPI function - replaced by DataManager-only pattern
  
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

  const {
    noteForm,
    handleAddNote,
    handleEditNote,
    handleDeleteNote,
    handleSaveNote,
    handleCancelNoteForm,
    handleBatchUpdateNote,
    handleBatchCreateNote,
  } = useNoteFlow({
    selectedCase: selectedCase ?? null,
    cases,
    setCases,
    setError,
  });

  // Note: loadCases is now provided by useCaseManagement hook

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

  const handleDataPurged = async () => {
    try {
      setError(null);
      // Clear local state only - do not reload data after purge
      setCases([]);
    setHasLoadedData(false);

    // Clear baseline flags - we're starting fresh
    clearFileStorageFlags('dataBaseline', 'sessionHadData');
      
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
  breadcrumbTitle={breadcrumbTitle}
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