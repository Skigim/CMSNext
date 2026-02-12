import { useCallback, useMemo } from 'react';
import { Pie, PieChart, type PieLabelRenderProps } from 'recharts';
import { ListChecks } from 'lucide-react';
import { formatFreshnessLabel } from '@/domain/common';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useWidgetData } from '@/hooks/useWidgetData';
import { useCategoryConfig } from '@/contexts/CategoryConfigContext';
import type { AlertWithMatch } from '@/utils/alertsData';
import { calculateTotalAlertsByDescription, type AlertDescriptionStats } from '@/domain/dashboard';
import { getColorSlotVar } from '@/types/colorSlots';
import type { WidgetMetadata } from './WidgetRegistry';
import { WidgetSkeleton, WidgetError } from './WidgetSkeleton';

interface AlertsByDescriptionWidgetProps {
  alerts: AlertWithMatch[];
  metadata?: WidgetMetadata;
}

export function AlertsByDescriptionWidget({ alerts = [], metadata }: Readonly<AlertsByDescriptionWidgetProps>) {
  const { config } = useCategoryConfig();
  
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

  // Build color map from category config's alertTypes colorSlot assignments
  // Falls back to cycling through chart colors for unconfigured types
  const alertColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    const fallbackColors = [
      'var(--chart-1)',
      'var(--chart-2)',
      'var(--chart-3)',
      'var(--chart-4)',
      'var(--chart-5)',
    ];
    let fallbackIndex = 0;
    
    stats.forEach((item) => {
      // Look for configured color for this alert type/description
      const alertTypeConfig = config.alertTypes.find(
        at => at.name.toLowerCase() === item.description.toLowerCase()
      );
      
      if (alertTypeConfig) {
        map[item.description] = getColorSlotVar(alertTypeConfig.colorSlot);
      } else {
        // Use fallback color and cycle
        map[item.description] = fallbackColors[fallbackIndex % fallbackColors.length];
        fallbackIndex++;
      }
    });
    
    return map;
  }, [stats, config.alertTypes]);

  // Convert stats to chart data with theme colors - take top 10
  const chartData = useMemo(() => {
    return stats.slice(0, 10).map((item) => ({
      description: item.description,
      count: item.count,
      fill: alertColorMap[item.description] || 'var(--muted)',
    }));
  }, [stats, alertColorMap]);

  // Build chart config from stats
  const chartConfig = useMemo(() => {
    const cfg: ChartConfig = {
      count: {
        label: 'Alerts',
      },
    };
    stats.slice(0, 10).forEach((item) => {
      const key = item.description.toLowerCase().replaceAll(/[^a-z0-9]/g, '_');
      cfg[key] = {
        label: item.description,
        color: alertColorMap[item.description] || 'var(--muted)',
      };
    });
    return cfg;
  }, [stats, alertColorMap]);

  const freshnessLabel = useMemo(() => formatFreshnessLabel(freshness), [freshness]);

  if (loading && !data) {
    return (
      <WidgetSkeleton
        title="Open Alerts by Description"
        description="Analyzing open alert descriptions..."
        variant="list"
        itemCount={5}
      />
    );
  }

  if (error) {
    return (
      <WidgetError
        title="Open Alerts by Description"
        description="Unable to load alert breakdown"
        message={error.message}
      />
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
              {stats.slice(0, 10).map((item) => {
                const color = alertColorMap[item.description] || 'var(--muted)';
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
