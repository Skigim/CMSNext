/**
 * Alert Domain Module - Core Business Logic
 *
 * Pure functions for alert matching, filtering, and indexing.
 * No I/O, no external dependencies beyond types.
 *
 * @module domain/alerts/matching
 */

import type { AlertRecord } from "@/types/case";
import type {
  AlertsIndex,
  AlertsSummary,
  AlertWithMatch,
  CaseForAlertMatching,
} from "./types";
import { workflowPriorityOrder } from "./types";

/**
 * Check if an alert is resolved
 */
export function isAlertResolved(
  alert:
    | Pick<AlertRecord, "status" | "resolvedAt">
    | AlertWithMatch
    | null
    | undefined
): boolean {
  if (!alert) {
    return false;
  }

  const normalizedStatus =
    typeof alert.status === "string" ? alert.status.toLowerCase() : undefined;
  if (normalizedStatus === "resolved") {
    return true;
  }

  if (alert.resolvedAt) {
    return String(alert.resolvedAt).trim().length > 0;
  }

  return false;
}

/**
 * Filter to only open (non-resolved) alerts
 */
export function filterOpenAlerts<
  T extends Pick<AlertRecord, "status" | "resolvedAt">,
>(alerts: T[] | null | undefined): T[] {
  if (!alerts || alerts.length === 0) {
    return [];
  }

  return alerts.filter((alert) => !isAlertResolved(alert));
}

/**
 * Normalize MCN for consistent matching
 */
export function normalizeMcn(rawMcn: string | undefined | null): string {
  if (!rawMcn) {
    return "";
  }
  return rawMcn.replaceAll(/[^a-z0-9]/gi, "").trim().toUpperCase();
}

/**
 * Create an empty alerts index
 */
export function createEmptyAlertsIndex(): AlertsIndex {
  return {
    alerts: [],
    summary: {
      total: 0,
      matched: 0,
      unmatched: 0,
      missingMcn: 0,
      latestUpdated: null,
    },
    alertsByCaseId: new Map(),
    unmatched: [],
    missingMcn: [],
  };
}

/**
 * Build a lookup map of cases by normalized MCN
 */
export function buildCaseMap(
  cases: CaseForAlertMatching[]
): Map<string, CaseForAlertMatching> {
  const map = new Map<string, CaseForAlertMatching>();

  cases.forEach((caseItem) => {
    const mcn = caseItem.caseRecord?.mcn ?? caseItem.mcn;
    const normalized = normalizeMcn(mcn);
    if (!normalized) {
      return;
    }

    if (!map.has(normalized)) {
      map.set(normalized, caseItem);
    }
  });

  return map;
}

/**
 * Produces the canonical storage key for an alert by combining its base identifier with
 * discriminators that differentiate stacked CSV entries.
 */
export function buildAlertStorageKey(alert: AlertWithMatch): string | null {
  if (!alert) {
    return null;
  }

  const baseId = alert.reportId?.trim() || alert.id?.trim();
  if (!baseId) {
    return null;
  }

  const normalizedMcn = normalizeMcn(alert.mcNumber ?? undefined);
  const normalizedName = alert.personName?.trim().toLowerCase() ?? "";
  const normalizedProgram = alert.program?.trim().toLowerCase() ?? "";
  const normalizedType = alert.alertType?.trim().toLowerCase() ?? "";
  const normalizedDescription = alert.description?.trim().toLowerCase() ?? "";
  const normalizedStatus = alert.matchStatus ?? "";

  const dateSource =
    alert.alertDate || alert.updatedAt || alert.createdAt || "";
  let normalizedDate = "";
  if (dateSource) {
    const parsed = new Date(dateSource);
    normalizedDate = Number.isNaN(parsed.getTime())
      ? dateSource
      : parsed.toISOString().slice(0, 10);
  }

  const discriminator = [
    normalizedMcn,
    normalizedName,
    normalizedProgram,
    normalizedType,
    normalizedDescription,
    normalizedStatus,
    normalizedDate,
  ]
    .filter(Boolean)
    .join("|");

  return discriminator.length > 0 ? `${baseId}|${discriminator}` : baseId;
}

