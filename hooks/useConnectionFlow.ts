import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { StoredCase } from "../types/case";
import type AutosaveFileService from "../utils/AutosaveFileService";
import type { FileStorageService } from "@/utils/services/FileStorageService";
import type DataManager from "../utils/DataManager";
import type { FileStorageLifecycleSelectors } from "../contexts/FileStorageContext";
import { useConnectionHandlers } from "./useConnectionHandlers";

interface UseConnectionFlowParams {
  isSupported: boolean | undefined;
  hasLoadedData: boolean;
  connectionState: FileStorageLifecycleSelectors;
  connectToFolder: () => Promise<boolean>;
  connectToExisting: () => Promise<boolean>;
  loadExistingData: () => Promise<any>;
  service: AutosaveFileService | null;
  fileStorageService: FileStorageService | null;
  dataManager: DataManager | null;
  loadCases: () => Promise<StoredCase[]>;
  setCases: React.Dispatch<React.SetStateAction<StoredCase[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setHasLoadedData: React.Dispatch<React.SetStateAction<boolean>>;
}

interface UseConnectionFlowResult {
  showConnectModal: boolean;
  handleChooseNewFolder: () => Promise<boolean>;
  handleConnectToExisting: () => Promise<boolean>;
  dismissConnectModal: () => void;
}

/**
 * Manages file storage connection flow and modal visibility.
 * 
 * Delegates connection operations to useConnectionHandlers.
 * Handles modal state, error syncing, and recovery notifications.
 */
export function useConnectionFlow({
  isSupported,
  hasLoadedData,
  connectionState,
  connectToFolder,
  connectToExisting,
  loadExistingData,
  service,
  fileStorageService: _fileStorageService,
  dataManager,
  loadCases,
  setCases,
  setError,
  setHasLoadedData,
}: UseConnectionFlowParams): UseConnectionFlowResult {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const lastErrorRef = useRef<number | null>(null);

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

  // Connection handlers
  const { handleChooseNewFolder, handleConnectToExisting } = useConnectionHandlers({
    isSupported,
    hasStoredHandle,
    connectToFolder,
    connectToExisting,
    loadExistingData,
    service,
    dataManager,
    loadCases,
    setCases,
    setError,
    setHasLoadedData,
    setShowConnectModal,
  });

  // Modal visibility and error sync effect
  useEffect(() => {
    if (isSupported === false) {
      setError("File System Access API is not supported in this browser. Please use a modern browser like Chrome, Edge, or Opera.");
      setShowConnectModal(false);
      return;
    }

    if (isSupported === undefined || lifecycle === "uninitialized") return;

    if (isBlocked) {
      setError(
        permissionStatus === "denied"
          ? "Permission denied for the selected directory. Please allow access to continue."
          : "Directory access is currently blocked. Please review permissions and try again."
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
  }, [hasLoadedData, isAwaitingUserChoice, isBlocked, isConnected, isErrored, isReady, isSupported, lastError, lifecycle, permissionStatus, setError]);

  // Error toast effect
  useEffect(() => {
    if (!lastError || lastErrorRef.current === lastError.timestamp) return;
    lastErrorRef.current = lastError.timestamp;
    if (lastError.type === "warning") {
      toast.warning(lastError.message, { id: "file-storage-warning" });
    } else {
      toast.error(lastError.message, { id: "file-storage-error" });
    }
  }, [lastError]);

  // Recovery status toast effect
  useEffect(() => {
    if (isRecovering) {
      toast.info("File storage is reconnecting…", { id: "file-storage-recovering" });
    } else {
      toast.dismiss("file-storage-recovering");
    }
  }, [isRecovering]);

  const dismissConnectModal = useCallback(() => setShowConnectModal(false), []);

  return { showConnectModal, handleChooseNewFolder, handleConnectToExisting, dismissConnectModal };
}
