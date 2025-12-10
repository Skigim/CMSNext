import { useCallback, useEffect, useRef, useState } from "react";
import type { AlertWorkflowStatus } from "@/types/case";

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

const STORAGE_KEY = "cmsnext-alert-list-preferences";

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

function loadPreferences(): {
  sortConfig: AlertSortConfig;
  filters: AlertFilters;
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
  } catch (error) {
    console.warn("Failed to load alert list preferences", error);
    return null;
  }
}

function savePreferences(
  sortConfig: AlertSortConfig,
  filters: AlertFilters,
): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    const serialized: SerializedPreferences = {
      sortConfig,
      filters: {
        searchTerm: filters.searchTerm,
        description: filters.description,
        statuses: filters.statuses,
        matchStatus: filters.matchStatus,
      },
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.warn("Failed to save alert list preferences", error);
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

export function useAlertListPreferences(): AlertListPreferences {
  // Load preferences once during initial render
  const [initialPrefs] = useState(() => loadPreferences());
  
  const [sortConfig, setSortConfigState] = useState<AlertSortConfig>(
    initialPrefs?.sortConfig ?? DEFAULT_SORT_CONFIG
  );
  const [filters, setFiltersState] = useState<AlertFilters>(
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
      savePreferences(sortConfig, filters);
    }, 300);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [sortConfig, filters]);

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
    clearPreferences();
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
