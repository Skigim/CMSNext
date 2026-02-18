import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, X } from "lucide-react";
import type { CaseFilters as CaseFiltersType, CaseListSegment } from "@/hooks/useCaseListPreferences";
import { format } from "date-fns";
import { CaseFiltersDialog } from "./CaseFiltersDialog";

interface CaseFiltersProps {
  filters: CaseFiltersType;
  onFiltersChange: (filters: CaseFiltersType) => void;
  /** Current segment - used to show alert-specific filters */
  segment?: CaseListSegment;
  /** List of unique alert descriptions for filter dropdown (only used in alerts segment) */
  alertDescriptions?: string[];
}

export function CaseFilters({ filters, onFiltersChange, segment, alertDescriptions = [] }: CaseFiltersProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.statuses.length > 0) count++;
    if (filters.priorityOnly) count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    if (filters.excludeStatuses.length > 0) count++;
    if (filters.excludePriority) count++;
    if (filters.alertDescription !== "all") count++;
    if (!filters.showCompleted) count++;
    return count;
  }, [filters]);

  const handleClearStatus = useCallback(() => {
    onFiltersChange({ ...filters, statuses: [] });
  }, [filters, onFiltersChange]);

  const handleClearPriority = useCallback(() => {
    onFiltersChange({ ...filters, priorityOnly: false });
  }, [filters, onFiltersChange]);

  const handleClearDateRange = useCallback(() => {
    onFiltersChange({ ...filters, dateRange: {} });
  }, [filters, onFiltersChange]);

  const handleClearExcludeStatuses = useCallback(() => {
    onFiltersChange({ ...filters, excludeStatuses: [] });
  }, [filters, onFiltersChange]);

  const handleClearExcludePriority = useCallback(() => {
    onFiltersChange({ ...filters, excludePriority: false });
  }, [filters, onFiltersChange]);

  const handleClearAlertDescription = useCallback(() => {
    onFiltersChange({ ...filters, alertDescription: "all" });
  }, [filters, onFiltersChange]);

  const handleClearShowCompleted = useCallback(() => {
    onFiltersChange({ ...filters, showCompleted: true });
  }, [filters, onFiltersChange]);

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
        <Filter className="h-4 w-4" />
        Filters
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      <CaseFiltersDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        filters={filters}
        onFiltersChange={onFiltersChange}
        segment={segment}
        alertDescriptions={alertDescriptions}
      />

      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {filters.statuses.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.statuses.join(", ")}
              <button
                onClick={handleClearStatus}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                aria-label="Clear status filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.priorityOnly && (
            <Badge variant="secondary" className="gap-1">
              Priority only{" "}
              <button
                onClick={handleClearPriority}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                aria-label="Clear priority filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(filters.dateRange.from || filters.dateRange.to) && (
            <Badge variant="secondary" className="gap-1">
              {filters.dateRange.from && format(filters.dateRange.from, "MMM d, yyyy")}
              {filters.dateRange.from && filters.dateRange.to && " - "}
              {filters.dateRange.to && format(filters.dateRange.to, "MMM d, yyyy")}
              <button
                onClick={handleClearDateRange}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                aria-label="Clear date range filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.excludeStatuses.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              Exclude: {filters.excludeStatuses.join(", ")}
              <button
                onClick={handleClearExcludeStatuses}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                aria-label="Clear exclude status filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.excludePriority && (
            <Badge variant="secondary" className="gap-1">
              Hide priority{" "}
              <button
                onClick={handleClearExcludePriority}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                aria-label="Clear hide priority filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.alertDescription !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Description: {filters.alertDescription}
              <button
                onClick={handleClearAlertDescription}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                aria-label="Clear alert description filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {!filters.showCompleted && (
            <Badge variant="secondary" className="gap-1">
              Hide completed{" "}
              <button
                onClick={handleClearShowCompleted}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                aria-label="Clear hide completed filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
