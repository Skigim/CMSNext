import { useMemo, useState, useCallback } from "react";
import { StoredCase, CaseStatus } from "../../types/case";
import { type AlertsIndex } from "../../utils/alertsData";
import type { CaseActivityLogState } from "../../types/activityLog";
import { WidgetRegistry, createLazyWidget, type RegisteredWidget } from "./widgets/WidgetRegistry";
import { useAppViewState } from "@/hooks/useAppViewState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuickActionsBar } from "./QuickActionsBar";

interface DashboardProps {
  cases: StoredCase[];
  alerts: AlertsIndex;
  activityLogState: CaseActivityLogState;
  onNewCase: () => void;
  onViewCase?: (caseId: string) => void;
  onBulkStatusUpdate?: (status: CaseStatus) => void;
  onExport?: () => void;
  onImport?: () => void;
  onImportAlerts?: () => void;
}

const ActivityWidgetLazy = createLazyWidget(
  import("./widgets/ActivityWidget"),
  "ActivityWidget",
);

const TodaysWorkWidgetLazy = createLazyWidget(
  import("./widgets/TodaysWorkWidget"),
  "TodaysWorkWidget",
);

const RecentCasesWidgetLazy = createLazyWidget(
  import("./widgets/RecentCasesWidget"),
  "RecentCasesWidget",
);

const PinnedCasesWidgetLazy = createLazyWidget(
  import("./widgets/PinnedCasesWidget"),
  "PinnedCasesWidget",
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

export function Dashboard({ 
  cases, 
  alerts, 
  activityLogState, 
  onNewCase, 
  onViewCase,
  onBulkStatusUpdate,
  onExport,
  onImport,
  onImportAlerts,
}: DashboardProps) {
  const { featureFlags, globalSearchTerm, setGlobalSearchTerm } = useAppViewState();
  const [localSearchTerm, setLocalSearchTerm] = useState(globalSearchTerm);

  const allAlerts = useMemo(() => alerts.alerts ?? [], [alerts.alerts]);
  const activityEntries = useMemo(() => activityLogState.activityLog ?? [], [activityLogState.activityLog]);

  // Handle search change with debouncing
  const handleSearchChange = useCallback((term: string) => {
    setLocalSearchTerm(term);
    setGlobalSearchTerm(term);
  }, [setGlobalSearchTerm]);

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
          id: 'todays-work',
          title: "Today's Work",
          description: 'Priority cases requiring attention',
          priority: 0,
          refreshInterval: 2 * 60 * 1000,
          featureFlag: 'dashboard.widgets.todaysWork',
        },
        component: TodaysWorkWidgetLazy,
        props: { cases, alerts, onViewCase },
      },
      {
        metadata: {
          id: 'recent-cases',
          title: 'Recently Viewed',
          description: 'Quick access to cases you have viewed',
          priority: 2,
          featureFlag: 'dashboard.widgets.recentCases',
        },
        component: RecentCasesWidgetLazy,
        props: { cases, onViewCase },
      },
      {
        metadata: {
          id: 'pinned-cases',
          title: 'Pinned Cases',
          description: 'Your favorite cases for quick access',
          priority: 3,
          featureFlag: 'dashboard.widgets.pinnedCases',
        },
        component: PinnedCasesWidgetLazy,
        props: { cases, onViewCase },
      },
      {
        metadata: {
          id: 'avg-case-processing-time',
          title: 'Avg. Case Processing Time',
          description: 'Average days to resolve a case',
          priority: 1,
          refreshInterval: 10 * 60 * 1000,
          featureFlag: 'dashboard.widgets.avgCaseProcessing',
        },
        component: AvgCaseProcessingTimeWidgetLazy,
        props: { activityLog: activityEntries, cases },
      },
      {
        metadata: {
          id: 'cases-processed-per-day',
          title: 'Cases Processed/Day',
          description: 'Daily case processing over the last 7 days',
          priority: 2,
          refreshInterval: 5 * 60 * 1000,
          featureFlag: 'dashboard.widgets.casesProcessed',
        },
        component: CasesProcessedPerDayWidgetLazy,
        props: { activityLog: activityEntries, refreshKey: activityRefreshKey },
      },
      {
        metadata: {
          id: 'total-cases-by-status',
          title: 'Total Cases by Status',
          description: 'Current status distribution across all cases',
          priority: 3,
          refreshInterval: 5 * 60 * 1000,
          featureFlag: 'dashboard.widgets.casesByStatus',
        },
        component: CasesByStatusWidgetLazy,
        props: { cases },
      },
      {
        metadata: {
          id: 'avg-alert-age',
          title: 'Avg. Alert Age',
          description: 'Average age of active alerts',
          priority: 4,
          refreshInterval: 5 * 60 * 1000,
          featureFlag: 'dashboard.widgets.avgAlertAge',
        },
        component: AvgAlertAgeWidgetLazy,
        props: { alerts: allAlerts },
      },
      {
        metadata: {
          id: 'alerts-cleared-per-day',
          title: 'Alerts Cleared/Day',
          description: 'Alert resolution trends over the last 7 days',
          priority: 5,
          refreshInterval: 5 * 60 * 1000,
          featureFlag: 'dashboard.widgets.alertsCleared',
        },
        component: AlertsClearedPerDayWidgetLazy,
        props: { alerts: allAlerts, refreshKey: alertsRefreshKey },
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
          id: 'activity',
          title: 'Activity',
          description: 'Recent timeline and daily reports',
          priority: 1,
          refreshInterval: 2 * 60 * 1000, // 2 minutes
          featureFlag: 'dashboard.widgets.activityTimeline',
        },
        component: ActivityWidgetLazy,
        props: { activityLogState, onViewCase },
      },
    ];
  }, [cases, alerts, allAlerts, activityEntries, activityLogState, alertsRefreshKey, activityRefreshKey, onViewCase]);

  const overviewWidgets = useMemo(() => widgets.filter(w => 
    w.metadata.id === 'activity' || 
    w.metadata.id === 'todays-work' || 
    w.metadata.id === 'recent-cases' ||
    w.metadata.id === 'pinned-cases'
  ), [widgets]);
  const analyticsWidgets = useMemo(() => widgets.filter(w => 
    w.metadata.id !== 'activity' && 
    w.metadata.id !== 'todays-work' && 
    w.metadata.id !== 'recent-cases' &&
    w.metadata.id !== 'pinned-cases'
  ), [widgets]);

  return (
    <div className="flex flex-col h-full" data-papercut-context="Dashboard">
      {/* Quick Actions Bar */}
      <QuickActionsBar
        onNewCase={onNewCase}
        onSearchChange={handleSearchChange}
        searchTerm={localSearchTerm}
        onBulkStatusUpdate={onBulkStatusUpdate}
        onExport={onExport}
        onImport={onImport}
        onImportAlerts={onImportAlerts}
        showBulkOperations={!!onBulkStatusUpdate}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <Tabs defaultValue="overview" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">Recent Activity</h2>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-3">
            <WidgetRegistry
              widgets={overviewWidgets}
              gridClassName="grid grid-cols-1 lg:grid-cols-2 gap-4"
              enabledFlags={featureFlags}
            />
          </TabsContent>

          <TabsContent value="analytics" className="mt-3">
            <WidgetRegistry
              widgets={analyticsWidgets}
              gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              enabledFlags={featureFlags}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default Dashboard;