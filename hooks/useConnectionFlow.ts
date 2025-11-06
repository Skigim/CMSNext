import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CaseDisplay } from "../types/case";
import type AutosaveFileService from "../utils/AutosaveFileService";
import type DataManager from "../utils/DataManager";
import {
  clearFileStorageFlags,
  updateFileStorageFlags,
} from "../utils/fileStorageFlags";
import type { FileStorageLifecycleSelectors } from "../contexts/FileStorageContext";
import { reportFileStorageError } from "../utils/fileStorageErrorReporter";
import { createLogger } from "@/utils/logger";
import ApplicationState from "@/application/ApplicationState";
import ActivityLogger from "@/application/ActivityLogger";
import StorageRepository from "@/infrastructure/storage/StorageRepository";
import { getRefactorFlags } from "@/utils/featureFlags";

const logger = createLogger("ConnectionFlow");

interface UseConnectionFlowParams {
  isSupported: boolean | undefined;
  hasLoadedData: boolean;
  connectionState: FileStorageLifecycleSelectors;
  connectToFolder: () => Promise<boolean>;
  connectToExisting: () => Promise<boolean>;
  loadExistingData: () => Promise<any>;
  service: AutosaveFileService | null;
  dataManager: DataManager | null;
  loadCases: () => Promise<CaseDisplay[]>;
  setCases: React.Dispatch<React.SetStateAction<CaseDisplay[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setHasLoadedData: React.Dispatch<React.SetStateAction<boolean>>;
}

interface UseConnectionFlowResult {
  showConnectModal: boolean;
  handleChooseNewFolder: () => Promise<boolean>;
  handleConnectToExisting: () => Promise<boolean>;
  dismissConnectModal: () => void;
}

export function useConnectionFlow({
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
}: UseConnectionFlowParams): UseConnectionFlowResult {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const lastErrorRef = useRef<number | null>(null);
  const activityLoggerRef = useRef<ActivityLogger | null>(null);

  const emitFileStorageError = useCallback(
    (
      options: Parameters<typeof reportFileStorageError>[0],
      persistError: boolean = true,
    ) => {
      const notification = reportFileStorageError(options);
      if (notification && persistError && notification.type !== "info") {
        setError(notification.message);
      }
      return notification;
    },
    [setError],
  );

  const {
    lifecycle,
    permissionStatus,
    isReady,
    isBlocked,
    isErrored,
    isRecovering,
    isAwaitingUserChoice,
    hasStoredHandle,
    isConnected,
    lastError,
  } = connectionState;

  const handleChooseNewFolder = useCallback(async (): Promise<boolean> => {
    try {
      if (!isSupported) {
        emitFileStorageError({
          operation: "connect",
          messageOverride: "File System Access API is not supported in this browser",
          severity: "warning",
          toastId: "file-storage-unsupported",
        });
        return false;
      }

      setError(null);

      const success = await connectToFolder();
      if (!success) {
        emitFileStorageError({
          operation: "connect",
          messageOverride: "Failed to connect to new folder",
          toastId: "file-storage-connect-new",
        });
        return false;
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      let existingData: any;
      try {
        existingData = await loadExistingData();
      } catch (loadError) {
        logger.error("Error loading existing data", {
          error: loadError instanceof Error ? loadError.message : String(loadError),
        });
        existingData = null;
      }

      if (existingData && Object.keys(existingData).length > 0) {
        try {
          const loadedCases = await loadCases();

          if (loadedCases.length > 0) {
            setHasLoadedData(true);
            setShowConnectModal(false);

            updateFileStorageFlags({ dataBaseline: true, sessionHadData: true });

            toast.success(`Connected and loaded ${loadedCases.length} cases from new folder`, {
              id: "new-folder-success",
              duration: 3000,
            });
          } else {
            setCases([]);
            setHasLoadedData(true);
            setShowConnectModal(false);
            updateFileStorageFlags({ dataBaseline: true });
            toast.success("Connected to folder with empty data file - ready to add cases!");
          }
        } catch (err) {
          logger.error("Error loading cases from new folder", {
            error: err instanceof Error ? err.message : String(err),
          });
          emitFileStorageError({
            operation: "loadExistingData",
            error: err,
            messageOverride: "Connected to folder but failed to load case data",
            toastId: "file-storage-load-cases",
          });
          return false;
        }
      } else {
        toast.success("Connected to new folder successfully! Ready to start managing cases.");
      }

      setHasLoadedData(true);
      setShowConnectModal(false);

      if (service) {
        service.notifyDataChange?.();
      }

      return true;
    } catch (err) {
      logger.error("handleChooseNewFolder failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      const notification = emitFileStorageError({
        operation: "connect",
        error: err,
        fallbackMessage: "Failed to connect to new folder",
        toastId: "file-storage-connect-new",
      });
      if (!notification) {
        return false;
      }
      return false;
    }
  }, [
    connectToFolder,
    isSupported,
    loadCases,
    loadExistingData,
    service,
    setCases,
    setError,
    setHasLoadedData,
    emitFileStorageError,
  ]);

  const handleConnectToExisting = useCallback(async (): Promise<boolean> => {
    try {
      window.location.hash = "#connect-to-existing";
      updateFileStorageFlags({ inSetupPhase: true, inConnectionFlow: true });

      if (!dataManager) {
        logger.warn("DataManager not available during connectToExisting");
        emitFileStorageError({
          operation: "connectExisting",
          messageOverride: "Data storage is not available. Please connect to a folder first.",
          toastId: "file-storage-data-manager",
        });
        return false;
      }

      setError(null);
      const success = hasStoredHandle ? await connectToExisting() : await connectToFolder();
      if (!success) {
        emitFileStorageError({
          operation: hasStoredHandle ? "connectExisting" : "connect",
          messageOverride: "Failed to connect to directory",
          toastId: "file-storage-connect-existing",
        });
        return false;
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      let existingData: any;
      try {
        existingData = await loadExistingData();
      } catch (loadError) {
        logger.error("Failed to load existing data", {
          error: loadError instanceof Error ? loadError.message : String(loadError),
        });
        throw new Error(
          `Failed to access connected directory: ${
            loadError instanceof Error ? loadError.message : "Unknown error"
          }`,
        );
      }

      const actualData =
        existingData || ({ exported_at: new Date().toISOString(), total_cases: 0, cases: [] } as const);

      logger.debug("About to load data", {
        expectedRecords: actualData?.cases?.length || actualData?.caseRecords?.length || 0,
      });

      const loadedCases = await loadCases();

      if (loadedCases.length > 0) {
        setHasLoadedData(true);
        setShowConnectModal(false);

        updateFileStorageFlags({ dataBaseline: true, sessionHadData: true });

        toast.success(`Connected and loaded ${loadedCases.length} cases`, {
          id: "connection-success",
          duration: 3000,
        });
      } else {
        setCases([]);
        setHasLoadedData(true);
        setShowConnectModal(false);

        updateFileStorageFlags({ dataBaseline: true });

        toast.success("Connected successfully - ready to start fresh", {
          id: "connection-empty",
          duration: 3000,
        });
      }

      if (getRefactorFlags().USE_NEW_ARCHITECTURE && service) {
        try {
          const storageRepository = new StorageRepository(service);
          const appState = ApplicationState.getInstance();
          await appState.hydrate(storageRepository);

          activityLoggerRef.current?.stop();
          const activityLogger = new ActivityLogger(appState, storageRepository);
          activityLogger.start();
          activityLoggerRef.current = activityLogger;
        } catch (hydrateError) {
          logger.error("Failed to hydrate ApplicationState from storage", {
            error: hydrateError instanceof Error ? hydrateError.message : String(hydrateError),
          });
          // Continue execution even if hydration fails - the app can still function with empty state
        }
      }

      return true;
    } catch (error) {
      logger.error("Failed to connect and load data", {
        error: error instanceof Error ? error.message : String(error),
      });

      const notification = emitFileStorageError({
        operation: hasStoredHandle ? "connectExisting" : "connect",
        error,
        fallbackMessage: "Failed to connect and load existing data. Please try again.",
        toastId: "file-storage-connect-existing",
      });

      if (!notification) {
        return false;
      }
      return false;
    } finally {
      clearFileStorageFlags("inSetupPhase", "inConnectionFlow");

      if (service && !service.getStatus().isRunning) {
        setTimeout(() => {
          service.startAutosave();
        }, 500);
      }

      setTimeout(() => {
        if (window.location.hash === "#connect-to-existing") {
          window.location.hash = "";
        }
      }, 300);
    }
  }, [
    connectToExisting,
    connectToFolder,
    dataManager,
    emitFileStorageError,
    hasStoredHandle,
    loadCases,
    loadExistingData,
    service,
    setCases,
    setError,
    setHasLoadedData,
  ]);

  useEffect(() => {
    if (isSupported === false) {
      setError(
        "File System Access API is not supported in this browser. Please use a modern browser like Chrome, Edge, or Opera.",
      );
      setShowConnectModal(false);
      return;
    }

    if (isSupported === undefined || lifecycle === "uninitialized") {
      return;
    }

    if (isBlocked) {
      setError(
        permissionStatus === "denied"
          ? "Permission denied for the selected directory. Please allow access to continue."
          : "Directory access is currently blocked. Please review permissions and try again.",
      );
      setShowConnectModal(true);
      return;
    }

    if (isErrored && lastError) {
      setError(lastError.message);
    } else if (isReady) {
      setError(null);
    }

    const shouldPromptConnection = !isReady || !isConnected || isAwaitingUserChoice;
    const needsDataLoad = isConnected && !hasLoadedData;

    if (!hasLoadedData && (shouldPromptConnection || needsDataLoad)) {
      setShowConnectModal(true);
    } else if (isReady && hasLoadedData) {
      setShowConnectModal(false);
    }
  }, [
    hasLoadedData,
    isAwaitingUserChoice,
    isBlocked,
    isConnected,
    isErrored,
    isReady,
    isSupported,
    lastError,
    lifecycle,
    permissionStatus,
    setError,
  ]);

  useEffect(() => {
    if (!lastError) {
      return;
    }

    if (lastErrorRef.current === lastError.timestamp) {
      return;
    }

    lastErrorRef.current = lastError.timestamp;

    if (lastError.type === "warning") {
      toast.warning(lastError.message, { id: "file-storage-warning" });
    } else {
      toast.error(lastError.message, { id: "file-storage-error" });
    }
  }, [lastError]);

  useEffect(() => {
    if (isRecovering) {
      toast.info("File storage is reconnecting…", { id: "file-storage-recovering" });
    } else {
      toast.dismiss("file-storage-recovering");
    }
  }, [isRecovering]);

  useEffect(() => {
    return () => {
      if (activityLoggerRef.current) {
        activityLoggerRef.current.stop();
        activityLoggerRef.current = null;
      }
    };
  }, []);

  const dismissConnectModal = useCallback(() => {
    setShowConnectModal(false);
  }, []);

  return {
    showConnectModal,
    handleChooseNewFolder,
    handleConnectToExisting,
    dismissConnectModal,
  };
}
