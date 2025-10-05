import {
  ActivityReportFormat,
  CaseActivityEntry,
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

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

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

function formatTxt(report: DailyActivityReport): string {
  const lines: string[] = [];
  lines.push(`Activity Report for ${report.date}`);
  lines.push("============================");
  lines.push(`Total entries: ${report.totals.total}`);
  lines.push(`Status changes: ${report.totals.statusChanges}`);
  lines.push(`Notes added: ${report.totals.notesAdded}`);
  lines.push("");
  lines.push("Top cases:");

  const topCases = getTopCasesForReport(report, 5);
  if (topCases.length === 0) {
    lines.push("  No case activity recorded.");
  } else {
    for (const breakdown of topCases) {
      const total = breakdown.statusChanges + breakdown.notesAdded;
      lines.push(
        `  • ${breakdown.caseName} (${breakdown.caseMcn ?? "MCN N/A"}) – ${total} entr${
          total === 1 ? "y" : "ies"
        }`,
      );
    }
  }

  if (report.entries.length > 0) {
    lines.push("");
    lines.push("Entries:");
    for (const entry of report.entries) {
      lines.push(
        `  - [${new Date(entry.timestamp).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })}] ${entry.caseName}: ${getEntryDetail(entry)}`,
      );
    }
  }

  return lines.join("\n");
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
