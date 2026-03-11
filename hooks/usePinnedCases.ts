import { useCallback, useState, useEffect, useRef } from "react";
import {
  pinCase,
  unpinCase,
  isPinned as domainIsPinned,
  canPinMore as domainCanPinMore,
  getPinnedCount,
  reorderPinnedCase,
  pruneDeletedCases,
} from "@/domain/dashboard/pinnedCases";
import { createLocalStorageAdapter } from "@/utils/localStorage";
import { createLogger } from "@/utils/logger";
import { sanitizePinReason } from "@/utils/pinnedCaseReason";

const logger = createLogger("usePinnedCases");
const storage = createLocalStorageAdapter<string[]>("cmsnext-pinned-cases", []);
const pinReasonStorage = createLocalStorageAdapter<Record<string, string>>(
  "cmsnext-pinned-case-reasons",
  {},
  {
    parse: (value) => {
      let parsedValue: unknown;

      try {
        parsedValue = JSON.parse(value);
      } catch (error) {
        logger.warn("Failed to parse pinned case reasons from localStorage", { error });
        return {};
      }

      if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
        logger.warn("Discarded invalid pinned case reasons payload from localStorage", {
          parsedValueType: Array.isArray(parsedValue) ? "array" : typeof parsedValue,
        });
        return {};
      }

      let filteredReasonCount = 0;
      const parsedReasons = Object.fromEntries(
        Object.entries(parsedValue).flatMap(([caseId, reason]) => {
          if (typeof reason !== "string") {
            filteredReasonCount += 1;
            return [];
          }

          const normalizedReason = sanitizePinReason(reason);
          if (!normalizedReason) {
            filteredReasonCount += 1;
            return [];
          }

          return [[caseId, normalizedReason]];
        })
      );

      if (filteredReasonCount > 0) {
        logger.warn("Discarded invalid pinned case reasons from localStorage", {
          filteredReasonCount,
        });
      }

      return parsedReasons;
    },
  }
);

/** Custom event name for cross-component pin synchronization */
const PINNED_CASES_CHANGED_EVENT = "pinned-cases-changed";

interface PinnedCasesState {
  pinnedIds: string[];
  pinReasons: Record<string, string>;
}

/** Dispatch event to notify other hook instances of pin changes */
function notifyPinnedCasesChanged() {
  globalThis.dispatchEvent(new CustomEvent(PINNED_CASES_CHANGED_EVENT));
}

function readPinnedCasesState(): PinnedCasesState {
  return {
    pinnedIds: storage.read(),
    pinReasons: pinReasonStorage.read(),
  };
}

function updatePinReason(
  pinReasons: Record<string, string>,
  caseId: string,
  reason?: string
): Record<string, string> {
  const nextReason = sanitizePinReason(reason);
  return nextReason
    ? { ...pinReasons, [caseId]: nextReason }
    : removePinReason(pinReasons, caseId);
}

function buildPinnedStateForPin(
  prev: PinnedCasesState,
  caseId: string,
  maxPins: number,
  reason?: string
): PinnedCasesState | null {
  const updatedIds = pinCase(prev.pinnedIds, caseId, maxPins);
  const wasPinned = domainIsPinned(prev.pinnedIds, caseId);
  const isNowPinned = domainIsPinned(updatedIds, caseId);

  if (wasPinned || !isNowPinned) {
    return null;
  }

  return {
    pinnedIds: updatedIds,
    pinReasons: updatePinReason(prev.pinReasons, caseId, reason),
  };
}

function persistPinnedCasesState(state: PinnedCasesState): void {
  storage.write(state.pinnedIds);
  pinReasonStorage.write(state.pinReasons);
}

