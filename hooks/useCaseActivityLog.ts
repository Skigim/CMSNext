import { useCallback, useEffect, useMemo, useState } from "react";
import { useDataManagerSafe } from "../contexts/DataManagerContext";
import type { CaseActivityEntry, DailyActivityReport } from "../types/activityLog";
import {
  generateDailyActivityReport,
  groupActivityEntriesByDate,
  toActivityDateKey,
} from "../utils/activityReport";

interface UseCaseActivityLogResult {
  activityLog: CaseActivityEntry[];
  dailyReports: DailyActivityReport[];
  todayReport: DailyActivityReport | null;
  yesterdayReport: DailyActivityReport | null;
  loading: boolean;
  error: string | null;
  refreshActivityLog: () => Promise<void>;
  getReportForDate: (date: string | Date) => DailyActivityReport;
}

export function useCaseActivityLog(): UseCaseActivityLogResult {
  const dataManager = useDataManagerSafe();
  const [activityLog, setActivityLog] = useState<CaseActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshActivityLog = useCallback(async () => {
    if (!dataManager) {
      setActivityLog([]);
      setError("Data storage is not connected.");
      return;
    }

    setLoading(true);
    try {
      const entries = await dataManager.getActivityLog();
      setActivityLog(entries);
      setError(null);
    } catch (err) {
      console.error("Failed to load activity log", err);
      setError(err instanceof Error ? err.message : "Failed to load activity log");
    } finally {
      setLoading(false);
    }
  }, [dataManager]);

  useEffect(() => {
    refreshActivityLog().catch(err => {
      console.error("Failed to refresh activity log", err);
    });
  }, [refreshActivityLog]);

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
          totals: { total: 0, statusChanges: 0, notesAdded: 0 },
          entries: [],
          cases: [],
        } as DailyActivityReport;
      }
    },
    [activityLog],
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
  };
}
