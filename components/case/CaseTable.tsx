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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { StoredCase, CaseStatusUpdateHandler } from "@/types/case";
import { CaseStatusMenu } from "./CaseStatusMenu";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { CaseListSortDirection, CaseListSortKey } from "@/hooks/useCaseListPreferences";
import { filterOpenAlerts, type AlertWithMatch } from "@/utils/alertsData";
import { AlertBadge } from "@/components/alerts/AlertBadge";
import { McnCopyControl } from "@/components/common/McnCopyControl";
import { CopyableText } from "@/components/common/CopyableText";
import { getDisplayPhoneNumber } from "@/utils/phoneFormatter";

export interface CaseTableProps {
  cases: StoredCase[];
  sortKey: CaseListSortKey;
  sortDirection: CaseListSortDirection;
  onRequestSort: (key: CaseListSortKey, direction: CaseListSortDirection) => void;
  onViewCase: (caseId: string) => void;
  onEditCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
  alertsByCaseId?: Map<string, AlertWithMatch[]>;
  onOpenAlerts?: (caseId: string) => void;
  onUpdateCaseStatus?: CaseStatusUpdateHandler;
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

export const CaseTable = memo(function CaseTable({
  cases,
  sortKey,
  sortDirection,
  onRequestSort,
  onViewCase,
  onEditCase,
  onDeleteCase,
  alertsByCaseId,
  onOpenAlerts,
  onUpdateCaseStatus,
  selectionEnabled = false,
  isSelected,
  isAllSelected = false,
  isPartiallySelected = false,
  onToggleSelection,
  onToggleSelectAll,
}: CaseTableProps) {
  const hasCases = cases.length > 0;

  const rows = useMemo(
    () =>
      cases.map(item => {
        const caseType = item.caseRecord?.caseType || "Not specified";
        const applicationDate = item.caseRecord?.applicationDate || item.createdAt;
        const updatedDate = item.updatedAt || item.caseRecord?.updatedDate || item.createdAt;
        // Prefer phone over email for primary contact
        const phone = item.person?.phone;
        const primaryContact = phone ? getDisplayPhoneNumber(phone) : item.person?.email;
        const allCaseAlerts = alertsByCaseId?.get(item.id) ?? [];
        const caseAlerts = filterOpenAlerts(allCaseAlerts);
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
          alerts: caseAlerts,
        };
      }),
    [alertsByCaseId, cases],
  );

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
    const nextDirection: CaseListSortDirection = isActive
      ? (sortDirection === "asc" ? "desc" : "asc")
      : key === "updated" || key === "application" || key === "alerts"
        ? "desc"
        : "asc";

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
            <TableHead
              aria-sort={sortKey === "name" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
            >
              <button
                type="button"
                onClick={() => handleSortClick("name")}
                className="flex items-center gap-1 text-left font-semibold transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label={`Sort by Name. Currently ${sortKey === "name" ? (sortDirection === "asc" ? "ascending" : "descending") : "unsorted"}.`}
              >
                <span>Name</span>
                {renderSortIndicator("name")}
              </button>
            </TableHead>
            <TableHead
              aria-sort={sortKey === "mcn" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
            >
              <button
                type="button"
                onClick={() => handleSortClick("mcn")}
                className="flex items-center gap-1 text-left font-semibold transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label={`Sort by MCN. Currently ${sortKey === "mcn" ? (sortDirection === "asc" ? "ascending" : "descending") : "unsorted"}.`}
              >
                <span>MCN</span>
                {renderSortIndicator("mcn")}
              </button>
            </TableHead>
            <TableHead
              aria-sort={sortKey === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
            >
              <button
                type="button"
                onClick={() => handleSortClick("status")}
                className="flex items-center gap-1 text-left font-semibold transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label={`Sort by Status. Currently ${sortKey === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : "unsorted"}.`}
              >
                <span>Status</span>
                {renderSortIndicator("status")}
              </button>
            </TableHead>
            <TableHead
              aria-sort={sortKey === "alerts" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
            >
              <button
                type="button"
                onClick={() => handleSortClick("alerts")}
                className="flex items-center gap-1 text-left font-semibold transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label={`Sort by Alerts. Currently ${sortKey === "alerts" ? (sortDirection === "asc" ? "ascending" : "descending") : "unsorted"}.`}
              >
                <span>Alerts</span>
                {renderSortIndicator("alerts")}
              </button>
            </TableHead>
            <TableHead
              aria-sort={sortKey === "caseType" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
            >
              <button
                type="button"
                onClick={() => handleSortClick("caseType")}
                className="flex items-center gap-1 text-left font-semibold transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label={`Sort by Case type. Currently ${sortKey === "caseType" ? (sortDirection === "asc" ? "ascending" : "descending") : "unsorted"}.`}
              >
                <span>Case type</span>
                {renderSortIndicator("caseType")}
              </button>
            </TableHead>
            <TableHead
              aria-sort={sortKey === "application" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
            >
              <button
                type="button"
                onClick={() => handleSortClick("application")}
                className="flex items-center gap-1 text-left font-semibold transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label={`Sort by Application Date. Currently ${sortKey === "application" ? (sortDirection === "asc" ? "ascending" : "descending") : "unsorted"}.`}
              >
                <span>Application</span>
                {renderSortIndicator("application")}
              </button>
            </TableHead>
            <TableHead
              aria-sort={sortKey === "updated" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
            >
              <button
                type="button"
                onClick={() => handleSortClick("updated")}
                className="flex items-center gap-1 text-left font-semibold transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label={`Sort by Last updated. Currently ${sortKey === "updated" ? (sortDirection === "asc" ? "ascending" : "descending") : "unsorted"}.`}
              >
                <span>Last updated</span>
                {renderSortIndicator("updated")}
              </button>
            </TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="w-0 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!hasCases && (
            <TableRow>
              <TableCell colSpan={selectionEnabled ? 10 : 9} className="py-12 text-center text-muted-foreground">
                No cases to display
              </TableCell>
            </TableRow>
          )}
          {rows.map(row => (
            <TableRow key={row.id} className="group">
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
                      <span
                        className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500"
                        role="img"
                        aria-label="High priority case"
                        title="High priority case"
                      />
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <McnCopyControl
                  mcn={row.mcn}
                  showLabel={false}
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
                {row.alerts.length > 0 ? (
                  <AlertBadge alerts={row.alerts} onClick={() => onOpenAlerts?.(row.id)} />
                ) : (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
              </TableCell>
              <TableCell>{row.caseType}</TableCell>
              <TableCell>{row.applicationDate}</TableCell>
              <TableCell>{row.updatedDate}</TableCell>
              <TableCell>
                <CopyableText
                  text={row.primaryContact}
                  showLabel={false}
                  missingLabel="Not provided"
                  buttonClassName="max-w-[16rem]"
                  textClassName="truncate"
                />
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Case actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onViewCase(row.id)}>
                      <Eye className="mr-2 h-4 w-4" /> View case
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onEditCase(row.id)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit case
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onDeleteCase(row.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete case
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});
