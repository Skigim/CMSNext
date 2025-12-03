import Papa from "papaparse";

import { CaseDisplay, AlertRecord, AlertWorkflowStatus, CaseStatus } from "../types/case";

export type AlertMatchStatus = "matched" | "unmatched" | "missing-mcn";

/**
 * Minimal case interface for alert matching
 * Compatible with both CaseDisplay and StoredCase
 */
export interface CaseForAlertMatching {
  id: string;
  name: string;
  mcn: string;
  status: CaseStatus;
  caseRecord?: {
    mcn?: string;
  };
}

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

export function isAlertResolved(
  alert: Pick<AlertRecord, "status" | "resolvedAt"> | AlertWithMatch | null | undefined,
): boolean {
  if (!alert) {
    return false;
  }

  const normalizedStatus = typeof alert.status === "string" ? alert.status.toLowerCase() : undefined;
  if (normalizedStatus === "resolved") {
    return true;
  }

  if (alert.resolvedAt) {
    return String(alert.resolvedAt).trim().length > 0;
  }

  return false;
}

export function filterOpenAlerts<T extends Pick<AlertRecord, "status" | "resolvedAt">>(
  alerts: T[] | null | undefined,
): T[] {
  if (!alerts || alerts.length === 0) {
    return [];
  }

  return alerts.filter(alert => !isAlertResolved(alert));
}

const workflowPriorityOrder: AlertWorkflowStatus[] = ["new", "in-progress", "acknowledged", "snoozed", "resolved"];

const DATE_VALUE_REGEX = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/;

type RawAlertCsvRow = {
  dueDate: string;
  displayDate?: string;
  mcNumber: string;
  name: string;
  program: string;
  type: string;
  description: string;
  alertNumber: string;
};

function isLikelyDate(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return DATE_VALUE_REGEX.test(value.trim());
}

function normalizeAlertDate(rawDate: string | undefined): string {
  if (!rawDate) {
    return "";
  }

  const trimmed = rawDate.trim();
  if (!trimmed) {
    return "";
  }

  const sanitized = trimmed.replace(/\//g, "-");
  const match = DATE_VALUE_REGEX.exec(sanitized);
  if (!match) {
    return sanitized;
  }

  const [, monthInput, dayInput, yearInput] = match;
  const month = monthInput.padStart(2, "0");
  const day = dayInput.padStart(2, "0");
  const normalizedYear = yearInput.length === 2 ? `20${yearInput}` : yearInput.padStart(4, "0");

  const yearNumber = Number.parseInt(normalizedYear, 10);
  const monthNumber = Number.parseInt(month, 10);
  const dayNumber = Number.parseInt(day, 10);

  if ([yearNumber, monthNumber, dayNumber].some(Number.isNaN)) {
    return sanitized;
  }

  const date = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber));
  if (Number.isNaN(date.getTime())) {
    return sanitized;
  }

  return date.toISOString();
}

/**
 * Pulls alert rows from the Nightingale "stacked" CSV export format. Each line has a long
 * prefix of report metadata, followed by the alert payload in this exact order:
 * `Due Date`, optional `Display Date`, `MC#`, `Name`, `Program`, `Type`, `Description`, `Alert_Number`.
 * We only support that layout and ignore any other structure.
 */
