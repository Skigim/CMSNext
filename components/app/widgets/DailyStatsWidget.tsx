import { useCallback, useMemo } from "react";
import { Activity, BellOff, CheckCircle2, Gauge, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatFreshnessLabel } from "@/domain/common";
import { useWidgetData } from "@/hooks/useWidgetData";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { getCompletionStatusNames } from "@/types/categoryConfig";
import type { StoredCase } from "@/types/case";
import type { CaseActivityEntry } from "@/types/activityLog";
import type { AlertsIndex } from "@/utils/alertsData";
import { isAlertResolved } from "@/utils/alertsData";
import {
  calculateAlertsClearedPerDay,
  calculateCasesProcessedPerDay,
  calculatePriorityScore,
  isCompletedStatus,
} from "@/domain/dashboard";
import type { WidgetMetadata } from "./WidgetRegistry";

interface DailyStatsWidgetProps {
  cases: StoredCase[];
  alerts: AlertsIndex;
  activityLog: CaseActivityEntry[];
  metadata?: WidgetMetadata;
}

interface DailyStatsData {
  averagePriority: number | null;
  activeCaseCount: number;
  processedToday: number;
  alertsClearedToday: number;
}

export function DailyStatsWidget({
  cases = [],
  alerts,
  activityLog = [],
  metadata,
}: DailyStatsWidgetProps) {
  const { config } = useCategoryConfig();
  const completionStatuses = useMemo(
    () => getCompletionStatusNames(config),
    [config]
  );
  const requireNoteOnSameDay = config.dashboardSettings?.requireNoteForProcessedCount ?? false;

  const fetchData = useCallback(async (): Promise<DailyStatsData> => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Calculate average priority of active cases
    const activeCases = cases.filter(
      (c) => !isCompletedStatus(c.status, config.caseStatuses)
    );

    let averagePriority: number | null = null;
    if (activeCases.length > 0) {
      const priorityConfig = {
        caseStatuses: config.caseStatuses,
        alertTypes: config.alertTypes,
      };
      const totalScore = activeCases.reduce((acc, caseItem) => {
        const caseAlerts = alerts.alertsByCaseId.get(caseItem.id) ?? [];
        const unresolvedAlerts = caseAlerts.filter((a) => !isAlertResolved(a));
        return (
          acc + calculatePriorityScore(caseItem, unresolvedAlerts, priorityConfig)
        );
      }, 0);
      averagePriority = totalScore / activeCases.length;
    }

    // 2. Cases processed today
    const dailyCases = calculateCasesProcessedPerDay(activityLog, {
      referenceDate: today,
      days: 1,
      completionStatuses,
      requireNoteOnSameDay,
    });
    const processedToday = dailyCases[0]?.processedCount ?? 0;

    // 3. Alerts cleared today
    const dailyAlerts = calculateAlertsClearedPerDay(alerts.alerts, {
      referenceDate: today,
      days: 1,
    });
    const alertsClearedToday = dailyAlerts[0]?.clearedCount ?? 0;

    return {
      averagePriority,
      activeCaseCount: activeCases.length,
      processedToday,
      alertsClearedToday,
    };
  }, [cases, alerts, activityLog, completionStatuses, requireNoteOnSameDay, config.caseStatuses, config.alertTypes]);

  const { data, loading, error, freshness } = useWidgetData<DailyStatsData>(
    fetchData,
    {
      refreshInterval: metadata?.refreshInterval ?? 5 * 60 * 1000,
      enablePerformanceTracking: true,
    }
  );

  const freshnessLabel = useMemo(
    () => formatFreshnessLabel(freshness),
    [freshness]
  );

  const priorityFormatter = useMemo(
    () => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }),
    []
  );

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Daily Stats
          </CardTitle>
          <CardDescription>Loading today&apos;s metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Activity className="h-5 w-5" />
            Daily Stats
          </CardTitle>
          <CardDescription>Unable to load daily stats</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive/90">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  const avgPriorityLabel =
    data?.averagePriority == null
      ? "--"
      : priorityFormatter.format(data.averagePriority);
  const activeCasesLabel = data?.activeCaseCount
    ? `${data.activeCaseCount} active`
    : "No active cases";
  const hasActivity =
    (data?.processedToday ?? 0) > 0 || (data?.alertsClearedToday ?? 0) > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Daily Stats
            </CardTitle>
            <CardDescription>
              Today&apos;s priority, completions, and alert progress
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {activeCasesLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Average Priority */}
          <div className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Avg. Priority</span>
              <Gauge className="h-4 w-4" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {avgPriorityLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              {data?.activeCaseCount
                ? `${data.activeCaseCount} cases scored`
                : "No active cases"}
            </p>
          </div>

          {/* Cases Processed Today */}
          <div className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Processed</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {data?.processedToday ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Cases completed today</p>
          </div>

          {/* Alerts Cleared Today */}
          <div className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Alerts Cleared</span>
              <BellOff className="h-4 w-4 text-amber-500" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {data?.alertsClearedToday ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Resolved today</p>
          </div>
        </div>

        {!hasActivity && (
          <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-6 text-center text-muted-foreground">
            <Info className="h-5 w-5" aria-hidden="true" />
            <p className="text-sm font-medium">No activity recorded today</p>
            <p className="text-xs">Process cases or clear alerts to see updates.</p>
          </div>
        )}

        <div className="mt-4 border-t border-border/60 pt-3 pb-0 text-center text-xs text-muted-foreground">
          Last checked: {freshnessLabel}
        </div>
      </CardContent>
    </Card>
  );
}

export default DailyStatsWidget;
