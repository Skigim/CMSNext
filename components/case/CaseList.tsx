import { useCallback, useEffect, useMemo, useState } from "react";
import { toastPromise } from "@/utils/withToast";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "../ui/pagination";
import type { StoredCase, CaseStatus, CaseStatusUpdateHandler } from "../../types/case";
import { setupSampleData } from "../../utils/setupData";
import { CaseFilters } from "./CaseFilters";
import { MultiSortConfig } from "./MultiSortConfig";
import { BulkActionsToolbar } from "./BulkActionsToolbar";
import {
  Plus,
  Search,
  Database,
  Filter,
  RefreshCcw,
  RotateCcw,
  Archive,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
import { CaseTable } from "./CaseTable";
import {
  useCaseListPreferences,
  type CaseListSegment,
  type CaseListSortKey,
  type CaseListSortDirection,
  type CaseFilters as CaseFilterState,
} from "@/hooks/useCaseListPreferences";
import { useCaseSelection } from "@/hooks/useCaseSelection";
import { useBulkNoteFlow } from "@/hooks/useBulkNoteFlow";
import { filterOpenAlerts, type AlertsSummary, type AlertWithMatch } from "../../utils/alertsData";
import { useAppViewState } from "@/hooks/useAppViewState";
import { isFeatureEnabled } from "@/utils/featureFlags";
import { calculatePriorityScore } from "@/domain/dashboard/priorityQueue";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { BulkNoteModal } from "./BulkNoteModal";

// ============================================================================
// Pure helpers extracted to reduce component cognitive complexity
// ============================================================================

/** Check if a case passes the basic property filters (status, priority, completion). */
function casePassesPropertyFilters(
  caseData: StoredCase,
  filters: CaseFilterState,
  completedStatuses: Set<string>,
): boolean {
  if (!filters.showCompleted && completedStatuses.has(caseData.status)) return false;
  if (filters.statuses.length > 0 && !filters.statuses.includes(caseData.status)) return false;
  if (filters.excludeStatuses.length > 0 && filters.excludeStatuses.includes(caseData.status)) return false;
  if (filters.priorityOnly && !caseData.priority) return false;
  if (filters.excludePriority && caseData.priority) return false;
  return true;
}

/** Check if a case falls within the active date range filter. */
function casePassesDateFilter(caseData: StoredCase, filters: CaseFilterState): boolean {
  if (!filters.dateRange.from && !filters.dateRange.to) return true;
  const updatedAt = Date.parse(caseData.updatedAt || caseData.caseRecord?.updatedDate || "");
  if (!Number.isFinite(updatedAt)) return true;
  const caseDate = new Date(updatedAt);
  if (filters.dateRange.from && caseDate < filters.dateRange.from) return false;
  if (filters.dateRange.to) {
    const endOfDay = new Date(filters.dateRange.to);
    endOfDay.setHours(23, 59, 59, 999);
    if (caseDate > endOfDay) return false;
  }
  return true;
}

/** Check if a case matches the active list segment. */
function caseMatchesSegment(
  caseData: StoredCase,
  segment: CaseListSegment,
  recentThreshold: number,
): boolean {
  if (segment === "priority") return Boolean(caseData.priority);
  if (segment === "archival-review") return Boolean(caseData.pendingArchival);
  if (segment === "recent") {
    const updatedAt = Date.parse(caseData.updatedAt || caseData.caseRecord?.updatedDate || "");
    return Number.isFinite(updatedAt) && updatedAt >= recentThreshold;
  }
  return true;
}

/** Check if a case passes all active filters. */
function casePassesFilters(
  caseData: StoredCase,
  normalizedSearch: string,
  filters: CaseFilterState,
  completedStatuses: Set<string>,
  segment: CaseListSegment,
  recentThreshold: number,
): boolean {
  if (
    normalizedSearch.length > 0 &&
    !(caseData.name || "").toLowerCase().includes(normalizedSearch) &&
    !(caseData.mcn || "").toLowerCase().includes(normalizedSearch)
  ) {
    return false;
  }
  if (!casePassesPropertyFilters(caseData, filters, completedStatuses)) return false;
  if (!casePassesDateFilter(caseData, filters)) return false;
  return caseMatchesSegment(caseData, segment, recentThreshold);
}

/** Parse a date value from a case, returning 0 for invalid dates. */
function parseCaseDate(raw: string | undefined): number {
  if (!raw) return 0;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : 0;
}

/** Multi-key sort comparator for cases. */
function compareCases(
  a: StoredCase,
  b: StoredCase,
  sortConfigs: { key: CaseListSortKey; direction: CaseListSortDirection }[],
  openAlertsByCase: Map<string, AlertWithMatch[]>,
  priorityConfig: { caseStatuses: any[]; alertTypes?: any[] },
): number {
  for (const sortConfig of sortConfigs) {
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    let cmp = 0;

    switch (sortConfig.key) {
      case "name": cmp = (a.name || "").localeCompare(b.name || ""); break;
      case "mcn": cmp = (a.mcn || "").localeCompare(b.mcn || ""); break;
      case "status": cmp = (a.status || "").localeCompare(b.status || ""); break;
      case "caseType": cmp = (a.caseRecord?.caseType || "").localeCompare(b.caseRecord?.caseType || ""); break;
      case "alerts": {
        cmp = (openAlertsByCase.get(a.id)?.length ?? 0) - (openAlertsByCase.get(b.id)?.length ?? 0);
        break;
      }
      case "score": {
        const aScore = calculatePriorityScore(a, openAlertsByCase.get(a.id) ?? [], priorityConfig);
        const bScore = calculatePriorityScore(b, openAlertsByCase.get(b.id) ?? [], priorityConfig);
        cmp = aScore - bScore;
        break;
      }
      case "application": {
        cmp = parseCaseDate(a.caseRecord?.applicationDate || a.createdAt) -
              parseCaseDate(b.caseRecord?.applicationDate || b.createdAt);
        break;
      }
      case "updated":
      default: {
        cmp = parseCaseDate(a.updatedAt || a.caseRecord?.updatedDate || a.createdAt) -
              parseCaseDate(b.updatedAt || b.caseRecord?.updatedDate || b.createdAt);
        break;
      }
    }

    const result = cmp * dir;
    if (result !== 0) return result;
  }
  return 0;
}

interface CaseListProps {
  cases: StoredCase[];
  onViewCase: (caseId: string) => void;
  onNewCase: () => void;
  onRefresh?: () => void;
  alertsSummary?: AlertsSummary;
  alertsByCaseId?: Map<string, AlertWithMatch[]>;
  alerts?: AlertWithMatch[];
  onResolveAlert?: (alert: AlertWithMatch) => void | Promise<void>;
  onUpdateCaseStatus?: CaseStatusUpdateHandler;
  // Bulk action handlers
  onDeleteCases?: (caseIds: string[]) => Promise<number>;
  onUpdateCasesStatus?: (caseIds: string[], status: CaseStatus) => Promise<number>;
  onUpdateCasesPriority?: (caseIds: string[], priority: boolean) => Promise<number>;
  onBulkResolveAlerts?: (caseIds: string[], alerts: AlertWithMatch[], descriptionFilter: string) => Promise<{ resolvedCount: number; caseCount: number }>;
  // Archival action handlers
  onApproveArchival?: (caseIds: string[]) => Promise<unknown>;
  onCancelArchival?: (caseIds: string[]) => Promise<unknown>;
  isArchiving?: boolean;
}

export function CaseList({
  cases,
  onViewCase,
  onNewCase,
  onRefresh,
  alertsSummary: _alertsSummary,
  alertsByCaseId,
  alerts: _alerts,
  onResolveAlert,
  onUpdateCaseStatus,
  onDeleteCases,
  onUpdateCasesStatus,
  onUpdateCasesPriority,
  onBulkResolveAlerts,
  onApproveArchival,
  onCancelArchival,
  isArchiving = false,
}: CaseListProps) {
  const { featureFlags } = useAppViewState();
  const showDevTools = isFeatureEnabled("settings.devTools", featureFlags);
  const { config } = useCategoryConfig();
  const {
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    segment,
    setSegment,
    sortConfigs,
    setSortConfigs,
    filters,
    setFilters,
    resetPreferences,
  } = useCaseListPreferences();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSettingUpData, setIsSettingUpData] = useState(false);
  const [showSampleDataDialog, setShowSampleDataDialog] = useState(false);

  // Pagination
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  const matchedAlertsByCase = useMemo(
    () => alertsByCaseId ?? new Map<string, AlertWithMatch[]>(),
    [alertsByCaseId],
  );

  const openAlertsByCase = useMemo(() => {
    if (matchedAlertsByCase.size === 0) {
      return new Map<string, AlertWithMatch[]>();
    }

    const map = new Map<string, AlertWithMatch[]>();
    matchedAlertsByCase.forEach((caseAlerts, caseId) => {
      const openAlertsForCase = filterOpenAlerts(caseAlerts);
      if (openAlertsForCase.length > 0) {
        map.set(caseId, openAlertsForCase);
      }
    });

    return map;
  }, [matchedAlertsByCase]);

  // Get unique alert descriptions for the filter dropdown
  const uniqueAlertDescriptions = useMemo(() => {
    const descriptions = new Set<string>();
    openAlertsByCase.forEach((alerts) => {
      for (const alert of alerts) {
        if (alert.description && alert.description.trim().length > 0) {
          descriptions.add(alert.description.trim());
        }
      }
    });
    return Array.from(descriptions).sort((a, b) => a.localeCompare(b));
  }, [openAlertsByCase]);

  const hasCustomPreferences = useMemo(() => {
    const hasFilters = filters.statuses.length > 0 || filters.priorityOnly || filters.dateRange.from || filters.dateRange.to;
    const hasCustomSort = sortConfigs.length > 1 || sortConfigs[0]?.key !== "name" || sortConfigs[0]?.direction !== "asc";
    const hasCustomSegment = segment !== "all";
    return hasFilters || hasCustomSort || hasCustomSegment;
  }, [filters, sortConfigs, segment]);

  const handleSetupSampleData = useCallback(async () => {
    setIsSettingUpData(true);
    try {
      await toastPromise(setupSampleData(), {
        loading: "Adding sample data...",
        success: "Sample data added",
        error: "Unable to add sample data",
      });
      onRefresh?.();
    } catch (error) {
      console.error("Failed to setup sample data:", error);
    } finally {
      setIsSettingUpData(false);
      setShowSampleDataDialog(false);
    }
  }, [onRefresh]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  const handleSegmentChange = useCallback((value: string) => {
    if (value === "all" || value === "recent" || value === "priority" || value === "alerts" || value === "archival-review") {
      setSegment(value as CaseListSegment);
    }
  }, [setSegment]);

  const handleTableSortRequest = useCallback((key: CaseListSortKey, direction: CaseListSortDirection) => {
    setSortKey(key);
    setSortDirection(direction);
  }, [setSortKey, setSortDirection]);

  const handleResolveAlert = useCallback((alert: AlertWithMatch) => {
    if (!onResolveAlert) {
      return;
    }
    onResolveAlert(alert);
  }, [onResolveAlert]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const now = Date.now();
    const recentThreshold = now - 1000 * 60 * 60 * 24 * 14; // 14 days

    // Build a Set of completed status names for efficient lookup
    const completedStatuses = new Set(
      config.caseStatuses
        .filter(s => s.countsAsCompleted)
        .map(s => s.name)
    );

    return cases.filter(caseData =>
      casePassesFilters(caseData, normalizedSearch, filters, completedStatuses, segment, recentThreshold)
    );
  }, [cases, searchTerm, segment, filters, config.caseStatuses]);

  const sortedCases = useMemo(() => {
    const priorityConfig = { caseStatuses: config.caseStatuses, alertTypes: config.alertTypes };
    return [...filteredCases].sort((a, b) =>
      compareCases(a, b, sortConfigs, openAlertsByCase, priorityConfig)
    );
  }, [filteredCases, openAlertsByCase, sortConfigs, config.caseStatuses, config.alertTypes]);

  // When in alerts mode, count total open alerts for pagination (respecting description filter)
  const totalAlertRows = useMemo(() => {
    if (segment !== "alerts") {
      return 0;
    }
    let count = 0;
    const descFilter = filters.alertDescription !== "all" ? filters.alertDescription : null;
    for (const caseData of sortedCases) {
      const openAlerts = openAlertsByCase.get(caseData.id);
      if (openAlerts) {
        if (descFilter) {
          count += openAlerts.filter(a => a.description === descFilter).length;
        } else {
          count += openAlerts.length;
        }
      }
    }
    return count;
  }, [segment, sortedCases, openAlertsByCase, filters.alertDescription]);

  // Pagination computed values - use alert count when in alerts mode
  const totalItems = segment === "alerts" ? totalAlertRows : sortedCases.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;

  // Paginated cases (for non-alerts mode)
  const paginatedCases = useMemo(
    () => sortedCases.slice(startIndex, endIndex),
    [sortedCases, startIndex, endIndex]
  );

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, segment, filters, sortConfigs]);

  const noMatches = segment === "alerts" ? totalAlertRows === 0 : sortedCases.length === 0;

  // Selection management - operates on all visible/filtered cases
  // When in alerts view with description filter, only include cases with matching alerts
  const allFilteredCaseIds = useMemo(() => {
    if (segment === "alerts" && filters.alertDescription !== "all") {
      // Only include cases that have alerts matching the description filter
      return sortedCases
        .filter(c => {
          const caseAlerts = openAlertsByCase.get(c.id);
          return caseAlerts?.some(a => a.description === filters.alertDescription);
        })
        .map(c => c.id);
    }
    return sortedCases.map(c => c.id);
  }, [sortedCases, segment, filters.alertDescription, openAlertsByCase]);
  
  const {
    selectedCount,
    isAllSelected,
    isPartiallySelected,
    toggleSelection,
    selectAll,
    deselectAll,
    clearSelection,
    isSelected,
  } = useCaseSelection(allFilteredCaseIds);

  const selectionEnabled = !!(onDeleteCases || onUpdateCasesStatus);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      deselectAll(allFilteredCaseIds);
    } else {
      selectAll(allFilteredCaseIds);
    }
  }, [isAllSelected, allFilteredCaseIds, deselectAll, selectAll]);

  const handleBulkDelete = useCallback(async () => {
    if (!onDeleteCases) return;
    
    const idsToDelete = allFilteredCaseIds.filter(id => isSelected(id));
    if (idsToDelete.length === 0) return;

    setIsBulkDeleting(true);
    try {
      await onDeleteCases(idsToDelete);
      clearSelection();
    } finally {
      setIsBulkDeleting(false);
    }
  }, [onDeleteCases, allFilteredCaseIds, isSelected, clearSelection]);

  const handleBulkStatusChange = useCallback(async (status: CaseStatus) => {
    if (!onUpdateCasesStatus) return;

    const idsToUpdate = allFilteredCaseIds.filter(id => isSelected(id));
    if (idsToUpdate.length === 0) return;

    setIsBulkUpdating(true);
    try {
      await onUpdateCasesStatus(idsToUpdate, status);
      clearSelection();
    } finally {
      setIsBulkUpdating(false);
    }
  }, [onUpdateCasesStatus, allFilteredCaseIds, isSelected, clearSelection]);

  const handleBulkPriorityToggle = useCallback(async (priority: boolean) => {
    if (!onUpdateCasesPriority) return;

    const idsToUpdate = allFilteredCaseIds.filter(id => isSelected(id));
    if (idsToUpdate.length === 0) return;

    setIsBulkUpdating(true);
    try {
      await onUpdateCasesPriority(idsToUpdate, priority);
      clearSelection();
    } finally {
      setIsBulkUpdating(false);
    }
  }, [onUpdateCasesPriority, allFilteredCaseIds, isSelected, clearSelection]);

  const handleApproveArchival = useCallback(async () => {
    if (!onApproveArchival) return;

    const idsToArchive = allFilteredCaseIds.filter(id => isSelected(id));
    if (idsToArchive.length === 0) return;

    try {
      await onApproveArchival(idsToArchive);
      clearSelection();
    } catch {
      // Error handling is done in the hook
    }
  }, [onApproveArchival, allFilteredCaseIds, isSelected, clearSelection]);

  const handleCancelArchival = useCallback(async () => {
    if (!onCancelArchival) return;

    const idsToCancelArchival = allFilteredCaseIds.filter(id => isSelected(id));
    if (idsToCancelArchival.length === 0) return;

    try {
      await onCancelArchival(idsToCancelArchival);
      clearSelection();
    } catch {
      // Error handling is done in the hook
    }
  }, [onCancelArchival, allFilteredCaseIds, isSelected, clearSelection]);

  // Compute the priority state of selected cases: true if all priority, false if all non-priority, null if mixed
  const selectedPriorityState = useMemo<boolean | null>(() => {
    const selectedIds = allFilteredCaseIds.filter(id => isSelected(id));
    if (selectedIds.length === 0) return null;

    const caseMap = new Map(cases.map(c => [c.id, c]));
    const selectedCases = selectedIds.map(id => caseMap.get(id)).filter((c): c is StoredCase => !!c);
    
    if (selectedCases.length === 0) return null;

    const firstPriority = selectedCases[0].priority ?? false;
    const allSame = selectedCases.every(c => (c.priority ?? false) === firstPriority);
    
    return allSame ? firstPriority : null;
  }, [allFilteredCaseIds, isSelected, cases]);

  // Compute the selected case IDs for bulk operations
  const selectedCaseIds = useMemo(() => {
    return allFilteredCaseIds.filter(id => isSelected(id));
  }, [allFilteredCaseIds, isSelected]);

  // Get the active alert description filter (only when in alerts segment and not "all")
  const activeAlertDescriptionFilter = useMemo(() => {
    if (segment === "alerts" && filters.alertDescription !== "all") {
      return filters.alertDescription;
    }
    return undefined;
  }, [segment, filters.alertDescription]);

  // Compute the count of matching alerts for SELECTED cases only
  const alertCountForSelection = useMemo(() => {
    if (!activeAlertDescriptionFilter) return 0;
    
    let count = 0;
    for (const caseId of selectedCaseIds) {
      const caseAlerts = openAlertsByCase.get(caseId);
      if (caseAlerts) {
        count += caseAlerts.filter(a => a.description === activeAlertDescriptionFilter).length;
      }
    }
    return count;
  }, [activeAlertDescriptionFilter, selectedCaseIds, openAlertsByCase]);

  // Get alerts for SELECTED cases matching the filter
  const alertsForBulkResolve = useMemo(() => {
    if (!activeAlertDescriptionFilter) return [];
    
    const alerts: AlertWithMatch[] = [];
    for (const caseId of selectedCaseIds) {
      const caseAlerts = openAlertsByCase.get(caseId);
      if (caseAlerts) {
        alerts.push(...caseAlerts.filter(a => a.description === activeAlertDescriptionFilter));
      }
    }
    return alerts;
  }, [activeAlertDescriptionFilter, selectedCaseIds, openAlertsByCase]);

  // State for bulk alert resolution
  const [isResolvingAlerts, setIsResolvingAlerts] = useState(false);

  const handleBulkResolveAlerts = useCallback(async () => {
    if (!onBulkResolveAlerts || !activeAlertDescriptionFilter) return;
    if (alertsForBulkResolve.length === 0) return;

    setIsResolvingAlerts(true);
    try {
      const result = await onBulkResolveAlerts(
        selectedCaseIds,
        alertsForBulkResolve,
        activeAlertDescriptionFilter
      );
      clearSelection();
      // Toast is handled by the parent component
      console.log(`Resolved ${result.resolvedCount} alerts across ${result.caseCount} cases`);
    } finally {
      setIsResolvingAlerts(false);
    }
  }, [onBulkResolveAlerts, activeAlertDescriptionFilter, alertsForBulkResolve, selectedCaseIds, clearSelection]);

  // Bulk note flow
  const bulkNoteFlow = useBulkNoteFlow({
    selectedCaseIds,
    onSuccess: clearSelection,
  });

  return (
    <div className="flex flex-col h-full bg-background" data-papercut-context="CaseList">
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-6 py-3">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search cases by name or MCN..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-10"
            aria-label="Search cases"
          />
        </div>
        <div className="flex items-center gap-2">
          {showDevTools && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Database className="h-4 w-4" /> Demo tools
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Data helpers</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    setShowSampleDataDialog(true);
                  }}
                  disabled={isSettingUpData}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" /> Add sample data
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  Additional helpers coming soon
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={onNewCase}>
            <Plus className="h-4 w-4" />
            New case
          </Button>
        </div>
      </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
        <CaseFilters 
          filters={filters} 
          onFiltersChange={setFilters} 
          segment={segment}
          alertDescriptions={uniqueAlertDescriptions}
        />
        <MultiSortConfig sortConfigs={sortConfigs} onSortConfigsChange={setSortConfigs} />
        <ToggleGroup
          type="single"
          value={segment}
          onValueChange={handleSegmentChange}
          variant="outline"
          size="sm"
          aria-label="Filter case segments"
        >
          <ToggleGroupItem value="priority" aria-label="Priority cases">
            <Filter className="mr-2 h-4 w-4" /> Priority
          </ToggleGroupItem>
          <ToggleGroupItem value="alerts" aria-label="Alerts">
            <Filter className="mr-2 h-4 w-4" /> Alerts
          </ToggleGroupItem>
          <ToggleGroupItem value="archival-review" aria-label="Archival review">
            <Archive className="mr-2 h-4 w-4" /> Archival
          </ToggleGroupItem>
        </ToggleGroup>
        {hasCustomPreferences && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetPreferences}
                aria-label="Reset all filters and sorting"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Reset filters & sorting</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <CaseTable
        cases={segment === "alerts" ? sortedCases : paginatedCases}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onRequestSort={handleTableSortRequest}
        onViewCase={onViewCase}
        alertsByCaseId={matchedAlertsByCase}
        onResolveAlert={onResolveAlert ? handleResolveAlert : undefined}
        onUpdateCaseStatus={onUpdateCaseStatus}
        expandAlerts={segment === "alerts"}
        alertPageRange={segment === "alerts" ? { start: startIndex, end: endIndex } : undefined}
        alertDescriptionFilter={segment === "alerts" && filters.alertDescription !== "all" ? filters.alertDescription : undefined}
        selectionEnabled={selectionEnabled}
        isSelected={isSelected}
        isAllSelected={isAllSelected}
        isPartiallySelected={isPartiallySelected}
        onToggleSelection={toggleSelection}
        onToggleSelectAll={handleToggleSelectAll}
      />

      {noMatches && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">{segment === "alerts" ? "No open alerts to display." : "No cases match the current filters."}</p>
        </div>
      )}

          {/* Pagination */}
          {totalItems > 0 && (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}–{Math.min(endIndex, totalItems)} of {totalItems} {segment === "alerts" ? "alerts" : "cases"}
              </p>
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        aria-disabled={currentPage === 1}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {/* First page */}
                    <PaginationItem>
                      <PaginationLink
                        onClick={() => setCurrentPage(1)}
                        isActive={currentPage === 1}
                        className="cursor-pointer"
                      >
                        1
                      </PaginationLink>
                    </PaginationItem>
                    {/* Ellipsis after first if needed */}
                    {currentPage > 3 && totalPages > 5 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    {/* Middle pages */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        if (page === 1 || page === totalPages) return false;
                        if (totalPages <= 5) return true;
                        return Math.abs(page - currentPage) <= 1;
                      })
                      .map(page => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                    {/* Ellipsis before last if needed */}
                    {currentPage < totalPages - 2 && totalPages > 5 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    {/* Last page (if more than 1 page) */}
                    {totalPages > 1 && (
                      <PaginationItem>
                        <PaginationLink
                          onClick={() => setCurrentPage(totalPages)}
                          isActive={currentPage === totalPages}
                          className="cursor-pointer"
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    )}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        aria-disabled={currentPage === totalPages}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
        </div>
      </div>

      {selectionEnabled && (
        <BulkActionsToolbar
          selectedCount={selectedCount}
          onDeleteSelected={handleBulkDelete}
          onStatusChange={handleBulkStatusChange}
          onPriorityToggle={onUpdateCasesPriority ? handleBulkPriorityToggle : undefined}
          onClearSelection={clearSelection}
          isDeleting={isBulkDeleting}
          isUpdating={isBulkUpdating}
          selectedPriorityState={selectedPriorityState}
          showArchivalActions={segment === "archival-review"}
          onApproveArchival={onApproveArchival ? handleApproveArchival : undefined}
          onCancelArchival={onCancelArchival ? handleCancelArchival : undefined}
          isArchiving={isArchiving}
          alertDescriptionFilter={activeAlertDescriptionFilter}
          alertCountForSelection={alertCountForSelection}
          onBulkResolveAlerts={onBulkResolveAlerts ? handleBulkResolveAlerts : undefined}
          isResolvingAlerts={isResolvingAlerts}
          onBulkAddNote={bulkNoteFlow.openModal}
        />
      )}

      <BulkNoteModal
        isOpen={bulkNoteFlow.isModalOpen}
        onClose={bulkNoteFlow.closeModal}
        onSubmit={bulkNoteFlow.submitBulkNote}
        isSubmitting={bulkNoteFlow.isSubmitting}
        selectedCount={selectedCaseIds.length}
      />

      <AlertDialog open={showSampleDataDialog} onOpenChange={setShowSampleDataDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add sample data?</AlertDialogTitle>
            <AlertDialogDescription>
              We'll add curated demo cases to your current workspace. Existing data will remain untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSettingUpData}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSetupSampleData} disabled={isSettingUpData}>
              {isSettingUpData ? "Adding..." : "Add sample data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}