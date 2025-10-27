import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { FileText, Clock, Plus, ArrowRight, CheckCircle2, XCircle, Coins, TrendingUp, BellRing } from "lucide-react";
import { CaseDisplay } from "../../types/case";
import { useCategoryConfig } from "../../contexts/CategoryConfigContext";
import {
  filterOpenAlerts,
  buildAlertStorageKey,
  type AlertsIndex,
  type AlertMatchStatus,
} from "../../utils/alertsData";
import { getAlertClientName, getAlertDisplayDescription, getAlertDueDateInfo, getAlertMcn } from "@/utils/alertDisplay";
import { UnlinkedAlertsDialog } from "@/components/alerts/UnlinkedAlertsDialog";
import { McnCopyControl } from "@/components/common/McnCopyControl";
import type { CaseActivityLogState } from "../../types/activityLog";
import { ActivityReportCard } from "./ActivityReportCard";
import { WidgetRegistry, createLazyWidget, type RegisteredWidget } from "./widgets/WidgetRegistry";
import { useAppState } from "@/hooks/useAppState";

interface DashboardProps {
  cases: CaseDisplay[];
  alerts: AlertsIndex;
  activityLogState: CaseActivityLogState;
  onViewAllCases: () => void;
  onNewCase: () => void;
  onNavigateToReports: () => void;
}

function formatAlertMatchStatus(status: AlertMatchStatus): string {
  if (status === "missing-mcn") {
    return "Missing MCN";
  }
  return status === "matched" ? "Matched" : "Unmatched";
}

const CasePriorityWidgetLazy = createLazyWidget(
  import("./widgets/CasePriorityWidget"),
  "CasePriorityWidget",
);

const ActivityTimelineWidgetLazy = createLazyWidget(
  import("./widgets/ActivityTimelineWidget"),
  "ActivityTimelineWidget",
);

const AlertsClearedPerDayWidgetLazy = createLazyWidget(
  import("./widgets/AlertsClearedPerDayWidget"),
  "AlertsClearedPerDayWidget",
);

const CasesProcessedPerDayWidgetLazy = createLazyWidget(
  import("./widgets/CasesProcessedPerDayWidget"),
  "CasesProcessedPerDayWidget",
);

const CasesByStatusWidgetLazy = createLazyWidget(
  import("./widgets/CasesByStatusWidget"),
  "CasesByStatusWidget",
);

const AlertsByDescriptionWidgetLazy = createLazyWidget(
  import("./widgets/AlertsByDescriptionWidget"),
  "AlertsByDescriptionWidget",
);

const AvgAlertAgeWidgetLazy = createLazyWidget(
  import("./widgets/AvgAlertAgeWidget"),
  "AvgAlertAgeWidget",
);

const AvgCaseProcessingTimeWidgetLazy = createLazyWidget(
  import("./widgets/AvgCaseProcessingTimeWidget"),
  "AvgCaseProcessingTimeWidget",
);

