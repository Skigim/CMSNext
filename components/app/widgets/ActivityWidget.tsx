import { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { formatRelativeTime } from '@/domain/common';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CopyButton } from '@/components/common/CopyButton';
import { PinButton } from '@/components/common/PinButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CalendarPicker } from '@/components/ui/calendar-picker';
import {
  FileText,
  Save,
  Clock,
  Download,
  Trash2,
  Loader2,
  RefreshCcw,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWidgetData } from '@/hooks/useWidgetData';
import type {
  CaseActivityLogState,
  CaseActivityEntry,
  ActivityReportFormat,
} from '@/types/activityLog';
import type { WidgetMetadata } from './WidgetRegistry';
import {
  getTopCasesForReport,
  serializeDailyActivityReport,
  toActivityDateKey,
} from '@/utils/activityReport';
import { createLogger } from '@/utils/logger';

const logger = createLogger('ActivityWidget');

/** Number of timeline items shown when collapsed */
const COLLAPSED_ITEM_COUNT = 3;
/** Maximum timeline items shown when expanded */
const EXPANDED_ITEM_COUNT = 10;
const TIMELINE_SKELETON_KEYS = ['timeline-skeleton-1', 'timeline-skeleton-2', 'timeline-skeleton-3', 'timeline-skeleton-4'];

/**
 * Activity timeline item with type and formatting.
 */
interface TimelineItem {
  id: string;
  entryType: CaseActivityEntry['type'];
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

interface CaseTimelineItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  relativeTime: string;
  caseId: string;
  caseName: string;
  caseMcn?: string | null;
  entryCount: number;
  entries: TimelineItem[];
  icon: typeof FileText;
  badgeColor: string;
  badgeText: string;
}

/**
 * Props for the Activity Widget.
 */
interface ActivityWidgetProps {
  /** Activity log state containing recent activity entries */
  activityLogState: CaseActivityLogState;
  /** Widget metadata (injected by WidgetRegistry) */
  metadata?: WidgetMetadata;
  /** Handler to view a case */
  onViewCase?: (caseId: string) => void;
}

function assertUnreachable(value: never): never {
  throw new Error(`Unexpected activity entry: ${JSON.stringify(value)}`);
}

function formatActivityEntry(entry: CaseActivityEntry): TimelineItem {
  const relativeTime = formatRelativeTime(entry.timestamp);

  if (entry.type === 'note-added') {
    return {
      id: entry.id,
      entryType: entry.type,
      type: 'note',
      title: 'Note added',
      description: entry.payload.preview || 'New case note',
      timestamp: entry.timestamp,
      relativeTime,
      caseId: entry.caseId,
      caseName: entry.caseName,
      caseMcn: entry.caseMcn,
      icon: FileText,
      badgeColor: 'bg-primary/20 text-primary',
      badgeText: 'Note',
    };
  }

  if (entry.type === 'status-change') {
    const fromStatus = entry.payload.fromStatus || 'Unknown';
    const toStatus = entry.payload.toStatus || 'Unknown';
    return {
      id: entry.id,
      entryType: entry.type,
      type: 'save',
      title: `Status: ${fromStatus} → ${toStatus}`,
      description: 'Status updated',
      timestamp: entry.timestamp,
      relativeTime,
      caseId: entry.caseId,
      caseName: entry.caseName,
      caseMcn: entry.caseMcn,
      icon: Save,
      badgeColor: 'bg-accent text-accent-foreground',
      badgeText: 'Status',
    };
  }

  if (entry.type === 'priority-change') {
    const action = entry.payload.toPriority ? 'marked as priority' : 'unmarked as priority';
    return {
      id: entry.id,
      entryType: entry.type,
      type: 'save',
      title: `Priority ${action}`,
      description: 'Priority updated',
      timestamp: entry.timestamp,
      relativeTime,
      caseId: entry.caseId,
      caseName: entry.caseName,
      caseMcn: entry.caseMcn,
      icon: Save,
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
      badgeText: 'Priority',
    };
  }

  if (entry.type === 'case-viewed') {
    return {
      id: entry.id,
      entryType: entry.type,
      type: 'save',
      title: 'Case viewed',
      description: 'Case opened',
      timestamp: entry.timestamp,
      relativeTime,
      caseId: entry.caseId,
      caseName: entry.caseName,
      caseMcn: entry.caseMcn,
      icon: Eye,
      badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      badgeText: 'Viewed',
    };
  }

  return assertUnreachable(entry);
}

