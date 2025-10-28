import { useCallback, useMemo } from 'react';
import { Pie, PieChart } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
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

  // Map status to theme chart colors from globals.css
  const statusColorMap: Record<string, string> = useMemo(() => ({
    pending: 'hsl(var(--chart-status-pending))',
    approved: 'hsl(var(--chart-status-approved))',
    denied: 'hsl(var(--chart-status-denied))',
    closed: 'hsl(var(--chart-status-closed))',
    spenddown: 'hsl(var(--chart-status-spenddown))',
  }), []);

  // Convert breakdown to chart data with theme colors
  const chartData = useMemo(() => {
    return breakdown.map((item) => {
      const statusKey = item.status.toLowerCase();
      return {
        status: item.status,
        count: item.count,
        fill: statusColorMap[statusKey] || 'hsl(var(--muted))',
      };
    });
  }, [breakdown, statusColorMap]);

  // Build chart config from breakdown
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      count: {
        label: 'Cases',
      },
    };
    breakdown.forEach((item) => {
      const statusKey = item.status.toLowerCase();
      config[statusKey] = {
        label: item.status,
        color: statusColorMap[statusKey] || 'hsl(var(--muted))',
      };
    });
    return config;
  }, [breakdown, statusColorMap]);

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
          <>
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square max-h-[250px]"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie 
                  data={chartData} 
                  dataKey="count" 
                  label={(entry) => `${entry.status}: ${entry.count}`}
                  nameKey="status"
                />
              </PieChart>
            </ChartContainer>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {breakdown.map((item) => {
                const statusKey = item.status.toLowerCase();
                const color = statusColorMap[statusKey] || 'hsl(var(--muted))';
                return (
                  <div key={item.status} className="flex items-center gap-2">
                    <div 
                      className="h-3 w-3 rounded-sm" 
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-muted-foreground">
                      {item.status}: <span className="font-medium text-foreground">{item.count}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-4 border-t border-border/60 pt-3 text-center text-xs text-muted-foreground">
          Last checked: {freshnessLabel}
        </div>
      </CardContent>
    </Card>
  );
}

export default CasesByStatusWidget;