/**
 * Generate a random alert ID
 */
export function createRandomAlertId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `alert-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Sort alerts by date (newest first)
 */
export function sortAlerts(alerts: AlertWithMatch[]): AlertWithMatch[] {
  return [...alerts].sort((a, b) => {
    const timeA = new Date(a.alertDate || a.createdAt || "").getTime();
    const timeB = new Date(b.alertDate || b.createdAt || "").getTime();

    if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
      return timeB - timeA;
    }

    if (!Number.isNaN(timeA)) {
      return -1;
    }

    if (!Number.isNaN(timeB)) {
      return 1;
    }

    return 0;
  });
}

/**
 * Get workflow priority for alert status
 */
function getWorkflowPriority(status: AlertWithMatch["status"]): number {
  const normalized = status ?? "new";
  const index = workflowPriorityOrder.indexOf(normalized);
  return index === -1 ? 0 : index;
}

/**
 * Get chronology score for an alert
 */
function getChronologyScore(alert: AlertWithMatch): number {
  const timestampSources = [alert.updatedAt, alert.createdAt, alert.alertDate];
  for (const candidate of timestampSources) {
    if (!candidate) {
      continue;
    }

    const value = new Date(candidate).getTime();
    if (!Number.isNaN(value)) {
      return value;
    }
  }

  return 0;
}

/**
 * Merge duplicate alerts, keeping the most relevant data
 */
export function mergeDuplicateAlerts(
  existing: AlertWithMatch,
  incoming: AlertWithMatch
): AlertWithMatch {
  if (!existing) {
    return incoming;
  }

  if (!incoming) {
    return existing;
  }

  const existingPriority = getWorkflowPriority(existing.status);
  const incomingPriority = getWorkflowPriority(incoming.status);

  let winner = existing;
  let fallback = incoming;

  if (incomingPriority > existingPriority) {
    winner = incoming;
    fallback = existing;
  } else if (incomingPriority === existingPriority) {
    const incomingChronology = getChronologyScore(incoming);
    const existingChronology = getChronologyScore(existing);
    if (incomingChronology > existingChronology) {
      winner = incoming;
      fallback = existing;
    }
  }

  const mergedMetadata = {
    ...fallback.metadata,
    ...winner.metadata,
  };

  return {
    ...fallback,
    ...winner,
    metadata:
      Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
    resolvedAt: winner.resolvedAt ?? fallback.resolvedAt ?? null,
    resolutionNotes: winner.resolutionNotes ?? fallback.resolutionNotes,
    mcNumber: winner.mcNumber ?? fallback.mcNumber,
    matchedCaseId: winner.matchedCaseId ?? fallback.matchedCaseId,
    matchedCaseName: winner.matchedCaseName ?? fallback.matchedCaseName,
    matchedCaseStatus: winner.matchedCaseStatus ?? fallback.matchedCaseStatus,
    updatedAt: winner.updatedAt ?? fallback.updatedAt,
    createdAt: winner.createdAt ?? fallback.createdAt,
    alertDate: winner.alertDate ?? fallback.alertDate,
  };
}

/**
 * Deduplicate alerts by storage key
 */
export function dedupeAlerts(alerts: AlertWithMatch[]): AlertWithMatch[] {
  if (!alerts || alerts.length === 0) {
    return [];
  }

  const deduped = new Map<string, AlertWithMatch>();
  const passthrough: AlertWithMatch[] = [];

  alerts.forEach((alert) => {
    const key = buildAlertStorageKey(alert);
    if (!key) {
      passthrough.push(alert);
      return;
    }

    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, alert);
      return;
    }

    deduped.set(key, mergeDuplicateAlerts(existing, alert));
  });

  return [...deduped.values(), ...passthrough];
}

/**
 * Create an AlertsIndex from an array of alerts
 */
export function createAlertsIndexFromAlerts(
  alertsInput: AlertWithMatch[]
): AlertsIndex {
  const dedupedAlerts = dedupeAlerts(alertsInput);
  const sortedAlerts = sortAlerts(dedupedAlerts);

  const alertsByCaseId = new Map<string, AlertWithMatch[]>();
  const summary: AlertsSummary = {
    total: sortedAlerts.length,
    matched: 0,
    unmatched: 0,
    missingMcn: 0,
    latestUpdated: null,
  };

  sortedAlerts.forEach((alert) => {
    if (alert.matchStatus === "matched" && alert.matchedCaseId) {
      if (!alertsByCaseId.has(alert.matchedCaseId)) {
        alertsByCaseId.set(alert.matchedCaseId, []);
      }
      alertsByCaseId.get(alert.matchedCaseId)!.push(alert);
      summary.matched += 1;
    } else if (alert.matchStatus === "unmatched") {
      summary.unmatched += 1;
    } else {
      summary.missingMcn += 1;
    }

    const updatedTime = new Date(
      alert.updatedAt || alert.createdAt || ""
    ).getTime();
    if (!Number.isNaN(updatedTime)) {
      if (
        !summary.latestUpdated ||
        updatedTime > new Date(summary.latestUpdated).getTime()
      ) {
        summary.latestUpdated = new Date(updatedTime).toISOString();
      }
    }
  });

  return {
    alerts: sortedAlerts,
    summary: {
      ...summary,
      total: sortedAlerts.length,
    },
    alertsByCaseId,
    unmatched: sortedAlerts.filter((alert) => alert.matchStatus === "unmatched"),
    missingMcn: sortedAlerts.filter(
      (alert) => alert.matchStatus === "missing-mcn"
    ),
  };
}

/**
 * Converts a string to proper title case.
 */
function toProperCase(str: string): string {
  if (!str) return "";

  return str
    .toLowerCase()
    .replaceAll(/\b\w/g, (char) => char.toUpperCase())
    .replaceAll(
      /\b(Mc|Mac)([a-z])/g,
      (_, prefix, letter) => prefix + letter.toUpperCase()
    )
    .replaceAll(/\bO'([a-z])/g, (_, letter) => "O'" + letter.toUpperCase());
}

/**
 * Parse a name from "LASTNAME, FIRSTNAME" format
 */
export function parseNameFromImport(rawName: string | undefined): {
  firstName: string;
  lastName: string;
} {
  if (!rawName) {
    return { firstName: "", lastName: "" };
  }

  const normalizedWhitespace = rawName.replaceAll(/\s+/g, " ").trim();
  if (!normalizedWhitespace) {
    return { firstName: "", lastName: "" };
  }

  const segments = normalizedWhitespace
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (segments.length === 1) {
    return { firstName: "", lastName: toProperCase(segments[0]) };
  }

  const [lastName, firstName, ...suffixParts] = segments;
  const suffix = suffixParts
    .map((s) => toProperCase(s))
    .join(" ")
    .trim();

  const parsedFirstName = suffix
    ? `${toProperCase(firstName)} ${suffix}`.trim()
    : toProperCase(firstName);

  return {
    firstName: parsedFirstName,
    lastName: toProperCase(lastName),
  };
}

/**
 * Normalize person name for display
 */
export function normalizePersonName(rawName: string | undefined): string {
  if (!rawName) {
    return "";
  }

  const normalizedWhitespace = rawName.replaceAll(/\s+/g, " ").trim();
  if (!normalizedWhitespace) {
    return "";
  }

  const segments = normalizedWhitespace
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return "";
  }

  if (segments.length === 1) {
    return segments[0];
  }

  const [lastName, givenNames, ...suffixParts] = segments;
  const suffix = suffixParts.join(", ");
  const baseName = [givenNames, lastName].filter(Boolean).join(" ").trim();

  if (!suffix) {
    return baseName;
  }

  return `${baseName} ${suffix}`.replaceAll(/\s+/g, " ").trim();
}
