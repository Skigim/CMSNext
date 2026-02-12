/**
 * Activity Report Generation Utilities
 *
 * Pure functions for generating and formatting activity reports.
 * No I/O, no React, no side effects.
 *
 * @module domain/dashboard/activityReport
 */

import type {
  ActivityReportFormat,
  CaseActivityEntry,
  CaseNoteAddedActivity,
  DailyActivityReport,
  DailyCaseActivityBreakdown,
} from "@/types/activityLog";

const NOTE_PREVIEW_MAX_LENGTH = 80;

function parseDateInput(targetDate: string | Date): Date {
  if (targetDate instanceof Date) {
    return new Date(targetDate.getTime());
  }

  return new Date(targetDate);
}

/**
 * Convert a date to a standardized date key string (YYYY-MM-DD).
 * Used consistently throughout activity reports for date identification.
 *
 * @param {string | Date} targetDate - Date to convert (string or Date object)
 * @returns {string} Date key in YYYY-MM-DD format
 * @throws {Error} If the date is invalid
 */
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

/**
 * Filter activity log entries to only those from a specific date.
 *
 * @param {CaseActivityEntry[]} entries - Full activity log entries
 * @param {string | Date} targetDate - Date to filter for
 * @returns {CaseActivityEntry[]} Entries matching the target date
 */
export function filterActivityEntriesByDate(
  entries: CaseActivityEntry[],
  targetDate: string | Date,
): CaseActivityEntry[] {
  const dateKey = toActivityDateKey(targetDate);

  return entries.filter(entry => toActivityDateKey(entry.timestamp) === dateKey);
}

/**
 * Group activity entries by date, creating a map of date keys to entry lists.
 * Useful for generating multi-day reports or finding date ranges.
 *
 * @param {CaseActivityEntry[]} entries - Full activity log entries
 * @returns {Map<string, CaseActivityEntry[]>} Map of date keys to entry arrays
 */
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

/**
 * Create per-case activity breakdown for a day.
 * Internal helper that summarizes entries by case and activity type.
 *
 * @private
 * @param {CaseActivityEntry[]} entries - Entries for a single day
 * @returns {DailyCaseActivityBreakdown[]} Cases sorted by activity volume (descending)
 */

/** Map activity type to the counter field it increments. */
const ACTIVITY_TYPE_COUNTER: Record<string, keyof Pick<DailyCaseActivityBreakdown, 'statusChanges' | 'priorityChanges' | 'notesAdded'>> = {
  "status-change": "statusChanges",
  "priority-change": "priorityChanges",
  "note-added": "notesAdded",
};

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
        priorityChanges: entry.type === "priority-change" ? 1 : 0,
        notesAdded: entry.type === "note-added" ? 1 : 0,
        entries: [entry],
      });
      continue;
    }

    const counterField = ACTIVITY_TYPE_COUNTER[entry.type];
    if (counterField) {
      existing[counterField] += 1;
    }
    existing.entries.push(entry);
  }

  return Array.from(caseMap.values()).sort((a, b) => {
    const aTotal = a.statusChanges + a.priorityChanges + a.notesAdded;
    const bTotal = b.statusChanges + b.priorityChanges + b.notesAdded;
    if (bTotal !== aTotal) {
      return bTotal - aTotal;
    }
    return a.caseName.localeCompare(b.caseName);
  });
}

/**
 * Generate a daily activity report for a specific date.
 * Aggregates all activity entries, creates case-level breakdowns, and computes totals.
 *
 * Automatically sorts entries by most recent first and cases by activity volume.
 *
 * @param {CaseActivityEntry[]} entries - Full activity log
 * @param {string | Date} targetDate - Date to generate report for
 * @returns {DailyActivityReport} Complete daily report with entries and case breakdown
 */
export function generateDailyActivityReport(
  entries: CaseActivityEntry[],
  targetDate: string | Date,
): DailyActivityReport {
  const filteredEntries = filterActivityEntriesByDate(entries, targetDate).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const statusChanges = filteredEntries.filter(entry => entry.type === "status-change").length;
  const priorityChanges = filteredEntries.filter(entry => entry.type === "priority-change").length;
  const notesAdded = filteredEntries.filter(entry => entry.type === "note-added").length;

  return {
    date: toActivityDateKey(targetDate),
    totals: {
      total: filteredEntries.length,
      statusChanges,
      priorityChanges,
      notesAdded,
    },
    entries: filteredEntries,
    cases: summarizeCaseEntries(filteredEntries),
  };
}

