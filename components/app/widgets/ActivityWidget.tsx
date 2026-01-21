import { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { formatRelativeTime } from '@/domain/common';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { useWidgetData } from '@/hooks/useWidgetData';
import type { CaseActivityLogState, CaseActivityEntry, ActivityReportFormat } from '@/types/activityLog';
import type { WidgetMetadata } from './WidgetRegistry';
import {
  getTopCasesForReport,
  serializeDailyActivityReport,
  toActivityDateKey,
} from '@/utils/activityReport';

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

/**
 * Format activity entries into timeline items.
 */
function formatActivityTimeline(activityLog: CaseActivityEntry[]): TimelineItem[] {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return activityLog
    .filter((entry) => {
      try {
        return new Date(entry.timestamp) >= sevenDaysAgo;
      } catch {
        return false;
      }
    })
    .slice(0, 10)
    .map((entry): TimelineItem => {
      const relativeTime = formatRelativeTime(entry.timestamp);

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
          title: `Status: ${fromStatus} → ${toStatus}`,
          description: `Status updated`,
          timestamp: statusEntry.timestamp,
          relativeTime,
          caseId: statusEntry.caseId,
          caseName: statusEntry.caseName,
          caseMcn: statusEntry.caseMcn,
          icon: Save,
          badgeColor: 'bg-accent text-accent-foreground',
          badgeText: 'Status',
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

      if (entry.type === 'case-viewed') {
        const viewedEntry = entry as Extract<CaseActivityEntry, { type: 'case-viewed' }>;
        return {
          id: viewedEntry.id,
          type: 'save',
          title: 'Viewed case',
          description: 'Case opened',
          timestamp: viewedEntry.timestamp,
          relativeTime,
          caseId: viewedEntry.caseId,
          caseName: viewedEntry.caseName,
          caseMcn: viewedEntry.caseMcn,
          icon: Eye,
          badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
          badgeText: 'Viewed',
        };
      }

      const baseEntry = entry as Extract<CaseActivityEntry, CaseActivityEntry>;
      return {
        id: baseEntry.id,
        type: 'unknown',
        title: 'Activity recorded',
        description: `Activity recorded`,
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
export function ActivityWidget({ activityLogState, metadata, onViewCase }: ActivityWidgetProps) {
  const [selectedReportDate, setSelectedReportDate] = useState<Date>(() => new Date());
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

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
      console.error('Failed to refresh activity log', error);
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
      console.error('Failed to clear activity log for date', error);
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
        const mimeType =
          format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/plain';
        const extension = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'txt';
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `ActivityReport_${toActivityDateKey(selectedReportDate)}.${extension}`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${extension.toUpperCase()} activity report.`);
      } catch (error) {
        console.error('Failed to export activity report', error);
        toast.error('Unable to export the activity report.');
      }
    },
    [selectedActivityReport, selectedReportDate]
  );

  const items = timeline || [];

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
            {loading && !timeline ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded" />
                ))}
              </div>
            ) : items.length > 0 ? (
              <div className="space-y-2">
                {items.slice(0, 3).map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex gap-3 p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                              <Badge
                                variant="secondary"
                                className={`text-xs flex-shrink-0 ${item.badgeColor}`}
                              >
                                {item.badgeText}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
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
                              <PinButton caseId={item.caseId} size="sm" />
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
                          </div>
                        </div>
                      );
                    })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">No recent activity in the last 7 days</p>
              </div>
            )}
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
    </Card>
  );
}

export default ActivityWidget;
