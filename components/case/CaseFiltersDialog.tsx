import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CalendarPicker } from "@/components/ui/calendar-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CaseFilters, CaseListSegment } from "@/hooks/useCaseListPreferences";
import { useAdvancedAlertFilter } from "@/hooks";
import type { CaseStatus } from "@/types/case";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { useAppViewState } from "@/hooks/useAppViewState";
import {
  createEmptyFilterCriterion,
  type FilterCriterion,
} from "@/domain/alerts";
import { ENABLE_ADVANCED_ALERT_FILTERS, isFeatureEnabled } from "@/utils/featureFlags";

interface CaseFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CaseFilters;
  onFiltersChange: (filters: CaseFilters) => void;
  /** Current segment - used to show alert-specific filters */
  segment?: CaseListSegment;
  /** List of unique alert descriptions for filter dropdown (only used in alerts segment) */
  alertDescriptions?: string[];
}

export function CaseFiltersDialog({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  segment,
  alertDescriptions = [],
}: Readonly<CaseFiltersDialogProps>) {
  const { featureFlags } = useAppViewState();
  const enableAdvancedAlertFilters = isFeatureEnabled(ENABLE_ADVANCED_ALERT_FILTERS, featureFlags);
  const { config } = useCategoryConfig();
  const {
    filter: advancedFilter,
    addCriterion,
    addExcludeCriterion,
    updateCriterion,
    removeCriterion,
    resetFilter,
    hasActiveAdvancedFilters,
  } = useAdvancedAlertFilter();

  // Extract status names from StatusConfig[] for UI display
  const statusOptions = useMemo(
    () => config.caseStatuses.map((s) => s.name),
    [config.caseStatuses]
  );
  const isManagedDescriptionCriterion = useCallback((criterion: FilterCriterion, negate: boolean) => {
    return criterion.field === "description" && criterion.negate === negate;
  }, []);

  const toValueList = useCallback((value: string | string[]): string[] => {
    if (Array.isArray(value)) {
      return value.filter((item) => item.trim().length > 0);
    }
    return value.trim().length > 0 ? [value] : [];
  }, []);

  const includeDescriptionValues = useMemo(() => {
    return advancedFilter.criteria
      .filter((criterion) => isManagedDescriptionCriterion(criterion, false))
      .flatMap((criterion) => toValueList(criterion.value));
  }, [advancedFilter.criteria, isManagedDescriptionCriterion, toValueList]);

  const excludeDescriptionValues = useMemo(() => {
    return advancedFilter.criteria
      .filter((criterion) => isManagedDescriptionCriterion(criterion, true))
      .flatMap((criterion) => toValueList(criterion.value));
  }, [advancedFilter.criteria, isManagedDescriptionCriterion, toValueList]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.statuses.length > 0) count++;
    if (filters.priorityOnly) count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    if (filters.excludeStatuses.length > 0) count++;
    if (filters.excludePriority) count++;
    if (filters.alertDescription !== "all") count++;
    if (!filters.showCompleted) count++;
    if (segment === "alerts" && enableAdvancedAlertFilters && hasActiveAdvancedFilters) count++;
    return count;
  }, [filters, segment, enableAdvancedAlertFilters, hasActiveAdvancedFilters]);

  const handleStatusToggle = useCallback(
    (status: CaseStatus) => {
      const newStatuses = filters.statuses.includes(status)
        ? filters.statuses.filter((s) => s !== status)
        : [...filters.statuses, status];
      onFiltersChange({ ...filters, statuses: newStatuses });
    },
    [filters, onFiltersChange]
  );

  const handleExcludeStatusToggle = useCallback(
    (status: CaseStatus) => {
      const newStatuses = filters.excludeStatuses.includes(status)
        ? filters.excludeStatuses.filter((s) => s !== status)
        : [...filters.excludeStatuses, status];
      onFiltersChange({ ...filters, excludeStatuses: newStatuses });
    },
    [filters, onFiltersChange]
  );

  const handlePriorityToggle = useCallback(() => {
    onFiltersChange({ ...filters, priorityOnly: !filters.priorityOnly });
  }, [filters, onFiltersChange]);

  const handleExcludePriorityToggle = useCallback(() => {
    onFiltersChange({ ...filters, excludePriority: !filters.excludePriority });
  }, [filters, onFiltersChange]);

  const handleDateRangeChange = useCallback(
    (from: Date | undefined, to: Date | undefined) => {
      onFiltersChange({ ...filters, dateRange: { from, to } });
    },
    [filters, onFiltersChange]
  );

  const handleAlertDescriptionChange = useCallback(
    (description: string) => {
      onFiltersChange({ ...filters, alertDescription: description });
    },
    [filters, onFiltersChange]
  );

  const handleShowCompletedToggle = useCallback(() => {
    onFiltersChange({ ...filters, showCompleted: !filters.showCompleted });
  }, [filters, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    onFiltersChange({
      statuses: [],
      priorityOnly: false,
      dateRange: {},
      excludeStatuses: [],
      excludePriority: false,
      alertDescription: "all",
      showCompleted: true,
    });
    if (segment === "alerts" && enableAdvancedAlertFilters) {
      resetFilter();
    }
  }, [onFiltersChange, segment, enableAdvancedAlertFilters, resetFilter]);

  const toggleDescriptionCriterion = useCallback((description: string, negate: boolean) => {
    const matchingCriteria = advancedFilter.criteria.filter((criterion) =>
      isManagedDescriptionCriterion(criterion, negate),
    );

    const primaryCriterion = matchingCriteria[0];
    const selectedValues = matchingCriteria.flatMap((criterion) => toValueList(criterion.value));
    const isChecked = selectedValues.includes(description);
    const nextValues = isChecked
      ? selectedValues.filter((value) => value !== description)
      : [...selectedValues, description];

    if (!primaryCriterion) {
      if (nextValues.length === 0) {
        return;
      }

      const newCriterion = {
        ...createEmptyFilterCriterion("description"),
        operator: "equals" as const,
        value: nextValues,
        negate,
      };

      if (negate) {
        addExcludeCriterion(newCriterion);
      } else {
        addCriterion(newCriterion);
      }
      return;
    }

    for (const duplicateCriterion of matchingCriteria.slice(1)) {
      removeCriterion(duplicateCriterion.id);
    }

    if (nextValues.length === 0) {
      removeCriterion(primaryCriterion.id);
      return;
    }

    updateCriterion(primaryCriterion.id, {
      field: "description",
      operator: "equals",
      value: nextValues,
      negate,
    });
  }, [
    addCriterion,
    addExcludeCriterion,
    advancedFilter.criteria,
    isManagedDescriptionCriterion,
    removeCriterion,
    toValueList,
    updateCriterion,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Filter cases</span>
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
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            {/* Status filter */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Include status</Label>
              <div className="space-y-2">
                {statusOptions.map((status: string) => (
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

            {/* Priority filter */}
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

            {/* Date range filter */}
            <div className="border-t pt-3">
              <Label className="text-sm font-medium mb-2 block">Date range</Label>
              <div className="space-y-2">
                <CalendarPicker
                  date={filters.dateRange.from}
                  onDateChange={(date) =>
                    handleDateRangeChange(date, filters.dateRange.to)
                  }
                  label="From"
                  className="w-full"
                />
                <CalendarPicker
                  date={filters.dateRange.to}
                  onDateChange={(date) =>
                    handleDateRangeChange(filters.dateRange.from, date)
                  }
                  label="To"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Exclude filters */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Exclude status</Label>
              <div className="space-y-2">
                {statusOptions.map((status: string) => (
                  <div key={`exclude-${status}`} className="flex items-center space-x-2">
                    <Checkbox
                      id={`exclude-status-${status}`}
                      checked={filters.excludeStatuses.includes(status as CaseStatus)}
                      onCheckedChange={() =>
                        handleExcludeStatusToggle(status as CaseStatus)
                      }
                    />
                    <label
                      htmlFor={`exclude-status-${status}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {status}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Exclude priority */}
            <div className="border-t pt-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="exclude-priority-filter"
                  checked={filters.excludePriority}
                  onCheckedChange={handleExcludePriorityToggle}
                />
                <label
                  htmlFor="exclude-priority-filter"
                  className="text-sm cursor-pointer flex-1 font-medium"
                >
                  Hide priority cases
                </label>
              </div>
            </div>

            {/* Show completed cases */}
            <div className="border-t pt-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-completed-filter"
                  checked={filters.showCompleted}
                  onCheckedChange={handleShowCompletedToggle}
                />
                <label
                  htmlFor="show-completed-filter"
                  className="text-sm cursor-pointer flex-1 font-medium"
                >
                  Show completed cases
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                Cases with statuses marked as completed will be hidden when unchecked
              </p>
            </div>

            {/* Advanced alert filters (feature-flagged in alerts segment) */}
            {segment === "alerts" && enableAdvancedAlertFilters && (
              <div className="border-t pt-3">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Advanced alert filters</Label>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium mb-2 block">Include criteria</Label>
                    {alertDescriptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No include criteria available.</p>
                    ) : (
                      <div className="space-y-2">
                        {alertDescriptions.map((description) => (
                          <div key={`include-alert-${description}`} className="flex items-center space-x-2">
                            <Checkbox
                              id={`include-alert-${description}`}
                              checked={includeDescriptionValues.includes(description)}
                              onCheckedChange={() => toggleDescriptionCriterion(description, false)}
                            />
                            <label
                              htmlFor={`include-alert-${description}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {description}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <Label className="text-sm font-medium mb-2 block">Exclude criteria</Label>
                    {alertDescriptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No exclude criteria available.</p>
                    ) : (
                      <div className="space-y-2">
                        {alertDescriptions.map((description) => (
                          <div key={`exclude-alert-${description}`} className="flex items-center space-x-2">
                            <Checkbox
                              id={`exclude-alert-${description}`}
                              checked={excludeDescriptionValues.includes(description)}
                              onCheckedChange={() => toggleDescriptionCriterion(description, true)}
                            />
                            <label
                              htmlFor={`exclude-alert-${description}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {description}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Alert description quick filter (alerts segment) */}
            {segment === "alerts" && alertDescriptions.length > 0 && (
              <div className="border-t pt-3">
                <Label className="text-sm font-medium mb-2 block">Alert description (quick filter)</Label>
                <Select value={filters.alertDescription} onValueChange={handleAlertDescriptionChange}>
                  <SelectTrigger id="alert-description-filter">
                    <SelectValue placeholder="All descriptions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All descriptions</SelectItem>
                    {alertDescriptions.map((desc) => (
                      <SelectItem key={desc} value={desc}>
                        {desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
