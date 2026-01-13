import { useCallback, useMemo, useState } from "react";
import type { AlertWorkflowStatus } from "@/types/case";
import { createLocalStorageAdapter } from "@/utils/localStorage";
import { useDebouncedSave } from "./useDebouncedSave";

export type AlertListSortKey = "description" | "client" | "due" | "program" | "mcn";
export type AlertListSortDirection = "asc" | "desc";

export interface AlertSortConfig {
  key: AlertListSortKey;
  direction: AlertListSortDirection;
}

export interface AlertFilters {
  /** Text search term for fuzzy matching */
  searchTerm: string;
  /** Filter by specific alert description/type */
  description: string;
  /** Filter by workflow statuses (new, in-progress, resolved, etc.) */
  statuses: AlertWorkflowStatus[];
  /** Filter by match status */
  matchStatus: "all" | "matched" | "unmatched" | "missing-mcn";
}

interface AlertListPreferences {
  // Sorting
  sortConfig: AlertSortConfig;
  setSortConfig: (config: AlertSortConfig) => void;
  // Filtering
  filters: AlertFilters;
  setFilters: (filters: AlertFilters) => void;
  setSearchTerm: (term: string) => void;
  setDescription: (description: string) => void;
  // Reset
  resetPreferences: () => void;
  // Helper to check if any filters are active
  hasActiveFilters: boolean;
}

const DEFAULT_SORT_CONFIG: AlertSortConfig = {
  key: "due",
  direction: "asc",
};

const DEFAULT_FILTERS: AlertFilters = {
  searchTerm: "",
  description: "all",
  statuses: [],
  matchStatus: "all",
};

/** Serialized format for localStorage */
interface SerializedPreferences {
  sortConfig: AlertSortConfig;
  filters: {
    searchTerm: string;
    description: string;
    statuses: AlertWorkflowStatus[];
    matchStatus: "all" | "matched" | "unmatched" | "missing-mcn";
  };
}

