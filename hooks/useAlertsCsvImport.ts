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
 * Hook for handling alerts CSV import functionality
 * 
 * Orchestrates CSV file selection and import workflow:
 * File picker → Read CSV → Parse and merge with existing alerts → Notify success
 * 
 * **Supported CSV Format:**
 * Expected columns: MCN, Description, Due Date, Priority, Status, etc.
 * Parsed by `dataManager.mergeAlertsFromCsvContent()` which handles format validation
 * 
 * **Import Behavior:**
 * - New alerts added, existing alerts updated based on MCN + description match
 * - Shows summary toast: "2 new · 1 updated • 15 total alerts saved"
 * - Empty file shows info toast, file selection cleared after import
 * 
 * **Error Handling:**
 * - Missing dataManager: Prevents import, shows error toast
 * - Invalid CSV: Catches parse error, displays error message to user
 * - Always clears file input after operation (success or failure)
 * 
 * **Usage Example:**
 * ```typescript
 * const csvImport = useAlertsCsvImport({
 *   dataManager: dm,
 *   cases: allCases,
 *   onAlertsCsvImported: (alertsIndex) => {
 *     // Called after successful import with refreshed alerts index
 *     setAlertsIndex(alertsIndex);
 *   }
 * });
 * 
 * // Render hidden file input
 * <input
 *   ref={csvImport.fileInputRef}
 *   type="file"
 *   accept=".csv"
 *   onChange={csvImport.handleFileSelected}
 *   hidden
 * />
 * 
 * // Render button
 * <button onClick={csvImport.handleButtonClick} disabled={csvImport.isImporting}>
 *   {csvImport.isImporting ? "Importing..." : "Import Alerts"}
 * </button>
 * ```
 * 
 * @param {UseAlertsCsvImportParams} params
 *   - `dataManager`: Alert merge service (null = import disabled)
 *   - `cases`: All cases for alert matching context
 *   - `onAlertsCsvImported`: Callback with refreshed AlertsIndex after import
 * 
 * @returns {UseAlertsCsvImportReturn} Import control interface:
 * - `isImporting`: Boolean loading state
 * - `fileInputRef`: Ref to attach to <input type="file" />
 * - `handleButtonClick()`: Trigger file picker
 * - `handleFileSelected(event)`: Process selected file (attach to input onChange)
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
