import { useCallback } from "react";
import { toast } from "sonner";
import { useIsMounted } from "./useIsMounted";
import type { StoredCase } from "../types/case";
import type AutosaveFileService from "../utils/AutosaveFileService";
import type DataManager from "../utils/DataManager";
import { clearFileStorageFlags, updateFileStorageFlags } from "../utils/fileStorageFlags";
import { reportFileStorageError } from "../utils/fileStorageErrorReporter";
import { createLogger } from "@/utils/logger";

const logger = createLogger("ConnectionHandlers");

export interface ConnectionHandlersParams {
  isSupported: boolean | undefined;
  hasStoredHandle: boolean;
  connectToFolder: () => Promise<boolean>;
  connectToExisting: () => Promise<boolean>;
  loadExistingData: () => Promise<any>;
  service: AutosaveFileService | null;
  dataManager: DataManager | null;
  loadCases: () => Promise<StoredCase[]>;
  setCases: React.Dispatch<React.SetStateAction<StoredCase[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setHasLoadedData: React.Dispatch<React.SetStateAction<boolean>>;
  setShowConnectModal: React.Dispatch<React.SetStateAction<boolean>>;
}

/** Provides handlers for folder connection operations. */
export function useConnectionHandlers(params: ConnectionHandlersParams) {
  const { isSupported, hasStoredHandle, connectToFolder, connectToExisting, loadExistingData, service, dataManager, loadCases, setCases, setError, setHasLoadedData, setShowConnectModal } = params;
  const isMounted = useIsMounted();

  const emitError = useCallback((options: Parameters<typeof reportFileStorageError>[0]) => {
    const notification = reportFileStorageError(options);
    if (notification && notification.type !== "info") setError(notification.message);
    return notification;
  }, [setError]);

  const finalizeConnection = useCallback((cases: StoredCase[], toastMsg: string, toastId: string) => {
    if (cases.length > 0) {
      updateFileStorageFlags({ dataBaseline: true, sessionHadData: true });
    } else {
      setCases([]);
      updateFileStorageFlags({ dataBaseline: true });
    }
    setHasLoadedData(true);
    setShowConnectModal(false);
    toast.success(toastMsg, { id: toastId, duration: 3000 });
  }, [setCases, setHasLoadedData, setShowConnectModal]);

  const handleChooseNewFolder = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      emitError({ operation: "connect", messageOverride: "File System Access API is not supported", severity: "warning", toastId: "file-storage-unsupported" });
      return false;
    }
    setError(null);
    try {
      if (!await connectToFolder()) {
        emitError({ operation: "connect", messageOverride: "Failed to connect to new folder", toastId: "file-storage-connect-new" });
        return false;
      }
      await new Promise(r => setTimeout(r, 150));
      if (!isMounted.current) return false;

      let existingData: any = null;
      try { existingData = await loadExistingData(); } catch (e) { logger.error("Error loading existing data", { error: String(e) }); }

      if (existingData && Object.keys(existingData).length > 0) {
        const loadedCases = await loadCases();
        if (!isMounted.current) return false;
        const msg = loadedCases.length > 0 ? `Connected and loaded ${loadedCases.length} cases from new folder` : "Connected to folder with empty data file - ready to add cases!";
        finalizeConnection(loadedCases, msg, "new-folder-success");
      } else {
        toast.success("Connected to new folder successfully! Ready to start managing cases.");
        setHasLoadedData(true);
        setShowConnectModal(false);
      }
      service?.notifyDataChange?.();
      return true;
    } catch (err) {
      logger.error("handleChooseNewFolder failed", { error: String(err) });
      emitError({ operation: "connect", error: err, fallbackMessage: "Failed to connect to new folder", toastId: "file-storage-connect-new" });
      return false;
    }
  }, [connectToFolder, emitError, finalizeConnection, isMounted, isSupported, loadCases, loadExistingData, service, setError, setHasLoadedData, setShowConnectModal]);

  const handleConnectToExisting = useCallback(async (): Promise<boolean> => {
    window.location.hash = "#connect-to-existing";
    updateFileStorageFlags({ inSetupPhase: true, inConnectionFlow: true });
    try {
      if (!dataManager) {
        emitError({ operation: "connectExisting", messageOverride: "Data storage is not available. Please connect to a folder first.", toastId: "file-storage-data-manager" });
        return false;
      }
      setError(null);
      const success = hasStoredHandle ? await connectToExisting() : await connectToFolder();
      if (!success) {
        emitError({ operation: hasStoredHandle ? "connectExisting" : "connect", messageOverride: "Failed to connect to directory", toastId: "file-storage-connect-existing" });
        return false;
      }
      await new Promise(r => setTimeout(r, 150));
      try { await loadExistingData(); } catch (e) { throw new Error(`Failed to access connected directory: ${e instanceof Error ? e.message : "Unknown"}`); }

      const loadedCases = await loadCases();
      if (!isMounted.current) return false;
      const msg = loadedCases.length > 0 ? `Connected and loaded ${loadedCases.length} cases` : "Connected successfully - ready to start fresh";
      finalizeConnection(loadedCases, msg, loadedCases.length > 0 ? "connection-success" : "connection-empty");
      return true;
    } catch (error) {
      logger.error("Failed to connect and load data", { error: String(error) });
      emitError({ operation: hasStoredHandle ? "connectExisting" : "connect", error, fallbackMessage: "Failed to connect and load existing data.", toastId: "file-storage-connect-existing" });
      return false;
    } finally {
      clearFileStorageFlags("inSetupPhase", "inConnectionFlow");
      if (service && !service.getStatus().isRunning) {
        setTimeout(() => {
          if (isMounted.current) service.startAutosave();
        }, 500);
      }
      setTimeout(() => {
        if (isMounted.current && window.location.hash === "#connect-to-existing") {
          window.location.hash = "";
        }
      }, 300);
    }
  }, [connectToExisting, connectToFolder, dataManager, emitError, finalizeConnection, hasStoredHandle, isMounted, loadCases, loadExistingData, service, setError]);

  return { handleChooseNewFolder, handleConnectToExisting };
}
