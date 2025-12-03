import { useCallback, useEffect, useState } from "react";
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
  // Reset to defaults
  resetPreferences: () => void;
}

const DEFAULT_SORT_KEY: CaseListSortKey = "updated";
const DEFAULT_SORT_DIRECTION: CaseListSortDirection = "desc";
const DEFAULT_SEGMENT: CaseListSegment = "all";
const DEFAULT_FILTERS: CaseFilters = {
  statuses: [],
  priorityOnly: false,
  dateRange: {},
};

const STORAGE_KEY = "cmsnext-case-list-preferences";

/** Serialized format for localStorage (Dates become ISO strings) */
interface SerializedPreferences {
  sortConfigs: SortConfig[];
  segment: CaseListSegment;
  filters: {
    statuses: CaseStatus[];
    priorityOnly: boolean;
    dateRange: {
      from?: string;
      to?: string;
    };
  };
}

function loadPreferences(): {
  sortConfigs: SortConfig[];
  segment: CaseListSegment;
  filters: CaseFilters;
} | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as SerializedPreferences | null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    // Validate sortConfigs
    const sortConfigs = Array.isArray(parsed.sortConfigs) && parsed.sortConfigs.length > 0
      ? parsed.sortConfigs
      : [{ key: DEFAULT_SORT_KEY, direction: DEFAULT_SORT_DIRECTION }];

    // Validate segment
    const segment = ["all", "recent", "priority"].includes(parsed.segment)
      ? parsed.segment
      : DEFAULT_SEGMENT;

    // Parse filters with Date reconstruction
    const filters: CaseFilters = {
      statuses: Array.isArray(parsed.filters?.statuses) ? parsed.filters.statuses : [],
      priorityOnly: Boolean(parsed.filters?.priorityOnly),
      dateRange: {
        from: parsed.filters?.dateRange?.from ? new Date(parsed.filters.dateRange.from) : undefined,
        to: parsed.filters?.dateRange?.to ? new Date(parsed.filters.dateRange.to) : undefined,
      },
    };

    // Validate parsed dates (check for Invalid Date)
    if (filters.dateRange.from && isNaN(filters.dateRange.from.getTime())) {
      filters.dateRange.from = undefined;
    }
    if (filters.dateRange.to && isNaN(filters.dateRange.to.getTime())) {
      filters.dateRange.to = undefined;
    }

    return { sortConfigs, segment, filters };
  } catch (error) {
    console.warn("Failed to load case list preferences", error);
    return null;
  }
}

function savePreferences(
  sortConfigs: SortConfig[],
  segment: CaseListSegment,
  filters: CaseFilters,
): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    const serialized: SerializedPreferences = {
      sortConfigs,
      segment,
      filters: {
        statuses: filters.statuses,
        priorityOnly: filters.priorityOnly,
        dateRange: {
          from: filters.dateRange.from?.toISOString(),
          to: filters.dateRange.to?.toISOString(),
        },
      },
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.warn("Failed to save case list preferences", error);
  }
}

function clearPreferences(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors on clear
  }
}

export function useCaseListPreferences(): CaseListPreferences {
  // Load preferences once during initial render
  const [initialPrefs] = useState(() => loadPreferences());
  
  const [sortKey, setSortKeyState] = useState<CaseListSortKey>(
    initialPrefs?.sortConfigs[0]?.key ?? DEFAULT_SORT_KEY
  );
  const [sortDirection, setSortDirectionState] = useState<CaseListSortDirection>(
    initialPrefs?.sortConfigs[0]?.direction ?? DEFAULT_SORT_DIRECTION
  );
  const [segment, setSegmentState] = useState<CaseListSegment>(
    initialPrefs?.segment ?? DEFAULT_SEGMENT
  );
  const [sortConfigs, setSortConfigsState] = useState<SortConfig[]>(
    initialPrefs?.sortConfigs ?? [{ key: DEFAULT_SORT_KEY, direction: DEFAULT_SORT_DIRECTION }]
  );
  const [filters, setFiltersState] = useState<CaseFilters>(
    initialPrefs?.filters ?? DEFAULT_FILTERS
  );

  // Persist preferences when they change
  useEffect(() => {
    savePreferences(sortConfigs, segment, filters);
  }, [sortConfigs, segment, filters]);

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

  const resetPreferences = useCallback(() => {
    setSortKeyState(DEFAULT_SORT_KEY);
    setSortDirectionState(DEFAULT_SORT_DIRECTION);
    setSegmentState(DEFAULT_SEGMENT);
    setSortConfigsState([{ key: DEFAULT_SORT_KEY, direction: DEFAULT_SORT_DIRECTION }]);
    setFiltersState(DEFAULT_FILTERS);
    clearPreferences();
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
    resetPreferences,
  };
}
