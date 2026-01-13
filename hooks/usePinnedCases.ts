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
import { createLocalStorageAdapter } from "@/utils/localStorage";

const storage = createLocalStorageAdapter<string[]>("cmsnext-pinned-cases", []);

/**
 * Hook for managing pinned/favorite cases.
 * Persists to localStorage.
 */
export function usePinnedCases(maxPins: number = 20) {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => storage.read());

  const pin = useCallback(
    (caseId: string) => {
      setPinnedIds((prev) => {
        const updated = pinCase(prev, caseId, maxPins);
        storage.write(updated);
        return updated;
      });
    },
    [maxPins]
  );

  const unpin = useCallback((caseId: string) => {
    setPinnedIds((prev) => {
      const updated = unpinCase(prev, caseId);
      storage.write(updated);
      return updated;
    });
  }, []);

  const togglePin = useCallback(
    (caseId: string) => {
      setPinnedIds((prev) => {
        const updated = domainTogglePin(prev, caseId, maxPins);
        storage.write(updated);
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
      storage.write(updated);
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
