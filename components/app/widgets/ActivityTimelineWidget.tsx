import { useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/common/CopyButton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Save, Clock } from 'lucide-react';
import { useWidgetData } from '@/hooks/useWidgetData';
import type { CaseActivityLogState, CaseActivityEntry } from '@/types/activityLog';
import type { WidgetMetadata } from './WidgetRegistry';

/**
 * Activity timeline item with type and formatting.
 */
interface TimelineItem {
  id: string;
  type: 'note' | 'save' | 'import' | 'unknown';
  title: string;
  description: string;
  timestamp: string;
  relativeTime: string;
  caseId: string;
  caseName: string;
  caseMcn?: string | null;
  icon: typeof FileText;
  badgeColor: string;
  badgeText: string;
}

/**
 * Props for the Activity Timeline Widget.
 */
interface ActivityTimelineWidgetProps {
  /** Activity log state containing recent activity entries */
  activityLogState: CaseActivityLogState;
  /** Widget metadata (injected by WidgetRegistry) */
  metadata?: WidgetMetadata;
  /** Handler to view a case */
  onViewCase?: (caseId: string) => void;
}

/**
 * Calculate relative time string from timestamp.
 * Returns "Just now", "5 minutes ago", "2 hours ago", etc.
 */
function getRelativeTime(timestamp: string): string {
  try {
    const now = new Date();
    const then = new Date(timestamp);
    const secondsAgo = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (secondsAgo < 60) {
      return 'Just now';
    }

    const minutesAgo = Math.floor(secondsAgo / 60);
    if (minutesAgo === 1) {
      return '1 minute ago';
    }
    if (minutesAgo < 60) {
      return `${minutesAgo} minutes ago`;
    }

    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo === 1) {
      return '1 hour ago';
    }
    if (hoursAgo < 24) {
      return `${hoursAgo} hours ago`;
    }

    const daysAgo = Math.floor(hoursAgo / 24);
    if (daysAgo === 1) {
      return 'Yesterday';
    }
    if (daysAgo < 7) {
      return `${daysAgo} days ago`;
    }

    return 'Over a week ago';
  } catch {
    return 'Unknown time';
  }
}

/**
 * Format activity entries into timeline items.
 * Filters to last 7 days and limits to 10 items.
 */
function formatActivityTimeline(activityLog: CaseActivityEntry[]): TimelineItem[] {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentActivity = activityLog
    .filter((entry) => {
      try {
        return new Date(entry.timestamp) >= sevenDaysAgo;
      } catch {
        return false;
      }
    })
    .slice(0, 10)
    .map((entry): TimelineItem => {
      const relativeTime = getRelativeTime(entry.timestamp);

      if (entry.type === 'note-added') {
        const noteEntry = entry as Extract<CaseActivityEntry, { type: 'note-added' }>;
        return {
          id: noteEntry.id,
          type: 'note',
          title: `Note added`,
          description: noteEntry.payload.preview || 'New case note',
          timestamp: noteEntry.timestamp,
          relativeTime,
          caseId: noteEntry.caseId,
          caseName: noteEntry.caseName,
          caseMcn: noteEntry.caseMcn,
          icon: FileText,
          badgeColor: 'bg-primary/20 text-primary',
          badgeText: 'Note',
        };
      }

      if (entry.type === 'status-change') {
        const statusEntry = entry as Extract<CaseActivityEntry, { type: 'status-change' }>;
        const fromStatus = statusEntry.payload.fromStatus || 'Unknown';
        const toStatus = statusEntry.payload.toStatus || 'Unknown';
        return {
          id: statusEntry.id,
          type: 'save',
          title: `Status updated: ${fromStatus} → ${toStatus}`,
          description: `Status changed`,
          timestamp: statusEntry.timestamp,
          relativeTime,
          caseId: statusEntry.caseId,
          caseName: statusEntry.caseName,
          caseMcn: statusEntry.caseMcn,
          icon: Save,
          badgeColor: 'bg-accent text-accent-foreground',
          badgeText: 'Status Change',
        };
      }

      if (entry.type === 'priority-change') {
        const priorityEntry = entry as Extract<CaseActivityEntry, { type: 'priority-change' }>;
        const action = priorityEntry.payload.toPriority ? 'marked as priority' : 'unmarked as priority';
        return {
          id: priorityEntry.id,
          type: 'save',
          title: `Priority ${action}`,
          description: `Priority updated`,
          timestamp: priorityEntry.timestamp,
          relativeTime,
          caseId: priorityEntry.caseId,
          caseName: priorityEntry.caseName,
          caseMcn: priorityEntry.caseMcn,
          icon: Save,
          badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
          badgeText: 'Priority',
        };
      }

      // Fallback for unknown activity types - cast to base type
      const baseEntry = entry as Extract<CaseActivityEntry, CaseActivityEntry>;
      return {
        id: baseEntry.id,
        type: 'unknown',
        title: 'Activity recorded',
        description: `Activity on case`,
        timestamp: baseEntry.timestamp,
        relativeTime,
        caseId: baseEntry.caseId,
        caseName: baseEntry.caseName,
        caseMcn: baseEntry.caseMcn,
        icon: Clock,
        badgeColor: 'bg-muted text-muted-foreground',
        badgeText: 'Other',
      };
    });

  return recentActivity;
}

