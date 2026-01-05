import { useCallback, useState } from "react";
import {
  pinCase,
  unpinCase,
  togglePin as domainTogglePin,
  isPinned as domainIsPinned,
  canPinMore as domainCanPinMore,
  getPinnedCount,
  reorderPinnedCase,
} from "@/domain/dashboard/pinnedCases";

const STORAGE_KEY = "cmsnext-pinned-cases";

function loadFromStorage(): string[] {
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

function saveToStorage(ids: string[]): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Silently fail on storage errors
  }
}

/**
 * Hook for managing pinned/favorite cases.
 * Persists to localStorage.
 */
export function usePinnedCases(maxPins: number = 20) {
  const [pinnedIds, setPinnedIds] = useState<string[]>(loadFromStorage);

  const pin = useCallback(
    (caseId: string) => {
      setPinnedIds((prev) => {
        const updated = pinCase(prev, caseId, maxPins);
        saveToStorage(updated);
        return updated;
      });
    },
    [maxPins]
  );

  const unpin = useCallback((caseId: string) => {
    setPinnedIds((prev) => {
      const updated = unpinCase(prev, caseId);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const togglePin = useCallback(
    (caseId: string) => {
      setPinnedIds((prev) => {
        const updated = domainTogglePin(prev, caseId, maxPins);
        saveToStorage(updated);
        return updated;
      });
    },
    [maxPins]
  );

  const isPinned = useCallback(
    (caseId: string) => domainIsPinned(pinnedIds, caseId),
    [pinnedIds]
  );

  const reorder = useCallback((caseId: string, newIndex: number) => {
    setPinnedIds((prev) => {
      const updated = reorderPinnedCase(prev, caseId, newIndex);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  return {
    pinnedCaseIds: pinnedIds,
    pin,
    unpin,
    togglePin,
    isPinned,
    canPinMore: domainCanPinMore(pinnedIds, maxPins),
    pinnedCount: getPinnedCount(pinnedIds),
    reorder,
  };
}