function extractAlertRows(csvContent: string): RawAlertCsvRow[] {
  const parsed = Papa.parse<string[]>(csvContent, {
    header: false,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  if (parsed.errors.length > 0) {
    console.warn("extractAlertRows encountered parse issues", parsed.errors);
  }

  const toTrimmedString = (value: unknown): string => {
    if (typeof value === "string") {
      return value.trim();
    }
    if (value == null) {
      return "";
    }
    return String(value).trim();
  };

  return parsed.data.reduce<RawAlertCsvRow[]>((rows, rawColumns) => {
    if (!Array.isArray(rawColumns) || rawColumns.length === 0) {
      return rows;
    }

    const trimmedColumns = rawColumns.map(cell => toTrimmedString(cell));
    const dueDateIndex = trimmedColumns.findIndex(cell => isLikelyDate(cell));
    if (dueDateIndex === -1) {
      return rows;
    }

    const dueDate = trimmedColumns[dueDateIndex];
    let cursor = dueDateIndex + 1;

    let displayDate: string | undefined;
    const displayDateCandidate = trimmedColumns[cursor];
    const hasSufficientColumnsAfterDisplay = trimmedColumns.length - (cursor + 1) >= 6;

    if (displayDateCandidate === "" && hasSufficientColumnsAfterDisplay) {
      displayDate = "";
      cursor += 1;
    } else if (isLikelyDate(displayDateCandidate)) {
      displayDate = displayDateCandidate;
      cursor += 1;
    }

    const remainingRequiredColumns = trimmedColumns.length - cursor;
    if (remainingRequiredColumns < 6) {
      return rows;
    }

    const mcNumber = trimmedColumns[cursor] ?? "";
    cursor += 1;

    const name = trimmedColumns[cursor] ?? "";
    cursor += 1;

    const program = trimmedColumns[cursor] ?? "";
    cursor += 1;

    const type = trimmedColumns[cursor] ?? "";
    cursor += 1;

    const description = trimmedColumns[cursor] ?? "";
    cursor += 1;

    const alertNumber = trimmedColumns[cursor] ?? "";

    rows.push({
      dueDate,
      displayDate,
      mcNumber,
      name,
      program,
      type,
      description,
      alertNumber,
    });

    return rows;
  }, []);
}

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

export function normalizeMcn(rawMcn: string | undefined | null): string {
  if (!rawMcn) {
    return "";
  }
  return rawMcn.replace(/[^a-z0-9]/gi, "").trim().toUpperCase();
}

function buildCaseMap(cases: CaseForAlertMatching[]): Map<string, CaseForAlertMatching> {
  const map = new Map<string, CaseForAlertMatching>();

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
 * Converts a string to proper title case.
 * Handles ALL CAPS input by lowercasing first, then capitalizing first letter of each word.
 * Handles special cases like "O'BRIEN" → "O'Brien", "MCDONALD" → "McDonald"
 */
function toProperCase(str: string): string {
  if (!str) return "";
  
  // First lowercase everything, then capitalize first letter of each word
  return str
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase())
    // Handle Mc/Mac prefixes (McDonald, MacArthur)
    .replace(/\b(Mc|Mac)([a-z])/g, (_, prefix, letter) => prefix + letter.toUpperCase())
    // Handle O' prefix (O'Brien, O'Connor)
    .replace(/\bO'([a-z])/g, (_, letter) => "O'" + letter.toUpperCase());
}

/**
 * Parse a name from "LASTNAME, FIRSTNAME" format (common in imports)
 * and return properly-cased firstName and lastName.
 * 
 * Examples:
 * - "DOE, JOHN" → { firstName: "John", lastName: "Doe" }
 * - "O'BRIEN, MARY" → { firstName: "Mary", lastName: "O'Brien" }
 * - "MCDONALD, JAMES" → { firstName: "James", lastName: "McDonald" }
 * - "SMITH, JOHN JR" → { firstName: "John Jr", lastName: "Smith" }
 */
export function parseNameFromImport(rawName: string | undefined): { firstName: string; lastName: string } {
  if (!rawName) {
    return { firstName: "", lastName: "" };
  }

  const normalizedWhitespace = rawName.replace(/\s+/g, " ").trim();
  if (!normalizedWhitespace) {
    return { firstName: "", lastName: "" };
  }

  const segments = normalizedWhitespace
    .split(",")
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0);

  if (segments.length === 0) {
    return { firstName: "", lastName: "" };
  }

  // Single segment - treat as lastName only
  if (segments.length === 1) {
    return { firstName: "", lastName: toProperCase(segments[0]) };
  }

  // Two or more segments: "LastName, FirstName [, Suffix...]"
  const [lastName, firstName, ...suffixParts] = segments;
  const suffix = suffixParts.map(s => toProperCase(s)).join(" ").trim();
  
  const parsedFirstName = suffix 
    ? `${toProperCase(firstName)} ${suffix}`.trim()
    : toProperCase(firstName);

  return {
    firstName: parsedFirstName,
    lastName: toProperCase(lastName),
  };
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

  const normalizedWhitespace = rawName.replace(/\s+/g, " ").trim();
  if (!normalizedWhitespace) {
    return "";
  }

  const segments = normalizedWhitespace
    .split(",")
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0);

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

  return `${baseName} ${suffix}`.replace(/\s+/g, " ").trim();
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

/**
 * Parses alerts from the Nightingale stacked CSV export (see `external-examples/Alerts Sample.txt`).
 * The importer assumes the column ordering described there and will skip any rows that do not
 * match it exactly.
 */
export function parseStackedAlerts(csvContent: string, cases: CaseForAlertMatching[]): AlertsIndex {
  if (!csvContent || csvContent.trim().length === 0) {
    return createEmptyAlertsIndex();
  }

  const rows = extractAlertRows(csvContent);
  if (rows.length === 0) {
    // Attempt a more flexible parse for CSV exports that don't match the "stacked" layout.
    const generic = parseGenericCsvAlerts(csvContent, cases);
    if (generic.alerts.length > 0) {
      return generic;
    }

    return createEmptyAlertsIndex();
  }

  const casesByMcn = buildCaseMap(cases);
  const alerts: AlertWithMatch[] = [];

  rows.forEach(row => {
    const normalizedMcn = normalizeMcn(row.mcNumber);
    const matchedCase = normalizedMcn ? casesByMcn.get(normalizedMcn) : undefined;

    const dueDateIso = normalizeAlertDate(row.dueDate);
    const displayDateIso = row.displayDate ? normalizeAlertDate(row.displayDate) : "";
    const alertNumber = row.alertNumber;
    const alertId = alertNumber && alertNumber.length > 0 ? alertNumber : createRandomAlertId();
    const personName = normalizePersonName(row.name);

    const metadata: Record<string, string | undefined> = {
      rawDueDate: row.dueDate,
      rawProgram: row.program,
      rawType: row.type,
      rawDescription: row.description,
      rawName: row.name,
      alertNumber: row.alertNumber,
    };

    if (row.displayDate) {
      metadata.rawDisplayDate = row.displayDate;
    }

    if (displayDateIso && displayDateIso !== row.displayDate) {
      metadata.displayDateIso = displayDateIso;
    }

    if (dueDateIso && dueDateIso !== row.dueDate) {
      metadata.dueDateIso = dueDateIso;
    }

    const alert: AlertWithMatch = {
      id: alertId,
      reportId: alertNumber || undefined,
      alertCode: alertNumber || row.type || row.program,
      alertType: row.type,
      alertDate: dueDateIso,
      createdAt: dueDateIso,
      updatedAt: dueDateIso,
      mcNumber: normalizedMcn || null,
      personName,
      program: row.program,
      region: "",
      state: "",
      source: "Import",
      description: row.description,
      status: "new",
      resolvedAt: null,
      resolutionNotes: undefined,
      metadata,
      matchStatus: !normalizedMcn ? "missing-mcn" : matchedCase ? "matched" : "unmatched",
      matchedCaseId: matchedCase?.id,
      matchedCaseName: matchedCase?.name,
      matchedCaseStatus: matchedCase?.status,
    };

    alerts.push(alert);
  });

  return createAlertsIndexFromAlerts(alerts);
}

/**
 * Generic CSV parser: attempts to map common header names to the expected alert fields.
 * This is a forgiving fallback for CSV exports that don't follow the stacked layout.
 */
function parseGenericCsvAlerts(csvContent: string, cases: CaseForAlertMatching[]): AlertsIndex {
  const parsed = Papa.parse<Record<string, string | null>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parsed.errors && parsed.errors.length > 0) {
    // If header parsing failed, give up
    console.warn('parseGenericCsvAlerts encountered errors', parsed.errors);
    return createEmptyAlertsIndex();
  }

  const rows = parsed.data || [];
  if (rows.length === 0) {
    return createEmptyAlertsIndex();
  }

  const casesByMcn = buildCaseMap(cases);
  const alerts: AlertWithMatch[] = [];

  const headerKeys = rows.length > 0 ? Object.keys(rows[0]).map(k => k.toLowerCase().trim()) : [];

  const findKey = (aliases: string[]) => {
    for (const alias of aliases) {
      const idx = headerKeys.findIndex(h => h === alias.toLowerCase());
      if (idx !== -1) return Object.keys(rows[0])[idx];
    }
    // fallback: find any key that contains alias
    for (const alias of aliases) {
      const idx = headerKeys.findIndex(h => h.includes(alias.toLowerCase()));
      if (idx !== -1) return Object.keys(rows[0])[idx];
    }
    return undefined;
  };

  const keyDue = findKey(['due date', 'due_date', 'date', 'alert date', 'date of service']);
  const keyMcn = findKey(['mc#', 'mcn', 'mc_number', 'mc', 'mc number']);
  const keyName = findKey(['name', 'patient name']);
  const keyProgram = findKey(['program']);
  const keyType = findKey(['type']);
  const keyDescription = findKey(['description', 'details']);
  const keyAlertNumber = findKey(['alert_number', 'alertnumber', 'alert number', 'id', 'reportid']);

  rows.forEach(raw => {
    const get = (k?: string) => (k ? (raw[k] ?? '') : '');

    const dueDate = (get(keyDue) as string) || '';
    const mcNumber = (get(keyMcn) as string) || '';
    const name = (get(keyName) as string) || '';
    const program = (get(keyProgram) as string) || '';
    const type = (get(keyType) as string) || '';
    const description = (get(keyDescription) as string) || '';
    const alertNumber = (get(keyAlertNumber) as string) || '';

    const normalizedMcn = normalizeMcn(mcNumber);
    const matchedCase = normalizedMcn ? casesByMcn.get(normalizedMcn) : undefined;

    const dueDateIso = normalizeAlertDate(dueDate);
    const personName = normalizePersonName(name);

    const alertId = alertNumber && alertNumber.length > 0 ? alertNumber : createRandomAlertId();

    const metadata: Record<string, string | undefined> = {
      rawDueDate: dueDate || undefined,
      rawProgram: program || undefined,
      rawType: type || undefined,
      rawDescription: description || undefined,
      rawName: name || undefined,
      alertNumber: alertNumber || undefined,
    };

    const alert: AlertWithMatch = {
      id: alertId,
      reportId: alertNumber || undefined,
      alertCode: alertNumber || type || program,
      alertType: type,
      alertDate: dueDateIso,
      createdAt: dueDateIso,
      updatedAt: dueDateIso,
      mcNumber: normalizedMcn || null,
      personName,
      program,
      region: '',
      state: '',
      source: 'Import',
      description,
      status: 'new',
      resolvedAt: null,
      resolutionNotes: undefined,
      metadata,
      matchStatus: !normalizedMcn ? 'missing-mcn' : matchedCase ? 'matched' : 'unmatched',
      matchedCaseId: matchedCase?.id,
      matchedCaseName: matchedCase?.name,
      matchedCaseStatus: matchedCase?.status,
    };

    alerts.push(alert);
  });

  return createAlertsIndexFromAlerts(alerts);
}