export function Dashboard({ cases, alerts, activityLogState, onViewAllCases, onNewCase, onNavigateToReports }: DashboardProps) {
  const { config } = useCategoryConfig();
  const { featureFlags } = useAppState();

  const allAlerts = useMemo(() => alerts.alerts ?? [], [alerts.alerts]);
  const activityEntries = useMemo(() => activityLogState.activityLog ?? [], [activityLogState.activityLog]);

  // Create refresh keys that change whenever the actual data content changes
  const alertsRefreshKey = useMemo(() => {
    return allAlerts.length > 0 
      ? `${allAlerts.length}-${allAlerts.filter(a => a.status === 'resolved').length}-${Date.now()}`
      : allAlerts.length;
  }, [allAlerts]);

  const activityRefreshKey = useMemo(() => {
    return activityEntries.length > 0
      ? `${activityEntries.length}-${activityEntries.filter(e => e.type === 'status-change').length}`
      : activityEntries.length;
  }, [activityEntries]);

  /**
   * Register dashboard widgets with metadata and props.
   */
  const widgets = useMemo<RegisteredWidget[]>(() => {
    return [
      {
        metadata: {
          id: 'case-priority',
          title: 'Case Priority',
          description: 'Breakdown of cases by priority level',
          priority: 1,
          refreshInterval: 5 * 60 * 1000, // 5 minutes
          featureFlag: 'dashboard.widgets.casePriority',
        },
        component: CasePriorityWidgetLazy,
        props: { cases },
      },
      {
        metadata: {
          id: 'alerts-cleared-per-day',
          title: 'Alerts Cleared/Day',
          description: 'Alert resolution trends over the last 7 days',
          priority: 2,
          refreshInterval: 5 * 60 * 1000,
          featureFlag: 'dashboard.widgets.alertsCleared',
        },
        component: AlertsClearedPerDayWidgetLazy,
        props: { alerts: allAlerts, refreshKey: alertsRefreshKey },
      },
      {
        metadata: {
          id: 'cases-processed-per-day',
          title: 'Cases Processed/Day',
          description: 'Daily case processing over the last 7 days',
          priority: 3,
          refreshInterval: 5 * 60 * 1000,
          featureFlag: 'dashboard.widgets.casesProcessed',
        },
        component: CasesProcessedPerDayWidgetLazy,
        props: { activityLog: activityEntries, refreshKey: activityRefreshKey },
      },
      {
        metadata: {
          id: 'activity-timeline',
          title: 'Activity Timeline',
          description: 'Recent activity from the last 7 days',
          priority: 4,
          refreshInterval: 2 * 60 * 1000, // 2 minutes
          featureFlag: 'dashboard.widgets.activityTimeline',
        },
        component: ActivityTimelineWidgetLazy,
        props: { activityLogState },
      },
      {
        metadata: {
          id: 'total-cases-by-status',
          title: 'Total Cases by Status',
          description: 'Current status distribution across all cases',
          priority: 5,
          refreshInterval: 5 * 60 * 1000,
          featureFlag: 'dashboard.widgets.casesByStatus',
        },
        component: CasesByStatusWidgetLazy,
        props: { cases },
      },
      {
        metadata: {
          id: 'total-alerts-by-description',
          title: 'Alerts by Description',
          description: 'Top alert types by frequency',
          priority: 6,
          refreshInterval: 5 * 60 * 1000,
          featureFlag: 'dashboard.widgets.alertsByDescription',
        },
        component: AlertsByDescriptionWidgetLazy,
        props: { alerts: allAlerts },
      },
      {
        metadata: {
          id: 'avg-alert-age',
          title: 'Avg. Alert Age',
          description: 'Average age of active alerts',
          priority: 7,
          refreshInterval: 5 * 60 * 1000,
          featureFlag: 'dashboard.widgets.avgAlertAge',
        },
        component: AvgAlertAgeWidgetLazy,
        props: { alerts: allAlerts },
      },
      {
        metadata: {
          id: 'avg-case-processing-time',
          title: 'Avg. Case Processing Time',
          description: 'Average days to resolve a case',
          priority: 8,
          refreshInterval: 10 * 60 * 1000,
          featureFlag: 'dashboard.widgets.avgCaseProcessing',
        },
        component: AvgCaseProcessingTimeWidgetLazy,
        props: { activityLog: activityEntries, cases },
      },
    ];
  }, [cases, allAlerts, activityEntries, activityLogState, alertsRefreshKey, activityRefreshKey]);

  const validCases = useMemo(
    () => cases.filter(c => c && c.caseRecord && typeof c.caseRecord === "object"),
    [cases],
  );

  const totalCases = cases.length;

  const statusCount = useCallback(
    (status: string) =>
      validCases.filter(c => c.caseRecord.status === status).length,
    [validCases],
  );

  const recentCases = validCases.slice(0, 5);

  const statusPalette = useMemo(
    () => [
      "text-primary",
      "text-accent-foreground",
      "text-destructive",
      "text-secondary-foreground",
      "text-chart-1",
      "text-muted-foreground",
    ],
    [],
  );

  const statusIconMap = useMemo(
    () => ({
      pending: { icon: Clock, description: "Awaiting determination" },
      approved: { icon: CheckCircle2, description: "Cleared for services" },
      denied: { icon: XCircle, description: "Requires follow-up" },
      spenddown: { icon: Coins, description: "Spenddown management" },
    }),
    [],
  );

  const statusStats = useMemo(
    () =>
      config.caseStatuses.map((status, index) => {
        const key = status.toLowerCase();
        const meta = statusIconMap[key as keyof typeof statusIconMap] || {
          icon: TrendingUp,
          description: "Tracked cases",
        };

        return {
          title: `${status} Cases`,
          value: statusCount(status),
          description: meta.description,
          icon: meta.icon,
          color: statusPalette[index % statusPalette.length],
        };
      }),
    [config.caseStatuses, statusCount, statusIconMap, statusPalette],
  );

  const totalAlerts = alerts.alerts.length;

  const openAlerts = useMemo(() => filterOpenAlerts(alerts.alerts), [alerts.alerts]);

  const unlinkedAlerts = useMemo(
    () => openAlerts.filter(alert => alert.matchStatus !== "matched"),
    [openAlerts],
  );

  const openAlertsCount = openAlerts.length;
  const unlinkedAlertCount = unlinkedAlerts.length;

  const [showUnlinkedDialog, setShowUnlinkedDialog] = useState(false);

  const stats = useMemo(
    () => [
      {
        title: "Alerts",
        value: totalAlerts,
        description:
          openAlertsCount === 0
            ? "No open alerts"
            : `${openAlertsCount} open${unlinkedAlertCount ? ` • ${unlinkedAlertCount} unlinked` : ""}`,
        icon: BellRing,
        color: totalAlerts > 0 ? "text-primary" : "text-muted-foreground",
      },
      {
        title: "Total Cases",
        value: totalCases,
        description: "All tracked cases",
        icon: FileText,
        color: "text-accent-foreground",
      },
      ...statusStats,
    ],
    [openAlertsCount, statusStats, totalAlerts, totalCases, unlinkedAlertCount],
  );

  const latestAlerts = useMemo(() => openAlerts.slice(0, 5), [openAlerts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your case management system</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onNewCase} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Case
          </Button>
        </div>
      </div>
      <ActivityReportCard activityLogState={activityLogState} />

      {/* Widget Section */}
      {widgets.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Insights</h2>
          <WidgetRegistry
            widgets={widgets}
            gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            enabledFlags={featureFlags}
          />
        </div>
      )}

      {/* Note: Evaluate blending Today's metrics directly into ActivityReportCard to reduce duplication when we revisit dashboard layout. */}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Cases */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Cases</CardTitle>
                <CardDescription>Latest cases added to the system</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={onViewAllCases}>
                View All
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentCases.length > 0 ? (
              <div className="space-y-3">
                {recentCases.map((case_) => (
                  <div key={case_.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {case_.person.firstName} {case_.person.lastName}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <McnCopyControl
                          mcn={case_.caseRecord?.mcn ?? null}
                          className="inline-flex items-center gap-1 text-muted-foreground"
                          labelClassName="text-sm font-normal text-muted-foreground"
                          buttonClassName="text-sm text-muted-foreground"
                          textClassName="text-sm"
                          missingLabel="MCN unavailable"
                          missingClassName="text-sm text-muted-foreground"
                          variant="plain"
                        />
                        <span>• Status: {case_.caseRecord?.status || 'Unknown'}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {case_.caseRecord?.createdDate ? new Date(case_.caseRecord.createdDate).toLocaleDateString() : 'No date'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No cases yet</p>
                <Button variant="outline" size="sm" onClick={onNewCase} className="mt-2">
                  Create your first case
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Alert Center</CardTitle>
                <CardDescription>Latest updates from the alerts feed</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BellRing className={totalAlerts ? "h-4 w-4 text-primary" : "h-4 w-4"} />
                  {totalAlerts ? `${totalAlerts} total` : "No alerts"}
                </div>
                {totalAlerts > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onNavigateToReports}
                    className="flex items-center gap-1"
                  >
                    View reports
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
                {unlinkedAlertCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowUnlinkedDialog(true)}
                    className="relative inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive transition hover:border-destructive/60 hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={`${unlinkedAlertCount} unlinked alert${unlinkedAlertCount === 1 ? "" : "s"}`}
                  >
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
                    <span>Unlinked</span>
                    <span>
                      <Badge variant="secondary" className="ml-0 flex h-4 items-center justify-center px-1 text-[10px] font-semibold">
                        {unlinkedAlertCount}
                      </Badge>
                    </span>
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {totalAlerts === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                <p>No alerts detected in the sample feed.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Open alerts</p>
                    <p className="text-lg font-semibold text-foreground">{openAlertsCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Unlinked alerts</p>
                    <p className="text-lg font-semibold text-destructive">{unlinkedAlertCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Recently resolved</p>
                    <p className="text-lg font-semibold text-foreground">
                      {totalAlerts - openAlertsCount}
                    </p>
                  </div>
                </div>

                {latestAlerts.length > 0 ? (
                  <div className="space-y-3">
                    {latestAlerts.map((alert, index) => {
                      const description = getAlertDisplayDescription(alert);
                      const { label, hasDate } = getAlertDueDateInfo(alert);
                      const dueLabel = hasDate ? `Due ${label}` : label;
                      const clientName = getAlertClientName(alert) ?? "Client name unavailable";
                      const mcn = getAlertMcn(alert);
                      const storageKey = buildAlertStorageKey(alert);
                      const elementKey = storageKey ?? (alert.id ? `alert-${String(alert.id)}-${index}` : `alert-${index}`);

                      return (
                        <div
                          key={elementKey}
                          className="rounded-lg border border-border/60 bg-card/60 p-3"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">{description}</p>
                            <p className="text-xs text-muted-foreground">{dueLabel || "No due date"}</p>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                              <span>{clientName}</span>
                              <McnCopyControl
                                mcn={mcn}
                                showLabel={false}
                                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                                buttonClassName="text-[11px] text-muted-foreground"
                                textClassName="text-[11px]"
                                missingLabel="MCN unavailable"
                                missingClassName="text-[11px] text-muted-foreground"
                                variant="plain"
                              />
                              <span className="uppercase tracking-wide">
                                Match: {formatAlertMatchStatus(alert.matchStatus)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                    All open alerts are resolved. Great job!
                  </div>
                )}

                {openAlertsCount > latestAlerts.length && (
                  <p className="text-xs text-muted-foreground">
                    Plus {openAlertsCount - latestAlerts.length} more open alert{openAlertsCount - latestAlerts.length === 1 ? "" : "s"} available in Reports.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
      
      <UnlinkedAlertsDialog
        alerts={unlinkedAlerts}
        open={showUnlinkedDialog}
        onOpenChange={setShowUnlinkedDialog}
      />
    </div>
  );
}

export default Dashboard;