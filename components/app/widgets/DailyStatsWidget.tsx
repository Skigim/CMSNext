import { useCallback, useMemo } from "react";
import { BellOff, CheckCircle2, Gauge, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  activeCases: number;
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
  const completionStatuses = useMemo(() => getCompletionStatusNames(config), [config]);

  const fetchData = useCallback(async () => {
    const now = new Date();
    const reference = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const activeCases = cases.filter(
      (caseItem) => !isCompletedStatus(caseItem.status, config.caseStatuses),
    );
    const priorityConfig = { caseStatuses: config.caseStatuses, alertTypes: config.alertTypes };
    const totalScore = activeCases.reduce((acc, caseItem) => {
      const caseAlerts = alerts.alertsByCaseId.get(caseItem.id) ?? [];
      const unresolvedAlerts = caseAlerts.filter((alert) => !isAlertResolved(alert));
      return acc + calculatePriorityScore(caseItem, unresolvedAlerts, priorityConfig);
    }, 0);
    const averagePriority =
      activeCases.length > 0 ? totalScore / activeCases.length : null;

    const dailyCases = calculateCasesProcessedPerDay(activityLog, {
      referenceDate: reference,
      days: 1,
      completionStatuses,
    });
    const processedToday = dailyCases[0]?.processedCount ?? 0;

    const dailyAlerts = calculateAlertsClearedPerDay(alerts.alerts, {
      referenceDate: reference,
      days: 1,
    });
    const alertsClearedToday = dailyAlerts[0]?.clearedCount ?? 0;

    return {
      averagePriority,
      activeCases: activeCases.length,
      processedToday,
      alertsClearedToday,
    } satisfies DailyStatsData;
  }, [
    cases,
    alerts,
    activityLog,
    completionStatuses,
    config.caseStatuses,
    config.alertTypes,
  ]);

  const { data, loading, error, freshness } = useWidgetData<DailyStatsData>(fetchData, {
    refreshInterval: metadata?.refreshInterval ?? 60 * 1000,
    enablePerformanceTracking: true,
  });

  const freshnessLabel = useMemo(() => formatFreshnessLabel(freshness), [freshness]);
  const priorityFormatter = useMemo(
    () => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }),
    [],
  );
  const averagePriorityLabel =
    data?.averagePriority == null ? "--" : priorityFormatter.format(data.averagePriority);

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Overview</CardTitle>
          <CardDescription>Refreshing daily activity signals...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-20 rounded-lg bg-muted animate-pulse" />
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
          <CardTitle>Daily Overview</CardTitle>
          <CardDescription>Unable to load daily stats</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive/90">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  const activeCasesLabel = data?.activeCases ? `${data.activeCases} active` : "No active cases";
  const activeCasesDescription = data?.activeCases
    ? `${data.activeCases} active cases scored`
    : "No active cases to score";
  const hasData =
    (data?.activeCases ?? 0) > 0 ||
    (data?.processedToday ?? 0) > 0 ||
    (data?.alertsClearedToday ?? 0) > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Daily Overview</CardTitle>
            <CardDescription>Priority, completion, and alert progress for today</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {activeCasesLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Avg. priority</span>
              <Gauge className="h-4 w-4" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {averagePriorityLabel}
            </p>
            <p className="text-xs text-muted-foreground">{activeCasesDescription}</p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Processed today</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {data?.processedToday ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Completion status updates</p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Alerts cleared</span>
              <BellOff className="h-4 w-4 text-amber-500" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {data?.alertsClearedToday ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Resolved alert activity</p>
          </div>
        </div>
        {!hasData && (
          <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-6 text-center text-muted-foreground">
            <Info className="h-5 w-5" aria-hidden />
            <p className="text-sm font-medium">No updates recorded today</p>
            <p className="text-xs">Add case activity to see daily stats.</p>
          </div>
        )}
        <div className="mt-4 border-t border-border/60 pt-3 text-center text-xs text-muted-foreground">
          Last checked: {freshnessLabel}
        </div>
      </CardContent>
    </Card>
  );
}

export default DailyStatsWidget;
