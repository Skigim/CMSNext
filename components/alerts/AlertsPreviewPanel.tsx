import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { CaseDisplay } from "../../types/case";
import { AlertsSummary, AlertWithMatch, parseAlertsFromCsv } from "../../utils/alertsData";
import sampleAlertsCsv from "../../archive/data/sample-alerts.csv?raw";
import { cn } from "../ui/utils";
import { AlertTriangle, BellRing, Download, RefreshCw } from "lucide-react";

interface AlertsPreviewPanelProps {
  cases: CaseDisplay[];
}

type PreviewAlert = AlertWithMatch;
type PreviewMatchStatus = PreviewAlert["matchStatus"];

const matchVariant: Record<PreviewMatchStatus, { label: string; className: string }> = {
  matched: { label: "Matched", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  "missing-mcn": { label: "Needs MCN", className: "bg-muted text-muted-foreground border-dashed" },
  unmatched: { label: "No Case Match", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

const emptySummary: AlertsSummary = {
  total: 0,
  matched: 0,
  unmatched: 0,
  missingMcn: 0,
  latestUpdated: null,
};

const intlDate = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

function formatDisplayDate(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return intlDate.format(date);
}

export const AlertsPreviewPanel = memo(function AlertsPreviewPanel({ cases }: AlertsPreviewPanelProps) {
  const [alerts, setAlerts] = useState<PreviewAlert[]>([]);
  const [summary, setSummary] = useState<AlertsSummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const loadSampleAlerts = useCallback(() => {
    setIsLoading(true);
    setError(null);

    try {
      const { alerts: parsedAlerts, summary: parsedSummary } = parseAlertsFromCsv(sampleAlertsCsv, cases);
      if (!parsedAlerts.length) {
        throw new Error("Sample CSV returned no rows");
      }

      setAlerts(parsedAlerts);
      setSummary(parsedSummary);
      setLastLoadedAt(new Date().toISOString());
      toast.success(`Loaded ${parsedSummary.total} sample alerts`);
    } catch (err) {
      console.error("Failed to load sample alerts", err);
      setError("We couldn't read the sample alerts file. Please check the console for details.");
      toast.error("Failed to load sample alerts");
    } finally {
      setIsLoading(false);
    }
  }, [cases]);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setSummary(emptySummary);
    setError(null);
    setLastLoadedAt(null);
  }, []);

  const latestUpdated = useMemo(() => {
    if (!summary.latestUpdated) {
      return null;
    }

    return formatDisplayDate(summary.latestUpdated);
  }, [summary.latestUpdated]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <BellRing className="h-5 w-5 text-primary" />
              Alerts Preview Workspace
            </CardTitle>
            <CardDescription>
              Load the bundled sample to explore the upcoming alerts UI. The parser keeps raw CSV values so we can iterate on the schema without migrations.
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <a href="/archive/data/sample-alerts.csv" download>
              <Download className="h-4 w-4" />
              Sample CSV
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={loadSampleAlerts} disabled={isLoading}>
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <BellRing className="h-4 w-4" />
            )}
            {isLoading ? "Loading sample..." : "Load sample alerts"}
          </Button>
          {alerts.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAlerts}>
              Clear preview
            </Button>
          )}
          {lastLoadedAt && (
            <span className="text-xs text-muted-foreground">
              Preview refreshed {formatDisplayDate(lastLoadedAt)}
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">No alerts loaded yet</p>
            <p className="mb-2">
              Use the button above to load <code>sample-alerts.csv</code>. We map MCNs against your current workspace and flag anything that needs a manual link.
            </p>
            <p>
              This preview keeps everything client-side so we can iterate on the schema before wiring storage updates.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                <div className="text-xs uppercase text-muted-foreground">Total alerts</div>
                <div className="text-2xl font-semibold text-foreground">{summary.total}</div>
                {latestUpdated && (
                  <div className="text-xs text-muted-foreground">Updated {latestUpdated}</div>
                )}
              </div>
              <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                <div className="text-xs uppercase text-muted-foreground">Matched</div>
                <div className="text-xl font-semibold text-foreground">{summary.matched}</div>
                <div className="text-xs text-muted-foreground">Joined to an MCN in this workspace</div>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                <div className="text-xs uppercase text-muted-foreground">Missing MCN</div>
                <div className="text-xl font-semibold text-foreground">{summary.missingMcn}</div>
                <div className="text-xs text-muted-foreground">Requires manual match</div>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                <div className="text-xs uppercase text-muted-foreground">Unmatched</div>
                <div className="text-xl font-semibold text-foreground">{summary.unmatched}</div>
                <div className="text-xs text-muted-foreground">MCN not found in workspace</div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Alert</TableHead>
                  <TableHead>Case match</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="max-w-[240px]">
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">{alert.alertType || alert.alertCode || "Alert"}</div>
                        <div className="text-xs text-muted-foreground">
                          {alert.description || "No description provided."}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {alert.alertCode && <span>#{alert.alertCode}</span>}
                          {alert.personName && <span>{alert.personName}</span>}
                          {alert.mcNumber && <span>MCN {alert.mcNumber}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("border", matchVariant[alert.matchStatus].className)}
                      >
                        {matchVariant[alert.matchStatus].label}
                      </Badge>
                      {alert.matchedCaseName && (
                        <div className="text-xs text-muted-foreground">
                          {alert.matchedCaseName}
                          {alert.matchedCaseStatus && ` · ${alert.matchedCaseStatus}`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{alert.program || "-"}</TableCell>
                    <TableCell>{alert.source || "-"}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDisplayDate(alert.updatedAt || alert.createdAt || alert.alertDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableCaption className="text-xs text-muted-foreground">
                Previewing {alerts.length} alerts from sample-alerts.csv
              </TableCaption>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