/**
 * Extract the top N most active cases from a report.
 * Useful for dashboards and summary views.
 *
 * @param {DailyActivityReport} report - Daily activity report
 * @param {number} [limit=3] - Maximum number of cases to return
 * @returns {DailyCaseActivityBreakdown[]} Top N cases by activity volume
 */
export function getTopCasesForReport(
  report: DailyActivityReport,
  limit = 3,
): DailyCaseActivityBreakdown[] {
  return report.cases.slice(0, Math.max(0, limit));
}

/**
 * Format a single activity entry into human-readable detail string.
 * Internal helper for report generation.
 *
 * Handles status changes, priority changes, and note additions with appropriate labels.
 * Note previews are truncated to NOTE_PREVIEW_MAX_LENGTH characters.
 *
 * @private
 * @param {CaseActivityEntry} entry - Activity log entry to format
 * @returns {string} Human-readable detail string (e.g., "Status changed from Active to Closed")
 */
function getEntryDetail(entry: CaseActivityEntry): string {
  if (entry.type === "status-change") {
    const fromStatus = entry.payload.fromStatus ?? "Unknown";
    const toStatus = entry.payload.toStatus;
    return `Status changed from ${fromStatus} to ${toStatus}`;
  }

  if (entry.type === "priority-change") {
    const from = entry.payload.fromPriority ? "Priority" : "Normal";
    const to = entry.payload.toPriority ? "Priority" : "Normal";
    return `Priority changed from ${from} to ${to}`;
  }

  const preview = entry.payload.preview.replace(/\s+/g, " ").trim();
  const snippet =
    preview.length > NOTE_PREVIEW_MAX_LENGTH
      ? `${preview.slice(0, NOTE_PREVIEW_MAX_LENGTH - 3)}…`
      : preview;
  return `Note added (${entry.payload.category}) – ${snippet}`;
}

/**
 * Convert activity report to CSV format.
 * Internal helper used by convertReportToFormat.
 *
 * Includes columns: Timestamp, Case, MCN, Type, Detail
 * Special characters in case names and MCNs are properly escaped.
 *
 * @private
 * @param {DailyActivityReport} report - Daily activity report
 * @returns {string} CSV-formatted report with header and rows
 */
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

function formatTxt(report: DailyActivityReport): string {
  const sections = report.cases
    .map(breakdown => {
      const noteEntries = breakdown.entries.filter(isNoteEntry);
      if (noteEntries.length === 0) {
        return null;
      }

      const lines: string[] = [];
      lines.push(formatCaseHeading(breakdown.caseMcn ?? null, breakdown.caseName));
      lines.push("");
      noteEntries.forEach((entry, index) => {
        const category = entry.payload.category?.trim() || "General";
        const content = normalizeWhitespace(entry.payload.content ?? entry.payload.preview);
        lines.push(category);
        lines.push(`* ${content}`);
        if (index < noteEntries.length - 1) {
          lines.push("");
        }
      });

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

/**
 * Format report as JSON with full structure.
 * Internal helper used by serializeDailyActivityReport.
 *
 * @private
 * @param {DailyActivityReport} report - Daily activity report
 * @returns {string} JSON-formatted report (pretty-printed with 2-space indent)
 */
function formatJson(report: DailyActivityReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Serialize a daily activity report in the specified format.
 * Supports JSON (full data), CSV (for spreadsheets), and TXT (for notes).
 *
 * **Format Details:**
 * - **JSON**: Complete report structure with all fields
 * - **CSV**: Tabular format with Timestamp, Case, MCN, Type, Detail columns
 * - **TXT**: Note-focused format grouped by case, suitable for copying/pasting
 *
 * @param {DailyActivityReport} report - Daily activity report to serialize
 * @param {ActivityReportFormat} format - Output format ('json', 'csv', or 'txt')
 * @returns {string} Formatted report as string
 */
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
