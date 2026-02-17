import { memo, useCallback, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { StoredCase, CaseStatusUpdateHandler } from "@/types/case";
import { CaseStatusMenu } from "./CaseStatusMenu";
import { ArrowDown, ArrowUp, ArrowUpDown, AlertCircle } from "lucide-react";
import type { CaseListSortDirection, CaseListSortKey } from "@/hooks/useCaseListPreferences";
import type { AlertWithMatch } from "@/utils/alertsData";
import { AlertsPopover } from "./AlertsPopover";
import { CopyButton } from "@/components/common/CopyButton";
import { getDisplayPhoneNumber } from "@/domain/common";
import { getAlertDisplayDescription, getAlertDueDateInfo } from "@/utils/alertDisplay";
import { calculatePriorityScore } from "@/domain/dashboard/priorityQueue";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";

/** Compare two expanded rows for sorting. */
function compareExpandedRows(
  a: { name: string; mcn: string | null; status: string; score: number; expandedAlert: AlertWithMatch | null },
  b: { name: string; mcn: string | null; status: string; score: number; expandedAlert: AlertWithMatch | null },
  sortKey: CaseListSortKey,
  directionFactor: number,
): number {
  switch (sortKey) {
    case "updated": {
      const aRaw = a.expandedAlert?.alertDate ?? a.expandedAlert?.createdAt ?? "";
      const bRaw = b.expandedAlert?.alertDate ?? b.expandedAlert?.createdAt ?? "";
      return ((Date.parse(aRaw) || 0) - (Date.parse(bRaw) || 0)) * directionFactor;
    }
    case "name":
      return (a.name || "").localeCompare(b.name || "") * directionFactor;
    case "mcn":
      return (a.mcn || "").localeCompare(b.mcn || "") * directionFactor;
    case "status":
      return (a.status || "").localeCompare(b.status || "") * directionFactor;
    case "score":
      return (a.score - b.score) * directionFactor;
    default:
      return 0;
  }
}

function getAriaSortDirection(sortDirection: CaseListSortDirection): "ascending" | "descending" {
  return sortDirection === "asc" ? "ascending" : "descending";
}

function getSortStatusLabel(
  isActiveSort: boolean,
  sortDirection: CaseListSortDirection,
): "ascending" | "descending" | "unsorted" {
  if (!isActiveSort) {
    return "unsorted";
  }
  return getAriaSortDirection(sortDirection);
}

function getNextSortDirection(
  isActiveSort: boolean,
  sortDirection: CaseListSortDirection,
  key: CaseListSortKey,
): CaseListSortDirection {
  if (isActiveSort) {
    return sortDirection === "asc" ? "desc" : "asc";
  }
  if (key === "updated" || key === "application" || key === "alerts") {
    return "desc";
  }
  return "asc";
}

/** Reusable sortable table header. */
function SortableTableHead({
  label,
  sortKeyValue,
  activeSortKey,
  sortDirection,
  onSortClick,
  renderIndicator,
}: Readonly<{
  label: string;
  sortKeyValue: CaseListSortKey;
  activeSortKey: CaseListSortKey;
  sortDirection: CaseListSortDirection;
  onSortClick: (key: CaseListSortKey) => void;
  renderIndicator: (key: CaseListSortKey) => React.ReactNode;
}>) {
  const isActiveSort = activeSortKey === sortKeyValue;
  const sortStatusLabel = getSortStatusLabel(isActiveSort, sortDirection);
  const ariaSortValue = sortStatusLabel === "unsorted" ? "none" : sortStatusLabel;
  const ariaLabel = `Sort by ${label}. Currently ${sortStatusLabel}.`;

  return (
    <TableHead aria-sort={ariaSortValue}>
      <button
        type="button"
        onClick={() => onSortClick(sortKeyValue)}
        className="flex items-center gap-1 text-left font-semibold transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={ariaLabel}
      >
        <span>{label}</span>
        {renderIndicator(sortKeyValue)}
      </button>
    </TableHead>
  );
}

export interface CaseTableProps {
  cases: StoredCase[];
  sortKey: CaseListSortKey;
  sortDirection: CaseListSortDirection;
  onRequestSort: (key: CaseListSortKey, direction: CaseListSortDirection) => void;
  onViewCase: (caseId: string) => void;
  alertsByCaseId?: Map<string, AlertWithMatch[]>;
  onResolveAlert?: (alert: AlertWithMatch) => void | Promise<void>;
  onUpdateCaseStatus?: CaseStatusUpdateHandler;
  /** When true, shows inline expanded alert details instead of popover */
  expandAlerts?: boolean;
  /** When expandAlerts is true, specifies which alert indices to show (for pagination) */
  alertPageRange?: { start: number; end: number };
  /** When expandAlerts is true, filter alerts by description */
  alertDescriptionFilter?: string;
  // Selection props
  selectionEnabled?: boolean;
  isSelected?: (caseId: string) => boolean;
  isAllSelected?: boolean;
  isPartiallySelected?: boolean;
  onToggleSelection?: (caseId: string) => void;
  onToggleSelectAll?: () => void;
}

const formatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatter.format(date);
}

