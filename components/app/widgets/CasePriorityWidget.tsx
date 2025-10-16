import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, CheckCircle2, Archive } from 'lucide-react';
import { CaseDisplay } from '@/types/case';
import { useWidgetData } from '@/hooks/useWidgetData';
import type { WidgetMetadata } from './WidgetRegistry';

/**
 * Case priority breakdown statistics.
 */
interface PriorityStats {
  urgent: number;
  active: number;
  normal: number;
  closed: number;
  total: number;
}

/**
 * Props for the Case Priority Widget.
 */
interface CasePriorityWidgetProps {
  /** Array of cases to analyze */
  cases: CaseDisplay[];
  /** Widget metadata (injected by WidgetRegistry) */
  metadata?: WidgetMetadata;
}

/**
 * Calculate priority statistics from cases.
 */
function calculatePriorityStats(cases: CaseDisplay[]): PriorityStats {
  const stats: PriorityStats = {
    urgent: 0,
    active: 0,
    normal: 0,
    closed: 0,
    total: cases.length,
  };

  cases.forEach((caseItem) => {
    const status = caseItem.caseRecord?.status?.toLowerCase() || '';
    const isPriority = caseItem.caseRecord?.priority === true;

    if (status === 'approved' || status === 'pending') {
      if (isPriority) {
        stats.urgent++;
      } else {
        stats.active++;
      }
    } else if (status === 'denied' || status === 'spenddown') {
      stats.normal++;
    } else if (status === 'closed') {
      stats.closed++;
    } else {
      // Default active for unknown statuses
      stats.active++;
    }
  });

  return stats;
}

/**
 * Case Priority Widget Component
 *
 * Displays a breakdown of cases by priority level:
 * - Urgent: Priority cases pending or approved
 * - Active: Non-priority pending/approved cases
 * - Normal: Denied or spenddown cases
 * - Closed: Completed cases
 *
 * Features:
 * - Real-time priority calculation
 * - Freshness indicator ("Last updated: X minutes ago")
 * - Responsive grid layout
 * - Color-coded badges per priority level
 * - Loading skeleton state
 *
 * @example
 * ```tsx
 * <CasePriorityWidget cases={cases} />
 * ```
 */
export function CasePriorityWidget({ cases = [], metadata }: CasePriorityWidgetProps) {
  /**
   * Fetch priority data using widget data hook.
   * Memoizes data fetching with freshness tracking.
   */
  const { data: stats, loading, freshness } = useWidgetData(
    async () => {
      // Simulate async operation for consistency with other widgets
      return new Promise<PriorityStats>((resolve) => {
        setTimeout(() => {
          resolve(calculatePriorityStats(cases));
        }, 0);
      });
    },
    {
      refreshInterval: metadata?.refreshInterval ?? 5 * 60 * 1000, // 5 minutes default
      enablePerformanceTracking: true,
    }
  );

  /**
   * Priority card configuration with icons and colors.
   */
  const priorityCards = useMemo(
    () => [
      {
        label: 'Urgent',
        value: stats?.urgent ?? 0,
        icon: AlertCircle,
        color: 'bg-red-50',
        badgeColor: 'bg-red-100 text-red-800',
        iconColor: 'text-red-600',
      },
      {
        label: 'Active',
        value: stats?.active ?? 0,
        icon: Clock,
        color: 'bg-amber-50',
        badgeColor: 'bg-amber-100 text-amber-800',
        iconColor: 'text-amber-600',
      },
      {
        label: 'Normal',
        value: stats?.normal ?? 0,
        icon: CheckCircle2,
        color: 'bg-blue-50',
        badgeColor: 'bg-blue-100 text-blue-800',
        iconColor: 'text-blue-600',
      },
      {
        label: 'Closed',
        value: stats?.closed ?? 0,
        icon: Archive,
        color: 'bg-slate-50',
        badgeColor: 'bg-slate-100 text-slate-800',
        iconColor: 'text-slate-600',
      },
    ],
    [stats]
  );

  /**
   * Format freshness timestamp for display.
   */
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

    const hoursAgo = Math.floor((freshness.minutesAgo || 0) / 60);
    if (hoursAgo === 1) {
      return '1 hour ago';
    }

    return `${hoursAgo} hours ago`;
  }, [freshness]);

  /**
   * Render loading state with skeleton.
   */
  if (loading && !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Case Priority</CardTitle>
          <CardDescription>Loading priority breakdown...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded w-20" />
                <div className="h-8 bg-muted rounded w-10" />
              </div>
            ))}
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
            <CardTitle>Case Priority</CardTitle>
            <CardDescription>Breakdown by priority level</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {stats?.total ?? 0} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Priority breakdown grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {priorityCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={`rounded-lg p-3 ${card.color} border border-border/50`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {card.label}
                  </span>
                  <Icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {card.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Freshness indicator */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
          <p>Last updated: {freshnessLabel}</p>
        </div>

        {/* Empty state */}
        {!stats?.total && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              No cases to analyze
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CasePriorityWidget;
