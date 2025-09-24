import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { CaseDisplay } from "../types/case";
import type AutosaveFileService from "../utils/AutosaveFileService";
import {
  clearFileStorageFlags,
  updateFileStorageFlags,
} from "../utils/fileStorageFlags";

interface UseConnectionFlowParams {
  isSupported: boolean | undefined;
  isConnected: boolean;
  hasStoredHandle: boolean;
  hasLoadedData: boolean;
  connectToFolder: () => Promise<boolean>;
  connectToExisting: () => Promise<boolean>;
  loadExistingData: () => Promise<any>;
  service: AutosaveFileService | null;
  dataManager: unknown;
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
}: UseConnectionFlowParams): UseConnectionFlowResult {
  const [showConnectModal, setShowConnectModal] = useState(false);

  const handleChooseNewFolder = useCallback(async (): Promise<boolean> => {
    try {
      if (!isSupported) {
        toast.error("File System Access API is not supported in this browser");
        return false;
      }

      setError(null);

      const success = await connectToFolder();
      if (!success) {
        toast.error("Failed to connect to new folder");
        return false;
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      let existingData: any;
      try {
        existingData = await loadExistingData();
      } catch (loadError) {
        console.error("[ConnectionFlow] Error loading existing data:", loadError);
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
          console.error("[ConnectionFlow] Error loading cases from new folder:", err);
          toast.error("Connected to folder but failed to load case data");
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
      console.error("[ConnectionFlow] handleChooseNewFolder error:", err);
      toast.error("Failed to connect to new folder");
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
  ]);

  const handleConnectToExisting = useCallback(async (): Promise<boolean> => {
    try {
      window.location.hash = "#connect-to-existing";
      updateFileStorageFlags({ inSetupPhase: true, inConnectionFlow: true });

      if (!dataManager) {
        console.error("[ConnectionFlow] DataManager not available");
        toast.error("Data storage is not available. Please connect to a folder first.");
        return false;
      }

      setError(null);

      const success = hasStoredHandle ? await connectToExisting() : await connectToFolder();
      if (!success) {
        toast.error("Failed to connect to directory");
        return false;
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      let existingData: any;
      try {
        existingData = await loadExistingData();
      } catch (loadError) {
        console.error("[ConnectionFlow] Failed to load existing data:", loadError);
        throw new Error(
          `Failed to access connected directory: ${
            loadError instanceof Error ? loadError.message : "Unknown error"
          }`,
        );
      }

      const actualData =
        existingData || ({ exported_at: new Date().toISOString(), total_cases: 0, cases: [] } as const);

      console.log(
        "[ConnectionFlow] About to load data. Expected records:",
        actualData?.cases?.length || actualData?.caseRecords?.length || 0,
      );

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

      return true;
    } catch (error) {
      console.error("[ConnectionFlow] Failed to connect and load data:", error);

      let errorMsg = "Failed to connect and load existing data. Please try again.";
      if (error instanceof Error) {
        if (error.message.includes("User activation")) {
          errorMsg = "Directory selection was cancelled. Please try again.";
        } else if (error.message.includes("permission")) {
          errorMsg = "Permission denied for the selected directory. Please choose a different folder.";
        } else if (error.message.includes("connection")) {
          errorMsg = "Lost connection to directory. Please reconnect and try again.";
        } else if (error.message.includes("AbortError")) {
          errorMsg = "Directory selection was cancelled.";
          return false;
        }
      }

      setError(errorMsg);
      toast.error(errorMsg);
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
    hasStoredHandle,
    loadCases,
    loadExistingData,
    service,
    setCases,
    setError,
    setHasLoadedData,
  ]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isSupported === false) {
        setError(
          "File System Access API is not supported in this browser. Please use a modern browser like Chrome, Edge, or Opera.",
        );
        return;
      }

      if (isSupported === undefined) {
        return;
      }

      if (isSupported && !isConnected && !hasLoadedData) {
        setShowConnectModal(true);
      } else if (isConnected && !hasLoadedData) {
        setShowConnectModal(true);
      } else if (isConnected && hasLoadedData) {
        setShowConnectModal(false);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [hasLoadedData, isConnected, isSupported, setError]);

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
