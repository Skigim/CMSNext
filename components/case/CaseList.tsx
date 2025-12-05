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
import { CaseAlertsDrawer } from "./CaseAlertsDrawer";
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
} from "@/hooks/useCaseListPreferences";
import { useCaseSelection } from "@/hooks/useCaseSelection";
import { filterOpenAlerts, type AlertsSummary, type AlertWithMatch } from "../../utils/alertsData";
import { useAppViewState } from "@/hooks/useAppViewState";
import { isFeatureEnabled } from "@/utils/featureFlags";

interface CaseListProps {
  cases: StoredCase[];
  onViewCase: (caseId: string) => void;
  onEditCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
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
}

export function CaseList({
  cases,
  onViewCase,
  onEditCase,
  onDeleteCase,
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
}: CaseListProps) {
  const { featureFlags } = useAppViewState();
  const showDevTools = isFeatureEnabled("settings.devTools", featureFlags);
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
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);
  const [activeAlertsCaseId, setActiveAlertsCaseId] = useState<string | null>(null);

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
    if (value === "all" || value === "recent" || value === "priority") {
      setSegment(value as CaseListSegment);
    }
  }, [setSegment]);

  const handleTableSortRequest = useCallback((key: CaseListSortKey, direction: CaseListSortDirection) => {
    setSortKey(key);
    setSortDirection(direction);
  }, [setSortKey, setSortDirection]);

  const handleOpenCaseAlerts = useCallback((caseId: string) => {
    setActiveAlertsCaseId(caseId);
    setAlertsDrawerOpen(true);
  }, []);

  const handleAlertsDrawerOpenChange = useCallback((open: boolean) => {
    setAlertsDrawerOpen(open);
    if (!open) {
      setActiveAlertsCaseId(null);
    }
  }, []);

  const handleResolveAlert = useCallback((alert: AlertWithMatch) => {
    if (!onResolveAlert) {
      return;
    }
    void onResolveAlert(alert);
  }, [onResolveAlert]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const now = Date.now();
    const recentThreshold = now - 1000 * 60 * 60 * 24 * 14; // 14 days

    return cases.filter(caseData => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        (caseData.name || "").toLowerCase().includes(normalizedSearch) ||
        (caseData.mcn || "").toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      // Apply status filter (include)
      if (filters.statuses.length > 0 && !filters.statuses.includes(caseData.status)) {
        return false;
      }

      // Apply status anti-filter (exclude)
      if (filters.excludeStatuses.length > 0 && filters.excludeStatuses.includes(caseData.status)) {
        return false;
      }

      // Apply priority filter (show only priority)
      if (filters.priorityOnly && !caseData.priority) {
        return false;
      }

      // Apply priority anti-filter (hide priority)
      if (filters.excludePriority && caseData.priority) {
        return false;
      }

      // Apply date range filter
      if (filters.dateRange.from || filters.dateRange.to) {
        const updatedAt = Date.parse(caseData.updatedAt || caseData.caseRecord?.updatedDate || "");
        if (Number.isFinite(updatedAt)) {
          const caseDate = new Date(updatedAt);
          if (filters.dateRange.from && caseDate < filters.dateRange.from) {
            return false;
          }
          if (filters.dateRange.to) {
            // Include the entire end date by checking if before end of day
            const endOfDay = new Date(filters.dateRange.to);
            endOfDay.setHours(23, 59, 59, 999);
            if (caseDate > endOfDay) {
              return false;
            }
          }
        }
      }

      // Legacy segment filter (kept for backward compatibility)
      if (segment === "priority") {
        return Boolean(caseData.priority);
      }

      if (segment === "recent") {
        const updatedAt = Date.parse(caseData.updatedAt || caseData.caseRecord?.updatedDate || "");
        return Number.isFinite(updatedAt) && updatedAt >= recentThreshold;
      }

      return true;
    });
  }, [cases, searchTerm, segment, filters]);

  const sortedCases = useMemo(() => {
    return [...filteredCases].sort((a, b) => {
      // Apply each sort config in order
      for (const config of sortConfigs) {
        const directionFactor = config.direction === "asc" ? 1 : -1;
        let comparison = 0;

        switch (config.key) {
          case "name": {
            comparison = (a.name || "").localeCompare(b.name || "");
            break;
          }
          case "mcn": {
            comparison = (a.mcn || "").localeCompare(b.mcn || "");
            break;
          }
          case "status": {
            comparison = (a.status || "").localeCompare(b.status || "");
            break;
          }
          case "caseType": {
            const aType = a.caseRecord?.caseType || "";
            const bType = b.caseRecord?.caseType || "";
            comparison = aType.localeCompare(bType);
            break;
          }
          case "alerts": {
            const aAlerts = openAlertsByCase.get(a.id)?.length ?? 0;
            const bAlerts = openAlertsByCase.get(b.id)?.length ?? 0;
            comparison = aAlerts - bAlerts;
            break;
          }
          case "application": {
            const aApplicationRaw = Date.parse(a.caseRecord?.applicationDate || a.createdAt);
            const bApplicationRaw = Date.parse(b.caseRecord?.applicationDate || b.createdAt);
            const aApplication = Number.isFinite(aApplicationRaw) ? aApplicationRaw : 0;
            const bApplication = Number.isFinite(bApplicationRaw) ? bApplicationRaw : 0;
            comparison = aApplication - bApplication;
            break;
          }
          case "updated":
          default: {
            const aUpdatedRaw = Date.parse(a.updatedAt || a.caseRecord?.updatedDate || a.createdAt);
            const bUpdatedRaw = Date.parse(b.updatedAt || b.caseRecord?.updatedDate || b.createdAt);
            const aUpdated = Number.isFinite(aUpdatedRaw) ? aUpdatedRaw : 0;
            const bUpdated = Number.isFinite(bUpdatedRaw) ? bUpdatedRaw : 0;
            comparison = aUpdated - bUpdated;
            break;
          }
        }

        const result = comparison * directionFactor;
        if (result !== 0) {
          return result;
        }
        // If equal, continue to next sort config
      }

      return 0;
    });
  }, [filteredCases, openAlertsByCase, sortConfigs]);

  // Pagination computed values
  const totalPages = Math.ceil(sortedCases.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedCases = useMemo(
    () => sortedCases.slice(startIndex, endIndex),
    [sortedCases, startIndex, endIndex]
  );

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, segment, filters, sortConfigs]);

  const noMatches = sortedCases.length === 0;

  // Selection management - operates on current page only
  const visibleCaseIds = useMemo(() => paginatedCases.map(c => c.id), [paginatedCases]);
  const {
    selectedCount,
    isAllSelected,
    isPartiallySelected,
    toggleSelection,
    selectAll,
    deselectAll,
    clearSelection,
    isSelected,
  } = useCaseSelection(visibleCaseIds);

  const selectionEnabled = !!(onDeleteCases || onUpdateCasesStatus);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      deselectAll(visibleCaseIds);
    } else {
      selectAll(visibleCaseIds);
    }
  }, [isAllSelected, visibleCaseIds, deselectAll, selectAll]);

  const handleBulkDelete = useCallback(async () => {
    if (!onDeleteCases) return;
    
    const idsToDelete = visibleCaseIds.filter(id => isSelected(id));
    if (idsToDelete.length === 0) return;

    setIsBulkDeleting(true);
    try {
      await onDeleteCases(idsToDelete);
      clearSelection();
    } finally {
      setIsBulkDeleting(false);
    }
  }, [onDeleteCases, visibleCaseIds, isSelected, clearSelection]);

  const handleBulkStatusChange = useCallback(async (status: CaseStatus) => {
    if (!onUpdateCasesStatus) return;

    const idsToUpdate = visibleCaseIds.filter(id => isSelected(id));
    if (idsToUpdate.length === 0) return;

    setIsBulkUpdating(true);
    try {
      await onUpdateCasesStatus(idsToUpdate, status);
      clearSelection();
    } finally {
      setIsBulkUpdating(false);
    }
  }, [onUpdateCasesStatus, visibleCaseIds, isSelected, clearSelection]);

  const handleBulkPriorityToggle = useCallback(async (priority: boolean) => {
    if (!onUpdateCasesPriority) return;

    const idsToUpdate = visibleCaseIds.filter(id => isSelected(id));
    if (idsToUpdate.length === 0) return;

    setIsBulkUpdating(true);
    try {
      await onUpdateCasesPriority(idsToUpdate, priority);
      clearSelection();
    } finally {
      setIsBulkUpdating(false);
    }
  }, [onUpdateCasesPriority, visibleCaseIds, isSelected, clearSelection]);

  // Compute the priority state of selected cases: true if all priority, false if all non-priority, null if mixed
  const selectedPriorityState = useMemo<boolean | null>(() => {
    const selectedIds = visibleCaseIds.filter(id => isSelected(id));
    if (selectedIds.length === 0) return null;

    const caseMap = new Map(cases.map(c => [c.id, c]));
    const selectedCases = selectedIds.map(id => caseMap.get(id)).filter((c): c is StoredCase => !!c);
    
    if (selectedCases.length === 0) return null;

    const firstPriority = selectedCases[0].priority ?? false;
    const allSame = selectedCases.every(c => (c.priority ?? false) === firstPriority);
    
    return allSame ? firstPriority : null;
  }, [visibleCaseIds, isSelected, cases]);

  const activeCase = useMemo(() => {
    if (!activeAlertsCaseId) {
      return null;
    }

    return cases.find(caseData => caseData.id === activeAlertsCaseId) ?? null;
  }, [activeAlertsCaseId, cases]);

  const activeCaseAlerts = useMemo<AlertWithMatch[]>(() => {
    if (!activeAlertsCaseId) {
      return [];;
    }

    return matchedAlertsByCase.get(activeAlertsCaseId) ?? [];
  }, [activeAlertsCaseId, matchedAlertsByCase]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Case Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track all cases in your workspace
          </p>
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

      <div className="relative w-full max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search cases by name or MCN..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="pl-10"
          aria-label="Search cases"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <CaseFilters filters={filters} onFiltersChange={setFilters} />
        <MultiSortConfig sortConfigs={sortConfigs} onSortConfigsChange={setSortConfigs} />
        <ToggleGroup
          type="single"
          value={segment}
          onValueChange={handleSegmentChange}
          variant="outline"
          size="sm"
          aria-label="Filter case segments"
        >
          <ToggleGroupItem value="all" aria-label="All cases">
            <Filter className="mr-2 h-4 w-4" /> All cases
          </ToggleGroupItem>
          <ToggleGroupItem value="recent" aria-label="Recently updated">
            <Filter className="mr-2 h-4 w-4" /> Recently updated
          </ToggleGroupItem>
          <ToggleGroupItem value="priority" aria-label="Priority cases">
            <Filter className="mr-2 h-4 w-4" /> Priority
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
        cases={paginatedCases}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onRequestSort={handleTableSortRequest}
        onViewCase={onViewCase}
        onEditCase={onEditCase}
        onDeleteCase={onDeleteCase}
        alertsByCaseId={matchedAlertsByCase}
        onOpenAlerts={handleOpenCaseAlerts}
        onUpdateCaseStatus={onUpdateCaseStatus}
        selectionEnabled={selectionEnabled}
        isSelected={isSelected}
        isAllSelected={isAllSelected}
        isPartiallySelected={isPartiallySelected}
        onToggleSelection={toggleSelection}
        onToggleSelectAll={handleToggleSelectAll}
      />

      {noMatches && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No cases match the current filters.</p>
        </div>
      )}

      {/* Pagination */}
      {sortedCases.length > 0 && (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex + 1}–{Math.min(endIndex, sortedCases.length)} of {sortedCases.length} cases
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
        />
      )}

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

      <CaseAlertsDrawer
        alerts={activeCaseAlerts}
        open={alertsDrawerOpen}
        onOpenChange={handleAlertsDrawerOpenChange}
        caseName={activeCase?.name || "Unnamed Case"}
        caseId={activeCase?.id}
        caseStatus={activeCase?.status}
        onUpdateCaseStatus={onUpdateCaseStatus}
        onResolveAlert={onResolveAlert ? handleResolveAlert : undefined}
      />
    </div>
  );
}

export default CaseList;