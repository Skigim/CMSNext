import { useCallback, useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatFreshnessLabel } from '@/domain/common';
import { Badge } from '@/components/ui/badge';
import { useWidgetData } from '@/hooks/useWidgetData';
import { useCategoryConfig } from '@/contexts/CategoryConfigContext';
import { getCompletionStatusNames } from '@/types/categoryConfig';
import type { CaseActivityEntry } from '@/types/activityLog';
import {
  calculateCasesProcessedPerDay,
  widgetDateUtils,
  type DailyCaseStats,
} from '@/domain/dashboard';
import type { WidgetMetadata } from './WidgetRegistry';
import { WidgetSkeleton, WidgetError } from './WidgetSkeleton';

interface CasesProcessedPerDayWidgetProps {
  activityLog: CaseActivityEntry[];
  metadata?: WidgetMetadata;
  refreshKey?: unknown;
}

interface CasesProcessedPerDayData {
  daily: DailyCaseStats[];
  total: number;
  previousTotal: number;
}

const DEFAULT_WINDOW = 7;

export function CasesProcessedPerDayWidget({ activityLog = [], metadata, refreshKey }: CasesProcessedPerDayWidgetProps) {
  const { config } = useCategoryConfig();
  const completionStatuses = useMemo(() => getCompletionStatusNames(config), [config]);
  const requireNoteOnSameDay = config.dashboardSettings?.requireNoteForProcessedCount ?? false;

  const fetchData = useCallback(async () => {
    // Keep reference date in local time to match activity log timestamps
    const now = new Date();
    const reference = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daily = calculateCasesProcessedPerDay(activityLog, { 
      referenceDate: reference, 
      completionStatuses,
      requireNoteOnSameDay,
    });
    const total = daily.reduce((acc, item) => acc + item.processedCount, 0);

    const previousReference = widgetDateUtils.addDays(reference, -DEFAULT_WINDOW);
    const previousDaily = calculateCasesProcessedPerDay(activityLog, { 
      referenceDate: previousReference, 
      completionStatuses,
      requireNoteOnSameDay,
    });
    const previousTotal = previousDaily.reduce((acc, item) => acc + item.processedCount, 0);

    return { daily, total, previousTotal } satisfies CasesProcessedPerDayData;
  }, [activityLog, completionStatuses, requireNoteOnSameDay]);

  const { data, loading, error, freshness } = useWidgetData<CasesProcessedPerDayData>(fetchData, {
    refreshInterval: metadata?.refreshInterval ?? 5 * 60 * 1000,
    enablePerformanceTracking: true,
    refreshKey,
  });

  const formatter = useMemo(() => new Intl.DateTimeFormat('en-US', { weekday: 'short' }), []);

  const freshnessLabel = useMemo(() => formatFreshnessLabel(freshness), [freshness]);

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
    return Math.max(...data.daily.map((item) => item.processedCount), 0);
  }, [data]);

  if (loading && !data) {
    return (
      <WidgetSkeleton
        title="Cases Processed/Day"
        description="Compiling completion trend..."
        variant="chart"
        itemCount={DEFAULT_WINDOW}
      />
    );
  }

  if (error) {
    return (
      <WidgetError
        title="Cases Processed/Day"
        description="Unable to calculate case completions"
        message={error.message}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cases Processed/Day</CardTitle>
            <CardDescription>Completed case trend across the last 7 days</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {data?.total ?? 0} processed
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!data || data.total === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <p className="text-sm">No cases processed in the last week.</p>
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
            <div className="flex h-44 gap-3">
              {data.daily.map((entry) => {
                const height = maxCount === 0 ? 0 : (entry.processedCount / maxCount) * 100;
                // Parse the date string as local time by splitting the components
                const [year, month, day] = entry.date.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                return (
                  <div key={entry.date} className="flex-1 flex flex-col justify-end text-center">
                    <div
                      className="mx-auto w-full rounded-t-md bg-emerald-500/90"
                      style={{ height: `${height === 0 ? 4 : Math.max(height, 8)}%` }}
                      aria-label={`${entry.processedCount} cases processed on ${formatter.format(date)}`}
                    />
                    <div className="mt-2 text-xs font-medium text-foreground">{entry.processedCount}</div>
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

export default CasesProcessedPerDayWidget;
