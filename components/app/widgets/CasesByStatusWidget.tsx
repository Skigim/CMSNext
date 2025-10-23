import { useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWidgetData } from '@/hooks/useWidgetData';
import type { CaseDisplay } from '@/types/case';
import { calculateTotalCasesByStatus, type StatusBreakdown } from '@/utils/widgetDataProcessors';
import type { WidgetMetadata } from './WidgetRegistry';

interface CasesByStatusWidgetProps {
  cases: CaseDisplay[];
  metadata?: WidgetMetadata;
}

export function CasesByStatusWidget({ cases = [], metadata }: CasesByStatusWidgetProps) {
  const fetchData = useCallback(async () => {
    return calculateTotalCasesByStatus(cases);
  }, [cases]);

  const { data, loading, error, freshness } = useWidgetData<StatusBreakdown[]>(fetchData, {
    refreshInterval: metadata?.refreshInterval ?? 5 * 60 * 1000,
    enablePerformanceTracking: true,
  });

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

  const breakdown = useMemo(() => data ?? [], [data]);
  const totalCases = useMemo(() => breakdown.reduce((acc, item) => acc + item.count, 0), [breakdown]);
  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Total Cases by Status</CardTitle>
          <CardDescription>Preparing status totals...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
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
          <CardTitle>Total Cases by Status</CardTitle>
          <CardDescription>Unable to compute case distribution</CardDescription>
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
            <CardTitle>Total Cases by Status</CardTitle>
            <CardDescription>Current distribution across all case statuses</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {totalCases ? `${totalCases} cases` : 'No cases'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {breakdown.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-sm">No cases available to analyze</p>
          </div>
        ) : (
          <div className="space-y-4">
            {breakdown.map((item) => {
              const barWidth = item.percentage === 0 ? 0 : Math.max(item.percentage, 6);
              return (
                <div key={item.status} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{item.status}</span>
                    <span className="text-muted-foreground">
                      {item.count} • {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted">
                    <div
                      className={`flex h-full items-center justify-end rounded-full ${item.colorClass}`}
                      style={{ width: `${barWidth}%` }}
                    >
                      <span className="pr-2 text-[10px] font-medium tracking-wide uppercase">
                        {item.count}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 border-t border-border/60 pt-3 text-center text-xs text-muted-foreground">
          Last checked: {freshnessLabel}
        </div>
      </CardContent>
    </Card>
  );
}

export default CasesByStatusWidget;
