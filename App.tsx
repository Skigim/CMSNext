import { useEffect, useCallback, useMemo, memo, useRef, useState } from "react";
import { Toaster } from "./components/ui/sonner";
import { CaseDisplay, CaseCategory, FinancialItem, NewNoteData, type AlertWorkflowStatus } from "./types/case";
import { toast } from "sonner";
import { useFileStorage, useFileStorageLifecycleSelectors, useFileStorageDataLoadHandler } from "./contexts/FileStorageContext";
import { useDataManagerSafe } from "./contexts/DataManagerContext";
import {
  useCaseManagement,
  useCaseActivityLog,
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
import {
  createAlertsIndexFromAlerts,
  createEmptyAlertsIndex,
  buildAlertStorageKey,
  type AlertWithMatch,
  type AlertsIndex,
} from "./utils/alertsData";
import { ENABLE_SAMPLE_ALERTS } from "./utils/featureFlags";
import { createLogger } from "./utils/logger";

const logger = createLogger("App");

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
    updateCaseStatus,
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
  const [alertsIndex, setAlertsIndex] = useState<AlertsIndex>(() => createEmptyAlertsIndex());
  const resolvedAlertOverridesRef = useRef(
    new Map<string, { status?: AlertWorkflowStatus; resolvedAt?: string | null; resolutionNotes?: string }>(),
  );
  
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
      logger.lifecycle("handleFileDataLoaded invoked", {
        hasCases: Array.isArray(fileData?.cases),
        peopleCount: Array.isArray(fileData?.people) ? fileData.people.length : undefined,
      });

      if (fileData && typeof fileData === "object") {
        setConfigFromFile(fileData.categoryConfig);
      } else {
        setConfigFromFile(undefined);
      }

      let casesToSet: CaseDisplay[] = [];

      if (fileData?.cases) {
        casesToSet = fileData.cases as CaseDisplay[];
        logger.info("File data loaded", { caseCount: casesToSet.length });
      } else if (fileData?.people && fileData?.caseRecords) {
        logger.warn("Raw file data detected; scheduling DataManager reload", {
          peopleCount: fileData.people.length,
          caseRecordCount: fileData.caseRecords.length,
        });

        setTimeout(() => {
          loadCases().catch(err =>
            logger.error("Failed to reload cases after file load", {
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }, 100);

        setHasLoadedData(true);
        return;
      } else if (fileData && Object.keys(fileData).length === 0) {
        casesToSet = [];
        logger.info("Empty file data loaded and synced to UI");
      } else {
        logger.warn("Unexpected file data format", { keys: Object.keys(fileData ?? {}) });
        casesToSet = [];
      }

      setCases(casesToSet);
      setHasLoadedData(true);

      updateFileStorageFlags({ dataBaseline: true });

      if (casesToSet.length > 0) {
        updateFileStorageFlags({ sessionHadData: true });
      }
    } catch (err) {
      logger.error("Failed to handle file data loaded", {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error("Failed to load data");
    }
  }, [loadCases, setCases, setHasLoadedData, setConfigFromFile]);

  useFileStorageDataLoadHandler(handleFileDataLoaded);
  
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
    handleSaveNote: baseHandleSaveNote,
    handleCancelNoteForm,
    handleBatchUpdateNote: baseHandleBatchUpdateNote,
    handleBatchCreateNote: baseHandleBatchCreateNote,
  } = useNoteFlow({
    selectedCase: selectedCase ?? null,
    cases,
    setCases,
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

  const applyAlertOverrides = useCallback(
    (index: AlertsIndex): AlertsIndex => {
      if (resolvedAlertOverridesRef.current.size === 0) {
        return index;
      }

      let hasChanges = false;
      const adjustedAlerts = index.alerts.map(alert => {
        const override = resolvedAlertOverridesRef.current.get(alert.id);
        if (!override) {
          return alert;
        }

        const nextStatus = override.status ?? alert.status;
        const hasResolvedAtOverride = Object.prototype.hasOwnProperty.call(override, "resolvedAt");
        const nextResolvedAt = hasResolvedAtOverride ? override.resolvedAt ?? null : alert.resolvedAt ?? null;
        const nextResolutionNotes = override.resolutionNotes ?? alert.resolutionNotes;

        if (
          alert.status === nextStatus &&
          (alert.resolvedAt ?? null) === nextResolvedAt &&
          alert.resolutionNotes === nextResolutionNotes
        ) {
          return alert;
        }

        hasChanges = true;
        const overriddenAlert: AlertWithMatch = {
          ...alert,
          status: nextStatus,
          resolvedAt: nextResolvedAt,
          resolutionNotes: nextResolutionNotes,
        };

        return overriddenAlert;
      });

      if (!hasChanges) {
        return index;
      }

      return createAlertsIndexFromAlerts(adjustedAlerts);
    },
    [resolvedAlertOverridesRef],
  );

  const handleAlertsCsvImported = useCallback(
    (index: AlertsIndex) => {
      setAlertsIndex(applyAlertOverrides(index));
    },
    [applyAlertOverrides, setAlertsIndex],
  );

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
      logger.error("Failed to handle data purge", {
        error: err instanceof Error ? err.message : String(err),
      });
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

  const handleUpdateCaseStatus = useCallback(
    async (caseId: string, status: CaseDisplay["status"]) => {
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

  const handleResolveAlert = useCallback(
    async (alert: AlertWithMatch) => {
      if (selectedCase && alert.matchedCaseId && alert.matchedCaseId !== selectedCase.id) {
        toast.error("Unable to update alert for this case.");
        return;
      }

      if (!dataManager) {
        toast.error("Alerts service is not ready. Try again after reconnecting.");
        return;
      }

      const identifier = buildAlertStorageKey(alert) ?? alert.id;
      const isResolved = alert.status === "resolved";

      if (isResolved) {
        resolvedAlertOverridesRef.current.set(alert.id, {
          status: "in-progress",
          resolvedAt: null,
        });
        setAlertsIndex(prevIndex => applyAlertOverrides(prevIndex));

        try {
          await dataManager.updateAlertStatus(
            identifier,
            {
              status: "in-progress",
              resolvedAt: null,
              resolutionNotes: alert.resolutionNotes,
            },
            { cases },
          );

          resolvedAlertOverridesRef.current.delete(alert.id);

          const refreshedAlerts = await dataManager.getAlertsIndex({ cases });
          setAlertsIndex(applyAlertOverrides(refreshedAlerts));

          toast.success("Alert reopened", {
            description: "We moved this alert back into the active queue.",
          });
        } catch (err) {
          logger.error("Failed to reopen alert", {
            alertId: alert.id,
            error: err instanceof Error ? err.message : String(err),
          });
          resolvedAlertOverridesRef.current.delete(alert.id);
          setAlertsIndex(prevIndex => applyAlertOverrides(prevIndex));
          toast.error("Unable to reopen alert. Please try again.");
        }

        return;
      }

      const resolvedAt = new Date().toISOString();
      resolvedAlertOverridesRef.current.set(alert.id, {
        status: "resolved",
        resolvedAt,
        resolutionNotes: alert.resolutionNotes,
      });
      setAlertsIndex(prevIndex => applyAlertOverrides(prevIndex));

      try {
        await dataManager.updateAlertStatus(
          identifier,
          {
            status: "resolved",
            resolvedAt,
            resolutionNotes: alert.resolutionNotes,
          },
          { cases },
        );

        resolvedAlertOverridesRef.current.delete(alert.id);

        const refreshedAlerts = await dataManager.getAlertsIndex({ cases });
        setAlertsIndex(applyAlertOverrides(refreshedAlerts));

        toast.success("Alert resolved", {
          description: "Add a note when you're ready to document the resolution.",
        });
      } catch (err) {
        logger.error("Failed to resolve alert", {
          alertId: alert.id,
          error: err instanceof Error ? err.message : String(err),
        });
        resolvedAlertOverridesRef.current.delete(alert.id);
        setAlertsIndex(prevIndex => applyAlertOverrides(prevIndex));
        toast.error("Unable to resolve alert. Please try again.");
      }
    },
    [applyAlertOverrides, cases, dataManager, selectedCase, setAlertsIndex],
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadAlerts() {
      if (!dataManager || !hasLoadedData) {
        if (!isCancelled) {
          setAlertsIndex(createEmptyAlertsIndex());
        }
        return;
      }

      try {
        const nextAlerts = await dataManager.getAlertsIndex({ cases });
        if (!isCancelled) {
          setAlertsIndex(applyAlertOverrides(nextAlerts));
        }
      } catch (error) {
        logger.error("Failed to load alerts", {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!isCancelled) {
          setAlertsIndex(createEmptyAlertsIndex());
        }
      }
    }

    loadAlerts();

    return () => {
      isCancelled = true;
    };
  }, [applyAlertOverrides, cases, dataManager, hasLoadedData]);

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

  const previousAlertCountsRef = useRef({ unmatched: 0, missingMcn: 0 });
  const alertSummary = alertsIndex.summary;

  useEffect(() => {
    if (!ENABLE_SAMPLE_ALERTS) {
      return;
    }

    const { unmatched, missingMcn } = alertSummary;
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
  }, [alertSummary]);

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
      clearReportForDate,
      alertsIndex,
      cases,
      dailyActivityReports,
      editingCase,
      error,
      getReportForDate,
      financialFlow,
      handleDismissError,
      handleUpdateCaseStatus,
      handleResolveAlert,
      handleAlertsCsvImported,
      noteFlow,
      refreshActivityLog,
      selectedCase,
      todayActivityReport,
      yesterdayActivityReport,
      viewHandlers,
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
  logger.lifecycle("Rendering main App component");

  return (
    <AppProviders>
      <FileStorageIntegrator>
        <AppContent />
        <Toaster />
      </FileStorageIntegrator>
    </AppProviders>
  );
}