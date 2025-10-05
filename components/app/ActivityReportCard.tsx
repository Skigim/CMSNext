import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { RefreshCcw, Calendar as CalendarIcon, Download } from "lucide-react";
import { toast } from "sonner";
import type { ActivityReportFormat, CaseActivityLogState } from "../../types/activityLog";
import { getTopCasesForReport, serializeDailyActivityReport, toActivityDateKey } from "../../utils/activityReport";
import { DatePicker } from "../ui/date-picker";

interface ActivityReportCardProps {
  activityLogState: CaseActivityLogState;
  title?: string;
  description?: string;
}

export function ActivityReportCard({
  activityLogState,
  title = "Activity Report Export",
  description = "Choose a day to review case activity and export the log as JSON, CSV, or plain text.",
}: ActivityReportCardProps) {
  const [selectedReportDate, setSelectedReportDate] = useState<Date>(() => new Date());
  const {
    loading: activityLogLoading,
    error: activityLogError,
    refreshActivityLog,
    getReportForDate,
  } = activityLogState;

  const selectedActivityReport = useMemo(
    () => getReportForDate(selectedReportDate),
    [getReportForDate, selectedReportDate],
  );

  const handleSelectReportDate = useCallback(
    (date?: Date) => {
      if (date) {
        setSelectedReportDate(date);
      }
    },
    [],
  );

  const topCasesForSelectedDate = useMemo(
    () => getTopCasesForReport(selectedActivityReport, 5),
    [selectedActivityReport],
  );

  const hasSelectedActivity = selectedActivityReport?.totals.total > 0;

  const handleRefreshActivityLog = useCallback(async () => {
    try {
      await refreshActivityLog();
      toast.success("Activity log refreshed");
    } catch (error) {
      console.error("Failed to refresh activity log", error);
      toast.error("Unable to refresh the activity log.");
    }
  }, [refreshActivityLog]);

  const handleExportActivityReport = useCallback(
    (format: ActivityReportFormat) => {
      if (!selectedActivityReport || selectedActivityReport.totals.total === 0) {
        toast.info("No activity recorded for the selected date.");
        return;
      }

      try {
        const content = serializeDailyActivityReport(selectedActivityReport, format);
        const mimeType =
          format === "json"
            ? "application/json"
            : format === "csv"
              ? "text/csv"
              : "text/plain";
        const extension = format === "json" ? "json" : format === "csv" ? "csv" : "txt";
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `ActivityReport_${toActivityDateKey(selectedReportDate)}.${extension}`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${extension.toUpperCase()} activity report.`);
      } catch (error) {
        console.error("Failed to export activity report", error);
        toast.error("Unable to export the activity report.");
      }
    },
    [selectedActivityReport, selectedReportDate],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="font-medium">Daily activity summary</h4>
              <p className="text-sm text-muted-foreground">
                Includes status updates and notes captured in the background as you work cases.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DatePicker
                date={selectedReportDate}
                onDateChange={handleSelectReportDate}
                className="w-full sm:w-auto"
                popoverClassName="p-2"
              />
              <Button
                variant="outline"
                onClick={handleRefreshActivityLog}
                disabled={activityLogLoading}
                className="flex items-center gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                {activityLogLoading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
          {activityLogError && (
            <p className="text-xs text-destructive">
              Unable to load the latest activity log: {activityLogError}
            </p>
          )}
          {activityLogLoading ? (
            <p className="text-sm text-muted-foreground">Loading activity data…</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="text-xs uppercase text-muted-foreground">Total entries</div>
                  <div className="text-2xl font-semibold text-foreground">{selectedActivityReport.totals.total}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="text-xs uppercase text-muted-foreground">Status changes</div>
                  <div className="text-2xl font-semibold text-foreground">{selectedActivityReport.totals.statusChanges}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="text-xs uppercase text-muted-foreground">Notes added</div>
                  <div className="text-2xl font-semibold text-foreground">{selectedActivityReport.totals.notesAdded}</div>
                </div>
              </div>
              <div>
                <h5 className="mb-2 text-sm font-medium text-muted-foreground">Top cases for this day</h5>
                {hasSelectedActivity && topCasesForSelectedDate.length > 0 ? (
                  <ul className="space-y-1 text-sm text-foreground">
                    {topCasesForSelectedDate.map(caseSummary => {
                      const total = caseSummary.statusChanges + caseSummary.notesAdded;
                      return (
                        <li
                          key={caseSummary.caseId}
                          className="flex items-center justify-between rounded-md border border-border/60 bg-background/80 px-3 py-2"
                        >
                          <span className="font-medium">{caseSummary.caseName}</span>
                          <span className="text-xs text-muted-foreground">
                            {total} entr{total === 1 ? "y" : "ies"} · {caseSummary.statusChanges} status · {caseSummary.notesAdded} notes
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No recorded activity for this date.</p>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => handleExportActivityReport("json")}
            disabled={activityLogLoading || !hasSelectedActivity}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExportActivityReport("csv")}
            disabled={activityLogLoading || !hasSelectedActivity}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExportActivityReport("txt")}
            disabled={activityLogLoading || !hasSelectedActivity}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export TXT
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
