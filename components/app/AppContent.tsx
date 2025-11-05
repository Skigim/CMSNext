import { memo, Profiler, useCallback, useMemo } from "react";
import type { ProfilerOnRenderCallback } from "react";

type ExtendedProfilerArgs = [...Parameters<ProfilerOnRenderCallback>, Set<unknown>?, number?];
type ExtendedProfilerOnRenderCallback = (...args: ExtendedProfilerArgs) => void;
import { toast } from "sonner";
import { useFileStorage, useFileStorageLifecycleSelectors } from "../../contexts/FileStorageContext";
import { useDataManagerSafe } from "../../contexts/DataManagerContext";
import { useCategoryConfig } from "../../contexts/CategoryConfigContext";
import ApplicationState from "@/application/ApplicationState";
import {
  useAlertsFlow,
  useCaseActivityLog,
  useCaseManagement,
  useConnectionFlow,
  useFileDataSync,
  useFinancialItemFlow,
  useImportListeners,
  useNavigationFlow,
  useNoteFlow,
} from "../../hooks";
import { clearFileStorageFlags } from "../../utils/fileStorageFlags";
import { recordRenderProfile } from "../../utils/performanceTracker";
import { createLogger } from "../../utils/logger";
import { AppContentView } from "./AppContentView";
import { useAppContentViewModel } from "./useAppContentViewModel";
import type { CaseDisplay, NewPersonData, NewCaseRecordData } from "../../types/case";
import { FinancialCategory, type FinancialItemSnapshot } from "@/domain/financials/entities/FinancialItem";

const logger = createLogger("AppContent");

