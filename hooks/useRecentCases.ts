import { useCallback, useState } from "react";
import {
  addRecentCase,
  removeRecentCase,
  getRecentCaseIds,
  isRecentCase,
  type RecentCaseEntry,
} from "@/domain/dashboard/recentCases";

const STORAGE_KEY = "cmsnext-recent-cases";

function loadFromStorage(): RecentCaseEntry[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveToStorage(entries: RecentCaseEntry[]): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Silently fail on storage errors
  }
}

/**
 * Hook for tracking recently viewed cases.
 * Persists to localStorage, max 10 entries.
 */
export function useRecentCases() {
  const [entries, setEntries] = useState<RecentCaseEntry[]>(loadFromStorage);

  const addToRecent = useCallback((caseId: string) => {
    setEntries((prev) => {
      const updated = addRecentCase(prev, caseId, new Date().toISOString());
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const removeFromRecent = useCallback((caseId: string) => {
    setEntries((prev) => {
      const updated = removeRecentCase(prev, caseId);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setEntries([]);
    saveToStorage([]);
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
