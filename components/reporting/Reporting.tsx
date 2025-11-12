import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ScrollArea } from "../ui/scroll-area";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BellRing,
  ChevronRight,
} from "lucide-react";
import {
  buildAlertStorageKey,
  filterOpenAlerts,
  type AlertsIndex,
  type AlertWithMatch,
} from "../../utils/alertsData";
import {
  getAlertClientName,
  getAlertDisplayDescription,
  getAlertDueDateInfo,
  getAlertMcn,
} from "@/utils/alertDisplay";
import { McnCopyControl } from "@/components/common/McnCopyControl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReportingProps {
  alerts: AlertsIndex;
  onViewCase?: (caseId: string) => void;
}

export default function Reporting({ alerts, onViewCase }: ReportingProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reporting</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Deep dive into your case data with purpose-built reports. Start with the alerts report to audit unresolved issues and uncover follow-up opportunities.
        </p>
      </div>

      <AlertsReport alerts={alerts} onViewCase={onViewCase} />
    </div>
  );
}

interface AlertsReportProps {
  alerts: AlertsIndex;
  onViewCase?: (caseId: string) => void;
}

function AlertsReport({ alerts, onViewCase }: AlertsReportProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortState, setSortState] = useState<{
    column: "description" | "client" | "due";
    direction: "asc" | "desc";
  }>({ column: "due", direction: "asc" });

  const openAlerts = useMemo(() => filterOpenAlerts(alerts.alerts), [alerts.alerts]);
  const totalOpenAlerts = openAlerts.length;
  const matchedOpenAlerts = useMemo(
    () => openAlerts.filter(alert => alert.matchStatus === "matched"),
    [openAlerts],
  );
  const matchedOpenAlertsCount = matchedOpenAlerts.length;
  const unlinkedAlerts = useMemo(
    () => openAlerts.filter(alert => alert.matchStatus !== "matched"),
    [openAlerts],
  );
  const unlinkedAlertCount = unlinkedAlerts.length;

  const fuse = useMemo(() => {
    if (matchedOpenAlerts.length === 0) {
      return null;
    }

    return new Fuse(matchedOpenAlerts, {
      keys: [
        "description",
        "alertType",
        "alertCode",
        "program",
        "personName",
        "matchedCaseName",
        "mcNumber",
        "metadata.rawDescription",
      ],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
      useExtendedSearch: true,
    });
  }, [matchedOpenAlerts]);

  const filteredAlerts = useMemo(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      return matchedOpenAlerts;
    }

    if (!fuse) {
      return matchedOpenAlerts;
    }

    return fuse.search(trimmed).map(result => result.item);
  }, [fuse, matchedOpenAlerts, searchTerm]);

  const sortedAlerts = useMemo(() => {
    const items = [...filteredAlerts];
    items.sort((a, b) => {
      switch (sortState.column) {
        case "description": {
          const aLabel = getAlertDisplayDescription(a).toLowerCase();
          const bLabel = getAlertDisplayDescription(b).toLowerCase();
          return sortState.direction === "asc"
            ? aLabel.localeCompare(bLabel)
            : bLabel.localeCompare(aLabel);
        }
        case "client": {
          const aClient = (getAlertClientName(a) ?? "").toLowerCase();
          const bClient = (getAlertClientName(b) ?? "").toLowerCase();
          if (aClient === bClient) {
            const aLabel = getAlertDisplayDescription(a).toLowerCase();
            const bLabel = getAlertDisplayDescription(b).toLowerCase();
            return sortState.direction === "asc"
              ? aLabel.localeCompare(bLabel)
              : bLabel.localeCompare(aLabel);
          }
          return sortState.direction === "asc"
            ? aClient.localeCompare(bClient)
            : bClient.localeCompare(aClient);
        }
        case "due":
        default: {
          const aTime = getAlertDueTimestamp(a);
          const bTime = getAlertDueTimestamp(b);
          const normalizedA = aTime ?? (sortState.direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
          const normalizedB = bTime ?? (sortState.direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
          return sortState.direction === "asc"
            ? normalizedA - normalizedB
            : normalizedB - normalizedA;
        }
      }
    });
    return items;
  }, [filteredAlerts, sortState]);

  const filtersActive = searchTerm.trim().length > 0;

  const toggleSort = (column: "description" | "client" | "due") => {
    setSortState(current => {
      if (current.column === column) {
        return {
          column,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return { column, direction: "asc" };
    });
  };

  const renderSortIcon = (column: "description" | "client" | "due") => {
    if (sortState.column !== column) {
      return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground" aria-hidden />;
    }

    if (sortState.direction === "asc") {
      return <ArrowUp className="ml-2 h-3 w-3 text-muted-foreground" aria-hidden />;
    }

    return <ArrowDown className="ml-2 h-3 w-3 text-muted-foreground" aria-hidden />;
  };

  const getAriaSort = (column: "description" | "client" | "due"): "none" | "ascending" | "descending" => {
    if (sortState.column !== column) {
      return "none";
    }

    return sortState.direction === "asc" ? "ascending" : "descending";
  };

  const handleClearSearch = () => setSearchTerm("");

  const visibleAlerts = sortedAlerts;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5" />
          Alerts report
        </CardTitle>
        <CardDescription>
          Search across alert metadata with fuzzy matching and sort key fields to audit follow-up priorities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryStat label="Open alerts" value={totalOpenAlerts} highlight="warning" />
          <SummaryStat label="Matched & open" value={matchedOpenAlertsCount} />
          <SummaryStat label="Unlinked" value={unlinkedAlertCount} highlight={unlinkedAlertCount > 0 ? "danger" : undefined} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="report-alert-search">Fuzzy search</Label>
            <Input
              id="report-alert-search"
              placeholder="Try searching by description, client, code, or MCN"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          {filtersActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearSearch}
              className="justify-start sm:w-auto"
            >
              Clear search
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Showing <span className="font-medium text-foreground">{visibleAlerts.length}</span> of {matchedOpenAlertsCount} matched open alerts
          </span>
          {filtersActive && <span>Fuzzy search active</span>}
        </div>

        {visibleAlerts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <p>No alerts match the current filters.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <ScrollArea className="h-[480px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead aria-sort={getAriaSort("description")}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="flex items-center justify-start gap-2 px-0 font-semibold"
                        onClick={() => toggleSort("description")}
                      >
                        Description
                        {renderSortIcon("description")}
                      </Button>
                    </TableHead>
                    <TableHead aria-sort={getAriaSort("client")}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="flex items-center justify-start gap-2 px-0 font-semibold"
                        onClick={() => toggleSort("client")}
                      >
                        Client
                        {renderSortIcon("client")}
                      </Button>
                    </TableHead>
                    <TableHead aria-sort={getAriaSort("due")}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="flex items-center justify-start gap-2 px-0 font-semibold"
                        onClick={() => toggleSort("due")}
                      >
                        Due date
                        {renderSortIcon("due")}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleAlerts.map((alert, index) => (
                    <AlertsReportRow
                      key={buildAlertStorageKey(alert) ?? (alert.id ? `alert-${String(alert.id)}-${index}` : `alert-${index}`)}
                      alert={alert}
                      onViewCase={onViewCase}
                    />
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AlertsReportRowProps {
  alert: AlertWithMatch;
  onViewCase?: (caseId: string) => void;
}

function AlertsReportRow({ alert, onViewCase }: AlertsReportRowProps) {
  const description = getAlertDisplayDescription(alert);
  const { label } = getAlertDueDateInfo(alert);
  const clientName = getAlertClientName(alert) ?? "Client name unavailable";
  const mcn = getAlertMcn(alert);

  return (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <p className="font-medium text-foreground">{description}</p>
          <p className="text-xs text-muted-foreground">
            {(alert.alertType || "Alert")} • Code {alert.alertCode || "—"}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <p className="text-sm text-foreground">{clientName}</p>
          <McnCopyControl
            mcn={mcn}
            showLabel={false}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            buttonClassName="text-xs text-muted-foreground"
            textClassName="text-xs"
            missingLabel="MCN unavailable"
            missingClassName="text-xs text-muted-foreground"
            variant="plain"
          />
        </div>
      </TableCell>
      <TableCell className="text-sm font-medium text-foreground">
        {label || "—"}
      </TableCell>
      <TableCell className="text-right">
        {alert.matchedCaseId && onViewCase ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onViewCase(alert.matchedCaseId!)}
            className="ml-auto inline-flex items-center gap-1 text-xs"
          >
            View case
            <ChevronRight className="h-3 w-3" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

interface SummaryStatProps {
  label: string;
  value: number;
  highlight?: "warning" | "danger";
}

function SummaryStat({ label, value, highlight }: SummaryStatProps) {
  const valueClass = highlight === "warning"
    ? "text-amber-600 dark:text-amber-500"
    : highlight === "danger"
      ? "text-destructive"
      : "text-foreground";

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

function getAlertDueTimestamp(alert: AlertWithMatch): number | null {
  const raw = alert.alertDate ?? alert.createdAt ?? null;
  if (!raw) {
    return null;
  }
  const timestamp = new Date(raw).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}
