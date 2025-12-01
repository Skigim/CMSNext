import { useCallback, useState } from "react";
import type { CaseStatus } from "@/types/case";

export type CaseListSortKey = "updated" | "name" | "mcn" | "application" | "status" | "caseType" | "alerts";
export type CaseListSortDirection = "asc" | "desc";
export type CaseListSegment = "all" | "recent" | "priority";

export interface SortConfig {
  key: CaseListSortKey;
  direction: CaseListSortDirection;
}

export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

export interface CaseFilters {
  statuses: CaseStatus[];
  priorityOnly: boolean;
  dateRange: DateRangeFilter;
}

interface CaseListPreferences {
  sortKey: CaseListSortKey;
  setSortKey: (key: CaseListSortKey) => void;
  sortDirection: CaseListSortDirection;
  setSortDirection: (direction: CaseListSortDirection) => void;
  segment: CaseListSegment;
  setSegment: (segment: CaseListSegment) => void;
  // Multi-field sorting
  sortConfigs: SortConfig[];
  setSortConfigs: (configs: SortConfig[]) => void;
  // Enhanced filtering
  filters: CaseFilters;
  setFilters: (filters: CaseFilters) => void;
}

const DEFAULT_SORT_KEY: CaseListSortKey = "updated";
const DEFAULT_SORT_DIRECTION: CaseListSortDirection = "desc";
const DEFAULT_SEGMENT: CaseListSegment = "all";
const DEFAULT_FILTERS: CaseFilters = {
  statuses: [],
  priorityOnly: false,
  dateRange: {},
};

export function useCaseListPreferences(): CaseListPreferences {
  const [sortKey, setSortKeyState] = useState<CaseListSortKey>(DEFAULT_SORT_KEY);
  const [sortDirection, setSortDirectionState] = useState<CaseListSortDirection>(DEFAULT_SORT_DIRECTION);
  const [segment, setSegmentState] = useState<CaseListSegment>(DEFAULT_SEGMENT);
  const [sortConfigs, setSortConfigsState] = useState<SortConfig[]>([
    { key: DEFAULT_SORT_KEY, direction: DEFAULT_SORT_DIRECTION }
  ]);
  const [filters, setFiltersState] = useState<CaseFilters>(DEFAULT_FILTERS);

  const setSortKey = useCallback((key: CaseListSortKey) => {
    setSortKeyState(key);
    // Update sortConfigs to keep primary sort in sync
    setSortConfigsState(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[0] = { ...updated[0], key };
      } else {
        updated.push({ key, direction: sortDirection });
      }
      return updated;
    });
  }, [sortDirection]);

  const setSortDirection = useCallback((direction: CaseListSortDirection) => {
    setSortDirectionState(direction);
    // Update sortConfigs to keep primary sort in sync
    setSortConfigsState(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[0] = { ...updated[0], direction };
      } else {
        updated.push({ key: sortKey, direction });
      }
      return updated;
    });
  }, [sortKey]);

  const setSegment = useCallback((value: CaseListSegment) => {
    setSegmentState(value);
  }, []);

  const setSortConfigs = useCallback((configs: SortConfig[]) => {
    setSortConfigsState(configs);
    // Keep primary sort key/direction in sync
    if (configs.length > 0) {
      setSortKeyState(configs[0].key);
      setSortDirectionState(configs[0].direction);
    }
  }, []);

  const setFilters = useCallback((newFilters: CaseFilters) => {
    setFiltersState(newFilters);
  }, []);

  return {
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
  };
}
