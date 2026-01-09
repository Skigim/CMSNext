import { StoredCase } from "@/types/case";
import { toast } from "sonner";
import { toLocalDateString } from "@/domain/common";

/**
 * Export cases data to a JSON file
 * Downloads a JSON file with all cases data
 */
export function exportCasesToJSON(cases: StoredCase[]): void {
  try {
    const dataToExport = {
      exported_at: new Date().toISOString(),
      total_cases: cases.length,
      cases: cases,
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `case-tracker-export-${toLocalDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Successfully exported ${cases.length} cases to JSON file`);
  } catch (error) {
    console.error("Export failed:", error);
    toast.error("Failed to export data. Please try again.");
  }
}

/**
 * Trigger file input for importing data
 * This is a placeholder - full implementation would need DataManager integration
 */
export function triggerImportDialog(): void {
  toast.info("Import functionality coming soon. Use Settings > Data to import legacy data.");
}

/**
 * Trigger file input for importing alerts CSV
 * This is a placeholder - should be wired to the actual CSV import flow
 */
export function triggerAlertsCsvImport(): void {
  toast.info("Please use Settings > Data to import alerts from CSV.");
}
