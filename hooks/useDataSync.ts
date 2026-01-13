import { useEffect } from "react";
import { useFileStorageDataChange } from "@/contexts/FileStorageContext";

/**
 * Hook for synchronizing local state with file storage changes.
 *
 * Provides a consistent pattern for refreshing data when the underlying
 * file storage data changes. Replaces the repeated pattern of:
 *
 * ```typescript
 * const dataChangeCount = useFileStorageDataChange();
 * useEffect(() => {
 *   refreshData();
 * }, [refreshData, dataChangeCount]);
 * ```
 *
 * @module hooks/useDataSync
 */

/**
 * Options for the data sync hook.
 */
export interface UseDataSyncOptions {
  /**
   * Function to call when data changes are detected.
   * Should be wrapped in useCallback to prevent infinite loops.
   */
  onRefresh: () => void | Promise<void>;

  /**
   * Additional dependencies that should trigger a refresh.
   * These are in addition to the automatic dataChangeCount dependency.
   */
  deps?: unknown[];
}

/**
 * Synchronize local state with file storage data changes.
 *
 * This hook automatically calls the refresh function when:
 * - The file storage data changes (detected via dataChangeCount)
 * - Any of the additional dependencies change
 *
 * @param options - Configuration for data sync behavior
 *
 * @example
 * ```typescript
 * const refreshItems = useCallback(async () => {
 *   if (!dataManager) return;
 *   const items = await dataManager.getItems();
 *   setItems(items);
 * }, [dataManager]);
 *
 * useDataSync({ onRefresh: refreshItems });
 * ```
 *
 * @example
 * ```typescript
 * // With additional dependencies
 * useDataSync({
 *   onRefresh: refreshItems,
 *   deps: [caseId], // Also refresh when caseId changes
 * });
 * ```
 */
export function useDataSync({ onRefresh, deps = [] }: UseDataSyncOptions): void {
  const dataChangeCount = useFileStorageDataChange();

  useEffect(() => {
    // Call refresh and handle both sync and async functions
    const result = onRefresh();
    if (result instanceof Promise) {
      result.catch((err) => {
        console.error("Data sync refresh failed:", err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefresh, dataChangeCount, ...deps]);
}

/**
 * Get the current data change count without triggering a sync.
 *
 * Useful when you need to track changes but want to handle the
 * refresh logic manually.
 *
 * @returns Current data change count from file storage context
 */
export function useDataChangeCount(): number {
  return useFileStorageDataChange();
}