export const AppContent = memo(function AppContent() {
  const { isSupported, hasStoredHandle, connectToFolder, connectToExisting, loadExistingData, service } = useFileStorage();
  const connectionState = useFileStorageLifecycleSelectors();
  const dataManager = useDataManagerSafe();

  const {
    cases,
    loading,
    error,
    hasLoadedData,
    loadCases,
    saveCase,
    deleteCase,
    updateCaseStatus,
  } = useCaseManagement();

  const {
    activityLog,
    dailyReports: dailyActivityReports,
    todayReport: todayActivityReport,
    yesterdayReport: yesterdayActivityReport,
    loading: activityLogLoading,
    error: activityLogError,
    refreshActivityLog,
    getReportForDate,
    clearReportForDate,
  } = useCaseActivityLog();

  const { setConfigFromFile } = useCategoryConfig();

  const reloadCasesFromFile = useCallback(async () => {
    return await loadCases();
  }, [loadCases]);

  useFileDataSync({
    loadCases: reloadCasesFromFile,
    setConfigFromFile,
  });

  const handleSaveCaseForNav = useCallback(
    async (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }, editingCase?: CaseDisplay | null) => {
      await saveCase(caseData, editingCase);
    },
    [saveCase],
  );

  const navigationFlow = useNavigationFlow({
    cases,
    connectionState,
    saveCase: handleSaveCaseForNav,
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
    navigationLock,
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
  });

  // Legacy hooks require setState callbacks - create adapters for ApplicationState
  const setCases = useCallback((updater: React.SetStateAction<CaseDisplay[]>) => {
    const appState = ApplicationState.getInstance();
    const newCases = typeof updater === 'function' ? updater(cases) : updater;
    appState.setCasesFromLegacyDisplays(newCases);
  }, [cases]);

  const setError = useCallback((updater: React.SetStateAction<string | null>) => {
    const appState = ApplicationState.getInstance();
    const currentError = error;
    const newError = typeof updater === 'function' ? updater(currentError) : updater;
    appState.setCasesError(newError);
  }, [error]);

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

  useImportListeners({ loadCases, isStorageReady: connectionState.isReady });

  const { alertsIndex, onResolveAlert: handleResolveAlert, onAlertsCsvImported: handleAlertsCsvImported } = useAlertsFlow({
    cases,
    selectedCase: selectedCase ?? null,
    hasLoadedData,
    dataManager,
  });

  const handleAddItem = useCallback(
    (category: FinancialCategory) => {
      openItemForm(category);
    },
    [openItemForm],
  );

  const handleDeleteItem = useCallback(
    (category: FinancialCategory, itemId: string) => deleteFinancialItem(category, itemId),
    [deleteFinancialItem],
  );

  const handleBatchUpdateItem = useCallback(
    (category: FinancialCategory, itemId: string, updatedItem: Partial<FinancialItemSnapshot>) =>
      batchUpdateFinancialItem(category, itemId, updatedItem),
    [batchUpdateFinancialItem],
  );

  const handleCreateItem = useCallback(
    (category: FinancialCategory, itemData: Omit<FinancialItemSnapshot, "id" | "createdAt" | "updatedAt">) =>
      createFinancialItem(category, itemData),
    [createFinancialItem],
  );

  const handleCancelItemForm = useCallback(() => {
    closeItemForm();
  }, [closeItemForm]);

  const handleDataPurged = useCallback(async () => {
    try {
      const appState = ApplicationState.getInstance();
      appState.setCasesError(null);
      appState.setCasesFromLegacyDisplays([]);
      appState.setHasLoadedCases(false);

      clearFileStorageFlags("dataBaseline", "sessionHadData");

      toast.success("All data has been purged successfully");
    } catch (err) {
      logger.error("Failed to handle data purge", {
        error: err instanceof Error ? err.message : String(err),
      });
      const errorMsg = "Failed to complete data purge. Please try again.";
      ApplicationState.getInstance().setCasesError(errorMsg);
      toast.error(errorMsg);
    }
  }, []);

  const handleSidebarOpenChange = useCallback(
    (open: boolean) => {
      setSidebarOpen(open);
    },
    [setSidebarOpen],
  );

  const handleCaseUpdated = useCallback((updatedCase: CaseDisplay) => {
    ApplicationState.getInstance().upsertCaseFromLegacy(updatedCase);
  }, []);

  const handleUpdateCaseStatus = useCallback(
    async (caseId: string, status: CaseDisplay["status"]) => {
      try {
        const result = await updateCaseStatus(caseId, status);
        await refreshActivityLog();
        return result;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return null;
        }
        throw error;
      }
    },
    [refreshActivityLog, updateCaseStatus],
  );

  const handleDismissError = useCallback(() => {
    ApplicationState.getInstance().setCasesError(null);
  }, []);

  const handleGoToSettings = useCallback(() => {
    dismissConnectModal();
    ApplicationState.getInstance().setHasLoadedCases(true);
    handleNavigate("settings");
  }, [dismissConnectModal, handleNavigate]);

  const navigationState = useMemo(
    () => ({
      currentView,
      breadcrumbTitle,
      sidebarOpen,
      onNavigate: handleNavigate,
      onNewCase: handleNewCase,
      onSidebarOpenChange: handleSidebarOpenChange,
    }),
    [breadcrumbTitle, currentView, handleNavigate, handleNewCase, handleSidebarOpenChange, sidebarOpen],
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
      onUpdateCaseStatus: handleUpdateCaseStatus,
      onResolveAlert: handleResolveAlert,
      onAlertsCsvImported: handleAlertsCsvImported,
      activityLogState: {
        activityLog,
        dailyReports: dailyActivityReports,
        todayReport: todayActivityReport,
        yesterdayReport: yesterdayActivityReport,
        loading: activityLogLoading,
        error: activityLogError,
        refreshActivityLog,
        getReportForDate,
        clearReportForDate,
      },
    }),
    [
      activityLog,
      activityLogError,
      activityLogLoading,
      alertsIndex,
      cases,
      dailyActivityReports,
      editingCase,
      error,
      financialFlow,
      handleAlertsCsvImported,
      handleDismissError,
      handleResolveAlert,
      handleUpdateCaseStatus,
      noteFlow,
      refreshActivityLog,
      selectedCase,
      todayActivityReport,
      viewHandlers,
      yesterdayActivityReport,
      clearReportForDate,
      getReportForDate,
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

  const casesCount = cases.length;

  const handleAppRenderProfile = useCallback<ExtendedProfilerOnRenderCallback>(
    (...args) => {
      const [
        id,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
        interactions = new Set<unknown>(),
        lanes,
      ] = args;
      const normalizedPhase: "mount" | "update" = phase === "mount" ? "mount" : "update";
      const normalizedLanes = typeof lanes === "number" ? lanes : undefined;

      recordRenderProfile({
        id,
        phase: normalizedPhase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
        interactionCount: interactions.size,
        meta: {
          currentView,
          casesCount,
          navigationLocked: navigationLock.locked,
          lanes: normalizedLanes,
        },
      });
    },
    [casesCount, currentView, navigationLock.locked],
  );

  return (
    <Profiler id="AppContent" onRender={handleAppRenderProfile}>
      <AppContentView {...appContentViewProps} />
    </Profiler>
  );
});
