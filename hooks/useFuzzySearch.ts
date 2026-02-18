import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import Fuse, { type IFuseOptions } from "fuse.js";
import type { StoredCase } from "@/types/case";
import type { AlertWithMatch } from "@/utils/alertsData";

export interface CaseSearchResult {
  type: "case";
  item: StoredCase;
  score: number;
  matches?: ReadonlyArray<{
    key?: string;
    value?: string;
    indices: ReadonlyArray<readonly [number, number]>;
  }>;
}

export interface AlertSearchResult {
  type: "alert";
  item: AlertWithMatch;
  score: number;
  matches?: ReadonlyArray<{
    key?: string;
    value?: string;
    indices: ReadonlyArray<readonly [number, number]>;
  }>;
}

export type SearchResult = CaseSearchResult | AlertSearchResult;

export interface FuzzySearchResults {
  cases: CaseSearchResult[];
  alerts: AlertSearchResult[];
  all: SearchResult[];
  totalCount: number;
}

export interface UseFuzzySearchOptions {
  /** Debounce delay in milliseconds (default: 500) */
  debounceMs?: number;
  /** Maximum results to return per category (default: 10) */
  maxResults?: number;
  /** Minimum characters required to trigger search (default: 2) */
  minChars?: number;
  /** Fuse.js threshold for fuzzy matching (0 = exact, 1 = match anything) */
  threshold?: number;
}

const DEFAULT_OPTIONS: Required<UseFuzzySearchOptions> = {
  debounceMs: 500,
  maxResults: 10,
  minChars: 2,
  threshold: 0.4,
};

/**
 * Fuse.js configuration for cases
 */
const CASE_FUSE_OPTIONS: IFuseOptions<StoredCase> = {
  keys: [
    { name: "name", weight: 2 },
    { name: "mcn", weight: 2 },
    { name: "person.firstName", weight: 1.5 },
    { name: "person.lastName", weight: 1.5 },
    { name: "status", weight: 1 },
    { name: "caseRecord.caseType", weight: 0.8 },
    { name: "caseRecord.description", weight: 0.5 },
  ],
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  findAllMatches: true,
};

/**
 * Fuse.js configuration for alerts
 */
const ALERT_FUSE_OPTIONS: IFuseOptions<AlertWithMatch> = {
  keys: [
    { name: "description", weight: 2 },
    { name: "mcNumber", weight: 2 },
    { name: "personName", weight: 1.5 },
    { name: "alertCode", weight: 1 },
    { name: "status", weight: 0.8 },
    { name: "matchedCaseName", weight: 1 },
  ],
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  findAllMatches: true,
};

/**
 * Hook for fuzzy searching across cases and alerts
 * 
 * Features:
 * - Debounced search input (default 500ms)
 * - Fuzzy matching using Fuse.js
 * - Combined results from cases and alerts
 * - Configurable threshold and result limits
 * 
 * @example
 * ```tsx
 * const { query, setQuery, results, isSearching } = useFuzzySearch({
 *   cases,
 *   alerts,
 *   options: { debounceMs: 300, maxResults: 5 }
 * });
 * ```
 */
export function useFuzzySearch({
  cases,
  alerts,
  options = {},
}: {
  cases: StoredCase[];
  alerts: AlertWithMatch[];
  options?: UseFuzzySearchOptions;
}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [query, setQueryState] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create Fuse instances with memoization
  const caseFuse = useMemo(() => {
    return new Fuse(cases, {
      ...CASE_FUSE_OPTIONS,
      threshold: opts.threshold,
    });
  }, [cases, opts.threshold]);

  const alertFuse = useMemo(() => {
    return new Fuse(alerts, {
      ...ALERT_FUSE_OPTIONS,
      threshold: opts.threshold,
    });
  }, [alerts, opts.threshold]);

  const setQuery = useCallback((nextQuery: string) => {
    setQueryState(nextQuery);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (nextQuery.length < opts.minChars) {
      setDebouncedQuery("");
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(nextQuery);
      setIsSearching(false);
    }, opts.debounceMs);
  }, [opts.debounceMs, opts.minChars]);

  useEffect(() => () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  // Perform the search
  const results = useMemo<FuzzySearchResults>(() => {
    if (!debouncedQuery || debouncedQuery.length < opts.minChars) {
      return { cases: [], alerts: [], all: [], totalCount: 0 };
    }

    // Search cases
    const caseResults = caseFuse
      .search(debouncedQuery, { limit: opts.maxResults })
      .map((result): CaseSearchResult => ({
        type: "case",
        item: result.item,
        score: result.score ?? 1,
        matches: result.matches,
      }));

    // Search alerts
    const alertResults = alertFuse
      .search(debouncedQuery, { limit: opts.maxResults })
      .map((result): AlertSearchResult => ({
        type: "alert",
        item: result.item,
        score: result.score ?? 1,
        matches: result.matches,
      }));

    // Combine and sort by score (lower is better in Fuse.js)
    const allResults = [...caseResults, ...alertResults].sort(
      (a, b) => a.score - b.score
    );

    return {
      cases: caseResults,
      alerts: alertResults,
      all: allResults.slice(0, opts.maxResults * 2),
      totalCount: caseResults.length + alertResults.length,
    };
  }, [debouncedQuery, caseFuse, alertFuse, opts.maxResults, opts.minChars]);

  // Clear search
  const clearSearch = useCallback(() => {
    setQueryState("");
    setDebouncedQuery("");
    setIsSearching(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
    /** Current search query */
    query,
    /** Update search query */
    setQuery,
    /** Clear the search */
    clearSearch,
    /** Search results */
    results,
    /** Whether search is in progress (debouncing) */
    isSearching,
    /** Whether there are any results */
    hasResults: results.totalCount > 0,
    /** Whether the query is long enough to search */
    isQueryValid: query.length >= opts.minChars,
  };
}
