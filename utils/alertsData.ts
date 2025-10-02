import { CaseDisplay, AlertRecord, AlertSeverity, AlertWorkflowStatus } from "../types/case";

export type AlertMatchStatus = "matched" | "unmatched" | "missing-mcn";

export interface AlertWithMatch extends AlertRecord {
  matchStatus: AlertMatchStatus;
  matchedCaseId?: string;
  matchedCaseName?: string;
  matchedCaseStatus?: CaseDisplay["status"];
}

export interface AlertsSummary {
  total: number;
  matched: number;
  unmatched: number;
  missingMcn: number;
  latestUpdated?: string | null;
}

export interface AlertsIndex {
  alerts: AlertWithMatch[];
  summary: AlertsSummary;
  alertsByCaseId: Map<string, AlertWithMatch[]>;
  unmatched: AlertWithMatch[];
  missingMcn: AlertWithMatch[];
}

const severityPriorityOrder: AlertSeverity[] = ["Critical", "High", "Medium", "Low", "Info"];
const workflowPriorityOrder: AlertWorkflowStatus[] = ["new", "in-progress", "acknowledged", "snoozed", "resolved"];

const STACKED_ALERT_REGEX = /,,\s*(?<dueDate>\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s*,\s*(?<mcn>[^,"]*)\s*,"(?<name>(?:[^"]|"")*)","(?<program>(?:[^"]|"")*)","(?<type>(?:[^"]|"")*)","(?<description>(?:[^"]|"")*)",\s*(?<alertNumber>[^,\r\n]*)/g;

/**
 * Produces the canonical storage key for an alert by combining its base identifier with
 * discriminators that differentiate stacked CSV entries. The key is structured as
 * `baseId|normalizedMcn|person|program|type|description|matchStatus|date`, omitting any
 * segments where the source value is missing.
 *
 * Legacy snapshots that only provided an id or reportId still resolve to the same key because
 * the additional segments are optional. Prefer this key over plain id/reportId when persisting
 * alert workflow state across parses or persistence rounds.
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

  const dateSource = alert.alertDate || alert.updatedAt || alert.createdAt || "";
  let normalizedDate = "";
  if (dateSource) {
    const parsed = new Date(dateSource);
    normalizedDate = Number.isNaN(parsed.getTime()) ? dateSource : parsed.toISOString().slice(0, 10);
  }

  const discriminator = [
    normalizedMcn,
    normalizedName,
    normalizedProgram,
    normalizedType,
    normalizedDescription,
    normalizedStatus,
    normalizedDate,
  ].filter(Boolean).join("|");

  return discriminator.length > 0 ? `${baseId}|${discriminator}` : baseId;
}

function createRandomAlertId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `alert-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeMcn(rawMcn: string | undefined | null): string {
  if (!rawMcn) {
    return "";
  }
  return rawMcn.replace(/[^a-z0-9]/gi, "").trim().toUpperCase();
}

function buildCaseMap(cases: CaseDisplay[]): Map<string, CaseDisplay> {
  const map = new Map<string, CaseDisplay>();

  cases.forEach(caseItem => {
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

export function filterAlertsForCase(caseId: string, alertsByCaseId: Map<string, AlertWithMatch[]>): AlertWithMatch[] {
  return alertsByCaseId.get(caseId) ?? [];
}

function sortAlerts(alerts: AlertWithMatch[]): AlertWithMatch[] {
  return [...alerts].sort((a, b) => {
    const severityDifference = severityPriorityOrder.indexOf(a.severity) - severityPriorityOrder.indexOf(b.severity);
    if (severityDifference !== 0) {
      return severityDifference;
    }

    const timeA = new Date(a.alertDate || a.createdAt || "").getTime();
    const timeB = new Date(b.alertDate || b.createdAt || "").getTime();

    if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
      return timeB - timeA;
    }

    return 0;
  });
}

export function createAlertsIndexFromAlerts(alertsInput: AlertWithMatch[]): AlertsIndex {
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

  sortedAlerts.forEach(alert => {
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

    const updatedTime = new Date(alert.updatedAt || alert.createdAt || "").getTime();
    if (!Number.isNaN(updatedTime)) {
      if (!summary.latestUpdated || updatedTime > new Date(summary.latestUpdated).getTime()) {
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
    unmatched: sortedAlerts.filter(alert => alert.matchStatus === "unmatched"),
    missingMcn: sortedAlerts.filter(alert => alert.matchStatus === "missing-mcn"),
  };
}

function getWorkflowPriority(status: AlertWithMatch["status"]): number {
  const normalized = status ?? "new";
  const index = workflowPriorityOrder.indexOf(normalized);
  return index === -1 ? 0 : index;
}

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

function mergeDuplicateAlerts(existing: AlertWithMatch, incoming: AlertWithMatch): AlertWithMatch {
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
    ...(fallback.metadata ?? {}),
    ...(winner.metadata ?? {}),
  };

  return {
    ...fallback,
    ...winner,
    metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
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

function dedupeAlerts(alerts: AlertWithMatch[]): AlertWithMatch[] {
  if (!alerts || alerts.length === 0) {
    return [];
  }

  const deduped = new Map<string, AlertWithMatch>();
  const passthrough: AlertWithMatch[] = [];

  alerts.forEach(alert => {
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

function normalizePersonName(rawName: string | undefined): string {
  if (!rawName) {
    return "";
  }

  const trimmed = rawName.trim();
  if (trimmed.includes(",")) {
    const [last, first] = trimmed.split(",");
    const firstPart = (first ?? "").trim();
    const lastPart = (last ?? "").trim();
    return `${firstPart} ${lastPart}`.trim();
  }

  return trimmed;
}

function normalizeStackedDate(rawDate: string | undefined): string {
  if (!rawDate) {
    return "";
  }

  const normalizedDate = rawDate.trim().replace(/\//g, "-");
  const parts = normalizedDate.split("-");
  if (parts.length !== 3) {
    return normalizedDate;
  }

  const [monthInput, dayInput, yearInput] = parts;
  const month = monthInput.padStart(2, "0");
  const day = dayInput.padStart(2, "0");
  const year = (yearInput.length === 2 ? `20${yearInput}` : yearInput).padStart(4, "0");

  const isoCandidate = `${year}-${month}-${day}T00:00:00.000Z`;
  const date = new Date(isoCandidate);
  if (Number.isNaN(date.getTime())) {
    return normalizedDate;
  }
  return date.toISOString();
}

function decodeStackedValue(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return value.replace(/""/g, '"').trim();
}

function deriveSeverityFromType(type: string | undefined, description: string | undefined): AlertSeverity {
  const normalizedType = type?.trim().toLowerCase() ?? "";
  const normalizedDescription = description?.trim().toLowerCase() ?? "";

  if (normalizedType.includes("critical") || normalizedDescription.includes("critical")) {
    return "Critical";
  }

  if (normalizedType.includes("high")) {
    return "High";
  }

  if (normalizedType.includes("low")) {
    return "Low";
  }

  return "Medium";
}

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

export function parseStackedAlerts(csvContent: string, cases: CaseDisplay[]): AlertsIndex {
  if (!csvContent || csvContent.trim().length === 0) {
    return createEmptyAlertsIndex();
  }

  const sanitizedContent = csvContent.replace(/\r\n|\r|\n/g, "\n");
  const casesByMcn = buildCaseMap(cases);
  const alerts: AlertWithMatch[] = [];

  for (const match of sanitizedContent.matchAll(STACKED_ALERT_REGEX)) {
    const groups = match.groups ?? {};
    const rawMcn = decodeStackedValue(groups.mcn);
    const normalizedMcn = normalizeMcn(rawMcn);
    const matchedCase = normalizedMcn ? casesByMcn.get(normalizedMcn) : undefined;

    const dueDateIso = normalizeStackedDate(groups.dueDate);
    const program = decodeStackedValue(groups.program);
    const alertType = decodeStackedValue(groups.type);
    const description = decodeStackedValue(groups.description);
    const alertNumber = decodeStackedValue(groups.alertNumber);
    const alertId = alertNumber && alertNumber.length > 0 ? alertNumber : createRandomAlertId();

    const severity = deriveSeverityFromType(alertType, description);
    const rawName = decodeStackedValue(groups.name);
    const personName = normalizePersonName(rawName);

    const alert: AlertWithMatch = {
      id: alertId,
      reportId: alertNumber || undefined,
      alertCode: alertNumber || alertType || program,
      alertType,
      severity,
      alertDate: dueDateIso,
      createdAt: dueDateIso,
      updatedAt: dueDateIso,
      mcNumber: normalizedMcn || null,
      personName,
      program,
      region: "",
      state: "",
      source: "Import",
      description,
      status: "new",
      resolvedAt: null,
      resolutionNotes: undefined,
      metadata: {
        rawType: alertType,
        rawProgram: program,
        rawDescription: description,
        rawName: rawName,
        alertNumber,
      },
      matchStatus: !normalizedMcn
        ? "missing-mcn"
        : matchedCase
          ? "matched"
          : "unmatched",
      matchedCaseId: matchedCase?.id,
      matchedCaseName: matchedCase?.name,
      matchedCaseStatus: matchedCase?.status,
    };

    alerts.push(alert);
  }

  if (alerts.length === 0) {
    return createEmptyAlertsIndex();
  }

  return createAlertsIndexFromAlerts(alerts);
}
