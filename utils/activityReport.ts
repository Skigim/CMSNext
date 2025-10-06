import {
  ActivityReportFormat,
  CaseActivityEntry,
  CaseNoteAddedActivity,
  CaseStatusChangeActivity,
  DailyActivityReport,
  DailyCaseActivityBreakdown,
} from "../types/activityLog";

const NOTE_PREVIEW_MAX_LENGTH = 80;

function parseDateInput(targetDate: string | Date): Date {
  if (targetDate instanceof Date) {
    return new Date(targetDate.getTime());
  }

  return new Date(targetDate);
}

export function toActivityDateKey(targetDate: string | Date): string {
  const date = parseDateInput(targetDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date provided to toActivityDateKey");
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function filterActivityEntriesByDate(
  entries: CaseActivityEntry[],
  targetDate: string | Date,
): CaseActivityEntry[] {
  const dateKey = toActivityDateKey(targetDate);

  return entries.filter(entry => toActivityDateKey(entry.timestamp) === dateKey);
}

export function groupActivityEntriesByDate(
  entries: CaseActivityEntry[],
): Map<string, CaseActivityEntry[]> {
  return entries.reduce<Map<string, CaseActivityEntry[]>>((map, entry) => {
    const key = toActivityDateKey(entry.timestamp);
    const bucket = map.get(key) ?? [];
    bucket.push(entry);
    map.set(key, bucket);
    return map;
  }, new Map());
}

function summarizeCaseEntries(entries: CaseActivityEntry[]): DailyCaseActivityBreakdown[] {
  const caseMap = new Map<string, DailyCaseActivityBreakdown>();

  for (const entry of entries) {
    const existing = caseMap.get(entry.caseId);
    if (!existing) {
      caseMap.set(entry.caseId, {
        caseId: entry.caseId,
        caseName: entry.caseName,
        caseMcn: entry.caseMcn,
        statusChanges: entry.type === "status-change" ? 1 : 0,
        notesAdded: entry.type === "note-added" ? 1 : 0,
        entries: [entry],
      });
      continue;
    }

    if (entry.type === "status-change") {
      existing.statusChanges += 1;
    } else if (entry.type === "note-added") {
      existing.notesAdded += 1;
    }
    existing.entries.push(entry);
  }

  return Array.from(caseMap.values()).sort((a, b) => {
    const aTotal = a.statusChanges + a.notesAdded;
    const bTotal = b.statusChanges + b.notesAdded;
    if (bTotal !== aTotal) {
      return bTotal - aTotal;
    }
    return a.caseName.localeCompare(b.caseName);
  });
}

export function generateDailyActivityReport(
  entries: CaseActivityEntry[],
  targetDate: string | Date,
): DailyActivityReport {
  const filteredEntries = filterActivityEntriesByDate(entries, targetDate).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const statusChanges = filteredEntries.filter(entry => entry.type === "status-change").length;
  const notesAdded = filteredEntries.filter(entry => entry.type === "note-added").length;

  return {
    date: toActivityDateKey(targetDate),
    totals: {
      total: filteredEntries.length,
      statusChanges,
      notesAdded,
    },
    entries: filteredEntries,
    cases: summarizeCaseEntries(filteredEntries),
  };
}

export function getTopCasesForReport(
  report: DailyActivityReport,
  limit = 3,
): DailyCaseActivityBreakdown[] {
  return report.cases.slice(0, Math.max(0, limit));
}

function getEntryDetail(entry: CaseActivityEntry): string {
  if (entry.type === "status-change") {
    const fromStatus = entry.payload.fromStatus ?? "Unknown";
    const toStatus = entry.payload.toStatus;
    return `Status changed from ${fromStatus} to ${toStatus}`;
  }

  const preview = entry.payload.preview.replace(/\s+/g, " ").trim();
  const snippet =
    preview.length > NOTE_PREVIEW_MAX_LENGTH
      ? `${preview.slice(0, NOTE_PREVIEW_MAX_LENGTH - 3)}…`
      : preview;
  return `Note added (${entry.payload.category}) – ${snippet}`;
}

function formatCsv(report: DailyActivityReport): string {
  const header = ["Timestamp", "Case", "MCN", "Type", "Detail"].join(",");
  const rows = report.entries.map(entry => {
    const values = [
      new Date(entry.timestamp).toISOString(),
      entry.caseName.replace(/"/g, '""'),
      entry.caseMcn ? String(entry.caseMcn).replace(/"/g, '""') : "",
      entry.type,
      getEntryDetail(entry).replace(/"/g, '""'),
    ];

    return values.map(value => `"${value}"`).join(",");
  });

  return [header, ...rows].join("\n");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatMcn(mcn?: string | null): string {
  if (mcn === undefined || mcn === null) {
    return "No MC#";
  }

  const normalized = String(mcn).trim();
  return normalized.length > 0 ? normalized : "No MC#";
}

function formatCaseHeading(mcn: string | null | undefined, caseName: string): string {
  return `${formatMcn(mcn)} - ${caseName}`;
}

function isNoteEntry(entry: CaseActivityEntry): entry is CaseNoteAddedActivity {
  return entry.type === "note-added";
}

function isStatusChangeEntry(entry: CaseActivityEntry): entry is CaseStatusChangeActivity {
  return entry.type === "status-change";
}

const CLEARED_STATUS_KEYWORDS = ["resolved", "cleared", "closed"];

function isClearedAlert(entry: CaseStatusChangeActivity): boolean {
  const toStatus = entry.payload.toStatus?.toLowerCase()?.trim();
  if (!toStatus) {
    return false;
  }

  return CLEARED_STATUS_KEYWORDS.some(keyword => toStatus.includes(keyword));
}

function buildAlertDescription(entry: CaseStatusChangeActivity): string {
  const fromStatus = entry.payload.fromStatus?.trim();
  const toStatus = entry.payload.toStatus?.trim();

  if (!toStatus) {
    return "Alert updated";
  }

  if (!fromStatus || fromStatus.localeCompare(toStatus, undefined, { sensitivity: "accent" }) === 0) {
    return `Alert marked ${toStatus}`;
  }

  return `Alert marked ${toStatus} (previously ${fromStatus})`;
}

function formatTxt(report: DailyActivityReport): string {
  const sections = report.cases
    .map(breakdown => {
      const noteEntries = breakdown.entries.filter(isNoteEntry);
      const clearedAlerts = breakdown.entries
        .filter(isStatusChangeEntry)
        .filter(isClearedAlert);

      if (noteEntries.length === 0 && clearedAlerts.length === 0) {
        return null;
      }

      const lines: string[] = [];
      lines.push(formatCaseHeading(breakdown.caseMcn ?? null, breakdown.caseName));
      lines.push("");
      lines.push("Alerts Cleared:");

      if (clearedAlerts.length === 0) {
        lines.push("None recorded.");
      } else {
        clearedAlerts.forEach((entry, index) => {
          lines.push(`${index + 1}. ${buildAlertDescription(entry)}`);
        });
      }

      lines.push("");
      lines.push("Notes:");

      if (noteEntries.length === 0) {
        lines.push("None recorded.");
      } else {
        noteEntries.forEach((entry, index) => {
          const category = entry.payload.category?.trim() || "General";
          const preview = normalizeWhitespace(entry.payload.preview);
          lines.push(`${category}:`);
          lines.push(`* ${preview}`);
          if (index < noteEntries.length - 1) {
            lines.push("");
          }
        });
      }

      lines.push("");
      lines.push("-----");

      return lines.join("\n");
    })
    .filter((section): section is string => Boolean(section));

  if (sections.length === 0) {
    return "No note activity recorded.";
  }

  return sections.join("\n\n");
}

function formatJson(report: DailyActivityReport): string {
  return JSON.stringify(report, null, 2);
}

export function serializeDailyActivityReport(
  report: DailyActivityReport,
  format: ActivityReportFormat,
): string {
  switch (format) {
    case "csv":
      return formatCsv(report);
    case "txt":
      return formatTxt(report);
    case "json":
    default:
      return formatJson(report);
  }
}
