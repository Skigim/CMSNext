import { useCallback, useMemo } from 'react';
import { Pie, PieChart, type PieLabelRenderProps } from 'recharts';
import { ListChecks } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useWidgetData } from '@/hooks/useWidgetData';
import type { AlertWithMatch } from '@/utils/alertsData';
import { calculateTotalAlertsByDescription, type AlertDescriptionStats } from '@/utils/widgetDataProcessors';
import type { WidgetMetadata } from './WidgetRegistry';

interface AlertsByDescriptionWidgetProps {
  alerts: AlertWithMatch[];
  metadata?: WidgetMetadata;
}

export function AlertsByDescriptionWidget({ alerts = [], metadata }: AlertsByDescriptionWidgetProps) {
  const fetchData = useCallback(async () => {
    return calculateTotalAlertsByDescription(alerts);
  }, [alerts]);

  const { data, loading, error, freshness } = useWidgetData<AlertDescriptionStats[]>(fetchData, {
    refreshInterval: metadata?.refreshInterval ?? 5 * 60 * 1000,
    enablePerformanceTracking: true,
  });

  const stats = useMemo(() => {
    // Filter out items with zero count
    return (data ?? []).filter(item => item.count > 0);
  }, [data]);
  const uniqueDescriptions = stats.length;

  // Use theme chart colors from globals.css - cycle through them
  const alertColorPalette = useMemo(() => [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
  ], []);

  // Convert stats to chart data with theme colors - take top 10
  const chartData = useMemo(() => {
    return stats.slice(0, 10).map((item, index) => ({
      description: item.description,
      count: item.count,
      fill: alertColorPalette[index % alertColorPalette.length],
    }));
  }, [stats, alertColorPalette]);

  // Build chart config from stats
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      count: {
        label: 'Alerts',
      },
    };
    stats.slice(0, 10).forEach((item, index) => {
      const key = item.description.toLowerCase().replace(/[^a-z0-9]/g, '_');
      config[key] = {
        label: item.description,
        color: alertColorPalette[index % alertColorPalette.length],
      };
    });
    return config;
  }, [stats, alertColorPalette]);

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
          <CardTitle>Open Alerts by Description</CardTitle>
          <CardDescription>Analyzing open alert descriptions...</CardDescription>
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
          <CardTitle>Open Alerts by Description</CardTitle>
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
            <CardTitle>Open Alerts by Description</CardTitle>
            <CardDescription>Top alert reasons driving current workload</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {uniqueDescriptions ? `${uniqueDescriptions} types` : 'No open alerts'}
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
                  label={{
                    position: 'inside',
                    content: (props: PieLabelRenderProps) => {
                      const { count } = props;
                      return count;
                    },
                    fill: 'var(--foreground)',
                  }}
                  labelLine={false}
                  nameKey="description"
                />
              </PieChart>
            </ChartContainer>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {stats.slice(0, 10).map((item, index) => {
                const color = alertColorPalette[index % alertColorPalette.length];
                return (
                  <div key={item.description} className="flex items-center gap-2">
                    <div 
                      className="h-3 w-3 rounded-sm flex-shrink-0" 
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-muted-foreground truncate">
                      {item.description}: <span className="font-medium text-foreground">{item.count}</span>
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

export default AlertsByDescriptionWidget;
