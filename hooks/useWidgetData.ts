import { useCallback, useEffect, useRef, useState } from 'react';
import { recordPerformanceMarker } from '@/utils/telemetryInstrumentation';

/**
 * Widget data freshness information.
 * Tracks when data was last updated and how stale it is.
 */
export interface WidgetDataFreshness {
  lastUpdatedAt: number | null;
  isStale: boolean;
  minutesAgo: number | null;
}

/**
 * Widget data hook options.
 */
export interface UseWidgetDataOptions {
  /** How often to refresh data in milliseconds. Default: 5 minutes */
  refreshInterval?: number;
  /** Enable performance tracking for this widget */
  enablePerformanceTracking?: boolean;
  /** Optional key that forces a refetch when it changes */
  refreshKey?: unknown;
}

/**
 * useWidgetData Hook
 *
 * Manages data fetching, freshness tracking, and performance metrics for dashboard widgets.
 * Automatically refreshes data at specified intervals and tracks staleness.
 *
 * @param dataFetcher - Async function that fetches the widget data
 * @param options - Configuration options (refreshInterval, performance tracking)
 * @returns Object containing data, loading state, error, and freshness info
 *
 * @example
 * ```tsx
 * const { data, loading, error, freshness, refresh } = useWidgetData(
 *   async () => {
 *     const cases = await getCases();
 *     return calculatePriorities(cases);
 *   },
 *   { refreshInterval: 60000 } // 1 minute
 * );
 * ```
 */
export function useWidgetData<T>(
  dataFetcher: () => Promise<T>,
  options: UseWidgetDataOptions = {}
) {
  const {
    refreshInterval = 5 * 60 * 1000, // 5 minutes default
    enablePerformanceTracking = true,
    refreshKey,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [freshness, setFreshness] = useState<WidgetDataFreshness>({
    lastUpdatedAt: null,
    isStale: true,
    minutesAgo: null,
  });

  const mountedRef = useRef(true);
  const dataFetcherRef = useRef(dataFetcher);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdateRef = useRef<number | null>(null);
  const performanceMarkRef = useRef<string | null>(null);

  /**
   * Update freshness information based on last update timestamp.
   */
  const updateFreshness = useCallback((timestamp: number) => {
    const now = Date.now();
    const elapsedMs = now - timestamp;
    const minutesAgo = Math.floor(elapsedMs / 60000);
    const isStale = elapsedMs > refreshInterval;

    setFreshness({
      lastUpdatedAt: timestamp,
      isStale,
      minutesAgo,
    });
  }, [refreshInterval]);

  /**
   * Fetch widget data with error handling and performance tracking.
   */
  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return;

    const startTime = Date.now();
    const markName = `widget-data-fetch-${Date.now()}`;
    performanceMarkRef.current = markName;

    try {
      setLoading(true);
      setError(null);

      const result = await dataFetcherRef.current();

      if (!mountedRef.current) return;

  setData(result);
      const timestamp = Date.now();
      lastUpdateRef.current = timestamp;
      updateFreshness(timestamp);

      // Track performance if enabled
      if (enablePerformanceTracking) {
        const duration = Date.now() - startTime;
        recordPerformanceMarker(markName, {
          duration,
          metadata: {
            widgetType: 'custom',
            dataSize: typeof result === 'object' ? JSON.stringify(result).length : 0,
          },
        });
      }
    } catch (err) {
      if (!mountedRef.current) return;

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);

      // Record error performance marker
      if (enablePerformanceTracking) {
        const duration = Date.now() - startTime;
        recordPerformanceMarker(markName, {
          duration,
          metadata: {
            widgetType: 'custom',
            error: error.message,
          },
        });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [updateFreshness, enablePerformanceTracking]);

  /**
   * Refresh data manually.
   */
  const refresh = useCallback(async () => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    await fetchData();
    // Re-schedule the auto-refresh timer after manual refresh completes
    if (mountedRef.current) {
      refreshTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          fetchData().then(() => {
            // Re-schedule after this refresh too
            if (mountedRef.current) {
              refreshTimeoutRef.current = setTimeout(() => {
                if (mountedRef.current) {
                  // This will be handled by the main effect loop
                }
              }, refreshInterval);
            }
          });
        }
      }, refreshInterval);
    }
  }, [fetchData, refreshInterval]);

  useEffect(() => {
    dataFetcherRef.current = dataFetcher;
  }, [dataFetcher]);

  /**
   * Set up automatic refresh interval.
   */
  useEffect(() => {
    // Initial fetch or refetch when the fetcher dependencies change
    fetchData();

    // Set up refresh interval
    const setupRefreshInterval = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          fetchData().then(() => setupRefreshInterval());
        }
      }, refreshInterval);
    };

    setupRefreshInterval();

    // Freshness update interval (update "X minutes ago" every minute)
    const freshnessInterval = setInterval(() => {
      if (lastUpdateRef.current && mountedRef.current) {
        updateFreshness(lastUpdateRef.current);
      }
    }, 60000); // Update every minute

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      clearInterval(freshnessInterval);
    };
  }, [fetchData, refreshInterval, updateFreshness, dataFetcher, refreshKey]);

  /**
   * Cleanup on unmount.
   */
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    loading,
    error,
    freshness,
    refresh,
  };
}
