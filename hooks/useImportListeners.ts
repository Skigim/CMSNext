import { useEffect } from "react";
import { toast } from "sonner";

interface UseImportListenersParams {
  loadCases: () => Promise<unknown>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * Centralizes window-level file import listeners to keep App.tsx lean.
 *
 * Responsibilities:
 * - Reload cases after successful imports unless the connection flow is active
 * - Surface import errors consistently via toast + error banner
 * - Automatically cleans up listeners on unmount
 */
export function useImportListeners({ loadCases, setError }: UseImportListenersParams) {
  useEffect(() => {
    const handleFileImported = () => {
      // Skip automatic reloads during the connect-to-existing flow
      if (window.location.hash === "#connect-to-existing") {
        return;
      }

      void loadCases();
      setError(null);
    };

    const handleFileImportError = (event: Event) => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== "string") {
        const fallbackMessage = "Failed to import data. Please try again.";
        setError(fallbackMessage);
        toast.error(fallbackMessage);
        return;
      }

      setError(event.detail);
      toast.error(event.detail);
    };

    window.addEventListener("fileDataImported", handleFileImported);
    window.addEventListener("fileImportError", handleFileImportError as EventListener);

    return () => {
      window.removeEventListener("fileDataImported", handleFileImported);
      window.removeEventListener("fileImportError", handleFileImportError as EventListener);
    };
  }, [loadCases, setError]);
}
