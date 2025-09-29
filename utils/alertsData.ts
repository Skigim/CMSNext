import { CaseDisplay, AlertRecord, AlertSeverity } from "../types/case";
import { parseCsv, ParsedCsvRow } from "./csvParser";

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

function normalizeSeverity(rawSeverity: string | undefined): AlertSeverity {
  const normalized = rawSeverity?.trim().toLowerCase();

  switch (normalized) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return "Info";
  }
}

function normalizeDateString(value?: string): string {
  if (!value) {
    return "";
  }

  const normalized = value.replace(/ /g, "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
}

function normalizeSource(rawSource: string | undefined): string {
  const normalized = rawSource?.trim().toLowerCase();
  if (normalized === "user") {
    return "User";
  }
  return "Import";
}

function createAlertId(row: ParsedCsvRow): string {
  const reportId = row.ReportID ?? row["ReportID"];
  if (reportId && reportId.trim().length > 0) {
    return reportId.trim();
  }

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

function transformRow(row: ParsedCsvRow, casesByMcn: Map<string, CaseDisplay>): AlertWithMatch {
  const reportId = createAlertId(row);
  const rawMcn = row.MCNumber ?? row["MCNumber"] ?? "";
  const normalizedMcn = normalizeMcn(rawMcn);
  const matchedCase = normalizedMcn ? casesByMcn.get(normalizedMcn) : undefined;

  const severity = normalizeSeverity(row.Severity);

  const alert: AlertWithMatch = {
    id: reportId,
    reportId,
    alertCode: row.AlertCode ?? "",
    alertType: row.AlertType ?? "",
    severity,
    alertDate: normalizeDateString(row.AlertDate || row.CreatedAt),
    createdAt: normalizeDateString(row.CreatedAt || row.AlertDate),
    updatedAt: normalizeDateString(row.UpdatedAt || row.CreatedAt || row.AlertDate),
    mcNumber: rawMcn ? normalizedMcn : null,
    personName: row.Name ?? "",
    program: row.Program ?? "",
    region: row.Region ?? "",
    state: row.State ?? "",
    source: normalizeSource(row.Source),
    description: row.Comments ?? "",
    status: "new",
    metadata: {
      rawSeverity: row.Severity ?? "",
      alertType: row.AlertType ?? "",
      alertCode: row.AlertCode ?? "",
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

  return alert;
}

export function parseAlertsFromCsv(csvContent: string, cases: CaseDisplay[]): AlertsIndex {
  const rows = parseCsv(csvContent);
  const casesByMcn = buildCaseMap(cases);

  const alerts = rows
    .map(row => transformRow(row, casesByMcn))
    .sort((a, b) => {
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

  const alertsByCaseId = new Map<string, AlertWithMatch[]>();
  const summary: AlertsSummary = {
    total: alerts.length,
    matched: 0,
    unmatched: 0,
    missingMcn: 0,
    latestUpdated: null,
  };

  alerts.forEach(alert => {
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

  summary.total = alerts.length;

  return {
    alerts,
    summary,
    alertsByCaseId,
    unmatched: alerts.filter(alert => alert.matchStatus === "unmatched"),
    missingMcn: alerts.filter(alert => alert.matchStatus === "missing-mcn"),
  };
}

export function filterAlertsForCase(caseId: string, alertsByCaseId: Map<string, AlertWithMatch[]>): AlertWithMatch[] {
  return alertsByCaseId.get(caseId) ?? [];
}
