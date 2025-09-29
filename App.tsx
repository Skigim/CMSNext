import { useEffect, useCallback, useMemo, memo, useRef } from "react";
import { Toaster } from "./components/ui/sonner";
import { CaseDisplay, CaseCategory, FinancialItem } from "./types/case";
import { toast } from "sonner";
import { useFileStorage, useFileStorageLifecycleSelectors } from "./contexts/FileStorageContext";
import { useDataManagerSafe } from "./contexts/DataManagerContext";
import {
  useCaseManagement,
  useConnectionFlow,
  useFinancialItemFlow,
  useNavigationFlow,
  useNoteFlow,
  useImportListeners,
} from "./hooks";
import { AppProviders } from "./components/providers/AppProviders";
import { FileStorageIntegrator } from "./components/providers/FileStorageIntegrator";
import { AppContentView } from "./components/app/AppContentView";
import { useAppContentViewModel } from "./components/app/useAppContentViewModel";
import { clearFileStorageFlags, updateFileStorageFlags } from "./utils/fileStorageFlags";
import { useCategoryConfig } from "./contexts/CategoryConfigContext";
import type { AlertsIndex } from "./utils/alertsData";
import { ENABLE_SAMPLE_ALERTS } from "./utils/featureFlags";

const createEmptyAlertsIndex = (): AlertsIndex => ({
  alerts: [],
  summary: {
    total: 0,
    matched: 0,
    unmatched: 0,
    missingMcn: 0,
    latestUpdated: null,
  },
  alertsByCaseId: new Map(),
  unmatched: [],
  missingMcn: [],
});

