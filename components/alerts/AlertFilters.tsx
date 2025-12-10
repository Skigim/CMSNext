import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X, Search } from "lucide-react";
import type { AlertFilters as AlertFiltersType } from "@/hooks/useAlertListPreferences";
import type { AlertWorkflowStatus } from "@/types/case";

interface AlertFiltersProps {
  filters: AlertFiltersType;
  onFiltersChange: (filters: AlertFiltersType) => void;
  /** List of unique descriptions to populate the filter dropdown */
  descriptions: string[];
  /** Whether any filters are currently active */
  hasActiveFilters?: boolean;
}

const WORKFLOW_STATUSES: { value: AlertWorkflowStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in-progress", label: "In Progress" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "snoozed", label: "Snoozed" },
  { value: "resolved", label: "Resolved" },
];

const MATCH_STATUS_OPTIONS = [
  { value: "all", label: "All alerts" },
  { value: "matched", label: "Matched to case" },
  { value: "unmatched", label: "Unmatched (no case)" },
  { value: "missing-mcn", label: "Missing MCN" },
] as const;

export function AlertFilters({ 
  filters, 
  onFiltersChange, 
  descriptions,
  hasActiveFilters: hasActiveFiltersProp,
}: AlertFiltersProps) {
  
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchTerm.trim()) count++;
    if (filters.description !== "all") count++;
    if (filters.statuses.length > 0) count++;
    if (filters.matchStatus !== "all") count++;
    return count;
  }, [filters]);

  const hasActiveFilters = hasActiveFiltersProp ?? activeFilterCount > 0;

  const handleSearchChange = useCallback((term: string) => {
    onFiltersChange({ ...filters, searchTerm: term });
  }, [filters, onFiltersChange]);

  const handleDescriptionChange = useCallback((description: string) => {
    onFiltersChange({ ...filters, description });
  }, [filters, onFiltersChange]);

  const handleStatusToggle = useCallback((status: AlertWorkflowStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  }, [filters, onFiltersChange]);

  const handleMatchStatusChange = useCallback((value: string) => {
    onFiltersChange({ 
      ...filters, 
      matchStatus: value as AlertFiltersType["matchStatus"],
    });
  }, [filters, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    onFiltersChange({
      searchTerm: "",
      description: "all",
      statuses: [],
      matchStatus: "all",
    });
  }, [onFiltersChange]);

  const handleClearSearch = useCallback(() => {
    onFiltersChange({ ...filters, searchTerm: "" });
  }, [filters, onFiltersChange]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {/* Search input */}
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="alert-search" className="text-sm">Search</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="alert-search"
            placeholder="Search by description, client, code, or MCN..."
            value={filters.searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-9"
          />
          {filters.searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Description filter dropdown */}
      <div className="sm:w-[220px] space-y-1.5">
        <Label htmlFor="description-filter" className="text-sm">Description</Label>
        <Select value={filters.description} onValueChange={handleDescriptionChange}>
          <SelectTrigger id="description-filter">
            <SelectValue placeholder="All descriptions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All descriptions</SelectItem>
            {descriptions.map((desc) => (
              <SelectItem key={desc} value={desc}>
                {desc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Advanced filters popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-10">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Filter alerts</h4>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-auto px-2 py-1 text-xs"
                >
                  Clear all
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {/* Match status filter */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Match status</Label>
                <Select value={filters.matchStatus} onValueChange={handleMatchStatusChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATCH_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Workflow status filter */}
              <div className="border-t pt-3">
                <Label className="text-sm font-medium mb-2 block">Workflow status</Label>
                <div className="space-y-2">
                  {WORKFLOW_STATUSES.map((status) => (
                    <div key={status.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`alert-status-${status.value}`}
                        checked={filters.statuses.includes(status.value)}
                        onCheckedChange={() => handleStatusToggle(status.value)}
                      />
                      <label
                        htmlFor={`alert-status-${status.value}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {status.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear all button when filters active */}
      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="h-10"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

/** Compact filter badges to show active filters */
export function AlertFilterBadges({
  filters,
  onFiltersChange,
}: Pick<AlertFiltersProps, "filters" | "onFiltersChange">) {
  const hasActiveFilters = 
    filters.searchTerm.trim() || 
    filters.description !== "all" ||
    filters.statuses.length > 0 ||
    filters.matchStatus !== "all";

  if (!hasActiveFilters) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap mt-2">
      {filters.searchTerm.trim() && (
        <Badge variant="secondary" className="gap-1">
          Search: "{filters.searchTerm}"
          <button
            onClick={() => onFiltersChange({ ...filters, searchTerm: "" })}
            className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
            aria-label="Clear search filter"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {filters.description !== "all" && (
        <Badge variant="secondary" className="gap-1">
          Type: {filters.description}
          <button
            onClick={() => onFiltersChange({ ...filters, description: "all" })}
            className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
            aria-label="Clear description filter"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {filters.statuses.length > 0 && (
        <Badge variant="secondary" className="gap-1">
          Status: {filters.statuses.join(", ")}
          <button
            onClick={() => onFiltersChange({ ...filters, statuses: [] })}
            className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
            aria-label="Clear status filter"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {filters.matchStatus !== "all" && (
        <Badge variant="secondary" className="gap-1">
          Match: {filters.matchStatus}
          <button
            onClick={() => onFiltersChange({ ...filters, matchStatus: "all" })}
            className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
            aria-label="Clear match status filter"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
    </div>
  );
}