/**
 * Activity Timeline Widget Component
 *
 * Displays recent activity from the last 7 days including:
 * - Notes added to cases
 * - Status changes
 * - Import operations
 *
 * Features:
 * - Last 7 days of activity (limited to 10 most recent)
 * - Type badges with lucide icons (Note, Status Change, Import)
 * - Relative timestamps ("2 hours ago")
 * - Freshness indicator
 * - Empty state when no recent activity
 * - Scrollable content area
 * - Case name and activity description
 *
 * @example
 * ```tsx
 * <ActivityTimelineWidget activityLogState={activityLogState} />
 * ```
 */
export function ActivityTimelineWidget({
  activityLogState,
  metadata,
  onViewCase,
}: ActivityTimelineWidgetProps) {
  /**
   * Fetch and format activity data using widget data hook.
   * Memoized to prevent continuous refetching from inline lambda recreation.
   */
  const fetchTimeline = useCallback(async () => {
    return formatActivityTimeline(activityLogState.activityLog || []);
  }, [activityLogState.activityLog]);

  const { data: timeline, loading, freshness } = useWidgetData(
    fetchTimeline,
    {
      refreshInterval: metadata?.refreshInterval ?? 2 * 60 * 1000, // 2 minutes default for activity
      enablePerformanceTracking: true,
    }
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
  if (loading && !timeline) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>Loading recent activity...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const items = timeline || [];
  const hasActivity = items.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Activity Timeline</CardTitle>
            <CardDescription>Last 7 days of recent activity</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {items.length} recent
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {hasActivity ? (
          <>
            {/* Activity timeline */}
            <ScrollArea className="h-64 pr-4">
              <div className="space-y-3">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className="flex gap-3 pb-3 border-b border-border/50 last:border-0"
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {item.title}
                          </p>
                          <Badge
                            variant="secondary"
                            className={`text-xs flex-shrink-0 ${item.badgeColor}`}
                          >
                            {item.badgeText}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mb-1">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {onViewCase ? (
                            <Button
                              variant="link"
                              className="h-auto p-0 text-xs font-medium"
                              onClick={() => onViewCase(item.caseId)}
                            >
                              {item.caseName}
                            </Button>
                          ) : (
                            <span className="text-xs font-medium">{item.caseName}</span>
                          )}
                          <span className="text-xs text-muted-foreground">•</span>
                          <CopyButton
                            value={item.caseMcn}
                            label="MCN"
                            showLabel={false}
                            mono
                            className="text-muted-foreground"
                            buttonClassName="text-xs"
                            textClassName="text-xs"
                            missingLabel="No MCN"
                            missingClassName="text-xs text-muted-foreground"
                            variant="plain"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.relativeTime}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Freshness indicator */}
            <div className="text-xs text-muted-foreground text-center pt-3 border-t border-border/50 mt-3">
              <p>Last checked: {freshnessLabel}</p>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="text-center py-8">
            <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No recent activity in the last 7 days
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ActivityTimelineWidget;
