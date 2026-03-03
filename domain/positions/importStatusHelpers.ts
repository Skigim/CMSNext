import type { StatusConfig } from "@/types/categoryConfig";
import { autoAssignColorSlot, type ColorSlot } from "@/types/colorSlots";
import type { CaseStatusUpdate } from "./matching";

export interface StatusImportPlan {
  newStatuses: StatusConfig[];
  statusUpdatesByStatus: Map<string, string[]>;
  updatedCaseCount: number;
}

/**
 * Build a canonicalized status update plan for position assignment imports.
 */
export function buildStatusImportPlan(
  selectedUpdates: CaseStatusUpdate[],
  existingStatuses: StatusConfig[]
): StatusImportPlan {
  const existingNames = new Map(
    existingStatuses.map(statusConfig => [statusConfig.name.toLowerCase(), statusConfig.name] as const)
  );
  const usedSlots = new Set<ColorSlot>(existingStatuses.map(statusConfig => statusConfig.colorSlot));
  const newStatuses: StatusConfig[] = [];
  const statusUpdatesByStatus = new Map<string, string[]>();

  for (const update of selectedUpdates) {
    const trimmedImportedStatus = update.importedStatus.trim();
    const canonicalStatus =
      existingNames.get(trimmedImportedStatus.toLowerCase()) ?? trimmedImportedStatus;
    const canonicalKey = canonicalStatus.toLowerCase();

    if (!existingNames.has(canonicalKey)) {
      const colorSlot = autoAssignColorSlot(canonicalStatus, usedSlots);
      usedSlots.add(colorSlot);
      newStatuses.push({ name: canonicalStatus, colorSlot });
      existingNames.set(canonicalKey, canonicalStatus);
    }

    const ids = statusUpdatesByStatus.get(canonicalStatus) ?? [];
    ids.push(update.case.id);
    statusUpdatesByStatus.set(canonicalStatus, ids);
  }

  return {
    newStatuses,
    statusUpdatesByStatus,
    updatedCaseCount: selectedUpdates.length,
  };
}