const AppContent = memo(function AppContent() {
  const { isSupported, hasStoredHandle, connectToFolder, connectToExisting, loadExistingData, service } = useFileStorage();
  const connectionState = useFileStorageLifecycleSelectors();
  
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
  const { setConfigFromFile } = useCategoryConfig();
  
  const navigationFlow = useNavigationFlow({
    cases,
    connectionState,
    saveCase,
    deleteCase,
  });

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
    navigationLock: _navigationLock,
  } = navigationFlow;

  const {
    showConnectModal,
    handleChooseNewFolder,
    handleConnectToExisting,
    dismissConnectModal,
  } = useConnectionFlow({
    isSupported,
    hasLoadedData,
    connectionState,
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
      console.log("🔧 handleFileDataLoaded called with:", fileData);

      if (fileData && typeof fileData === "object") {
        setConfigFromFile(fileData.categoryConfig);
      } else {
        setConfigFromFile(undefined);
      }

      let casesToSet: CaseDisplay[] = [];

      if (fileData?.cases) {
        casesToSet = fileData.cases as CaseDisplay[];
        console.log(`✅ File data loaded with transformed cases: ${casesToSet.length} cases`);
      } else if (fileData?.people && fileData?.caseRecords) {
        console.log(
          `🔄 Raw file data detected: ${fileData.people.length} people, ${fileData.caseRecords.length} case records. Triggering DataManager reload...`,
        );

        setTimeout(() => {
          loadCases().catch(err => console.error("Failed to reload cases after file load:", err));
        }, 100);

        setHasLoadedData(true);
        return;
      } else if (fileData && Object.keys(fileData).length === 0) {
        casesToSet = [];
        console.log("✅ Empty file data loaded and synced to UI");
      } else {
        console.warn("⚠️ Unexpected file data format:", fileData);
        casesToSet = [];
      }

      setCases(casesToSet);
      setHasLoadedData(true);

      updateFileStorageFlags({ dataBaseline: true });

      if (casesToSet.length > 0) {
        updateFileStorageFlags({ sessionHadData: true });
      }
    } catch (err) {
      console.error("Failed to handle file data loaded:", err);
      toast.error("Failed to load data");
    }
  }, [loadCases, setCases, setHasLoadedData, setConfigFromFile]);

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

  useImportListeners({ loadCases, setError, isStorageReady: connectionState.isReady });

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

  const handleDataPurged = useCallback(async () => {
    try {
      setError(null);
      setCases([]);
      setHasLoadedData(false);

      clearFileStorageFlags("dataBaseline", "sessionHadData");

      toast.success("All data has been purged successfully");
    } catch (err) {
      console.error("Failed to handle data purge:", err);
      const errorMsg = "Failed to complete data purge. Please try again.";
      setError(errorMsg);
      toast.error(errorMsg);
    }
  }, [setCases, setError, setHasLoadedData]);

  const handleSidebarOpenChange = useCallback(
    (open: boolean) => {
      setSidebarOpen(open);
    },
    [setSidebarOpen],
  );

  const handleCaseUpdated = useCallback((updatedCase: CaseDisplay) => {
    setCases(prevCases => prevCases.map(c => (c.id === updatedCase.id ? updatedCase : c)));
  }, [setCases]);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, [setError]);

  const handleGoToSettings = useCallback(() => {
    dismissConnectModal();
    setHasLoadedData(true);
    handleNavigate("settings");
  }, [dismissConnectModal, handleNavigate, setHasLoadedData]);

  const navigationState = useMemo(
    () => ({
      currentView,
      breadcrumbTitle,
      sidebarOpen,
      onNavigate: handleNavigate,
      onNewCase: handleNewCase,
      onSidebarOpenChange: handleSidebarOpenChange,
    }),
    [
      breadcrumbTitle,
      currentView,
      handleNavigate,
      handleNewCase,
      handleSidebarOpenChange,
      sidebarOpen,
    ],
  );

  const viewHandlers = useMemo(
    () => ({
      handleViewCase,
      handleEditCase,
      handleNewCase,
      handleBackToList,
      handleSaveCase,
      handleCancelForm,
      handleDeleteCase,
      handleDataPurged,
    }),
    [
      handleBackToList,
      handleCancelForm,
      handleDataPurged,
      handleDeleteCase,
      handleEditCase,
      handleNewCase,
      handleSaveCase,
      handleViewCase,
    ],
  );

  const financialFlow = useMemo(
    () => ({
      itemForm,
      handleAddItem,
      handleDeleteItem,
      handleBatchUpdateItem,
      handleCreateItem,
      handleCancelItemForm,
      closeItemForm,
      onCaseUpdated: handleCaseUpdated,
    }),
    [
      closeItemForm,
      handleAddItem,
      handleBatchUpdateItem,
      handleCancelItemForm,
      handleCaseUpdated,
      handleCreateItem,
      handleDeleteItem,
      itemForm,
    ],
  );

  const noteFlow = useMemo(
    () => ({
      noteForm,
      handleAddNote,
      handleEditNote,
      handleDeleteNote,
      handleSaveNote,
      handleCancelNoteForm,
      handleBatchUpdateNote,
      handleBatchCreateNote,
    }),
    [
      handleAddNote,
      handleBatchCreateNote,
      handleBatchUpdateNote,
      handleCancelNoteForm,
      handleDeleteNote,
      handleEditNote,
      handleSaveNote,
      noteForm,
    ],
  );

  const alertsIndex = useMemo<AlertsIndex>(() => createEmptyAlertsIndex(), [cases]);

  const previousAlertCountsRef = useRef({ unmatched: 0, missingMcn: 0 });

  useEffect(() => {
    if (!ENABLE_SAMPLE_ALERTS) {
      return;
    }

    const { unmatched, missingMcn } = alertsIndex.summary;
    const prev = previousAlertCountsRef.current;

    if ((unmatched > 0 || missingMcn > 0) && (unmatched !== prev.unmatched || missingMcn !== prev.missingMcn)) {
      const messageParts: string[] = [];
      if (unmatched > 0) {
        messageParts.push(`${unmatched} alert${unmatched === 1 ? "" : "s"} need${unmatched === 1 ? "s" : ""} a case match`);
      }
      if (missingMcn > 0) {
        messageParts.push(`${missingMcn} alert${missingMcn === 1 ? "" : "s"} missing an MCN`);
      }

      toast.warning(`Heads up: ${messageParts.join(" and ")}`, {
        id: "alerts-match-status",
      });
    }

    previousAlertCountsRef.current = { unmatched, missingMcn };
  }, [alertsIndex.summary.missingMcn, alertsIndex.summary.unmatched]);

  const workspaceState = useMemo(
    () => ({
      cases,
      selectedCase,
      editingCase,
      error,
      onDismissError: handleDismissError,
      viewHandlers,
      financialFlow,
      noteFlow,
      alerts: alertsIndex,
    }),
    [
      cases,
      editingCase,
      error,
      financialFlow,
      handleDismissError,
      noteFlow,
      selectedCase,
      viewHandlers,
      alertsIndex,
    ],
  );

  const appContentViewProps = useAppContentViewModel({
    showConnectModal,
    isLoading: loading,
    isSupported,
    permissionStatus: connectionState.permissionStatus,
    hasStoredHandle,
    lifecycle: connectionState.lifecycle,
    navigationState,
    connectionHandlers: {
      onConnectToExisting: handleConnectToExisting,
      onChooseNewFolder: handleChooseNewFolder,
      onGoToSettings: handleGoToSettings,
    },
    workspaceState,
  });

  return <AppContentView {...appContentViewProps} />;
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