function getCaseTimelineDescription(entries: TimelineItem[]): string {
  const counts = entries.reduce(
    (totals, entry) => {
      if (entry.entryType === 'case-viewed') {
        totals.views += 1;
      }
      if (entry.entryType === 'status-change') {
        totals.statusChanges += 1;
      }
      if (entry.entryType === 'priority-change') {
        totals.priorityChanges += 1;
      }
      if (entry.entryType === 'note-added') {
        totals.notesAdded += 1;
      }
      return totals;
    },
    { views: 0, statusChanges: 0, priorityChanges: 0, notesAdded: 0 }
  );

  const summaryParts: string[] = [];

  if (counts.views > 0) {
    summaryParts.push(`${counts.views} view${counts.views === 1 ? '' : 's'}`);
  }
  if (counts.statusChanges > 0) {
    summaryParts.push(`${counts.statusChanges} status${counts.statusChanges === 1 ? '' : 'es'}`);
  }
  if (counts.priorityChanges > 0) {
    summaryParts.push(`${counts.priorityChanges} priorit${counts.priorityChanges === 1 ? 'y' : 'ies'}`);
  }
  if (counts.notesAdded > 0) {
    summaryParts.push(`${counts.notesAdded} note${counts.notesAdded === 1 ? '' : 's'}`);
  }

  if (summaryParts.length === 0) {
    return `${entries.length} action${entries.length === 1 ? '' : 's'} recorded`;
  }

  return summaryParts.join(' · ');
}

function getReportExportConfig(format: ActivityReportFormat): { mimeType: string; extension: string } {
  if (format === 'json') {
    return { mimeType: 'application/json', extension: 'json' };
  }
  if (format === 'csv') {
    return { mimeType: 'text/csv', extension: 'csv' };
  }
  return { mimeType: 'text/plain', extension: 'txt' };
}

/**
 * Format activity entries into timeline items.
 */
function formatActivityTimeline(activityLog: CaseActivityEntry[]): CaseTimelineItem[] {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const groupedTimeline = activityLog.reduce<Map<string, CaseTimelineItem>>((timelineMap, entry) => {
    const entryTimestamp = new Date(entry.timestamp).getTime();
    if (Number.isNaN(entryTimestamp) || entryTimestamp < sevenDaysAgo.getTime()) {
      return timelineMap;
    }

    const existingItem = timelineMap.get(entry.caseId);
    const formattedEntry = formatActivityEntry(entry);

    if (!existingItem) {
      timelineMap.set(entry.caseId, {
        id: entry.caseId,
        title: formattedEntry.title,
        description: '',
        timestamp: entry.timestamp,
        relativeTime: formattedEntry.relativeTime,
        caseId: entry.caseId,
        caseName: entry.caseName,
        caseMcn: entry.caseMcn,
        entryCount: 1,
        entries: [formattedEntry],
        icon: formattedEntry.icon,
        badgeColor: formattedEntry.badgeColor,
        badgeText: formattedEntry.badgeText,
      });
      return timelineMap;
    }

    existingItem.entries.push(formattedEntry);
    existingItem.entryCount += 1;
    const existingTimestamp = new Date(existingItem.timestamp).getTime();

    if (Number.isNaN(existingTimestamp) || entryTimestamp > existingTimestamp) {
      existingItem.timestamp = entry.timestamp;
      existingItem.relativeTime = formattedEntry.relativeTime;
      existingItem.caseName = entry.caseName;
      existingItem.caseMcn = entry.caseMcn;
      existingItem.title = formattedEntry.title;
      existingItem.icon = formattedEntry.icon;
      existingItem.badgeColor = formattedEntry.badgeColor;
      existingItem.badgeText = formattedEntry.badgeText;
    }

    return timelineMap;
  }, new Map());

  return Array.from(groupedTimeline.values())
    .map((item) => {
      const entries = [...item.entries].sort(
        (firstEntry, secondEntry) =>
          new Date(secondEntry.timestamp).getTime() - new Date(firstEntry.timestamp).getTime()
      );
      const latestEntry = entries[0];

      return {
        ...item,
        entries,
        title: latestEntry.title,
        icon: latestEntry.icon,
        badgeColor: latestEntry.badgeColor,
        badgeText: latestEntry.badgeText,
        description: getCaseTimelineDescription(entries),
        relativeTime: formatRelativeTime(item.timestamp),
      };
    })
    .sort(
      (firstItem, secondItem) =>
        new Date(secondItem.timestamp).getTime() - new Date(firstItem.timestamp).getTime()
    )
    .slice(0, EXPANDED_ITEM_COUNT);
}

