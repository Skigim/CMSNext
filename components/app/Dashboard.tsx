import { useMemo } from "react";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import { CaseDisplay } from "../../types/case";
import { type AlertsIndex } from "../../utils/alertsData";
import type { CaseActivityLogState } from "../../types/activityLog";
import { WidgetRegistry, createLazyWidget, type RegisteredWidget } from "./widgets/WidgetRegistry";
import { useAppViewState } from "@/hooks/useAppViewState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecentCasesWidget } from "./widgets/RecentCasesWidget";
import { AlertCenterWidget } from "./widgets/AlertCenterWidget";

interface DashboardProps {
  cases: CaseDisplay[];
  alerts: AlertsIndex;
  activityLogState: CaseActivityLogState;
  onViewAllCases: () => void;
  onNewCase: () => void;
  onNavigateToReports: () => void;
}

const CasePriorityWidgetLazy = createLazyWidget(
  import("./widgets/CasePriorityWidget"),
  "CasePriorityWidget",
);

const ActivityWidgetLazy = createLazyWidget(
  import("./widgets/ActivityWidget"),
  "ActivityWidget",
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
  const { featureFlags } = useAppViewState();

  const allAlerts = useMemo(() => alerts.alerts ?? [], [alerts.alerts]);
  const activityEntries = useMemo(() => activityLogState.activityLog ?? [], [activityLogState.activityLog]);

  // Create refresh keys that change whenever the actual data content changes
  // These track the length and key metrics to detect when data has been updated
  const alertsRefreshKey = useMemo(() => {
    const resolvedCount = allAlerts.filter(a => a.status?.toLowerCase() === 'resolved').length;
    const resolvedWithDates = allAlerts.filter(a => a.status?.toLowerCase() === 'resolved' && a.resolvedAt).length;
    return `${allAlerts.length}-${resolvedCount}-${resolvedWithDates}`;
  }, [allAlerts]);

  const activityRefreshKey = useMemo(() => {
    const statusChangeCount = activityEntries.filter(e => e.type === 'status-change').length;
    const completedStatuses = activityEntries.filter(e => 
      e.type === 'status-change' && 
      e.payload?.toStatus && 
      ['approved', 'denied', 'closed', 'spenddown'].includes(e.payload.toStatus.toLowerCase())
    ).length;
    return `${activityEntries.length}-${statusChangeCount}-${completedStatuses}`;
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
          id: 'activity',
          title: 'Activity',
          description: 'Recent timeline and daily reports',
          priority: 4,
          refreshInterval: 2 * 60 * 1000, // 2 minutes
          featureFlag: 'dashboard.widgets.activityTimeline',
        },
        component: ActivityWidgetLazy,
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

  const overviewWidgets = useMemo(() => widgets.filter(w => w.metadata.id === 'activity'), [widgets]);
  const analyticsWidgets = useMemo(() => widgets.filter(w => w.metadata.id !== 'activity'), [widgets]);

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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AlertCenterWidget alerts={alerts} onNavigateToReports={onNavigateToReports} />
            <RecentCasesWidget cases={cases} onViewAllCases={onViewAllCases} onNewCase={onNewCase} />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
            <WidgetRegistry
              widgets={overviewWidgets}
              gridClassName="grid grid-cols-1 gap-4"
              enabledFlags={featureFlags}
            />
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <WidgetRegistry
            widgets={analyticsWidgets}
            gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            enabledFlags={featureFlags}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Dashboard;