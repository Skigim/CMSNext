/**
 * AlertsTableView - Alert-centric table view for CaseList alerts segment.
 * 
 * Displays matched alerts with fuzzy search, sorting, and navigation actions.
 * Reuses patterns from Reporting.tsx but designed as a segment within CaseList.
 */

import { memo, useCallback, useMemo, useState } from "react";
import Fuse from "fuse.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Search,
} from "lucide-react";
import {
  buildAlertStorageKey,
  filterOpenAlerts,
  type AlertWithMatch,
} from "@/utils/alertsData";
import {
  getAlertClientName,
  getAlertDisplayDescription,
  getAlertDueDateInfo,
  getAlertMcn,
} from "@/utils/alertDisplay";
import { CopyButton } from "@/components/common/CopyButton";
import { EmptyState } from "@/components/common/EmptyState";

export type AlertsTableSortKey = "description" | "client" | "dueDate";
export type AlertsTableSortDirection = "asc" | "desc";

export interface AlertsTableSortConfig {
  key: AlertsTableSortKey;
  direction: AlertsTableSortDirection;
}

export interface AlertsTableViewProps {
  alerts: AlertWithMatch[];
  onViewCase: (caseId: string) => void;
  onResolveAlert?: (alert: AlertWithMatch) => void;
}

export const AlertsTableView = memo(function AlertsTableView({
  alerts,
  onViewCase,
  onResolveAlert: _onResolveAlert,
}: AlertsTableViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<AlertsTableSortConfig>({
    key: "dueDate",
    direction: "asc",
  });

  // Filter to open alerts only
  const openAlerts = useMemo(() => filterOpenAlerts(alerts), [alerts]);

  // Compute summary stats
  const matchedAlerts = useMemo(
    () => openAlerts.filter(alert => alert.matchStatus === "matched"),
    [openAlerts],
  );
  const unlinkedAlerts = useMemo(
    () => openAlerts.filter(alert => alert.matchStatus !== "matched"),
    [openAlerts],
  );

  // Create Fuse instance for fuzzy search
  const fuse = useMemo(() => {
    if (matchedAlerts.length === 0) {
      return null;
    }

    return new Fuse(matchedAlerts, {
      keys: [
        "description",
        "alertType",
        "alertCode",
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
  }, [matchedAlerts]);

  // Apply fuzzy search
  const filteredAlerts = useMemo(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed || !fuse) {
      return matchedAlerts;
    }

    return fuse.search(trimmed).map(result => result.item);
  }, [fuse, matchedAlerts, searchTerm]);

  // Sort alerts
  const sortedAlerts = useMemo(() => {
    const items = [...filteredAlerts];
    items.sort((a, b) => {
      switch (sortConfig.key) {
        case "description": {
          const aLabel = getAlertDisplayDescription(a).toLowerCase();
          const bLabel = getAlertDisplayDescription(b).toLowerCase();
          return sortConfig.direction === "asc"
            ? aLabel.localeCompare(bLabel)
            : bLabel.localeCompare(aLabel);
        }
        case "client": {
          const aClient = (getAlertClientName(a) ?? "").toLowerCase();
          const bClient = (getAlertClientName(b) ?? "").toLowerCase();
          if (aClient === bClient) {
            const aLabel = getAlertDisplayDescription(a).toLowerCase();
            const bLabel = getAlertDisplayDescription(b).toLowerCase();
            return sortConfig.direction === "asc"
              ? aLabel.localeCompare(bLabel)
              : bLabel.localeCompare(aLabel);
          }
          return sortConfig.direction === "asc"
            ? aClient.localeCompare(bClient)
            : bClient.localeCompare(aClient);
        }
        case "dueDate":
        default: {
          const aTime = getAlertDueTimestamp(a);
          const bTime = getAlertDueTimestamp(b);
          const normalizedA = aTime ?? (sortConfig.direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
          const normalizedB = bTime ?? (sortConfig.direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
          return sortConfig.direction === "asc"
            ? normalizedA - normalizedB
            : normalizedB - normalizedA;
        }
      }
    });
    return items;
  }, [filteredAlerts, sortConfig]);

  const toggleSort = useCallback((column: AlertsTableSortKey) => {
    setSortConfig(prev => ({
      key: column,
      direction: prev.key === column && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const renderSortIcon = (column: AlertsTableSortKey) => {
    if (sortConfig.key !== column) {
      return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground" aria-hidden />;
    }

    if (sortConfig.direction === "asc") {
      return <ArrowUp className="ml-2 h-3 w-3 text-muted-foreground" aria-hidden />;
    }

    return <ArrowDown className="ml-2 h-3 w-3 text-muted-foreground" aria-hidden />;
  };

  const getAriaSort = (column: AlertsTableSortKey): "none" | "ascending" | "descending" => {
    if (sortConfig.key !== column) {
      return "none";
    }

    return sortConfig.direction === "asc" ? "ascending" : "descending";
  };

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  return (
    <div className="space-y-4">
      {/* Summary Stats Bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryStat label="Open alerts" value={openAlerts.length} highlight="warning" />
        <SummaryStat label="Matched" value={matchedAlerts.length} />
        <SummaryStat label="Unlinked" value={unlinkedAlerts.length} highlight={unlinkedAlerts.length > 0 ? "danger" : undefined} />
      </div>

      {/* Fuzzy Search Input */}
      <div className="relative w-full max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search alerts by description, client, MCN..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="pl-10"
          aria-label="Search alerts"
        />
      </div>

      {/* Results Count */}
      <div className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{sortedAlerts.length}</span> of {matchedAlerts.length} matched open alerts
      </div>

      {/* Alerts Table */}
      {sortedAlerts.length === 0 ? (
        <EmptyState
          title={searchTerm.trim() ? "No alerts match your search." : "No matched alerts to display."}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
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
                    Client Name
                    {renderSortIcon("client")}
                  </Button>
                </TableHead>
                <TableHead>MCN</TableHead>
                <TableHead aria-sort={getAriaSort("dueDate")}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex items-center justify-start gap-2 px-0 font-semibold"
                    onClick={() => toggleSort("dueDate")}
                  >
                    Due Date
                    {renderSortIcon("dueDate")}
                  </Button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAlerts.map((alert, index) => (
                <AlertsTableRow
                  key={buildAlertStorageKey(alert) ?? (alert.id ? `alert-${String(alert.id)}-${index}` : `alert-${index}`)}
                  alert={alert}
                  onViewCase={onViewCase}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
});

interface AlertsTableRowProps {
  alert: AlertWithMatch;
  onViewCase: (caseId: string) => void;
}

const AlertsTableRow = memo(function AlertsTableRow({ alert, onViewCase }: AlertsTableRowProps) {
  const description = getAlertDisplayDescription(alert);
  const { label: dueLabel } = getAlertDueDateInfo(alert);
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
        <p className="text-sm text-foreground">{clientName}</p>
      </TableCell>
      <TableCell>
        <CopyButton
          value={mcn}
          label="MCN"
          showLabel={false}
          mono
          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          buttonClassName="text-xs text-muted-foreground"
          textClassName="text-xs"
          missingLabel="MCN unavailable"
          missingClassName="text-xs text-muted-foreground"
          variant="plain"
        />
      </TableCell>
      <TableCell className="text-sm font-medium text-foreground">
        {dueLabel || "—"}
      </TableCell>
      <TableCell className="text-right">
        {alert.matchedCaseId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onViewCase(alert.matchedCaseId!)}
            className="ml-auto inline-flex items-center gap-1 text-xs"
          >
            View Case
            <ChevronRight className="h-3 w-3" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
});

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

export default AlertsTableView;
