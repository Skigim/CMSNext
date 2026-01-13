import { useCallback, useMemo, useState } from "react";
import { useDataManagerSafe } from "../contexts/DataManagerContext";
import { useDataSync } from "./useDataSync";
import type { CaseActivityEntry, DailyActivityReport } from "../types/activityLog";
import {
  generateDailyActivityReport,
  groupActivityEntriesByDate,
  toActivityDateKey,
} from "../utils/activityReport";
import { LegacyFormatError } from "../utils/services/FileStorageService";
import { createLogger } from "../utils/logger";

const logger = createLogger("useCaseActivityLog");

/**
 * Return type for useCaseActivityLog hook.
 * @interface UseCaseActivityLogResult
 */
interface UseCaseActivityLogResult {
  /** All activity log entries */
  activityLog: CaseActivityEntry[];
  /** Activity grouped and summarized by date */
  dailyReports: DailyActivityReport[];
  /** Today's activity report (or null if no activity today) */
  todayReport: DailyActivityReport | null;
  /** Yesterday's activity report (or null if none) */
  yesterdayReport: DailyActivityReport | null;
  /** Whether activity log is loading */
  loading: boolean;
  /** Error message if load failed */
  error: string | null;
  /** Manually reload activity log from file */
  refreshActivityLog: () => Promise<void>;
  /** Get activity report for specific date */
  getReportForDate: (date: string | Date) => DailyActivityReport;
  /** Clear/delete activity for specific date */
  clearReportForDate: (date: string | Date) => Promise<number>;
}

/**
 * Case activity log hook.
 * 
 * Manages application activity log across all cases.
 * Automatically loads and groups activity by date.
 * Provides daily summaries and date-specific queries.
 * 
 * ## Activity Tracking
 * 
 * Logs all case changes:
 * - Case creation, updates, deletions
 * - Status and priority changes
 * - Note additions and edits
 * - Financial item changes
 * - Alert resolutions
 * 
 * ## Daily Summaries
 * 
 * Activity automatically summarized into daily reports with counts:
 * - Case changes: Creates, updates, deletions
 * - Note changes: Adds, updates, deletions
 * - Financial changes: Adds, updates, deletions
 * 
 * ## Usage Example
 * 
 * ```typescript
 * function ActivityPanel() {
 *   const {
 *     dailyReports,
 *     todayReport,
 *     refreshActivityLog
 *   } = useCaseActivityLog();
 *   
 *   return (
 *     <div>
 *       <h2>Activity Log</h2>
 *       {todayReport && (
 *         <TodaysSummary report={todayReport} />
 *       )}
 *       {dailyReports.map(report => (
 *         <DayReport key={report.date} report={report} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 * 
 * ## Date Queries
 * 
 * Get summary for specific date:
 * 
 * ```typescript
 * const report = getReportForDate('2025-12-29');
 * // or
 * const report = getReportForDate(new Date('2025-12-29'));
 * ```
 * 
 * ## Activity Clearing
 * 
 * Delete activity entries for specific date:
 * 
 * ```typescript
 * const deletedCount = await clearReportForDate('2025-12-28');
 * console.log(`Deleted ${deletedCount} entries`);
 * ```
 * 
 * ## Auto-Reload
 * 
 * Activity log automatically reloads when:
 * - File data changes (imports, case modifications)
 * - DataManager becomes available
 * 
 * @hook
 * @returns {UseCaseActivityLogResult} Activity log state and methods
 * 
 * @see {@link useDataManagerSafe} for safe DataManager access
 * @see {@link DataManager} for underlying persistence
 */
export function useCaseActivityLog(): UseCaseActivityLogResult {
  const dataManager = useDataManagerSafe();
  const [activityLog, setActivityLog] = useState<CaseActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshActivityLog = useCallback(async () => {
    if (!dataManager) {
      setActivityLog([]);
      setError(null); // Clear error when not connected (it's expected)
      return;
    }

    setLoading(true);
    try {
      const entries = await dataManager.getActivityLog();
      setActivityLog(entries);
      setError(null);
    } catch (err) {
      // LegacyFormatError is expected when opening old data files - handle gracefully
      if (err instanceof LegacyFormatError) {
        logger.warn("Legacy format detected in activity log", { message: err.message });
        setError(err.message);
      } else {
        console.error("Failed to load activity log", err);
        // Only set error if it's not a permission issue (which is expected when not connected)
        const isPermissionError = err instanceof Error && 
          (err.message.includes('permission') || err.message.includes('requested file could not be read'));
        if (!isPermissionError) {
          setError(err instanceof Error ? err.message : "Failed to load activity log");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [dataManager]);

  // Sync with file storage data changes
  useDataSync({ onRefresh: refreshActivityLog });

  const groupedByDate = useMemo(() => groupActivityEntriesByDate(activityLog), [activityLog]);

  const dailyReports = useMemo(
    () =>
      Array.from(groupedByDate.entries()).map(([dateKey, entriesForDate]) =>
        generateDailyActivityReport(entriesForDate, dateKey),
      ),
    [groupedByDate],
  );

  const todayReport = useMemo(() => {
    const todayKey = toActivityDateKey(new Date());
    return dailyReports.find(report => report.date === todayKey) ?? null;
  }, [dailyReports]);

  const yesterdayReport = useMemo(() => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayKey = toActivityDateKey(yesterday);
    return dailyReports.find(report => report.date === yesterdayKey) ?? null;
  }, [dailyReports]);

  const getReportForDate = useCallback(
    (date: string | Date) => {
      try {
        return generateDailyActivityReport(activityLog, date);
      } catch {
        const fallbackDateKey = (() => {
          try {
            return toActivityDateKey(date);
          } catch {
            return toActivityDateKey(new Date());
          }
        })();

        return {
          date: fallbackDateKey,
          totals: { total: 0, statusChanges: 0, priorityChanges: 0, notesAdded: 0 },
          entries: [],
          cases: [],
        } as DailyActivityReport;
      }
    },
    [activityLog],
  );

  const clearReportForDate = useCallback(
    async (date: string | Date) => {
      if (!dataManager) {
        throw new Error("Data storage is not connected.");
      }

      const dateKey = toActivityDateKey(date);
      const removedCount = await dataManager.clearActivityLogForDate(date);

      if (removedCount > 0) {
        setActivityLog(prev =>
          prev.filter(entry => {
            try {
              return toActivityDateKey(entry.timestamp) !== dateKey;
            } catch {
              return true;
            }
          }),
        );
      }

      return removedCount;
    },
    [dataManager],
  );

  return {
    activityLog,
    dailyReports,
    todayReport,
    yesterdayReport,
    loading,
    error,
    refreshActivityLog,
    getReportForDate,
    clearReportForDate,
  };
}
