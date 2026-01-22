/**
 * Alerts Data Utilities
 *
 * CSV parsing for alert imports. Core matching logic has moved to @/domain/alerts.
 *
 * @module alertsData
 */

import Papa from "papaparse";

// Re-export everything from domain/alerts for backwards compatibility
export {
  type AlertMatchStatus,
  type AlertsIndex,
  type AlertsSummary,
  type AlertWithMatch,
  type CaseForAlertMatching,
  isAlertResolved,
  filterOpenAlerts,
  normalizeMcn,
  createEmptyAlertsIndex,
  buildCaseMap,
  buildAlertStorageKey,
  createRandomAlertId,
  sortAlerts,
  dedupeAlerts,
  createAlertsIndexFromAlerts,
  parseNameFromImport,
  normalizePersonName,
} from "@/domain/alerts";

import {
  type AlertWithMatch,
  type AlertsIndex,
  type CaseForAlertMatching,
  normalizeMcn,
  createEmptyAlertsIndex,
  createAlertsIndexFromAlerts,
  buildCaseMap,
  createRandomAlertId,
  normalizePersonName,
} from "@/domain/alerts";

// ============================================================================
// CSV Parsing (kept in utils due to Papa dependency)
// ============================================================================

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
  const normalizedYear =
    yearInput.length === 2 ? `20${yearInput}` : yearInput.padStart(4, "0");

  const yearNumber = Number.parseInt(normalizedYear, 10);
  const monthNumber = Number.parseInt(month, 10);
  const dayNumber = Number.parseInt(day, 10);

  if ([yearNumber, monthNumber, dayNumber].some(Number.isNaN)) {
    return sanitized;
  }

  const date = new Date(yearNumber, monthNumber - 1, dayNumber);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== yearNumber ||
    date.getMonth() !== monthNumber - 1 ||
    date.getDate() !== dayNumber
  ) {
    return sanitized;
  }

  return `${normalizedYear}-${month}-${day}`;
}

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

    const trimmedColumns = rawColumns.map((cell) => toTrimmedString(cell));
    const dueDateIndex = trimmedColumns.findIndex((cell) => isLikelyDate(cell));
    if (dueDateIndex === -1) {
      return rows;
    }

    const dueDate = trimmedColumns[dueDateIndex];
    let cursor = dueDateIndex + 1;

    let displayDate: string | undefined;
    const displayDateCandidate = trimmedColumns[cursor];
    const hasSufficientColumnsAfterDisplay =
      trimmedColumns.length - (cursor + 1) >= 6;

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
 * Parses alerts from the Nightingale stacked CSV export format.
 */
export function parseStackedAlerts(
  csvContent: string,
  cases: CaseForAlertMatching[]
): AlertsIndex {
  if (!csvContent || csvContent.trim().length === 0) {
    return createEmptyAlertsIndex();
  }

  const rows = extractAlertRows(csvContent);
  if (rows.length === 0) {
    const generic = parseGenericCsvAlerts(csvContent, cases);
    if (generic.alerts.length > 0) {
      return generic;
    }
    return createEmptyAlertsIndex();
  }

  const casesByMcn = buildCaseMap(cases);
  const alerts: AlertWithMatch[] = [];
  const usedIds = new Set<string>();

  rows.forEach((row) => {
    const normalizedMcnValue = normalizeMcn(row.mcNumber);
    const matchedCase = normalizedMcnValue
      ? casesByMcn.get(normalizedMcnValue)
      : undefined;

    const dueDateIso = normalizeAlertDate(row.dueDate);
    const displayDateIso = row.displayDate
      ? normalizeAlertDate(row.displayDate)
      : "";
    const alertNumber = row.alertNumber;

    const baseId =
      alertNumber && alertNumber.length > 0
        ? alertNumber
        : createRandomAlertId();
    let alertId = baseId;
    let suffix = 1;
    while (usedIds.has(alertId)) {
      alertId = `${baseId}-${suffix}`;
      suffix++;
    }
    usedIds.add(alertId);

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
      caseId: matchedCase?.id,
      alertCode: alertNumber || row.type || row.program,
      alertType: row.type,
      alertDate: dueDateIso,
      createdAt: dueDateIso,
      updatedAt: dueDateIso,
      mcNumber: normalizedMcnValue || null,
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
      matchStatus: !normalizedMcnValue
        ? "missing-mcn"
        : matchedCase
          ? "matched"
          : "unmatched",
      matchedCaseId: matchedCase?.id,
      matchedCaseName: matchedCase?.name,
      matchedCaseStatus: matchedCase?.status,
    };

    alerts.push(alert);
  });

  return createAlertsIndexFromAlerts(alerts);
}

