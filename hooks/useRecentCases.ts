import { useCallback, useState } from "react";
import {
  addRecentCase,
  removeRecentCase,
  getRecentCaseIds,
  isRecentCase,
  type RecentCaseEntry,
} from "@/domain/dashboard/recentCases";
import { createLocalStorageAdapter } from "@/utils/localStorage";

const storage = createLocalStorageAdapter<RecentCaseEntry[]>("cmsnext-recent-cases", []);

/**
 * Hook for tracking recently viewed cases.
 * Persists to localStorage, max 10 entries.
 */
export function useRecentCases() {
  const [entries, setEntries] = useState<RecentCaseEntry[]>(() => storage.read());

  const addToRecent = useCallback((caseId: string) => {
    setEntries((prev) => {
      const updated = addRecentCase(prev, caseId, new Date().toISOString());
      storage.write(updated);
      return updated;
    });
  }, []);

  const removeFromRecent = useCallback((caseId: string) => {
    setEntries((prev) => {
      const updated = removeRecentCase(prev, caseId);
      storage.write(updated);
      return updated;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setEntries([]);
    storage.clear();
  }, []);

  const isRecent = useCallback(
    (caseId: string) => isRecentCase(entries, caseId),
    [entries]
  );

  return {
    recentCaseIds: getRecentCaseIds(entries),
    addToRecent,
    removeFromRecent,
    clearRecent,
    isRecent,
  };
}
