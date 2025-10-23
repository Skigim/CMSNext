import { useCallback, useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWidgetData } from '@/hooks/useWidgetData';
import type { AlertWithMatch } from '@/utils/alertsData';
import { calculateTotalAlertsByDescription, type AlertDescriptionStats } from '@/utils/widgetDataProcessors';
import type { WidgetMetadata } from './WidgetRegistry';

interface AlertsByDescriptionWidgetProps {
  alerts: AlertWithMatch[];
  metadata?: WidgetMetadata;
}

const MAX_COLLAPSED = 10;

export function AlertsByDescriptionWidget({ alerts = [], metadata }: AlertsByDescriptionWidgetProps) {
  const [showAll, setShowAll] = useState(false);

  const fetchData = useCallback(async () => {
    return calculateTotalAlertsByDescription(alerts);
  }, [alerts]);

  const { data, loading, error, freshness } = useWidgetData<AlertDescriptionStats[]>(fetchData, {
    refreshInterval: metadata?.refreshInterval ?? 5 * 60 * 1000,
    enablePerformanceTracking: true,
  });

  const stats = useMemo(() => data ?? [], [data]);
  const totalAlerts = useMemo(() => stats.reduce((acc, item) => acc + item.count, 0), [stats]);
  const uniqueDescriptions = stats.length;
  const visibleItems = useMemo(() => (showAll ? stats : stats.slice(0, MAX_COLLAPSED)), [showAll, stats]);

  const freshnessLabel = useMemo(() => {
    if (!freshness.lastUpdatedAt) {
      return 'Never updated';
    }
    if (freshness.minutesAgo === 0) {
      return 'Just now';
    }
    if (freshness.minutesAgo === 1) {
      return '1 minute ago';
    }
    if (freshness.minutesAgo && freshness.minutesAgo < 60) {
      return `${freshness.minutesAgo} minutes ago`;
    }
    const hoursAgo = Math.floor((freshness.minutesAgo ?? 0) / 60);
    return hoursAgo <= 1 ? '1 hour ago' : `${hoursAgo} hours ago`;
  }, [freshness]);

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Total Alerts by Description</CardTitle>
          <CardDescription>Analyzing alert descriptions...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-8 rounded-lg bg-muted animate-pulse" />
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
          <CardTitle>Total Alerts by Description</CardTitle>
          <CardDescription>Unable to load alert breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive/90">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  const isEmpty = stats.length === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Total Alerts by Description</CardTitle>
            <CardDescription>Top alert reasons driving current workload</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {uniqueDescriptions ? `${uniqueDescriptions} types` : 'No alerts'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="py-8 text-center text-muted-foreground">
            <ListChecks className="mx-auto mb-3 h-8 w-8 opacity-60" />
            <p className="text-sm">No alerts available to analyze.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Total alerts</span>
              <span className="text-foreground font-medium">{totalAlerts}</span>
            </div>
            <div className="space-y-3">
              {visibleItems.map((item) => {
                const width = item.percentage === 0 ? 0 : Math.max(item.percentage, 4);
                return (
                  <div key={item.description} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-sm font-medium text-foreground">{item.description}</div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {item.count} • {item.percentage.toFixed(1)}%
                      </div>
                    </div>
                    <div className="h-3 rounded-full bg-muted">
                      <div
                        className="flex h-full items-center rounded-full bg-primary/80 text-xs text-primary-foreground"
                        style={{ width: `${width}%` }}
                      >
                        <span className="pl-2 text-[10px] font-semibold">{item.openCount} open</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{item.openCount} open</span>
                      <span>{item.resolvedCount} resolved</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {stats.length > MAX_COLLAPSED && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll((prev) => !prev)}
                  className="text-xs"
                >
                  {showAll ? 'Show top 10' : `Show all ${uniqueDescriptions}`}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-border/60 pt-3 text-center text-xs text-muted-foreground">
          Last checked: {freshnessLabel}
        </div>
      </CardContent>
    </Card>
  );
}

export default AlertsByDescriptionWidget;
