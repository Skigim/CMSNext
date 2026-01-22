/**
 * @fileoverview useCaseArchival Hook
 * 
 * React hook for case archival operations with UI integration.
 * Bridges React state management and DataManager archive methods.
 * 
 * @module hooks/useCaseArchival
 */

import { useCallback, useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { DataManager } from '@/utils/DataManager';
import type { ArchiveFileInfo, RefreshQueueResult } from '@/utils/services/CaseArchiveService';
import type { CaseArchiveData, ArchiveResult, RestoreResult } from '@/types/archive';
import { createDataManagerGuard } from '@/utils/guardUtils';

const NOT_AVAILABLE_MSG = 'Data storage is not available. Please connect to a folder first.';

export interface CaseArchivalConfig {
  dataManager: DataManager | null;
  isMounted: React.MutableRefObject<boolean>;
  /** Callback to refresh case list after archive/restore operations */
  onCasesChanged?: () => void;
}

export interface CaseArchivalState {
  /** Whether an archive operation is in progress */
  isLoading: boolean;
  /** Available archive files */
  archiveFiles: ArchiveFileInfo[];
  /** Currently loaded archive (for viewing) */
  loadedArchive: CaseArchiveData | null;
  /** Number of cases pending archival review */
  pendingCount: number;
  /** Last queue refresh result */
  lastRefreshResult: RefreshQueueResult | null;
}

/**
 * React hook for case archival operations
 * 
 * Provides:
 * - `refreshQueue()`: Find and mark eligible cases for archival review
 * - `approveArchival(caseIds)`: Archive approved cases to archive file
 * - `cancelArchival(caseIds)`: Remove cases from archival queue
 * - `loadArchive(fileName)`: Load an archive file for viewing
 * - `restoreCases(fileName, caseIds)`: Restore cases from archive
 * - `refreshArchiveList()`: Reload list of available archive files
 * 
 * State:
 * - `isLoading`: Operation in progress
 * - `archiveFiles`: Available archive files
 * - `loadedArchive`: Currently loaded archive for viewing
 * - `pendingCount`: Cases pending archival review
 * 
 * @param config Configuration with dependencies
 * @returns Archive operations and state
 * 
 * @example
 * ```tsx
 * const { refreshQueue, approveArchival, pendingCount } = useCaseArchival({
 *   dataManager,
 *   isMounted: isMountedRef,
 *   onCasesChanged: () => loadCases(),
 * });
 * 
 * // On app load, refresh the queue
 * const result = await refreshQueue();
 * if (result.newlyMarked > 0) {
 *   toast.info(`${result.newlyMarked} cases pending archival review`);
 * }
 * ```
 */
export function useCaseArchival(config: CaseArchivalConfig) {
  const { dataManager, isMounted, onCasesChanged } = config;

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [archiveFiles, setArchiveFiles] = useState<ArchiveFileInfo[]>([]);
  const [loadedArchive, setLoadedArchive] = useState<CaseArchiveData | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastRefreshResult, setLastRefreshResult] = useState<RefreshQueueResult | null>(null);

  const guardDataManager = useMemo(
    () => createDataManagerGuard(dataManager, "useCaseArchival"),
    [dataManager]
  );

  const guardService = useCallback(() => {
    try {
      guardDataManager();
    } catch (error) {
      toast.error(NOT_AVAILABLE_MSG);
      return false;
    }
    return true;
  }, [guardDataManager]);

  /**
   * Refresh the archival queue by marking eligible cases as pending.
   * Shows a toast if new cases were marked.
   */
  const refreshQueue = useCallback(async (): Promise<RefreshQueueResult> => {
    if (!guardService() || !dataManager) {
      return { newlyMarked: 0, totalPending: 0, newlyMarkedIds: [] };
    }

    setIsLoading(true);

    try {
      const result = await dataManager.refreshArchivalQueue();

      if (!isMounted.current) {
        return { newlyMarked: 0, totalPending: 0, newlyMarkedIds: [] };
      }

      setPendingCount(result.totalPending);
      setLastRefreshResult(result);

      if (result.newlyMarked > 0) {
        toast.info(`${result.newlyMarked} case${result.newlyMarked === 1 ? '' : 's'} pending archival review`, {
          description: 'Review in the Archival Review tab',
          action: {
            label: 'View',
            onClick: () => {
              // This will be handled by the UI component that receives this hook
            },
          },
        });
        onCasesChanged?.();
      }

      return result;
    } catch (error) {
      if (isMounted.current) {
        const message = error instanceof Error ? error.message : 'Failed to refresh archival queue';
        toast.error(message);
      }
      return { newlyMarked: 0, totalPending: 0, newlyMarkedIds: [] };
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [guardService, dataManager, isMounted, onCasesChanged]);

  /**
   * Archive approved cases.
   */
  const approveArchival = useCallback(async (caseIds: string[]): Promise<ArchiveResult | null> => {
    if (!guardService() || !dataManager) {
      return null;
    }

    if (caseIds.length === 0) {
      toast.warning('No cases selected for archival');
      return null;
    }

    setIsLoading(true);
    const loadingId = toast.loading(`Archiving ${caseIds.length} case${caseIds.length === 1 ? '' : 's'}...`);

    try {
      const result = await dataManager.archiveApprovedCases(caseIds);

      if (!isMounted.current) return null;

      toast.dismiss(loadingId);
      toast.success(`Archived ${result.archivedCount} case${result.archivedCount === 1 ? '' : 's'}`, {
        description: `Saved to ${result.archiveFileName}`,
      });

      // Update pending count
      const newCount = await dataManager.getPendingArchivalCount();
      setPendingCount(newCount);

      // Notify parent to refresh case list
      onCasesChanged?.();

      // Refresh archive file list
      const files = await dataManager.listArchiveFiles();
      if (isMounted.current) {
        setArchiveFiles(files);
      }

      return result;
    } catch (error) {
      toast.dismiss(loadingId);
      if (isMounted.current) {
        const message = error instanceof Error ? error.message : 'Failed to archive cases';
        toast.error(message);
      }
      return null;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [guardService, dataManager, isMounted, onCasesChanged]);

  /**
   * Cancel archival for specified cases.
   */
  const cancelArchival = useCallback(async (caseIds: string[]): Promise<number> => {
    if (!guardService() || !dataManager) {
      return 0;
    }

    if (caseIds.length === 0) {
      return 0;
    }

    setIsLoading(true);

    try {
      const count = await dataManager.cancelArchival(caseIds);

      if (!isMounted.current) return 0;

      if (count > 0) {
        toast.success(`Removed ${count} case${count === 1 ? '' : 's'} from archival queue`);
        
        // Update pending count
        const newCount = await dataManager.getPendingArchivalCount();
        setPendingCount(newCount);

        onCasesChanged?.();
      }

      return count;
    } catch (error) {
      if (isMounted.current) {
        const message = error instanceof Error ? error.message : 'Failed to cancel archival';
        toast.error(message);
      }
      return 0;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [guardService, dataManager, isMounted, onCasesChanged]);

  /**
   * Refresh the list of available archive files.
   */
  const refreshArchiveList = useCallback(async (): Promise<ArchiveFileInfo[]> => {
    if (!guardService() || !dataManager) {
      return [];
    }

    try {
      const files = await dataManager.listArchiveFiles();

      if (!isMounted.current) return [];

      setArchiveFiles(files);
      return files;
    } catch (error) {
      if (isMounted.current) {
        const message = error instanceof Error ? error.message : 'Failed to list archive files';
        toast.error(message);
      }
      return [];
    }
  }, [guardService, dataManager, isMounted]);

  /**
   * Load an archive file for viewing.
   */
  const loadArchive = useCallback(async (fileName: string): Promise<CaseArchiveData | null> => {
    if (!guardService() || !dataManager) {
      return null;
    }

    setIsLoading(true);

    try {
      const archive = await dataManager.loadArchive(fileName);

      if (!isMounted.current) return null;

      setLoadedArchive(archive);

      if (archive) {
        toast.success(`Loaded archive: ${fileName}`, {
          description: `${archive.cases.length} case${archive.cases.length === 1 ? '' : 's'}`,
        });
      } else {
        toast.error(`Archive not found: ${fileName}`);
      }

      return archive;
    } catch (error) {
      if (isMounted.current) {
        const message = error instanceof Error ? error.message : 'Failed to load archive';
        toast.error(message);
        setLoadedArchive(null);
      }
      return null;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [guardService, dataManager, isMounted]);

  /**
   * Restore cases from an archive.
   */
  const restoreCases = useCallback(async (
    archiveFileName: string,
    caseIds: string[]
  ): Promise<RestoreResult | null> => {
    if (!guardService() || !dataManager) {
      return null;
    }

    if (caseIds.length === 0) {
      toast.warning('No cases selected for restoration');
      return null;
    }

    setIsLoading(true);
    const loadingId = toast.loading(`Restoring ${caseIds.length} case${caseIds.length === 1 ? '' : 's'}...`);

    try {
      const result = await dataManager.restoreFromArchive(archiveFileName, caseIds);

      if (!isMounted.current) return null;

      toast.dismiss(loadingId);
      toast.success(`Restored ${result.restoredCount} case${result.restoredCount === 1 ? '' : 's'}`, {
        description: `${result.financialsRestored} financials, ${result.notesRestored} notes`,
      });

      // Notify parent to refresh case list
      onCasesChanged?.();

      // Refresh archive file list and reload current archive
      const files = await dataManager.listArchiveFiles();
      if (isMounted.current) {
        setArchiveFiles(files);
      }

      // Reload the current archive to reflect removed cases
      const updatedArchive = await dataManager.loadArchive(archiveFileName);
      if (isMounted.current) {
        setLoadedArchive(updatedArchive);
      }

      return result;
    } catch (error) {
      toast.dismiss(loadingId);
      if (isMounted.current) {
        const message = error instanceof Error ? error.message : 'Failed to restore cases';
        toast.error(message);
      }
      return null;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [guardService, dataManager, isMounted, onCasesChanged]);

  /**
   * Clear the loaded archive from state.
   */
  const clearLoadedArchive = useCallback(() => {
    setLoadedArchive(null);
  }, []);

  /**
   * Get current pending count from service.
   */
  const refreshPendingCount = useCallback(async (): Promise<number> => {
    if (!dataManager) return 0;

    try {
      const count = await dataManager.getPendingArchivalCount();
      if (isMounted.current) {
        setPendingCount(count);
      }
      return count;
    } catch {
      return 0;
    }
  }, [dataManager, isMounted]);

  return {
    // State
    isLoading,
    archiveFiles,
    loadedArchive,
    pendingCount,
    lastRefreshResult,

    // Queue operations
    refreshQueue,
    cancelArchival,
    refreshPendingCount,

    // Archive operations
    approveArchival,
    refreshArchiveList,
    loadArchive,
    clearLoadedArchive,
    restoreCases,
  };
}

export type UseCaseArchivalReturn = ReturnType<typeof useCaseArchival>;
