import type { StatusConfig } from "@/types/categoryConfig";
import { autoAssignColorSlot, type ColorSlot } from "@/types/colorSlots";
import type { CaseStatusUpdate } from "./matching";

export interface StatusImportPlan {
  newStatuses: StatusConfig[];
  statusUpdatesByStatus: Map<string, string[]>;
  updatedCaseCount: number;
}

const IMPORTED_STATUS_ABBREVIATIONS: Readonly<Record<string, string>> = {
  PE: "Pending",
  AC: "Approved",
  SP: "Withdrawn",
  CL: "Withdrawn",
  DE: "Denied",
};

const IMPORTED_STATUS_LABELS: Readonly<Record<string, string>> = {
  active: "Pending",
  pending: "Pending",
  received: "Pending",
  approved: "Approved",
  denied: "Denied",
  closed: "Withdrawn",
  withdrawn: "Withdrawn",
  spenddown: "Withdrawn",
};

const CONFIG_STATUS_ALIASES: Readonly<Record<string, readonly string[]>> = {
  Pending: ["Pending", "Active", "Received"],
  Approved: ["Approved"],
  Denied: ["Denied"],
  Withdrawn: ["Withdrawn", "Closed", "Spenddown"],
};

function normalizeImportedStatusLabel(rawStatus: string): string {
  const trimmedStatus = rawStatus.trim();
  if (trimmedStatus.length === 0) {
    return trimmedStatus;
  }

  return (
    IMPORTED_STATUS_ABBREVIATIONS[trimmedStatus.toUpperCase()] ??
    IMPORTED_STATUS_LABELS[trimmedStatus.toLowerCase()] ??
    trimmedStatus
  );
}

function findConfiguredStatusByAliases(
  existingStatuses: StatusConfig[],
  aliases: readonly string[],
): string | undefined {
  const existingNames = new Map(
    existingStatuses.map(statusConfig => [statusConfig.name.toLowerCase(), statusConfig.name] as const),
  );

  for (const alias of aliases) {
    const configuredStatus = existingNames.get(alias.toLowerCase());
    if (configuredStatus) {
      return configuredStatus;
    }
  }

  return undefined;
}

export function resolveImportedStatusForConfig(
  rawStatus: string,
  existingStatuses: StatusConfig[],
): string {
  const trimmedStatus = rawStatus.trim();
  if (trimmedStatus.length === 0) {
    return trimmedStatus;
  }

  const normalizedLabel = normalizeImportedStatusLabel(trimmedStatus);
  const normalizedAliases = CONFIG_STATUS_ALIASES[normalizedLabel] ?? [normalizedLabel];

  const exactConfiguredStatus = findConfiguredStatusByAliases(existingStatuses, [trimmedStatus, normalizedLabel]);
  if (exactConfiguredStatus) {
    return exactConfiguredStatus;
  }

  const aliasedConfiguredStatus = findConfiguredStatusByAliases(existingStatuses, normalizedAliases);
  if (aliasedConfiguredStatus) {
    return aliasedConfiguredStatus;
  }

  if (normalizedLabel === "Pending") {
    const firstConfiguredOpenStatus = existingStatuses.find(
      statusConfig => statusConfig.countsAsCompleted !== true,
    );

    if (firstConfiguredOpenStatus) {
      return firstConfiguredOpenStatus.name;
    }
  }

  return normalizedLabel;
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
    const canonicalStatus = resolveImportedStatusForConfig(
      update.importedStatus,
      [...existingStatuses, ...newStatuses],
    );
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
