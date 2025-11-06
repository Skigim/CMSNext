import { useEffect } from "react";
import { reportFileStorageError } from "@/utils/fileStorageErrorReporter";

interface UseImportListenersParams {
  loadCases: () => Promise<unknown>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  isStorageReady: boolean;
}

/**
 * Centralizes window-level file import listeners to keep App.tsx lean.
 *
 * Responsibilities:
 * - Reload cases after successful imports unless the connection flow is active
 * - Surface import errors consistently via toast + error banner
 * - Automatically cleans up listeners on unmount
 */
export function useImportListeners({ loadCases, setError, isStorageReady }: UseImportListenersParams) {
  useEffect(() => {
    const handleFileImported = () => {
      // Skip automatic reloads during the connect-to-existing flow
      if (window.location.hash === "#connect-to-existing") {
        return;
      }

      if (!isStorageReady) {
        return;
      }

      void loadCases();
      setError(null);
    };

    const handleFileImportError = (event: Event) => {
      const fallbackMessage = "Failed to import data. Please try again.";
      const detailMessage = event instanceof CustomEvent && typeof event.detail === "string"
        ? event.detail
        : undefined;

      const notification = reportFileStorageError({
        operation: "importCases",
        severity: "error",
        source: "useImportListeners",
        messageOverride: detailMessage,
        fallbackMessage,
        toastId: "file-storage-import",
      });

      setError(notification?.message ?? detailMessage ?? fallbackMessage);
    };

    window.addEventListener("fileDataImported", handleFileImported);
    window.addEventListener("fileImportError", handleFileImportError as EventListener);

    return () => {
      window.removeEventListener("fileDataImported", handleFileImported);
      window.removeEventListener("fileImportError", handleFileImportError as EventListener);
    };
  }, [isStorageReady, loadCases, setError]);
}
