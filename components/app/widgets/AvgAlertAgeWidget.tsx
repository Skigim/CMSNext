import { useCallback, useMemo } from 'react';
import { AlertOctagon, BellOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatFreshnessLabel } from '@/domain/common';
import { useWidgetData } from '@/hooks/useWidgetData';
import type { AlertWithMatch } from '@/utils/alertsData';
import { calculateAvgAlertAge, type AlertAgeStats } from '@/domain/dashboard';
import type { WidgetMetadata } from './WidgetRegistry';
import { WidgetSkeleton, WidgetError } from './WidgetSkeleton';

interface AvgAlertAgeWidgetProps {
  alerts: AlertWithMatch[];
  metadata?: WidgetMetadata;
}

function formatDays(value: number | null, formatter: Intl.NumberFormat): string {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }
  return `${formatter.format(value)} days`;
}

export function AvgAlertAgeWidget({ alerts = [], metadata }: AvgAlertAgeWidgetProps) {
  const formatter = useMemo(() => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 0 }), []);

  const refreshKey = alerts.length
    ? JSON.stringify(
        alerts.map((alert) => ({
          id: alert.id,
          status: alert.status ?? null,
          resolvedAt: alert.resolvedAt ?? null,
          alertDate: alert.alertDate ?? alert.createdAt ?? null,
          updatedAt: alert.updatedAt ?? null,
        })),
      )
    : 'no-alerts';

  const fetchData = useCallback(async () => {
    return calculateAvgAlertAge(alerts);
  }, [alerts]);

  const { data, loading, error, freshness } = useWidgetData<AlertAgeStats>(fetchData, {
    refreshInterval: metadata?.refreshInterval ?? 5 * 60 * 1000,
    enablePerformanceTracking: true,
    refreshKey,
  });

  const freshnessLabel = useMemo(() => formatFreshnessLabel(freshness), [freshness]);

  if (loading && !data) {
    return (
      <WidgetSkeleton
        title="Avg. Alert Age"
        description="Calculating backlog age..."
        variant="list"
        itemCount={2}
      />
    );
  }

  if (error) {
    return (
      <WidgetError
        title="Avg. Alert Age"
        description="Unable to load alert age metrics"
        message={error.message}
        icon={<AlertOctagon className="h-5 w-5" />}
      />
    );
  }

  const stats = data;
  const isEmpty = !stats || stats.openCount === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Avg. Alert Age</CardTitle>
            <CardDescription>Average age of all open alerts</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {stats?.openCount ? `${stats.openCount} open` : 'No open alerts'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="text-center py-8 text-muted-foreground">
            <BellOff className="mx-auto mb-3 h-8 w-8 opacity-60" />
            <p className="text-sm">All alerts are cleared. Great work!</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-4xl font-semibold text-foreground">
                {formatDays(stats?.averageDays ?? null, formatter)}
              </p>
              <p className="text-sm text-muted-foreground">
                Average days since alert was created or received
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Median age</p>
                <p className="text-lg font-medium text-foreground">
                  {formatDays(stats?.medianDays ?? null, formatter)}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Oldest alert</p>
                <p className="text-lg font-medium text-foreground">
                  {formatDays(stats?.oldestDays ?? null, formatter)}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Backlog over 30 days</p>
                <p className="text-lg font-medium text-foreground">{stats?.over30Days ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Open alerts counted</p>
                <p className="text-lg font-medium text-foreground">{stats?.openCount ?? 0}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-border/60 pt-3 text-center text-xs text-muted-foreground">
          Last checked: {freshnessLabel}
        </div>
      </CardContent>
    </Card>
  );
}