function removePinReason(
  pinReasons: Record<string, string>,
  caseId: string
): Record<string, string> {
  if (!(caseId in pinReasons)) {
    return pinReasons;
  }

  const nextReasons = { ...pinReasons };
  delete nextReasons[caseId];
  return nextReasons;
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
 *   - `getPinReason` - Get the optional reason associated with a pinned case
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
  const [state, setState] = useState<PinnedCasesState>(() => readPinnedCasesState());
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
      setState(readPinnedCasesState());
    };

    globalThis.addEventListener(PINNED_CASES_CHANGED_EVENT, handlePinnedCasesChanged);
    return () => {
      globalThis.removeEventListener(PINNED_CASES_CHANGED_EVENT, handlePinnedCasesChanged);
    };
  }, []);

  const pin = useCallback(
    (caseId: string, reason?: string) => {
      setState((prev) => {
        const nextState = buildPinnedStateForPin(prev, caseId, maxPins, reason);
        if (!nextState) {
          return prev;
        }

        persistPinnedCasesState(nextState);
        isOwnUpdate.current = true;
        notifyPinnedCasesChanged();
        return nextState;
      });
    },
    [maxPins]
  );

  const unpin = useCallback((caseId: string) => {
    setState((prev) => {
      if (!domainIsPinned(prev.pinnedIds, caseId)) {
        return prev;
      }

      const updatedIds = unpinCase(prev.pinnedIds, caseId);
      const updatedReasons = removePinReason(prev.pinReasons, caseId);

      persistPinnedCasesState({
        pinnedIds: updatedIds,
        pinReasons: updatedReasons,
      });
      isOwnUpdate.current = true;
      notifyPinnedCasesChanged();
      return {
        pinnedIds: updatedIds,
        pinReasons: updatedReasons,
      };
    });
  }, []);

  const togglePin = useCallback(
    (caseId: string, reason?: string) => {
      setState((prev) => {
        if (domainIsPinned(prev.pinnedIds, caseId)) {
          const updatedIds = unpinCase(prev.pinnedIds, caseId);
          const updatedReasons = removePinReason(prev.pinReasons, caseId);

          persistPinnedCasesState({
            pinnedIds: updatedIds,
            pinReasons: updatedReasons,
          });
          isOwnUpdate.current = true;
          notifyPinnedCasesChanged();
          return {
            pinnedIds: updatedIds,
            pinReasons: updatedReasons,
          };
        }

        const nextState = buildPinnedStateForPin(prev, caseId, maxPins, reason);
        if (!nextState) {
          return prev;
        }

        persistPinnedCasesState(nextState);
        isOwnUpdate.current = true;
        notifyPinnedCasesChanged();
        return nextState;
      });
    },
    [maxPins]
  );

  const isPinned = useCallback(
    (caseId: string) => domainIsPinned(state.pinnedIds, caseId),
    [state.pinnedIds]
  );

  const getPinReason = useCallback(
    (caseId: string): string | undefined => state.pinReasons[caseId],
    [state.pinReasons]
  );

  const reorder = useCallback((caseId: string, newIndex: number) => {
    setState((prev) => {
      const updatedIds = reorderPinnedCase(prev.pinnedIds, caseId, newIndex);
      if (updatedIds === prev.pinnedIds) {
        return prev;
      }

      persistPinnedCasesState({
        pinnedIds: updatedIds,
        pinReasons: prev.pinReasons,
      });
      isOwnUpdate.current = true;
      notifyPinnedCasesChanged();
      return {
        pinnedIds: updatedIds,
        pinReasons: prev.pinReasons,
      };
    });
  }, []);

  /**
   * Remove pinned IDs that no longer exist in the given valid set.
   * Call this after archival, deletion, or any operation that removes cases.
   */
  const pruneStale = useCallback((validCaseIds: string[]) => {
    setState((prev) => {
      const updatedIds = pruneDeletedCases(prev.pinnedIds, validCaseIds);
      const validCaseIdsSet = new Set(validCaseIds);
      const updatedReasons = Object.fromEntries(
        Object.entries(prev.pinReasons).filter(([caseId]) => validCaseIdsSet.has(caseId))
      );

      if (
        updatedIds.length === prev.pinnedIds.length &&
        Object.keys(updatedReasons).length === Object.keys(prev.pinReasons).length
      ) {
        return prev; // No stale entries — skip write
      }

      persistPinnedCasesState({
        pinnedIds: updatedIds,
        pinReasons: updatedReasons,
      });
      isOwnUpdate.current = true;
      notifyPinnedCasesChanged();
      return {
        pinnedIds: updatedIds,
        pinReasons: updatedReasons,
      };
    });
  }, []);

  return {
    pinnedCaseIds: state.pinnedIds,
    pin,
    unpin,
    togglePin,
    isPinned,
    getPinReason,
    canPinMore: domainCanPinMore(state.pinnedIds, maxPins),
    pinnedCount: getPinnedCount(state.pinnedIds),
    reorder,
    pruneStale,
  };
}
