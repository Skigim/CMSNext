import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import Fuse from "fuse.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ScrollArea } from "../ui/scroll-area";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  BellRing,
  ChevronRight,
  LineChart,
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

type ReportOptionId = "alerts" | "caseload" | "outcomes";

type ReportOption = {
  id: ReportOptionId;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  status: "available" | "coming-soon";
};

const REPORT_OPTIONS: ReportOption[] = [
  {
    id: "alerts",
    title: "Alerts activity",
    description: "Track, filter, and manage every alert across your workspace.",
    icon: BellRing,
    status: "available",
  },
  {
    id: "caseload",
    title: "Caseload insights",
    description: "Visualize caseload trends, assignments, and throughput.",
    icon: LineChart,
    status: "coming-soon",
  },
  {
    id: "outcomes",
    title: "Outcomes dashboard",
    description: "Measure progress across key performance outcomes.",
    icon: BarChart3,
    status: "coming-soon",
  },
];

export default function Reporting({ alerts, onViewCase }: ReportingProps) {
  const [selectedReport, setSelectedReport] = useState<ReportOptionId>("alerts");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reporting</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Deep dive into your case data with purpose-built reports. Start with the alerts report to audit unresolved issues and uncover follow-up opportunities.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_OPTIONS.map((option) => {
          const isSelected = option.id === selectedReport;
          const isAvailable = option.status === "available";
          const cardClasses = [
            "h-full rounded-xl border transition",
            isSelected ? "border-primary shadow-sm ring-2 ring-primary/20" : "border-border hover:border-primary/40 hover:bg-accent/30",
            !isAvailable ? "cursor-not-allowed opacity-65" : "cursor-pointer",
          ].join(" ");

          return (
            <Card key={option.id} className={cardClasses}>
              <button
                type="button"
                onClick={() => {
                  if (!isAvailable) return;
                  setSelectedReport(option.id);
                }}
                disabled={!isAvailable}
                className="flex h-full w-full flex-col text-left"
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between">
                    <option.icon className="h-5 w-5 text-primary" aria-hidden />
                    {!isAvailable && (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        Coming soon
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg text-foreground">{option.title}</CardTitle>
                  <CardDescription>{option.description}</CardDescription>
                </CardHeader>
              </button>
            </Card>
          );
        })}
      </div>

      {selectedReport === "alerts" ? (
        <AlertsReport alerts={alerts} onViewCase={onViewCase} />
      ) : (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <AlertTriangle className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-lg font-semibold text-foreground">This report is under construction</p>
            <p className="mt-1 text-sm">
              We&apos;re building dedicated visuals for {selectedReport === "caseload" ? "caseload insights" : "outcomes tracking"}.
              Stay tuned!
            </p>
          </CardContent>
        </Card>
      )}
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

  const totalAlerts = alerts.alerts.length;
  const openAlerts = useMemo(() => filterOpenAlerts(alerts.alerts), [alerts.alerts]);
  const openAlertsCount = openAlerts.length;
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
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <BellRing className="h-5 w-5 text-primary" />
          Alerts report
        </CardTitle>
        <CardDescription>
          Search across alert metadata with fuzzy matching and sort key fields to audit follow-up priorities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryStat label="Total alerts" value={totalAlerts} />
          <SummaryStat label="Open alerts" value={openAlertsCount} highlight="warning" />
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
          <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            <p>No alerts match the current filters.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[520px]">
            <div className="min-w-[720px] overflow-hidden rounded-lg border border-border/60 bg-card/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-card/90">
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
            </div>
          </ScrollArea>
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
    ? "text-amber-600"
    : highlight === "danger"
      ? "text-destructive"
      : "text-foreground";

  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
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
