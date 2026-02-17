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
import { Input } from "@/components/ui/input";
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
  getFilterableFields,
  getOperatorsForField,
  type FilterCriterion,
  type FilterableField,
  type FilterOperator,
} from "@/domain/alerts";
import { ENABLE_ADVANCED_ALERT_FILTERS, isFeatureEnabled } from "@/utils/featureFlags";
import { Plus, Trash2 } from "lucide-react";

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
    updateCriterion,
    removeCriterion,
    toggleNegate,
    setLogic,
    resetFilter,
    hasActiveAdvancedFilters,
  } = useAdvancedAlertFilter();

  // Extract status names from StatusConfig[] for UI display
  const statusOptions = useMemo(
    () => config.caseStatuses.map((s) => s.name),
    [config.caseStatuses]
  );
  const alertTypeOptions = useMemo(
    () => config.alertTypes.map((alertType) => alertType.name),
    [config.alertTypes],
  );
  const programOptions = useMemo(() => config.caseTypes, [config.caseTypes]);
  const filterableFields = useMemo(() => getFilterableFields(), []);
  const matchStatusOptions = useMemo(() => ["matched", "unmatched", "missing-mcn"] as const, []);

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

  const isDateOperator = useCallback((operator: FilterOperator) => {
    return operator === "before" || operator === "after" || operator === "between";
  }, []);

  const getFieldType = useCallback((field: FilterableField) => {
    return filterableFields.find((entry) => entry.field === field)?.type ?? "text";
  }, [filterableFields]);

  const handleCriterionFieldChange = useCallback(
    (criterionId: string, field: FilterableField) => {
      const operators = getOperatorsForField(field);
      const nextOperator = operators[0] ?? "contains";
      const nextValue = nextOperator === "between" ? ["", ""] : "";
      updateCriterion(criterionId, { field, operator: nextOperator, value: nextValue });
    },
    [updateCriterion],
  );

  const renderSelectInput = useCallback((criterion: FilterCriterion, values: string[]) => {
    return (
      <Select
        value={typeof criterion.value === "string" ? criterion.value : ""}
        onValueChange={(value) => updateCriterion(criterion.id, { value })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select value" />
        </SelectTrigger>
        <SelectContent>
          {values.map((value) => (
            <SelectItem key={value} value={value}>
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }, [updateCriterion]);

  const getDropdownValuesForField = useCallback((field: FilterableField): string[] => {
    if (field === "description") {
      return alertDescriptions;
    }
    if (field === "alertType") {
      return alertTypeOptions;
    }
    if (field === "program") {
      return programOptions;
    }
    return [];
  }, [alertDescriptions, alertTypeOptions, programOptions]);

  const renderDateInput = useCallback((criterion: FilterCriterion) => {
    if (criterion.operator === "between") {
      const values = Array.isArray(criterion.value) ? criterion.value : ["", ""];
      return (
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={values[0] ?? ""}
            onChange={(event) => updateCriterion(criterion.id, { value: [event.target.value, values[1] ?? ""] })}
          />
          <Input
            type="date"
            value={values[1] ?? ""}
            onChange={(event) => updateCriterion(criterion.id, { value: [values[0] ?? "", event.target.value] })}
          />
        </div>
      );
    }

    return (
      <Input
        type="date"
        value={typeof criterion.value === "string" ? criterion.value : ""}
        onChange={(event) => updateCriterion(criterion.id, { value: event.target.value })}
      />
    );
  }, [updateCriterion]);

  const renderCriterionValueInput = useCallback((criterion: FilterCriterion) => {
    const fieldType = getFieldType(criterion.field);
    const operator = criterion.operator;

    if (operator === "is-empty" || operator === "is-not-empty") {
      return <p className="text-xs text-muted-foreground">No value required</p>;
    }

    if (fieldType === "enum") {
      const values = criterion.field === "status" ? statusOptions : [...matchStatusOptions];
      return renderSelectInput(criterion, values);
    }

    const dropdownValues = getDropdownValuesForField(criterion.field);

    if (dropdownValues.length > 0) {
      return renderSelectInput(criterion, dropdownValues);
    }

    if (fieldType === "date" || isDateOperator(operator)) {
      return renderDateInput(criterion);
    }

    return (
      <Input
        value={typeof criterion.value === "string" ? criterion.value : ""}
        onChange={(event) => updateCriterion(criterion.id, { value: event.target.value })}
        placeholder="Enter value"
      />
    );
  }, [
    alertDescriptions,
    alertTypeOptions,
    getDropdownValuesForField,
    getFieldType,
    isDateOperator,
    matchStatusOptions,
    programOptions,
    renderDateInput,
    renderSelectInput,
    statusOptions,
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
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Advanced alert filters</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addCriterion(createEmptyFilterCriterion())}
                    >
                      <Plus className="h-4 w-4" />
                      Add criterion
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Logic</Label>
                    <Select value={advancedFilter.logic} onValueChange={(value: "and" | "or") => setLogic(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="and">Match all criteria (AND)</SelectItem>
                        <SelectItem value="or">Match any criterion (OR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {advancedFilter.criteria.length === 0 && (
                    <p className="text-xs text-muted-foreground">No advanced criteria configured.</p>
                  )}

                  {advancedFilter.criteria.map((item) => (
                    <div key={item.id} className="space-y-2 rounded-md border p-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Select
                          value={item.field}
                          onValueChange={(value: FilterableField) => handleCriterionFieldChange(item.id, value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {filterableFields.map((fieldMeta) => (
                              <SelectItem key={fieldMeta.field} value={fieldMeta.field}>
                                {fieldMeta.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={item.operator}
                          onValueChange={(value: FilterOperator) => {
                            const nextValue = value === "between" ? ["", ""] : "";
                            updateCriterion(item.id, { operator: value, value: nextValue });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getOperatorsForField(item.field).map((operator) => (
                              <SelectItem key={operator} value={operator}>
                                {operator}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {renderCriterionValueInput(item)}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={item.negate}
                            onCheckedChange={() => toggleNegate(item.id)}
                            id={`exclude-${item.id}`}
                          />
                          <label htmlFor={`exclude-${item.id}`} className="text-sm cursor-pointer">
                            Exclude matching alerts
                          </label>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCriterion(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
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
