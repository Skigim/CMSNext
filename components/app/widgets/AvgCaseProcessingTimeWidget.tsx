import { useCallback, useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Timer } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatFreshnessLabel } from '@/domain/common';
import { useWidgetData } from '@/hooks/useWidgetData';
import { useCategoryConfig } from '@/contexts/CategoryConfigContext';
import { getCompletionStatusNames } from '@/types/categoryConfig';
import type { CaseActivityEntry } from '@/types/activityLog';
import type { StoredCase } from '@/types/case';
import { calculateAvgCaseProcessingTime, type ProcessingTimeStats } from '@/domain/dashboard';
import type { WidgetMetadata } from './WidgetRegistry';
import { WidgetSkeleton, WidgetError } from './WidgetSkeleton';

interface AvgCaseProcessingTimeWidgetProps {
  activityLog: CaseActivityEntry[];
  cases: StoredCase[];
  metadata?: WidgetMetadata;
}

type TrendDirection = 'up' | 'down' | 'flat';

interface TrendData {
  delta: number | null;
  direction: TrendDirection;
}

function formatDays(value: number | null, formatter: Intl.NumberFormat): string {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }
  return `${formatter.format(value)} days`;
}

function getTrendData(data: ProcessingTimeStats | null | undefined): TrendData {
  const average = data?.averageDays ?? null;
  const previous = data?.previousAverageDays ?? null;

  if (average == null || previous == null) {
    return { delta: null, direction: 'flat' };
  }

  const delta = average - previous;
  if (delta > 0) {
    return { delta, direction: 'up' };
  }
  if (delta < 0) {
    return { delta, direction: 'down' };
  }
  return { delta: 0, direction: 'flat' };
}

function getTrendTextColorClass(trend: TrendData): string {
  if (trend.delta == null) {
    return 'text-muted-foreground';
  }
  if (trend.direction === 'down') {
    return 'text-emerald-500 font-medium';
  }
  if (trend.direction === 'up') {
    return 'text-destructive font-medium';
  }
  return 'text-muted-foreground';
}

function getTrendLabel(trend: TrendData, formatter: Intl.NumberFormat): string {
  if (trend.delta == null) {
    return 'No prior baseline';
  }
  if (trend.delta === 0) {
    return 'No change';
  }
  const sign = trend.delta > 0 ? '+' : '-';
  return `${sign}${formatter.format(Math.abs(trend.delta))} days`;
}

function TrendIcon({ trend }: Readonly<{ trend: TrendData }>) {
  if (trend.delta == null || trend.direction === 'flat') {
    return <Minus className="h-4 w-4 text-muted-foreground" aria-hidden />;
  }
  if (trend.direction === 'up') {
    return <ArrowUpRight className="h-4 w-4 text-destructive" aria-hidden />;
  }
  return <ArrowDownRight className="h-4 w-4 text-emerald-500" aria-hidden />;
}

export function AvgCaseProcessingTimeWidget({
  activityLog = [],
  cases = [],
  metadata,
}: Readonly<AvgCaseProcessingTimeWidgetProps>) {
  const { config } = useCategoryConfig();
  const completionStatuses = useMemo(() => getCompletionStatusNames(config), [config]);

  const fetchData = useCallback(async () => {
    return calculateAvgCaseProcessingTime(activityLog, cases, { windowInDays: 30, completionStatuses });
  }, [activityLog, cases, completionStatuses]);

  const { data, loading, error, freshness } = useWidgetData<ProcessingTimeStats>(fetchData, {
    refreshInterval: metadata?.refreshInterval ?? 10 * 60 * 1000,
    enablePerformanceTracking: true,
  });

  const formatter = useMemo(() => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 0 }), []);

  const freshnessLabel = useMemo(() => formatFreshnessLabel(freshness), [freshness]);

  const trend = useMemo(() => getTrendData(data), [data]);

  if (loading && !data) {
    return (
      <WidgetSkeleton
        title="Avg. Case Processing Time"
        description="Crunching case completion times..."
        variant="list"
        itemCount={2}
      />
    );
  }

  if (error) {
    return (
      <WidgetError
        title="Avg. Case Processing Time"
        description="Unable to calculate processing metrics"
        message={error.message}
      />
    );
  }

  const hasSample = Boolean(data && data.sampleSize > 0 && data.averageDays != null);

  if (!hasSample) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Avg. Case Processing Time</CardTitle>
              <CardDescription>Average days from creation to completion (last 30 days)</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {data?.sampleSize ? `${data.sampleSize} cases` : 'No samples'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <Timer className="mx-auto mb-3 h-8 w-8 opacity-60" aria-hidden="true" />
            <p className="text-sm">No completed cases in the last 30 days.</p>
          </div>
          <div className="mt-4 border-t border-border/60 pt-3 text-center text-xs text-muted-foreground">
            Last checked: {freshnessLabel}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Avg. Case Processing Time</CardTitle>
            <CardDescription>Average days from creation to completion (last 30 days)</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {data?.sampleSize ? `${data.sampleSize} cases` : 'No samples'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-4xl font-semibold text-foreground">
                  {formatDays(data?.averageDays ?? null, formatter)}
                </p>
                <p className="text-sm text-muted-foreground">Average time to complete a case</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs">
                <TrendIcon trend={trend} />
                <span
                  className={getTrendTextColorClass(trend)}
                >
                  {getTrendLabel(trend, formatter)}
                </span>
                <span className="text-muted-foreground">vs. previous 30 days</span>
              </div>
            </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Median</p>
              <p className="text-lg font-medium text-foreground">
                {formatDays(data?.medianDays ?? null, formatter)}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Sample size</p>
              <p className="text-lg font-medium text-foreground">{data?.sampleSize ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Previous avg.</p>
              <p className="text-lg font-medium text-foreground">
                {formatDays(data?.previousAverageDays ?? null, formatter)}
              </p>
            </div>
          </div>

          {data && Object.keys(data.byStatus).length > 0 && (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">By status</p>
              <div className="space-y-2">
                {Object.entries(data.byStatus)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([status, avg]) => (
                    <div
                      key={status}
                      className="flex items-center justify-between rounded border border-border/40 bg-muted/40 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-foreground">{status}</span>
                      <span className="text-muted-foreground">{formatDays(avg, formatter)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-border/60 pt-3 text-center text-xs text-muted-foreground">
          Last checked: {freshnessLabel}
        </div>
      </CardContent>
    </Card>
  );
}
