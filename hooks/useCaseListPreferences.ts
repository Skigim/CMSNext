import { useCallback, useEffect, useRef, useState } from "react";
import type { CaseStatus } from "@/types/case";

export type CaseListSortKey = "updated" | "name" | "mcn" | "application" | "status" | "caseType" | "alerts" | "score";
export type CaseListSortDirection = "asc" | "desc";
export type CaseListSegment = "all" | "recent" | "priority" | "alerts";

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
  excludeStatuses: CaseStatus[];
  priorityOnly: boolean;
  excludePriority: boolean;
  dateRange: DateRangeFilter;
  /** Filter alerts by description (only used in alerts segment) */
  alertDescription: string;
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

const DEFAULT_SORT_KEY: CaseListSortKey = "name";
const DEFAULT_SORT_DIRECTION: CaseListSortDirection = "asc";
const DEFAULT_SEGMENT: CaseListSegment = "all";
const DEFAULT_FILTERS: CaseFilters = {
  statuses: [],
  excludeStatuses: [],
  priorityOnly: false,
  excludePriority: false,
  dateRange: {},
  alertDescription: "all",
};

const STORAGE_KEY = "cmsnext-case-list-preferences";

/** Serialized format for localStorage (Dates become ISO strings) */
interface SerializedPreferences {
  sortConfigs: SortConfig[];
  segment: CaseListSegment;
  filters: {
    statuses: CaseStatus[];
    excludeStatuses?: CaseStatus[];
    priorityOnly: boolean;
    excludePriority?: boolean;
    dateRange: {
      from?: string;
      to?: string;
    };
    alertDescription?: string;
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
    const segment = ["all", "recent", "priority", "alerts"].includes(parsed.segment)
      ? parsed.segment
      : DEFAULT_SEGMENT;

    // Parse filters with Date reconstruction
    const filters: CaseFilters = {
      statuses: Array.isArray(parsed.filters?.statuses) ? parsed.filters.statuses : [],
      excludeStatuses: Array.isArray(parsed.filters?.excludeStatuses) ? parsed.filters.excludeStatuses : [],
      priorityOnly: Boolean(parsed.filters?.priorityOnly),
      excludePriority: Boolean(parsed.filters?.excludePriority),
      dateRange: {
        from: parsed.filters?.dateRange?.from ? new Date(parsed.filters.dateRange.from) : undefined,
        to: parsed.filters?.dateRange?.to ? new Date(parsed.filters.dateRange.to) : undefined,
      },
      alertDescription: typeof parsed.filters?.alertDescription === "string" 
        ? parsed.filters.alertDescription 
        : "all",
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
        excludeStatuses: filters.excludeStatuses,
        priorityOnly: filters.priorityOnly,
        excludePriority: filters.excludePriority,
        dateRange: {
          from: filters.dateRange.from?.toISOString(),
          to: filters.dateRange.to?.toISOString(),
        },
        alertDescription: filters.alertDescription,
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

/**
 * Hook for managing case list view preferences (sorting, segmentation, filtering)
 * 
 * Persists user's case list configuration to localStorage with debounced writes.
 * Automatically restores preferences on mount. More feature-rich than alert preferences.
 * 
 * **Supported Sorts:**
 * - Keys: "updated" | "name" | "mcn" | "application" | "status" | "caseType" | "alerts"
 * - Direction: "asc" | "desc"
 * - Multi-sort: sortConfigs array supports primary + secondary sorts
 * - Default: Sort by "updated" descending
 * 
 * **Supported Segments:**
 * - "all": Show all cases
 * - "recent": Show recently modified cases (convenience segment)
 * - "priority": Show priority-flagged cases only
 * 
 * **Supported Filters:**
 * - `statuses`: Array of CaseStatus (Active, Closed, On Hold, etc.)
 * - `excludeStatuses`: Array of CaseStatus to exclude
 * - `priorityOnly`: Show only priority-flagged cases
 * - `excludePriority`: Hide priority-flagged cases
 * - `dateRange`: { from?: Date, to?: Date } for case creation/update date filtering
 * 
 * **Usage Example:**
 * ```typescript
 * const prefs = useCaseListPreferences();
 * 
 * // Set primary sort
 * prefs.setSortKey("updated");
 * prefs.setSortDirection("desc");
 * 
 * // Or use multi-sort configs
 * prefs.setSortConfigs([
 *   { key: "status", direction: "asc" },
 *   { key: "updated", direction: "desc" }
 * ]);
 * 
 * // Switch to priority segment
 * prefs.setSegment("priority");
 * 
 * // Filter by status and date range
 * prefs.setFilters({
 *   statuses: ["Active"],
 *   excludeStatuses: ["Closed"],
 *   priorityOnly: false,
 *   excludePriority: false,
 *   dateRange: {
 *     from: new Date("2024-01-01"),
 *     to: new Date("2024-12-31")
 *   }
 * });
 * 
 * // Reset to defaults and clear localStorage
 * prefs.resetPreferences();
 * ```
 * 
 * **Persistence Details:**
 * - Debounced localStorage writes delayed 300ms to batch rapid changes
 * - Validation: On load, invalid dates removed, invalid sorts reset to defaults
 * - Date handling: Serialized to ISO strings, reconstructed as Date objects
 * - Error handling: Logs to console; preferences lost if localStorage unavailable
 * 
 * **Sorting Architecture:**
 * Maintains both simple (sortKey + sortDirection) and advanced (sortConfigs[]) APIs:
 * - `sortKey/sortDirection`: Convenience API for primary sort only
 * - `sortConfigs`: Full multi-sort configuration
 * - Setters keep both APIs in sync internally
 * 
 * @returns {CaseListPreferences} State and setters:
 * - `sortKey`: Current primary sort column
 * - `setSortKey(key)`: Update primary sort column (updates sortConfigs[0])
 * - `sortDirection`: Current primary sort direction
 * - `setSortDirection(dir)`: Update primary sort direction
 * - `segment`: Current segment filter (all|recent|priority)
 * - `setSegment(segment)`: Switch to different view segment
 * - `sortConfigs`: Full multi-sort configuration array
 * - `setSortConfigs(configs)`: Set complete sort config (updates sortKey/sortDirection)
 * - `filters`: All active filters (statuses, date range, priority, etc.)
 * - `setFilters(filters)`: Batch update all filters
 * - `resetPreferences()`: Clear all prefs, delete from localStorage
 */
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

  // Debounced persistence to reduce main thread blocking
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce localStorage writes by 300ms
    saveTimeoutRef.current = setTimeout(() => {
      savePreferences(sortConfigs, segment, filters);
    }, 300);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
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
