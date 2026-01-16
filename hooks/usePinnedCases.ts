import { useCallback, useState, useEffect, useRef } from "react";
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

/** Custom event name for cross-component pin synchronization */
const PINNED_CASES_CHANGED_EVENT = "pinned-cases-changed";

/** Dispatch event to notify other hook instances of pin changes */
function notifyPinnedCasesChanged() {
  window.dispatchEvent(new CustomEvent(PINNED_CASES_CHANGED_EVENT));
}

/**
 * Hook for managing pinned/favorite cases.
 * Persists to localStorage and syncs across all hook instances via custom events.
 *
 * @param maxPins - Maximum number of cases that can be pinned (default: 20)
 * @returns Object containing:
 *   - `pinnedCaseIds` - Array of pinned case IDs in order
 *   - `pin` - Add a case to pins
 *   - `unpin` - Remove a case from pins
 *   - `togglePin` - Toggle pin state for a case
 *   - `isPinned` - Check if a case is pinned
 *   - `canPinMore` - Whether more cases can be pinned
 *   - `pinnedCount` - Current number of pinned cases
 *   - `reorder` - Move a pinned case to a new position
 *
 * @example
 * ```tsx
 * const { pinnedCaseIds, pin, unpin, isPinned } = usePinnedCases();
 *
 * // Pin a case
 * pin("case-123");
 *
 * // Check if pinned
 * if (isPinned("case-123")) {
 *   unpin("case-123");
 * }
 * ```
 */
export function usePinnedCases(maxPins: number = 20) {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => storage.read());
  // Track whether we're the source of the current update to avoid re-reading our own change
  const isOwnUpdate = useRef(false);

  // Listen for changes from other hook instances
  useEffect(() => {
    const handlePinnedCasesChanged = () => {
      // Skip if we triggered this event ourselves
      if (isOwnUpdate.current) {
        isOwnUpdate.current = false;
        return;
      }
      setPinnedIds(storage.read());
    };

    window.addEventListener(PINNED_CASES_CHANGED_EVENT, handlePinnedCasesChanged);
    return () => {
      window.removeEventListener(PINNED_CASES_CHANGED_EVENT, handlePinnedCasesChanged);
    };
  }, []);

  const pin = useCallback(
    (caseId: string) => {
      setPinnedIds((prev) => {
        const updated = pinCase(prev, caseId, maxPins);
        storage.write(updated);
        isOwnUpdate.current = true;
        notifyPinnedCasesChanged();
        return updated;
      });
    },
    [maxPins]
  );

  const unpin = useCallback((caseId: string) => {
    setPinnedIds((prev) => {
      const updated = unpinCase(prev, caseId);
      storage.write(updated);
      isOwnUpdate.current = true;
      notifyPinnedCasesChanged();
      return updated;
    });
  }, []);

  const togglePin = useCallback(
    (caseId: string) => {
      setPinnedIds((prev) => {
        const updated = domainTogglePin(prev, caseId, maxPins);
        storage.write(updated);
        isOwnUpdate.current = true;
        notifyPinnedCasesChanged();
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
      isOwnUpdate.current = true;
      notifyPinnedCasesChanged();
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
