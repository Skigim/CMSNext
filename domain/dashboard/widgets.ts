/**
 * Widget Data Processors
 *
 * Statistical processing utilities for dashboard widgets.
 * Generates metrics, breakdowns, and trend analysis from case and alert data.
 *
 * ## Metrics Provided
 *
 * - **Alert Stats**: Daily cleared counts, open/resolved counts by description
 * - **Case Stats**: Processing counts by day, status breakdowns
 * - **Trends**: Alert age analysis, processing time comparisons
 * - **Activity**: Case processing activity with percentage calculations
 *
 * @module domain/dashboard/widgets
 */

import { isAlertResolved, type AlertWithMatch } from "@/utils/alertsData";
import type { StoredCase } from "@/types/case";
import type { CaseActivityEntry } from "@/types/activityLog";

export interface DailyAlertStats {
  date: string;
  clearedCount: number;
}

export interface DailyCaseStats {
  date: string;
  processedCount: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
  percentage: number;
  colorClass: string;
}

export interface AlertDescriptionStats {
  description: string;
  count: number;
  percentage: number;
  openCount: number;
  resolvedCount: number;
}

export interface AlertAgeStats {
  averageDays: number | null;
  medianDays: number | null;
  oldestDays: number | null;
  openCount: number;
  over30Days: number;
}

export interface ProcessingTimeStats {
  averageDays: number | null;
  medianDays: number | null;
  sampleSize: number;
  byStatus: Record<string, number>;
  previousAverageDays: number | null;
}

interface DateWindowOptions {
  referenceDate?: Date;
  days?: number;
  /** Set of lowercase status names that count as completed. Falls back to legacy defaults if not provided. */
  completionStatuses?: Set<string>;
}

interface ProcessingTimeOptions {
  referenceDate?: Date;
  windowInDays?: number;
  /** Set of lowercase status names that count as completed. Falls back to legacy defaults if not provided. */
  completionStatuses?: Set<string>;
}

const DEFAULT_DAYS = 7;
/** @deprecated Use completionStatuses from CategoryConfig instead */
const LEGACY_COMPLETION_STATUSES = new Set([
  "approved",
  "denied",
  "closed",
  "spenddown",
]);
const STATUS_COLOR_MAP: Record<string, string> = {
  pending: "bg-primary/70 text-primary-foreground",
  approved: "bg-emerald-500/80 text-emerald-950",
  denied: "bg-destructive/80 text-destructive-foreground",
  closed: "bg-muted-foreground/40 text-background",
  spenddown: "bg-amber-500/80 text-amber-950",
};

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function isoDateKey(date: Date): string {
  // Use local time components directly without calling startOfDay again
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeParseDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function buildDayBuckets(days: number, referenceDate: Date): string[] {
  const end = startOfDay(referenceDate);
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const current = addDays(end, -offset);
    keys.push(isoDateKey(current));
  }
  return keys;
}