/**
 * Activity Widget Component
 *
 * Combined widget displaying:
 * - Timeline view: Last 7 days of recent activity (notes, status changes)
 * - Export view: Daily activity reports with export capabilities
 *
 * Features:
 * - Tabbed interface for timeline vs. export
 * - Relative timestamps and type badges
 * - Date picker for report selection
 * - Export to JSON/CSV/TXT
 * - Clear daily logs
 * - Auto-refresh with freshness indicator
 *
 * @example
 * ```tsx
 * <ActivityWidget activityLogState={activityLogState} />
 * ```
 */
export function ActivityWidget({ activityLogState, metadata, onViewCase }: Readonly<ActivityWidgetProps>) {
  const [selectedReportDate, setSelectedReportDate] = useState<Date>(() => new Date());
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const [selectedTimelineItem, setSelectedTimelineItem] = useState<CaseTimelineItem | null>(null);

  const {
    loading: activityLogLoading,
    error: activityLogError,
    refreshActivityLog,
    getReportForDate,
    clearReportForDate,
  } = activityLogState;

  // Timeline data
  const fetchTimeline = useCallback(async () => {
    return formatActivityTimeline(activityLogState.activityLog || []);
  }, [activityLogState.activityLog]);

  const { data: timeline, loading } = useWidgetData(fetchTimeline, {
    refreshInterval: metadata?.refreshInterval ?? 2 * 60 * 1000,
    enablePerformanceTracking: true,
  });

  // Report data
  const selectedActivityReport = useMemo(
    () => getReportForDate(selectedReportDate),
    [getReportForDate, selectedReportDate]
  );

  const selectedDateLabel = useMemo(() => format(selectedReportDate, 'PPP'), [selectedReportDate]);

  const topCasesForSelectedDate = useMemo(
    () => getTopCasesForReport(selectedActivityReport, 5),
    [selectedActivityReport]
  );

  const hasSelectedActivity = selectedActivityReport?.totals.total > 0;

  // Handlers
  const handleSelectReportDate = useCallback((date?: Date) => {
    if (date) setSelectedReportDate(date);
  }, []);

  const handleRefreshActivityLog = useCallback(async () => {
    try {
      await refreshActivityLog();
      toast.success('Activity log refreshed');
    } catch (error) {
      logger.error('Failed to refresh activity log', { error: String(error) });
      toast.error('Unable to refresh the activity log.');
    }
  }, [refreshActivityLog]);

  const handleClearSelectedReport = useCallback(async () => {
    if (isClearing) return;

    const targetDate = new Date(selectedReportDate);
    const toastId = toast.loading('Clearing activity log entries...');

    setIsClearing(true);
    try {
      const removedCount = await clearReportForDate(targetDate);
      if (removedCount > 0) {
        toast.success(
          `Cleared ${removedCount} entr${removedCount === 1 ? 'y' : 'ies'} for ${selectedDateLabel}.`,
          { id: toastId }
        );
      } else {
        toast.info(`No activity entries recorded for ${selectedDateLabel}.`, { id: toastId });
      }
      setClearDialogOpen(false);
    } catch (error) {
      logger.error('Failed to clear activity log for date', { error: String(error) });
      toast.error('Unable to clear the activity log for this date.', { id: toastId });
    } finally {
      setIsClearing(false);
    }
  }, [clearReportForDate, isClearing, selectedDateLabel, selectedReportDate]);

  const handleExportActivityReport = useCallback(
    (format: ActivityReportFormat) => {
      if (!selectedActivityReport || selectedActivityReport.totals.total === 0) {
        toast.info('No activity recorded for the selected date.');
        return;
      }

      try {
        const content = serializeDailyActivityReport(selectedActivityReport, format);
        const { mimeType, extension } = getReportExportConfig(format);
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `ActivityReport_${toActivityDateKey(selectedReportDate)}.${extension}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${extension.toUpperCase()} activity report.`);
      } catch (error) {
        logger.error('Failed to export activity report', { error: String(error) });
        toast.error('Unable to export the activity report.');
      }
    },
    [selectedActivityReport, selectedReportDate]
  );

  const handleOpenTimelineItem = useCallback((item: CaseTimelineItem) => {
    setSelectedTimelineItem(item);
  }, []);

  const handleTimelineDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedTimelineItem(null);
    }
  }, []);

  const handleViewSelectedCase = useCallback(() => {
    if (!selectedTimelineItem || !onViewCase) {
      return;
    }

    onViewCase(selectedTimelineItem.caseId);
    setSelectedTimelineItem(null);
  }, [onViewCase, selectedTimelineItem]);

  const timelineContent = useMemo(() => {
    const items = timeline || [];
    if (loading && !timeline) {
      return (
        <div className="space-y-3">
          {TIMELINE_SKELETON_KEYS.map((key) => (
            <div key={key} className="h-12 bg-muted rounded" />
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="text-center py-8">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">No recent activity in the last 7 days</p>
        </div>
      );
    }

    return (
      <div id="activity-timeline-list" className="space-y-2">
        {items.slice(0, isTimelineExpanded ? EXPANDED_ITEM_COUNT : COLLAPSED_ITEM_COUNT).map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 transition-colors"
            >
              <Button
                variant="ghost"
                className="h-auto flex-1 justify-start rounded-lg px-3 py-3 text-left hover:bg-muted/50"
                onClick={() => handleOpenTimelineItem(item)}
                aria-label={`View activity for ${item.caseName}`}
              >
                <div className="flex w-full gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs font-medium truncate">{item.caseName}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant="secondary"
                          className={`text-xs flex-shrink-0 ${item.badgeColor}`}
                        >
                          {item.badgeText}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{item.relativeTime}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.entryCount} action{item.entryCount === 1 ? '' : 's'} · {item.description}
                    </p>
                  </div>
                </div>
              </Button>
              <div className="flex items-center gap-2 pr-3">
                <PinButton caseId={item.caseId} caseName={item.caseName} size="sm" />
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
            </div>
          );
        })}
        {items.length > COLLAPSED_ITEM_COUNT && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => setIsTimelineExpanded((prev) => !prev)}
            aria-expanded={isTimelineExpanded}
            aria-controls="activity-timeline-list"
          >
            {isTimelineExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" aria-hidden="true" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" aria-hidden="true" />
                Show more ({Math.min(items.length, EXPANDED_ITEM_COUNT) - COLLAPSED_ITEM_COUNT} more)
              </>
            )}
          </Button>
        )}
      </div>
    );
  }, [handleOpenTimelineItem, isTimelineExpanded, timeline, loading]);

  return (
    <Card>
      <Tabs defaultValue="timeline" className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Recent timeline and daily reports</CardDescription>
            </div>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>
        <CardContent>
          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-0">
            {timelineContent}
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
              <CalendarPicker
                date={selectedReportDate}
                onDateChange={handleSelectReportDate}
                label="Report date"
                placeholder="Select date"
                formatString="P"
                className="w-full"
                buttonClassName="bg-background"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshActivityLog}
                  disabled={activityLogLoading}
                  className="flex-1"
                >
                  {activityLogLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Refreshing
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="h-3 w-3 mr-1" />
                      Refresh
                    </>
                  )}
                </Button>
                <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={!hasSelectedActivity || activityLogLoading || isClearing}
                      className="flex-1"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear activity log for {selectedDateLabel}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove all {selectedActivityReport?.totals.total ?? 0}{' '}
                        entries recorded on {selectedDateLabel}. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={handleClearSelectedReport}
                      >
                        {isClearing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Clearing...
                          </>
                        ) : (
                          'Clear entries'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {activityLogError && (
              <p className="text-xs text-destructive">Error: {activityLogError}</p>
            )}

            {activityLogLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded border bg-muted/40 p-2 text-center">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="text-lg font-semibold">
                      {selectedActivityReport.totals.total}
                    </div>
                  </div>
                  <div className="rounded border bg-muted/40 p-2 text-center">
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="text-lg font-semibold">
                      {selectedActivityReport.totals.statusChanges}
                    </div>
                  </div>
                  <div className="rounded border bg-muted/40 p-2 text-center">
                    <div className="text-xs text-muted-foreground">Notes</div>
                    <div className="text-lg font-semibold">
                      {selectedActivityReport.totals.notesAdded}
                    </div>
                  </div>
                </div>

                {hasSelectedActivity && topCasesForSelectedDate.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Top cases</h5>
                    <ul className="space-y-1 text-sm">
                      {topCasesForSelectedDate.slice(0, 3).map((caseSummary) => {
                        const total = caseSummary.statusChanges + caseSummary.notesAdded;
                        return (
                          <li
                            key={caseSummary.caseId}
                            className="flex justify-between rounded border bg-background/80 px-2 py-1.5"
                          >
                            <span className="font-medium truncate">{caseSummary.caseName}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {total} · {caseSummary.statusChanges}s · {caseSummary.notesAdded}n
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportActivityReport('json')}
                    disabled={activityLogLoading || !hasSelectedActivity}
                    className="flex-1"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportActivityReport('csv')}
                    disabled={activityLogLoading || !hasSelectedActivity}
                    className="flex-1"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportActivityReport('txt')}
                    disabled={activityLogLoading || !hasSelectedActivity}
                    className="flex-1"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    TXT
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
      <Dialog open={selectedTimelineItem !== null} onOpenChange={handleTimelineDialogOpenChange}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {selectedTimelineItem ? `Activity for ${selectedTimelineItem.caseName}` : 'Case activity'}
            </DialogTitle>
            <DialogDescription>
              {selectedTimelineItem
                ? `${selectedTimelineItem.entryCount} recorded action${selectedTimelineItem.entryCount === 1 ? '' : 's'} in the last 7 days.`
                : 'Review recent case activity.'}
            </DialogDescription>
          </DialogHeader>

          {selectedTimelineItem && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <CopyButton
                  value={selectedTimelineItem.caseMcn}
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
                <span>•</span>
                <span>Latest activity {selectedTimelineItem.relativeTime}</span>
              </div>

              <div
                className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden"
                data-testid="activity-detail-scroll-container"
              >
                <ScrollArea className="min-h-0 flex-1" data-testid="activity-detail-scroll-area">
                  <div className="space-y-2 pr-4">
                    {selectedTimelineItem.entries.map((entry) => {
                      const Icon = entry.icon;
                      return (
                        <div
                          key={entry.id}
                          className="rounded-lg border border-border/60 bg-muted/20 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex-shrink-0">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">{entry.title}</p>
                                  <p className="text-xs text-muted-foreground break-words">
                                    {entry.description}
                                  </p>
                                </div>
                                <Badge
                                  variant="secondary"
                                  className={`text-xs flex-shrink-0 ${entry.badgeColor}`}
                                >
                                  {entry.badgeText}
                                </Badge>
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">{entry.relativeTime}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}

          <DialogFooter>
            {onViewCase && selectedTimelineItem ? (
              <Button onClick={handleViewSelectedCase}>Open case</Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
