import { useState, useEffect, useCallback, useMemo, memo, lazy, Suspense } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { FileStorageProvider, useFileStorage, useFileStorageDataChange } from "./contexts/FileStorageContext";
import { MainLayout } from "./components/MainLayout";
import { Toaster } from "./components/ui/sonner";
import { CaseDisplay, CaseCategory, FinancialItem, Note, NewPersonData, NewCaseRecordData, NewNoteData } from "./types/case";
import { fileDataProvider } from "./utils/fileDataProvider";
import { toast } from "sonner";

// Lazy load heavy components
const Dashboard = lazy(() => import("./components/Dashboard").then(m => ({ default: m.Dashboard })));
const CaseList = lazy(() => import("./components/CaseList").then(m => ({ default: m.CaseList })));
const CaseDetails = lazy(() => import("./components/CaseDetails").then(m => ({ default: m.CaseDetails })));
const CaseForm = lazy(() => import("./components/CaseForm").then(m => ({ default: m.CaseForm })));
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
type NoteFormState = {
  isOpen: boolean;
  editingNote?: Note;
  caseId?: string;
};

const AppContent = memo(function AppContent() {
  const { isSupported, isConnected, hasStoredHandle, status, connectToFolder, connectToExisting, loadExistingData } = useFileStorage();
  const notifyFileStorageChange = useFileStorageDataChange();
  const [cases, setCases] = useState<CaseDisplay[]>([]);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<CaseDisplay | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>({ isOpen: false });
  const [noteForm, setNoteForm] = useState<NoteFormState>({ isOpen: false });
  const [formState, setFormState] = useState<FormState>({ previousView: 'list' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  
  // Always use file storage - no more API switching
  const getDataAPI = () => fileDataProvider.getAPI();

  // Memoize selectedCase to prevent unnecessary recalculations
  const selectedCase = useMemo(() => 
    cases.find(c => c.id === selectedCaseId), 
    [cases, selectedCaseId]
  );

  // Helper to safely notify file storage changes (avoids conflicts during connect flow)
  const safeNotifyFileStorageChange = useCallback(() => {
    if (window.location.hash !== '#connect-to-existing') {
      notifyFileStorageChange();
    }
  }, [notifyFileStorageChange]);

  const loadCases = useCallback(async () => {
    const dataAPI = getDataAPI();
    if (!dataAPI) {
      const errorMsg = 'Data storage is not available. Please check your file system connection.';
      setError(errorMsg);
      toast.error(errorMsg);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await dataAPI.getAllCases();
      setCases(data);
      setHasLoadedData(true);
      
      // Set baseline - we've now loaded data (even if empty)
      (window as any).fileStorageDataBaseline = true;
      
      // Ensure FileStorageAPI internal cache is synchronized with loaded data
      const fileData = {
        exported_at: new Date().toISOString(),
        total_cases: data.length,
        cases: data
      };
      fileDataProvider.handleFileDataLoaded(fileData);
      
      if (data.length > 0) {
        (window as any).fileStorageSessionHadData = true;
        toast.success(`Loaded ${data.length} cases successfully`);
      } else {
        toast.success(`Connected successfully - ready to start fresh`);
      }
    } catch (err) {
      console.error('Failed to load cases:', err);
      const errorMsg = 'Failed to load cases. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);



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
      
      setLoading(true);
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
      setLoading(false);
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
    const dataAPI = getDataAPI();
    if (!dataAPI) {
      const errorMsg = 'Data storage is not available. Please check your file system connection.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    const isEditing = !!editingCase;
    const toastId = toast.loading(isEditing ? "Updating case..." : "Creating case...");

    try {
      setError(null);
      if (editingCase) {
        // Update existing case
        const updatedCase = await dataAPI.updateCompleteCase(editingCase.id, caseData);
        setCases(prevCases => 
          prevCases.map(c => 
            c.id === editingCase.id ? updatedCase : c
          )
        );
        
        toast.success(`Case for ${caseData.person.firstName} ${caseData.person.lastName} updated successfully`, { id: toastId });
        
        // Return to the previous view after saving
        if (formState.previousView === 'details' && formState.returnToCaseId) {
          setSelectedCaseId(formState.returnToCaseId);
          setCurrentView('details');
        } else {
          setCurrentView(formState.previousView);
        }
      } else {
        // Create new case - always go to list after creating
        const newCase = await dataAPI.createCompleteCase(caseData);
        setCases(prevCases => [...prevCases, newCase]);
        
        toast.success(`Case for ${caseData.person.firstName} ${caseData.person.lastName} created successfully`, { id: toastId });
        setCurrentView('list');
      }
      setEditingCase(null);
      setFormState({ previousView: 'list' });
      
      // Notify file storage of data change
      safeNotifyFileStorageChange();
    } catch (err) {
      console.error('Failed to save case:', err);
      const errorMsg = `Failed to ${isEditing ? 'update' : 'create'} case. Please try again.`;
      setError(errorMsg);
      toast.error(errorMsg, { id: toastId });
    }
  }, [editingCase, formState, safeNotifyFileStorageChange]);

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
    const dataAPI = getDataAPI();
    if (!selectedCase || !dataAPI) {
      if (!dataAPI) {
        const errorMsg = 'Data storage is not available. Please check your connection.';
        setError(errorMsg);
        toast.error(errorMsg);
      }
      return;
    }
    
    try {
      setError(null);
      const updatedCase = await dataAPI.deleteItem(selectedCase.id, category, itemId);
      setCases(prevCases =>
        prevCases.map(c =>
          c.id === selectedCase.id ? updatedCase : c
        )
      );
      
      toast.success(`${category.charAt(0).toUpperCase() + category.slice(1)} item deleted successfully`);
      
      // Notify file storage of data change
      safeNotifyFileStorageChange();
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
    setNoteForm({
      isOpen: true,
      caseId: selectedCase.id
    });
  };

  const handleEditNote = (noteId: string) => {
    if (!selectedCase) return;
    
    const note = selectedCase.caseRecord.notes?.find(n => n.id === noteId);
    if (note) {
      setNoteForm({
        isOpen: true,
        editingNote: note,
        caseId: selectedCase.id
      });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const dataAPI = getDataAPI();
    if (!selectedCase || !dataAPI) return;
    
    try {
      setError(null);
      const updatedCase = await dataAPI.deleteNote(selectedCase.id, noteId);
      setCases(prevCases =>
        prevCases.map(c =>
          c.id === selectedCase.id ? updatedCase : c
        )
      );
      
      toast.success("Note deleted successfully");
      
      // Notify file storage of data change
      safeNotifyFileStorageChange();
    } catch (err) {
      console.error('Failed to delete note:', err);
      const errorMsg = 'Failed to delete note. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    const dataAPI = getDataAPI();
    if (!dataAPI) return;
    
    // Find the case to get the person's name for the toast
    const caseToDelete = cases.find(c => c.id === caseId);
    const personName = caseToDelete ? `${caseToDelete.person.firstName} ${caseToDelete.person.lastName}` : 'Case';
    
    try {
      setError(null);
      await dataAPI.deleteCase(caseId);
      
      // Remove the case from the local state
      setCases(prevCases => prevCases.filter(c => c.id !== caseId));
      
      // If we're currently viewing this case, redirect to list
      if (selectedCaseId === caseId) {
        setCurrentView('list');
        setSelectedCaseId(null);
      }
      
      toast.success(`${personName} case deleted successfully`);
      
      // Notify file storage of data change
      safeNotifyFileStorageChange();
    } catch (err) {
      console.error('Failed to delete case:', err);
      const errorMsg = 'Failed to delete case. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleSaveNote = async (noteData: NewNoteData) => {
    const dataAPI = getDataAPI();
    if (!noteForm.caseId || !dataAPI) return;

    const isEditing = !!noteForm.editingNote;

    try {
      setError(null);
      let updatedCase: CaseDisplay;
      
      if (noteForm.editingNote) {
        // Update existing note
        updatedCase = await dataAPI.updateNote(noteForm.caseId, noteForm.editingNote.id, noteData);
        toast.success("Note updated successfully");
      } else {
        // Add new note
        updatedCase = await dataAPI.addNote(noteForm.caseId, noteData);
        toast.success("Note added successfully");
      }
      
      setCases(prevCases =>
        prevCases.map(c =>
          c.id === noteForm.caseId ? updatedCase : c
        )
      );
      
      setNoteForm({ isOpen: false });
      
      // Notify file storage of data change
      safeNotifyFileStorageChange();
    } catch (err) {
      console.error('Failed to save note:', err);
      const errorMsg = `Failed to ${isEditing ? 'update' : 'add'} note. Please try again.`;
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleCancelNoteForm = () => {
    setNoteForm({ isOpen: false });
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
      
      // Notify file storage of data change
      safeNotifyFileStorageChange();
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
        setLoading(false);
        return;
      }
      
      // Only proceed if we have a definitive support status
      if (isSupported === undefined) {
        return; // Still initializing
      }
      
      // For file storage mode, check if setup is needed
      if (isSupported && !isConnected && !hasLoadedData) {
        setShowConnectModal(true);
        setLoading(false); // Stop the main loading to show connect modal
      } else if (isConnected && !hasLoadedData) {
        // Directory connected but no data loaded yet - show modal for user to load
        setShowConnectModal(true);
        setLoading(false);
      } else if (isConnected && hasLoadedData) {
        // Everything is set up and ready
        setShowConnectModal(false);
        setLoading(false);
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

// Simple file data handler - only updates provider, no import processing
const handleFileDataLoaded = (fileData: any) => {
  try {
    // Always update the file data provider cache (this is safe and necessary)
    fileDataProvider.handleFileDataLoaded(fileData);
    
    // Set baseline - we've now loaded data through the file storage system
    (window as any).fileStorageDataBaseline = true;
    
    if (fileData && fileData.cases && fileData.cases.length > 0) {
      (window as any).fileStorageSessionHadData = true;
    }
  } catch (err) {
    console.error('Failed to update file data provider:', err);
  }
};

export default function App() {
  return (
    <ThemeProvider>
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
        <FileStorageIntegrator>
          <AppContent />
          <Toaster />
        </FileStorageIntegrator>
      </FileStorageProvider>
    </ThemeProvider>
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