/**
 * Generic CSV parser for non-stacked formats
 */
function parseGenericCsvAlerts(
  csvContent: string,
  cases: CaseForAlertMatching[]
): AlertsIndex {
  const parsed = Papa.parse<Record<string, string | null>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parsed.errors && parsed.errors.length > 0) {
    console.warn("parseGenericCsvAlerts encountered errors", parsed.errors);
    return createEmptyAlertsIndex();
  }

  const rows = parsed.data || [];
  if (rows.length === 0) {
    return createEmptyAlertsIndex();
  }

  const casesByMcn = buildCaseMap(cases);
  const alerts: AlertWithMatch[] = [];
  const usedIds = new Set<string>();

  const headerKeys =
    rows.length > 0
      ? Object.keys(rows[0]).map((k) => k.toLowerCase().trim())
      : [];

  const findKey = (aliases: string[]) => {
    for (const alias of aliases) {
      const idx = headerKeys.findIndex((h) => h === alias.toLowerCase());
      if (idx !== -1) return Object.keys(rows[0])[idx];
    }
    for (const alias of aliases) {
      const idx = headerKeys.findIndex((h) =>
        h.includes(alias.toLowerCase())
      );
      if (idx !== -1) return Object.keys(rows[0])[idx];
    }
    return undefined;
  };

  const keyDue = findKey([
    "due date",
    "due_date",
    "date",
    "alert date",
    "date of service",
  ]);
  const keyMcn = findKey(["mc#", "mcn", "mc_number", "mc", "mc number"]);
  const keyName = findKey(["name", "patient name"]);
  const keyProgram = findKey(["program"]);
  const keyType = findKey(["type"]);
  const keyDescription = findKey(["description", "details"]);
  const keyAlertNumber = findKey([
    "alert_number",
    "alertnumber",
    "alert number",
    "id",
    "reportid",
  ]);

  rows.forEach((raw) => {
    const get = (k?: string) => (k ? (raw[k] ?? "") : "");

    const dueDate = (get(keyDue) as string) || "";
    const mcNumber = (get(keyMcn) as string) || "";
    const name = (get(keyName) as string) || "";
    const program = (get(keyProgram) as string) || "";
    const type = (get(keyType) as string) || "";
    const description = (get(keyDescription) as string) || "";
    const alertNumber = (get(keyAlertNumber) as string) || "";

    const normalizedMcnValue = normalizeMcn(mcNumber);
    const matchedCase = normalizedMcnValue
      ? casesByMcn.get(normalizedMcnValue)
      : undefined;

    const dueDateIso = normalizeAlertDate(dueDate);
    const personName = normalizePersonName(name);

    const baseId =
      alertNumber && alertNumber.length > 0
        ? alertNumber
        : createRandomAlertId();
    let alertId = baseId;
    let suffix = 1;
    while (usedIds.has(alertId)) {
      alertId = `${baseId}-${suffix}`;
      suffix++;
    }
    usedIds.add(alertId);

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
      caseId: matchedCase?.id,
      alertCode: alertNumber || type || program,
      alertType: type,
      alertDate: dueDateIso,
      createdAt: dueDateIso,
      updatedAt: dueDateIso,
      mcNumber: normalizedMcnValue || null,
      personName,
      program,
      region: "",
      state: "",
      source: "Import",
      description,
      status: "new",
      resolvedAt: null,
      resolutionNotes: undefined,
      metadata,
      matchStatus: !normalizedMcnValue
        ? "missing-mcn"
        : matchedCase
          ? "matched"
          : "unmatched",
      matchedCaseId: matchedCase?.id,
      matchedCaseName: matchedCase?.name,
      matchedCaseStatus: matchedCase?.status,
    };

    alerts.push(alert);
  });

  return createAlertsIndexFromAlerts(alerts);
}
