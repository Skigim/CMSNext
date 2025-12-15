import { useRef, useState, useCallback, type ChangeEvent, type RefObject } from "react";
import { toast } from "sonner";
import type { DataManager } from "@/utils/DataManager";
import type { StoredCase } from "@/types/case";
import type { AlertsIndex } from "@/utils/alertsData";

interface UseAlertsCsvImportParams {
  dataManager: DataManager | null;
  cases: StoredCase[];
  onAlertsCsvImported?: (index: AlertsIndex) => void;
}

interface UseAlertsCsvImportReturn {
  isImporting: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  handleButtonClick: () => void;
  handleFileSelected: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

/**
 * Hook for handling alerts CSV import functionality.
 * Extracts the CSV import logic from Settings for reusability and cleaner code.
 */
export function useAlertsCsvImport({
  dataManager,
  cases,
  onAlertsCsvImported,
}: UseAlertsCsvImportParams): UseAlertsCsvImportReturn {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = useCallback(() => {
    if (!dataManager) {
      toast.error("Connect a storage folder before importing alerts.");
      return;
    }
    fileInputRef.current?.click();
  }, [dataManager]);

  const handleFileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const file = input.files?.[0];

      if (!file) {
        return;
      }

      if (!dataManager) {
        toast.error("Alerts service isn't available yet. Connect storage and try again.");
        input.value = "";
        return;
      }

      setIsImporting(true);

      try {
        const csvText = await file.text();
        if (!csvText.trim()) {
          toast.info("No alerts detected", {
            description: `${file.name} is empty.`,
          });
          return;
        }

        const result = await dataManager.mergeAlertsFromCsvContent(csvText, {
          cases,
          sourceFileName: file.name,
        });

        const refreshedIndex = await dataManager.getAlertsIndex({ cases });
        onAlertsCsvImported?.(refreshedIndex);

        if (result.added === 0 && result.updated === 0) {
          toast.info("No new alerts found", {
            description: `${file.name} didn't include new or updated alerts. Still tracking ${result.total} alerts.`,
          });
        } else {
          const descriptionParts = [
            result.added > 0 ? `${result.added} new` : null,
            result.updated > 0 ? `${result.updated} updated` : null,
          ].filter(Boolean) as string[];

          toast.success("Alerts updated", {
            description: `${descriptionParts.join(" · ")} • ${result.total} total alerts saved`,
          });
        }
      } catch (error) {
        console.error("Failed to import alerts from CSV:", error);
        toast.error("Failed to import alerts", {
          description: error instanceof Error ? error.message : "Please verify the file and try again.",
        });
      } finally {
        setIsImporting(false);
        input.value = "";
      }
    },
    [dataManager, cases, onAlertsCsvImported]
  );

  return {
    isImporting,
    fileInputRef,
    handleButtonClick,
    handleFileSelected,
  };
}
