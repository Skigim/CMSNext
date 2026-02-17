import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Skeleton variant types for different widget layouts.
 */
export type WidgetSkeletonVariant = 'list' | 'stats' | 'chart' | 'default';

/**
 * Props for WidgetSkeleton component.
 */
export interface WidgetSkeletonProps {
  /** Widget title to display */
  title: string;
  /** Loading description/subtitle */
  description?: string;
  /** Optional icon component to show in title */
  icon?: ReactNode;
  /** Skeleton variant to use */
  variant?: WidgetSkeletonVariant;
  /** Number of skeleton items (for list/chart variants) */
  itemCount?: number;
  /** Additional className for the Card */
  className?: string;
}

function buildSkeletonKeys(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, position) => `${prefix}-${position + 1}`);
}

function buildChartBars(count: number): Array<{ key: string; height: number }> {
  const chartHeights = [30, 50, 70, 90, 110];

  return buildSkeletonKeys("chart", count).map((key, position) => ({
    key,
    height: chartHeights[position % chartHeights.length],
  }));
}

/**
 * List skeleton - horizontal bars of varying widths
 */
function ListSkeleton({ count }: Readonly<{ count: number }>) {
  return (
    <div className="space-y-3">
      {buildSkeletonKeys("list", count).map((key) => (
        <div key={key} className="h-8 rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
  );
}

/**
 * Stats skeleton - boxes for stat cards
 */
function StatsSkeleton({ count }: Readonly<{ count: number }>) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {buildSkeletonKeys("stats", count).map((key) => (
        <div key={key} className="h-20 rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
  );
}

/**
 * Chart skeleton - bar chart with varying heights
 */
function ChartSkeleton({ count }: Readonly<{ count: number }>) {
  return (
    <div className="flex items-end gap-2 h-40">
      {buildChartBars(count).map((bar) => (
        <div
          key={bar.key}
          className="w-full rounded bg-muted animate-pulse"
          style={{ height: `${bar.height}px` }}
        />
      ))}
    </div>
  );
}

/**
 * Default skeleton - title and content bars
 */
function DefaultSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-32" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

/**
 * Widget Skeleton Component
 *
 * Provides standardized loading states for dashboard widgets with
 * support for different layout variants.
 *
 * @example
 * ```tsx
 * // List variant (pie charts, tables)
 * <WidgetSkeleton
 *   title="Cases by Status"
 *   description="Loading status breakdown..."
 *   variant="list"
 *   itemCount={5}
 * />
 *
 * // Stats variant (summary cards)
 * <WidgetSkeleton
 *   title="Daily Stats"
 *   description="Loading today's metrics..."
 *   variant="stats"
 *   itemCount={3}
 *   icon={<Activity className="h-5 w-5" />}
 * />
 *
 * // Chart variant (bar/line charts)
 * <WidgetSkeleton
 *   title="Cases Processed"
 *   description="Loading trend data..."
 *   variant="chart"
 *   itemCount={7}
 * />
 * ```
 */
export function WidgetSkeleton({
  title,
  description,
  icon,
  variant = 'default',
  itemCount = 4,
  className,
}: Readonly<WidgetSkeletonProps>) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className={cn(icon && "flex items-center gap-2")}>
          {icon}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {variant === 'list' && <ListSkeleton count={itemCount} />}
        {variant === 'stats' && <StatsSkeleton count={itemCount} />}
        {variant === 'chart' && <ChartSkeleton count={itemCount} />}
        {variant === 'default' && <DefaultSkeleton />}
      </CardContent>
    </Card>
  );
}

/**
 * Widget Error Component
 *
 * Provides standardized error display for dashboard widgets.
 */
export interface WidgetErrorProps {
  /** Widget title to display */
  title: string;
  /** Error description/subtitle */
  description?: string;
  /** Error message to show */
  message: string;
  /** Optional icon component to show in title */
  icon?: ReactNode;
  /** Additional className for the Card */
  className?: string;
}

export function WidgetError({
  title,
  description = 'Unable to load data',
  message,
  icon,
  className,
}: Readonly<WidgetErrorProps>) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className={cn("text-destructive", icon && "flex items-center gap-2")}>
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-destructive/90">{message}</p>
      </CardContent>
    </Card>
  );
}