function getScoreTextClass(score: number): string {
  if (score >= 500) {
    return "text-sm font-medium tabular-nums text-red-600 dark:text-red-400";
  }
  if (score >= 200) {
    return "text-sm font-medium tabular-nums text-amber-600 dark:text-amber-400";
  }
  return "text-sm font-medium tabular-nums text-muted-foreground";
}

function renderAlertsCell(
  row: { expandedAlert: AlertWithMatch | null; alerts: AlertWithMatch[] },
  onResolveAlert?: (alert: AlertWithMatch) => void | Promise<void>,
): React.ReactNode {
  if (row.expandedAlert) {
    return <ExpandedAlertCell alert={row.expandedAlert} />;
  }
  if (row.alerts.length > 0) {
    return (
      <AlertsPopover
        alerts={row.alerts}
        onResolveAlert={onResolveAlert}
      />
    );
  }
  return <span className="text-xs text-muted-foreground">None</span>;
}

export const CaseTable = memo(function CaseTable({
  cases,
  sortKey,
  sortDirection,
  onRequestSort,
  onViewCase,
  alertsByCaseId,
  onResolveAlert,
  onUpdateCaseStatus,
  expandAlerts = false,
  alertPageRange,
  alertDescriptionFilter,
  selectionEnabled = false,
  isSelected,
  isAllSelected = false,
  isPartiallySelected = false,
  onToggleSelection,
  onToggleSelectAll,
}: CaseTableProps) {
  const { config } = useCategoryConfig();
  
  // Build base case rows
  const baseRows = useMemo(
    () =>
      cases.map(item => {
        const caseType = item.caseRecord?.caseType || "Not specified";
        const applicationDate = item.caseRecord?.applicationDate || item.createdAt;
        const updatedDate = item.updatedAt || item.caseRecord?.updatedDate || item.createdAt;
        const phone = item.person?.phone;
        const primaryContact = phone ? getDisplayPhoneNumber(phone) : item.person?.email;
        const allCaseAlerts = alertsByCaseId?.get(item.id) ?? [];
        const unresolvedAlerts = allCaseAlerts.filter(a => a.status?.toLowerCase() !== 'resolved');
        const priorityConfig = { caseStatuses: config.caseStatuses, alertTypes: config.alertTypes };
        const score = calculatePriorityScore(item, unresolvedAlerts, priorityConfig);
        return {
          id: item.id,
          name: item.name || "Unnamed Case",
          mcn: item.mcn ?? null,
          status: item.status,
          priority: item.priority,
          caseType,
          applicationDate: formatDate(applicationDate),
          updatedDate: formatDate(updatedDate),
          primaryContact,
          alerts: allCaseAlerts,
          score,
        };
      }),
    [alertsByCaseId, cases, config.caseStatuses, config.alertTypes],
  );

  // When expandAlerts is true, flatten to one row per open alert
  const rows = useMemo(() => {
    if (!expandAlerts) {
      return baseRows.map(row => ({ ...row, expandedAlert: null as AlertWithMatch | null }));
    }

    // Flatten: one row per open alert, applying description filter
    const flattened: Array<typeof baseRows[number] & { expandedAlert: AlertWithMatch | null }> = [];

    for (const row of baseRows) {
      let openAlerts = row.alerts.filter(a => a.status !== "resolved");
      
      // Apply description filter if set
      if (alertDescriptionFilter) {
        openAlerts = openAlerts.filter(a => a.description === alertDescriptionFilter);
      }
      
      if (openAlerts.length === 0) {
        continue; // Skip cases with no matching open alerts
      }

      for (const alert of openAlerts) {
        flattened.push({ ...row, expandedAlert: alert });
      }
    }

    // Sort flattened rows by alert due date (not case-level sorting)
    const directionFactor = sortDirection === "asc" ? 1 : -1;
    const sorted = [...flattened].sort((a, b) =>
      compareExpandedRows(a, b, sortKey, directionFactor),
    );

    // Apply page range after sorting
    if (alertPageRange) {
      return sorted.slice(alertPageRange.start, alertPageRange.end);
    }
    return sorted;
  }, [baseRows, expandAlerts, alertPageRange, alertDescriptionFilter, sortKey, sortDirection]);

  const hasRows = rows.length > 0;

  const renderSortIndicator = useCallback((key: CaseListSortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />;
    }

    if (sortDirection === "asc") {
      return <ArrowUp className="h-3.5 w-3.5" aria-hidden />;
    }

    return <ArrowDown className="h-3.5 w-3.5" aria-hidden />;
  }, [sortDirection, sortKey]);

  const handleSortClick = useCallback((key: CaseListSortKey) => {
    const isActive = sortKey === key;
    const nextDirection = getNextSortDirection(isActive, sortDirection, key);

    onRequestSort(key, nextDirection);
  }, [onRequestSort, sortDirection, sortKey]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {selectionEnabled && (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) {
                      // Set indeterminate state via DOM since it's not a standard HTML attribute
                      (el as unknown as HTMLInputElement).indeterminate = isPartiallySelected;
                    }
                  }}
                  onCheckedChange={() => onToggleSelectAll?.()}
                  aria-label={isAllSelected ? "Deselect all cases" : "Select all cases"}
                />
              </TableHead>
            )}
            <SortableTableHead label="Name" sortKeyValue="name" activeSortKey={sortKey} sortDirection={sortDirection} onSortClick={handleSortClick} renderIndicator={renderSortIndicator} />
            <SortableTableHead label="MCN" sortKeyValue="mcn" activeSortKey={sortKey} sortDirection={sortDirection} onSortClick={handleSortClick} renderIndicator={renderSortIndicator} />
            <SortableTableHead label="Status" sortKeyValue="status" activeSortKey={sortKey} sortDirection={sortDirection} onSortClick={handleSortClick} renderIndicator={renderSortIndicator} />
            <SortableTableHead label="Score" sortKeyValue="score" activeSortKey={sortKey} sortDirection={sortDirection} onSortClick={handleSortClick} renderIndicator={renderSortIndicator} />
            <SortableTableHead label="Alerts" sortKeyValue="alerts" activeSortKey={sortKey} sortDirection={sortDirection} onSortClick={handleSortClick} renderIndicator={renderSortIndicator} />
            <SortableTableHead label="Case type" sortKeyValue="caseType" activeSortKey={sortKey} sortDirection={sortDirection} onSortClick={handleSortClick} renderIndicator={renderSortIndicator} />
            <SortableTableHead label="Application" sortKeyValue="application" activeSortKey={sortKey} sortDirection={sortDirection} onSortClick={handleSortClick} renderIndicator={renderSortIndicator} />
            <SortableTableHead label={expandAlerts ? "Due Date" : "Last updated"} sortKeyValue="updated" activeSortKey={sortKey} sortDirection={sortDirection} onSortClick={handleSortClick} renderIndicator={renderSortIndicator} />
            <TableHead>Contact</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!hasRows && (
            <TableRow>
              <TableCell colSpan={selectionEnabled ? 10 : 9} className="py-12 text-center text-muted-foreground">
                {expandAlerts ? "No open alerts to display" : "No cases to display"}
              </TableCell>
            </TableRow>
          )}
          {rows.map((row, rowIndex) => (
            <TableRow key={row.expandedAlert ? `${row.id}-${row.expandedAlert.id ?? rowIndex}` : row.id} className="group">
              {selectionEnabled && (
                <TableCell className="w-[40px]">
                  <Checkbox
                    checked={isSelected?.(row.id) ?? false}
                    onCheckedChange={() => onToggleSelection?.(row.id)}
                    aria-label={`Select ${row.name}`}
                  />
                </TableCell>
              )}
              <TableCell>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="link"
                      className="h-auto w-fit p-0 text-base"
                      onClick={() => onViewCase(row.id)}
                    >
                      {row.name}
                    </Button>
                    {row.priority && (
                      <>
                        <span
                          className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500"
                          aria-hidden
                        />
                        <span className="sr-only">High priority case</span>
                      </>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <CopyButton
                  value={row.mcn}
                  label="MCN"
                  showLabel={false}
                  mono
                  className="text-muted-foreground"
                  buttonClassName="text-sm text-muted-foreground"
                  textClassName="text-sm"
                  missingLabel="No MCN"
                  missingClassName="text-sm text-muted-foreground"
                  variant="plain"
                />
              </TableCell>
              <TableCell>
                <CaseStatusMenu
                  caseId={row.id}
                  status={row.status}
                  onUpdateStatus={onUpdateCaseStatus}
                />
              </TableCell>
              <TableCell>
                <span className={getScoreTextClass(row.score)}>
                  {row.score}
                </span>
              </TableCell>
              <TableCell>
                {renderAlertsCell(row, onResolveAlert)}
              </TableCell>
              <TableCell>{row.caseType}</TableCell>
              <TableCell>{row.applicationDate}</TableCell>
              <TableCell>
                {row.expandedAlert
                  ? getAlertDueDateInfo(row.expandedAlert).label || "—"
                  : row.updatedDate}
              </TableCell>
              <TableCell>
                <CopyButton
                  value={row.primaryContact}
                  showLabel={false}
                  missingLabel="Not provided"
                  buttonClassName="max-w-[16rem]"
                  textClassName="truncate"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});

/**
 * ExpandedAlertCell - Shows a single alert's details inline.
 * Used when expandAlerts is true to display one row per alert.
 */
interface ExpandedAlertCellProps {
  alert: AlertWithMatch;
}

function ExpandedAlertCell({ alert }: Readonly<ExpandedAlertCellProps>) {
  const description = getAlertDisplayDescription(alert);
  const { label: dueLabel } = getAlertDueDateInfo(alert);

  return (
    <div className="flex items-start gap-2">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{description}</p>
        <p className="text-xs text-muted-foreground">
          {alert.alertType || "Alert"} • Code {alert.alertCode || "—"}
          {dueLabel && ` • Due ${dueLabel}`}
        </p>
      </div>
    </div>
  );
}