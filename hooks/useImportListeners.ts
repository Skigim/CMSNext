import { useEffect } from "react";
import { reportFileStorageError } from "@/utils/fileStorageErrorReporter";

interface UseImportListenersParams {
  loadCases: () => Promise<unknown>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  isStorageReady: boolean;
}

/**
 * Hook for managing window-level file import event listeners
 * 
 * Centralizes import event handling to keep App.tsx clean.
 * Listens for custom events from file import workflows and updates app state.
 * 
 * **Custom Events:**
 * - `file-imported`: Successful file/data import
 *   - Reloads cases if storage ready and not in connect flow
 *   - Clears error state on success
 * 
 * - `file-import-error`: Import failure
 *   - Reports error via reportFileStorageError utility
 *   - Shows toast + sets error banner message
 *   - Extracts detailed message from event.detail if available
 * 
 * **Connect Flow Skip:**
 * - When location.hash === \"#connect-to-existing\"
 * - Skips auto-reload to avoid interrupting user setup
 * 
 * **Error Reporting:**
 * - Uses fileStorageErrorReporter for consistent error display
 * - Shows operation context (\"importCases\")
 * - Extracts event detail message if provided
 * - Falls back to default message if detail unavailable
 * 
 * **Lifecycle:**
 * - Installs listeners on mount
 * - Automatically cleans up on unmount
 * - Safe to call multiple times (idempotent setup)
 * 
 * **Usage Example:**
 * ```typescript
 * useImportListeners({\n *   loadCases: async () => {\n *     const cases = await dataManager.getAllCases();\n *     setCases(cases);\n *   },\n *   setError,\n *   isStorageReady: connectionState.isReady\n * });\n * \n * // Somewhere else in app:
 * // After file import completes:\n * window.dispatchEvent(new Event(\"file-imported\"));\n * // Or on error:
 * window.dispatchEvent(new CustomEvent(\"file-import-error\", {\n *   detail: \"CSV file has invalid format\"\n * }));\n * ```
 * 
 * @param {UseImportListenersParams} params
 *   - `loadCases`: Async function to fetch and set cases
 *   - `setError`: Error state setter for banner display
 *   - `isStorageReady`: Flag to check before auto-reload
 * 
 * @returns {void} No return value, side effect only
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