function parsePreferences(raw: string): SerializedPreferences | null {
  try {
    const parsed = JSON.parse(raw) as SerializedPreferences | null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function validateAndTransform(parsed: SerializedPreferences | null): {
  sortConfig: AlertSortConfig;
  filters: AlertFilters;
} | null {
  if (!parsed) return null;

  // Validate sortConfig
  const validSortKeys: AlertListSortKey[] = ["description", "client", "due", "program", "mcn"];
  const sortConfig: AlertSortConfig = {
    key: validSortKeys.includes(parsed.sortConfig?.key) 
      ? parsed.sortConfig.key 
      : DEFAULT_SORT_CONFIG.key,
    direction: ["asc", "desc"].includes(parsed.sortConfig?.direction)
      ? parsed.sortConfig.direction
      : DEFAULT_SORT_CONFIG.direction,
  };

  // Parse filters
  const filters: AlertFilters = {
    searchTerm: typeof parsed.filters?.searchTerm === "string" 
      ? parsed.filters.searchTerm 
      : "",
    description: typeof parsed.filters?.description === "string" 
      ? parsed.filters.description 
      : "all",
    statuses: Array.isArray(parsed.filters?.statuses) 
      ? parsed.filters.statuses 
      : [],
    matchStatus: ["all", "matched", "unmatched", "missing-mcn"].includes(parsed.filters?.matchStatus)
      ? parsed.filters.matchStatus
      : "all",
  };

  return { sortConfig, filters };
}

const storage = createLocalStorageAdapter<SerializedPreferences | null>("cmsnext-alert-list-preferences", null, {
  parse: parsePreferences,
});

/**
 * Hook for managing alert list view preferences (sorting and filtering)
 * 
 * Persists user's alert list configuration to localStorage with debounced writes.
 * Automatically restores preferences on mount.
 * 
 * **Supported Sorts:**
 * - "description" | "client" | "due" | "program" | "mcn"
 * - Direction: "asc" | "desc"
 * - Default: Sort by "due" ascending
 * 
 * **Supported Filters:**
 * - `searchTerm`: Fuzzy search across all alert fields
 * - `description`: Alert type filter (e.g., "Court Notice", "Fee Payment")
 * - `statuses`: Array of AlertWorkflowStatus (new, in-progress, resolved, etc.)
 * - `matchStatus`: Filter by case matching ("all", "matched", "unmatched", "missing-mcn")
 * 
 * **Usage Example:**
 * ```typescript
 * const prefs = useAlertListPreferences();
 * 
 * // Sort by due date
 * prefs.setSortConfig({ key: "due", direction: "asc" });
 * 
 * // Filter by status
 * prefs.setFilters({
 *   ...prefs.filters,
 *   statuses: ["in-progress", "new"],
 *   matchStatus: "matched"
 * });
 * 
 * // Quick filter setters
 * prefs.setSearchTerm("urgent");
 * prefs.setDescription("Court Notice");
 * 
 * // Check if any filters active
 * if (prefs.hasActiveFilters) {
 *   console.log("Filtered alerts displayed");
 * }
 * 
 * // Reset to defaults and clear localStorage
 * prefs.resetPreferences();
 * ```
 * 
 * **Persistence Details:**
 * - Debounced localStorage writes delayed 300ms to batch rapid changes
 * - Validation: On load, invalid values reset to defaults
 * - Error handling: Logs to console; preferences lost if localStorage unavailable
 * 
 * @returns {AlertListPreferences} State and setters:
 * - `sortConfig`: Current sort (key: description|client|due|program|mcn, direction: asc|desc)
 * - `filters`: Filter state (searchTerm, description, statuses[], matchStatus)
 * - `setSearchTerm(term)`: Update search term
 * - `setDescription(desc)`: Update alert type filter
 * - `setFilters(filters)`: Batch update all filters
 * - `setSortConfig(config)`: Update sort configuration
 * - `resetPreferences()`: Clear all filters/sort, delete from localStorage
 * - `hasActiveFilters`: Computed boolean - true if any filter is set
 */
export function useAlertListPreferences(): AlertListPreferences {
  // Load preferences once during initial render
  const [initialPrefs] = useState(() => validateAndTransform(storage.read()));
  
  const [sortConfig, setSortConfigState] = useState<AlertSortConfig>(
    initialPrefs?.sortConfig ?? DEFAULT_SORT_CONFIG
  );
  const [filters, setFiltersState] = useState<AlertFilters>(
    initialPrefs?.filters ?? DEFAULT_FILTERS
  );

  // Memoize save data for debounced persistence
  const saveData = useMemo(() => ({
    sortConfig,
    filters: {
      searchTerm: filters.searchTerm,
      description: filters.description,
      statuses: filters.statuses,
      matchStatus: filters.matchStatus,
    },
  }), [sortConfig, filters]);

  // Debounced persistence to reduce main thread blocking
  useDebouncedSave({
    data: saveData,
    onSave: (data) => storage.write(data),
    delay: 300,
  });

  const setSortConfig = useCallback((config: AlertSortConfig) => {
    setSortConfigState(config);
  }, []);

  const setFilters = useCallback((newFilters: AlertFilters) => {
    setFiltersState(newFilters);
  }, []);

  const setSearchTerm = useCallback((term: string) => {
    setFiltersState(prev => ({ ...prev, searchTerm: term }));
  }, []);

  const setDescription = useCallback((description: string) => {
    setFiltersState(prev => ({ ...prev, description }));
  }, []);

  const resetPreferences = useCallback(() => {
    setSortConfigState(DEFAULT_SORT_CONFIG);
    setFiltersState(DEFAULT_FILTERS);
    storage.clear();
  }, []);

  const hasActiveFilters = 
    filters.searchTerm.trim().length > 0 || 
    filters.description !== "all" ||
    filters.statuses.length > 0 ||
    filters.matchStatus !== "all";

  return {
    sortConfig,
    setSortConfig,
    filters,
    setFilters,
    setSearchTerm,
    setDescription,
    resetPreferences,
    hasActiveFilters,
  };
}
