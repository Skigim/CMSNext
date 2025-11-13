import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarPicker } from "@/components/ui/calendar-picker";
import { Filter, X } from "lucide-react";
import type { CaseFilters as CaseFiltersType } from "@/hooks/useCaseListPreferences";
import type { CaseStatus } from "@/types/case";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { format } from "date-fns";

interface CaseFiltersProps {
  filters: CaseFiltersType;
  onFiltersChange: (filters: CaseFiltersType) => void;
}

export function CaseFilters({ filters, onFiltersChange }: CaseFiltersProps) {
  const { config } = useCategoryConfig();
  
  const statusOptions = useMemo(() => config.caseStatus || [], [config.caseStatus]);
  
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.statuses.length > 0) count++;
    if (filters.priorityOnly) count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    return count;
  }, [filters]);

  const handleStatusToggle = useCallback((status: CaseStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  }, [filters, onFiltersChange]);

  const handlePriorityToggle = useCallback(() => {
    onFiltersChange({ ...filters, priorityOnly: !filters.priorityOnly });
  }, [filters, onFiltersChange]);

  const handleDateRangeChange = useCallback((from: Date | undefined, to: Date | undefined) => {
    onFiltersChange({ ...filters, dateRange: { from, to } });
  }, [filters, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    onFiltersChange({
      statuses: [],
      priorityOnly: false,
      dateRange: {},
    });
  }, [onFiltersChange]);

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Filter cases</h4>
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
              <div>
                <Label className="text-sm font-medium mb-2 block">Status</Label>
                <div className="space-y-2">
                  {statusOptions.map(status => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={filters.statuses.includes(status as CaseStatus)}
                        onCheckedChange={() => handleStatusToggle(status as CaseStatus)}
                      />
                      <label
                        htmlFor={`status-${status}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {status}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="priority-filter"
                    checked={filters.priorityOnly}
                    onCheckedChange={handlePriorityToggle}
                  />
                  <label
                    htmlFor="priority-filter"
                    className="text-sm cursor-pointer flex-1 font-medium"
                  >
                    Priority cases only
                  </label>
                </div>
              </div>

              <div className="border-t pt-3">
                <Label className="text-sm font-medium mb-2 block">Date range</Label>
                <div className="space-y-2">
                  <CalendarPicker
                    date={filters.dateRange.from}
                    onDateChange={(date) => handleDateRangeChange(date, filters.dateRange.to)}
                    label="From"
                    className="w-full"
                  />
                  <CalendarPicker
                    date={filters.dateRange.to}
                    onDateChange={(date) => handleDateRangeChange(filters.dateRange.from, date)}
                    label="To"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
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
          {filters.priorityOnly && (
            <Badge variant="secondary" className="gap-1">
              Priority only
              <button
                onClick={() => onFiltersChange({ ...filters, priorityOnly: false })}
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
                onClick={() => onFiltersChange({ ...filters, dateRange: {} })}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                aria-label="Clear date range filter"
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
