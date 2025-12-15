import { memo, Profiler, useCallback, useMemo } from "react";
import type { ProfilerOnRenderCallback } from "react";

type ExtendedProfilerArgs = [...Parameters<ProfilerOnRenderCallback>, Set<unknown>?, number?];
type ExtendedProfilerOnRenderCallback = (...args: ExtendedProfilerArgs) => void;
import { useFileStorage, useFileStorageLifecycleSelectors } from "../../contexts/FileStorageContext";
import { useDataManagerSafe } from "../../contexts/DataManagerContext";
import { useCategoryConfig } from "../../contexts/CategoryConfigContext";
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
import { recordRenderProfile } from "../../utils/performanceTracker";
import { AppContentView } from "./AppContentView";
import { useAppContentViewModel } from "./useAppContentViewModel";
import type { CaseCategory, StoredCase, FinancialItem, NewNoteData } from "../../types/case";

export const AppContent = memo(function AppContent() {
  const { isSupported, hasStoredHandle, connectToFolder, connectToExisting, loadExistingData, service, fileStorageService } = useFileStorage();
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
    deleteCases,
    updateCaseStatus,
    updateCasesStatus,
    updateCasesPriority,
    setCases,
    setError,
    setHasLoadedData,
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

  useFileDataSync({
    setCases,
    setHasLoadedData,
    setConfigFromFile,
  });

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
    fileStorageService,
    dataManager,
    loadCases,
    setCases,
    setError,
    setHasLoadedData,
  });

  const {
    itemForm,
    openItemForm,
    closeItemForm,
    handleDeleteItem: deleteFinancialItem,
    handleBatchUpdateItem: batchUpdateFinancialItem,
    handleCreateItem: createFinancialItem,
    formData,
    formErrors,
    addAnother,
    setAddAnother,
    updateFormField,
    handleSaveItem,
    isEditing,
  } = useFinancialItemFlow({
    selectedCase: selectedCase ?? null,
    setError,
  });

  const {
    noteForm,
    handleAddNote,
    handleEditNote,
    handleDeleteNote,
    handleSaveNote: baseHandleSaveNote,
    handleCancelNoteForm,
    handleBatchUpdateNote: baseHandleBatchUpdateNote,
    handleBatchCreateNote: baseHandleBatchCreateNote,
  } = useNoteFlow({
    selectedCase: selectedCase ?? null,
    setError,
  });

  const handleSaveNote = useCallback(
    async (noteData: NewNoteData) => {
      await baseHandleSaveNote(noteData);
      await refreshActivityLog();
    },
    [baseHandleSaveNote, refreshActivityLog],
  );

  const handleBatchUpdateNote = useCallback(
    async (noteId: string, noteData: NewNoteData) => {
      await baseHandleBatchUpdateNote(noteId, noteData);
      await refreshActivityLog();
    },
    [baseHandleBatchUpdateNote, refreshActivityLog],
  );

  const handleBatchCreateNote = useCallback(
    async (noteData: NewNoteData) => {
      await baseHandleBatchCreateNote(noteData);
      await refreshActivityLog();
    },
    [baseHandleBatchCreateNote, refreshActivityLog],
  );

  useImportListeners({ loadCases, setError, isStorageReady: connectionState.isReady });

  const { alertsIndex, onResolveAlert: handleResolveAlert, onAlertsCsvImported: handleAlertsCsvImported } = useAlertsFlow({
    cases,
    selectedCase: selectedCase ?? null,
    hasLoadedData,
    dataManager,
  });

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
    (category: CaseCategory, itemData: Omit<FinancialItem, "id" | "createdAt" | "updatedAt">) =>
      createFinancialItem(category, itemData),
    [createFinancialItem],
  );

  const handleCancelItemForm = useCallback(() => {
    closeItemForm();
  }, [closeItemForm]);



  const handleSidebarOpenChange = useCallback(
    (open: boolean) => {
      setSidebarOpen(open);
    },
    [setSidebarOpen],
  );

  const handleUpdateCaseStatus = useCallback(
    async (caseId: string, status: StoredCase["status"]) => {
      const result = await updateCaseStatus(caseId, status);
      if (result) {
        await refreshActivityLog();
      }
      return result;
    },
    [refreshActivityLog, updateCaseStatus],
  );

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
      handleDeleteCases: deleteCases,
      handleUpdateCasesStatus: updateCasesStatus,
      handleUpdateCasesPriority: updateCasesPriority,
    }),
    [
      handleBackToList,
      handleCancelForm,
      handleDeleteCase,
      deleteCases,
      updateCasesStatus,
      updateCasesPriority,
      handleEditCase,
      handleNewCase,
      handleSaveCase,
      handleViewCase,
    ],
  );

  const financialFlow = useMemo(
    () => ({
      itemForm,
      formData,
      formErrors,
      addAnother,
      isEditing,
      handleAddItem,
      handleDeleteItem,
      handleBatchUpdateItem,
      handleCreateItem,
      handleCancelItemForm,
      handleSaveItem,
      updateFormField,
      setAddAnother,
    }),
    [
      addAnother,
      formData,
      formErrors,
      handleAddItem,
      handleBatchUpdateItem,
      handleCancelItemForm,
      handleCreateItem,
      handleDeleteItem,
      handleSaveItem,
      isEditing,
      itemForm,
      setAddAnother,
      updateFormField,
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
      getReportForDate,
      clearReportForDate,
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
