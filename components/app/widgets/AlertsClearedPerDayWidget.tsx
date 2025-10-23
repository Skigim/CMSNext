import { useCallback, useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWidgetData } from '@/hooks/useWidgetData';
import type { AlertWithMatch } from '@/utils/alertsData';
import {
  calculateAlertsClearedPerDay,
  widgetDateUtils,
  type DailyAlertStats,
} from '@/utils/widgetDataProcessors';
import type { WidgetMetadata } from './WidgetRegistry';

interface AlertsClearedPerDayWidgetProps {
  alerts: AlertWithMatch[];
  metadata?: WidgetMetadata;
}

interface AlertsClearedPerDayData {
  daily: DailyAlertStats[];
  total: number;
  previousTotal: number;
}

const DEFAULT_WINDOW = 7;

export function AlertsClearedPerDayWidget({ alerts = [], metadata }: AlertsClearedPerDayWidgetProps) {
  const fetchData = useCallback(async () => {
    const reference = widgetDateUtils.startOfDay(new Date());
    const daily = calculateAlertsClearedPerDay(alerts, { referenceDate: reference });
    const total = daily.reduce((acc, item) => acc + item.clearedCount, 0);

    const previousReference = widgetDateUtils.addDays(reference, -DEFAULT_WINDOW);
    const previousDaily = calculateAlertsClearedPerDay(alerts, { referenceDate: previousReference });
    const previousTotal = previousDaily.reduce((acc, item) => acc + item.clearedCount, 0);

    return { daily, total, previousTotal } satisfies AlertsClearedPerDayData;
  }, [alerts]);

  const { data, loading, error, freshness } = useWidgetData<AlertsClearedPerDayData>(fetchData, {
    refreshInterval: metadata?.refreshInterval ?? 5 * 60 * 1000,
    enablePerformanceTracking: true,
  });

  const formatter = useMemo(() => new Intl.DateTimeFormat('en-US', { weekday: 'short' }), []);

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

  const trend = useMemo(() => {
    if (!data) {
      return { delta: 0, direction: 'flat' as const };
    }
    const delta = data.total - data.previousTotal;
    if (delta > 0) {
      return { delta, direction: 'up' as const };
    }
    if (delta < 0) {
      return { delta, direction: 'down' as const };
    }
    return { delta: 0, direction: 'flat' as const };
  }, [data]);

  const maxCount = useMemo(() => {
    if (!data) {
      return 0;
    }
    return Math.max(...data.daily.map((item) => item.clearedCount), 0);
  }, [data]);

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alerts Cleared/Day</CardTitle>
          <CardDescription>Compiling resolution trend...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-40">
            {Array.from({ length: DEFAULT_WINDOW }).map((_, index) => (
              <div key={index} className="w-full rounded bg-muted animate-pulse" style={{ height: `${30 + index * 5}px` }} />
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
          <CardTitle>Alerts Cleared/Day</CardTitle>
          <CardDescription>Unable to calculate alert resolutions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive/90">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Alerts Cleared/Day</CardTitle>
            <CardDescription>Resolved alert trend across the last 7 days</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {data?.total ?? 0} cleared
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!data || data.total === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <p className="text-sm">No alerts cleared in the last week.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium text-foreground">Weekly change</span>
              <div className="flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-xs">
                {trend.direction === 'up' && <ArrowUpRight className="h-4 w-4 text-emerald-500" aria-hidden />}
                {trend.direction === 'down' && <ArrowDownRight className="h-4 w-4 text-destructive" aria-hidden />}
                {trend.direction === 'flat' && <Minus className="h-4 w-4 text-muted-foreground" aria-hidden />}
                <span className={trend.direction === 'down' ? 'text-destructive font-medium' : trend.direction === 'up' ? 'text-emerald-500 font-medium' : 'text-muted-foreground'}>
                  {trend.delta === 0 ? 'No change' : `${trend.delta > 0 ? '+' : ''}${trend.delta}`}
                </span>
                <span className="text-muted-foreground">vs. prior week</span>
              </div>
            </div>
            <div className="flex h-44 items-end gap-3">
              {data.daily.map((entry) => {
                const height = maxCount === 0 ? 0 : (entry.clearedCount / maxCount) * 100;
                const date = new Date(entry.date);
                return (
                  <div key={entry.date} className="flex-1 text-center">
                    <div
                      className="mx-auto w-full rounded-t-md bg-primary/80"
                      style={{ height: `${height === 0 ? 4 : Math.max(height, 8)}%` }}
                      aria-label={`${entry.clearedCount} alerts cleared on ${formatter.format(date)}`}
                    />
                    <div className="mt-2 text-xs font-medium text-foreground">{entry.clearedCount}</div>
                    <div className="text-[11px] text-muted-foreground">{formatter.format(date)}</div>
                  </div>
                );
              })}
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

export default AlertsClearedPerDayWidget;