function calculateAverage(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

function calculateMedian(values: number[]): number | null {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

function daysBetween(start: Date, end: Date): number {
  const diff = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function isWithinRange(date: Date, start: Date, end: Date): boolean {
  const value = startOfDay(date).getTime();
  return (
    value >= startOfDay(start).getTime() && value <= startOfDay(end).getTime()
  );
}

export function calculateAlertsClearedPerDay(
  alerts: AlertWithMatch[] | null | undefined,
  options: DateWindowOptions = {}
): DailyAlertStats[] {
  const referenceDate = options.referenceDate
    ? startOfDay(options.referenceDate)
    : startOfDay(new Date());
  const days = options.days && options.days > 0 ? options.days : DEFAULT_DAYS;
  const keys = buildDayBuckets(days, referenceDate);
  const start = addDays(referenceDate, -(days - 1));

  const counts = new Map<string, number>();
  keys.forEach((key) => counts.set(key, 0));

  if (!alerts || alerts.length === 0) {
    return keys.map((date) => ({ date, clearedCount: 0 }));
  }

  alerts.forEach((alert) => {
    if (!alert) {
      return;
    }

    if (alert.status && alert.status.toLowerCase() !== "resolved") {
      return;
    }

    const resolvedAt = safeParseDate(alert.resolvedAt ?? undefined);
    if (!resolvedAt || !isWithinRange(resolvedAt, start, referenceDate)) {
      return;
    }

    const key = isoDateKey(resolvedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return keys.map((date) => ({
    date,
    clearedCount: counts.get(date) ?? 0,
  }));
}

export function calculateCasesProcessedPerDay(
  activityLog: CaseActivityEntry[] | null | undefined,
  options: DateWindowOptions = {}
): DailyCaseStats[] {
  const referenceDate = options.referenceDate
    ? startOfDay(options.referenceDate)
    : startOfDay(new Date());
  const days = options.days && options.days > 0 ? options.days : DEFAULT_DAYS;
  const completionStatuses =
    options.completionStatuses ?? LEGACY_COMPLETION_STATUSES;
  const keys = buildDayBuckets(days, referenceDate);
  const start = addDays(referenceDate, -(days - 1));

  const counts = new Map<string, number>();
  keys.forEach((key) => counts.set(key, 0));

  if (!activityLog || activityLog.length === 0) {
    return keys.map((date) => ({ date, processedCount: 0 }));
  }

  activityLog.forEach((entry) => {
    if (!entry || entry.type !== "status-change") {
      return;
    }

    const timestamp = safeParseDate(entry.timestamp);
    if (!timestamp || !isWithinRange(timestamp, start, referenceDate)) {
      return;
    }

    const key = isoDateKey(timestamp);
    const toStatus = entry.payload?.toStatus?.toLowerCase();
    const fromStatus = entry.payload?.fromStatus?.toLowerCase();

    const movedToCompletion = toStatus && completionStatuses.has(toStatus);
    const movedFromCompletion = fromStatus && completionStatuses.has(fromStatus);

    // Net change: +1 when moving TO completion, -1 when moving FROM completion
    if (movedToCompletion && !movedFromCompletion) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    } else if (movedFromCompletion && !movedToCompletion) {
      counts.set(key, (counts.get(key) ?? 0) - 1);
    }
    // If moving between two completion statuses, net change is 0
  });

  return keys.map((date) => ({
    date,
    processedCount: counts.get(date) ?? 0,
  }));
}

export function calculateTotalCasesByStatus(
  cases: StoredCase[] | null | undefined
): StatusBreakdown[] {
  if (!cases || cases.length === 0) {
    return [];
  }

  const counts = new Map<string, number>();
  cases.forEach((caseItem) => {
    const rawStatus =
      caseItem?.caseRecord?.status ?? caseItem?.status ?? "Unknown";
    const normalizedStatus = rawStatus.trim() || "Unknown";
    const key = normalizedStatus.toLowerCase();
    counts.set(normalizedStatus, (counts.get(normalizedStatus) ?? 0) + 1);
    if (!STATUS_COLOR_MAP[key]) {
      STATUS_COLOR_MAP[key] = "bg-muted/80 text-foreground";
    }
  });

  const total =
    [...counts.values()].reduce((acc, value) => acc + value, 0) || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => {
      const colorKey = status.toLowerCase();
      const colorClass =
        STATUS_COLOR_MAP[colorKey] ?? "bg-muted/80 text-foreground";
      return {
        status,
        count,
        percentage: (count / total) * 100,
        colorClass,
      };
    });
}

export function calculateTotalAlertsByDescription(
  alerts: AlertWithMatch[] | null | undefined
): AlertDescriptionStats[] {
  if (!alerts || alerts.length === 0) {
    return [];
  }

  const totals = new Map<
    string,
    { label: string; count: number; resolved: number }
  >();

  alerts.forEach((alert) => {
    if (!alert) {
      return;
    }

    const label = (alert.description?.trim() || "Unspecified").slice(0, 120);
    const key = label.toLowerCase();
    const existing = totals.get(key) ?? { label, count: 0, resolved: 0 };
    const resolved = isAlertResolved(alert) ? 1 : 0;
    totals.set(key, {
      label: existing.label,
      count: existing.count + 1,
      resolved: existing.resolved + resolved,
    });
  });

  // Only count open alerts for the total
  const grandTotal =
    [...totals.values()].reduce(
      (acc, value) => acc + (value.count - value.resolved),
      0
    ) || 1;

  return [...totals.values()]
    .sort((a, b) => b.count - b.resolved - (a.count - a.resolved))
    .map((item) => {
      const resolvedCount = item.resolved;
      const openCount = item.count - resolvedCount;
      return {
        description: item.label,
        count: openCount,
        percentage: (openCount / grandTotal) * 100,
        openCount,
        resolvedCount,
      };
    });
}

export function calculateAvgAlertAge(
  alerts: AlertWithMatch[] | null | undefined,
  options: { referenceDate?: Date } = {}
): AlertAgeStats {
  const referenceDate = options.referenceDate
    ? startOfDay(options.referenceDate)
    : startOfDay(new Date());
  const agingDurations: number[] = [];

  if (alerts && alerts.length > 0) {
    alerts.forEach((alert) => {
      if (!alert || isAlertResolved(alert)) {
        return;
      }

      const primaryDate =
        safeParseDate(alert.alertDate) ||
        safeParseDate(alert.createdAt) ||
        safeParseDate(alert.updatedAt);
      if (!primaryDate) {
        return;
      }

      agingDurations.push(daysBetween(primaryDate, referenceDate));
    });
  }

  if (agingDurations.length === 0) {
    return {
      averageDays: null,
      medianDays: null,
      oldestDays: null,
      openCount: 0,
      over30Days: 0,
    };
  }

  const oldestDays = Math.max(...agingDurations);
  const over30Days = agingDurations.filter((day) => day > 30).length;

  return {
    averageDays: calculateAverage(agingDurations),
    medianDays: calculateMedian(agingDurations),
    oldestDays,
    openCount: agingDurations.length,
    over30Days,
  };
}

export function calculateAvgCaseProcessingTime(
  activityLog: CaseActivityEntry[] | null | undefined,
  cases: StoredCase[] | null | undefined,
  options: ProcessingTimeOptions = {}
): ProcessingTimeStats {
  const referenceDate = options.referenceDate
    ? startOfDay(options.referenceDate)
    : startOfDay(new Date());
  const windowDays =
    options.windowInDays && options.windowInDays > 0
      ? options.windowInDays
      : 30;
  const completionStatuses =
    options.completionStatuses ?? LEGACY_COMPLETION_STATUSES;
  const windowStart = addDays(referenceDate, -(windowDays - 1));
  const previousWindowEnd = addDays(windowStart, -1);
  const previousWindowStart = addDays(previousWindowEnd, -(windowDays - 1));

  if (
    !activityLog ||
    activityLog.length === 0 ||
    !cases ||
    cases.length === 0
  ) {
    return {
      averageDays: null,
      medianDays: null,
      sampleSize: 0,
      byStatus: {},
      previousAverageDays: null,
    };
  }

  const creationMap = new Map<string, Date>();
  cases.forEach((caseItem) => {
    const caseId = caseItem.id;
    const recordId = caseItem.caseRecord?.id;
    const createdDate =
      safeParseDate(caseItem.caseRecord?.createdDate) ||
      safeParseDate(caseItem.createdAt);
    if (createdDate) {
      creationMap.set(caseId, createdDate);
      if (recordId) {
        creationMap.set(recordId, createdDate);
      }
    }
  });

  const currentDurations: number[] = [];
  const previousDurations: number[] = [];
  const statusSums = new Map<string, { total: number; count: number }>();

  activityLog.forEach((entry) => {
    if (!entry || entry.type !== "status-change") {
      return;
    }

    const toStatus = entry.payload?.toStatus;
    if (!toStatus || !completionStatuses.has(toStatus.toLowerCase())) {
      return;
    }

    const completionDate = safeParseDate(entry.timestamp);
    if (!completionDate) {
      return;
    }

    const caseCreatedDate = creationMap.get(entry.caseId);
    if (!caseCreatedDate) {
      return;
    }

    const duration = daysBetween(caseCreatedDate, completionDate);
    if (duration < 0) {
      return;
    }

    if (isWithinRange(completionDate, windowStart, referenceDate)) {
      currentDurations.push(duration);
      const normalizedStatus = toStatus.trim() || "Completed";
      const current = statusSums.get(normalizedStatus) ?? {
        total: 0,
        count: 0,
      };
      statusSums.set(normalizedStatus, {
        total: current.total + duration,
        count: current.count + 1,
      });
    } else if (
      isWithinRange(completionDate, previousWindowStart, previousWindowEnd)
    ) {
      previousDurations.push(duration);
    }
  });

  const byStatus: Record<string, number> = {};
  statusSums.forEach((value, status) => {
    if (value.count > 0) {
      byStatus[status] = value.total / value.count;
    }
  });

  return {
    averageDays: calculateAverage(currentDurations),
    medianDays: calculateMedian(currentDurations),
    sampleSize: currentDurations.length,
    byStatus,
    previousAverageDays: calculateAverage(previousDurations),
  };
}

export const widgetDateUtils = {
  startOfDay,
  addDays,
};
