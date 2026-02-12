import { useCallback, useEffect, useRef, useState } from 'react';
import { recordPerformanceMarker } from '@/utils/telemetryInstrumentation';
import { useDataChangeCount } from './useDataSync';

/**
 * Configuration options for useWidgetData hook.
 * @interface UseWidgetDataOptions
 */
interface UseWidgetDataOptions {
  /** Auto-refresh period in milliseconds (default: 300000 = 5 minutes) */
  refreshInterval?: number;
  /** Enable performance tracking metrics (default: false) */
  enablePerformanceTracking?: boolean;
  /** Dependency value to trigger refetch when it changes (optional) */
  refreshKey?: any;
}

/**
 * Hook for managing widget data fetching with auto-refresh and freshness tracking
 * 
 * Provides:
 * - Periodic data refresh with configurable interval
 * - Error handling with silent retries
 * - Data staleness tracking (minutes since last update)
 * - Performance metrics for dashboard optimization
 * - Forced refresh via dependency or manual trigger
 * 
 * **Refresh Behavior:**
 * - Auto-refresh at specified interval (default: 5 minutes = 300,000ms)
 * - Skips refresh if component unmounted
 * - Continues refreshing even if error (doesn't break polling)
 * - Manual refresh via `refresh()` function restarts timer
 * 
 * **Staleness Tracking:**
 * - `lastUpdatedAt`: Timestamp of last successful fetch
 * - `isStale`: Boolean - true if data > 1 interval old
 * - `minutesAgo`: Minutes since last update (null if never fetched)
 * 
 * **Error Handling:**
 * - Catches errors from dataFetcher
 * - Stores error in state (doesn't throw)
 * - Shows error to user via widget UI
 * - Auto-retries on next interval (doesn't stop polling)
 * 
 * **Performance Tracking:**
 * - Optional performance metrics via recordPerformanceMarker()
 * - Tracks fetch duration for dashboard optimization
 * - Helps identify slow widgets
 * 
 * **Usage Example:**
 * ```typescript
 * const widget = useWidgetData(\n *   async () => {\n *     const cases = await dataManager.getAllCases();\n *     return {\n *       total: cases.length,\n *       priority: cases.filter(c => c.priority).length\n *     };\n *   },\n *   { \n *     refreshInterval: 60000, // 1 minute\n *     enablePerformanceTracking: true,\n *     refreshKey: selectedCaseId // Refetch when case changes\n *   }\n * );\n * \n * if (widget.loading) return <Skeleton />;\n * if (widget.error) return <Error message={widget.error} />;\n * \n * <div>\n *   <h3>Cases: {widget.data.total}</h3>\n *   <small>Updated {widget.freshness.minutesAgo}min ago</small>\n *   <button onClick={() => widget.refresh()}>Refresh</button>\n * </div>\n * ```
 * 
 * **Dependencies:**
 * - Requires useFileStorageDataChange() hook for reactive updates
 * - Respects component unmount state (useIsMounted)
 * 
 * @template T Type of data returned by dataFetcher
 * 
 * @param {() => Promise<T>} dataFetcher Async function to fetch widget data
 * @param {UseWidgetDataOptions} options Configuration
 *   - `refreshInterval`: Auto-refresh period in ms (default: 300000 = 5min)
 *   - `enablePerformanceTracking`: Record fetch duration metrics (default: false)
 *   - `refreshKey`: Dependency to force refetch when changes (optional)
 * 
 * @returns Widget data, loading state, error, staleness, and refresh control
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
  const [freshness, setFreshness] = useState<{
    lastUpdatedAt: number | null;
    isStale: boolean;
    minutesAgo: number | null;
  }>({
    lastUpdatedAt: null,
    isStale: true,
    minutesAgo: null,
  });

  const mountedRef = useRef(true);
  const dataFetcherRef = useRef(dataFetcher);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdateRef = useRef<number | null>(null);
  const performanceMarkRef = useRef<string | null>(null);
  
  // Listen for file storage changes to trigger refresh
  const dataChangeCount = useDataChangeCount();

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

      const fetchedData = await dataFetcherRef.current();

      if (!mountedRef.current) return;

  setData(fetchedData);
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
            dataSize: typeof fetchedData === 'object' ? JSON.stringify(fetchedData).length : 0,
          },
        });
      }
    } catch (caughtError) {
      if (!mountedRef.current) return;

      const error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
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

  /** Schedule the next auto-refresh after a fetch completes. */
  const scheduleRefresh = useCallback((interval: number) => {
    if (!mountedRef.current) return;
    refreshTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        fetchData().then(() => scheduleRefresh(interval));
      }
    }, interval);
  }, [fetchData]);

  /**
   * Refresh data manually.
   */
  const refresh = useCallback(async () => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    await fetchData();
    // Re-schedule the auto-refresh timer after manual refresh completes
    scheduleRefresh(refreshInterval);
  }, [fetchData, refreshInterval, scheduleRefresh]);

  useEffect(() => {
    dataFetcherRef.current = dataFetcher;
  }, [dataFetcher]);

  /**
   * Set up automatic refresh interval.
   */
  useEffect(() => {
    // Initial fetch or refetch when the fetcher dependencies change
    fetchData();

    // Set up refresh interval (disabled in test environment to prevent infinite loops with fake timers)
    if (import.meta.env.MODE !== 'test') {
      scheduleRefresh(refreshInterval);
    }

    // Freshness update interval (update "X minutes ago" every minute)
    // Skip in test environment for better test isolation
    let freshnessInterval: ReturnType<typeof setInterval> | null = null;
    if (import.meta.env.MODE !== 'test') {
      freshnessInterval = setInterval(() => {
        if (lastUpdateRef.current && mountedRef.current) {
          updateFreshness(lastUpdateRef.current);
        }
      }, 60000); // Update every minute
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (freshnessInterval) {
        clearInterval(freshnessInterval);
      }
    };
  }, [fetchData, refreshInterval, updateFreshness, dataFetcher, refreshKey, dataChangeCount]);

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
