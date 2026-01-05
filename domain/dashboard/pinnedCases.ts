/**
 * @fileoverview Pinned Cases Domain Logic
 *
 * Pure functions for managing pinned/favorite cases.
 * Used by the dashboard to show cases the user has explicitly marked for quick access.
 *
 * Features:
 * - Pin/unpin cases
 * - Toggle pin state
 * - Optional maximum pin limit
 * - Cleanup of deleted cases
 */

/** Default maximum number of pins (unlimited) */
export const DEFAULT_MAX_PINS = Infinity;

/**
 * Add a case to the pinned list.
 * No-op if already pinned. Returns original array if at max capacity.
 *
 * @param pinnedIds - Current list of pinned case IDs
 * @param caseId - ID of the case to pin
 * @param maxPins - Maximum allowed pins (default unlimited)
 * @returns New pinned list with the case added (if not already pinned and under limit)
 *
 * @example
 * ```ts
 * const pinned = pinCase([], 'case-1');
 * // ['case-1']
 *
 * const same = pinCase(['case-1'], 'case-1');
 * // ['case-1'] - no duplicate
 * ```
 */
export function pinCase(
  pinnedIds: string[],
  caseId: string,
  maxPins: number = DEFAULT_MAX_PINS
): string[] {
  // Already pinned - no-op
  if (pinnedIds.includes(caseId)) {
    return pinnedIds;
  }

  // At capacity - cannot add more
  if (pinnedIds.length >= maxPins) {
    return pinnedIds;
  }

  // Add to end of list
  return [...pinnedIds, caseId];
}

/**
 * Remove a case from the pinned list.
 *
 * @param pinnedIds - Current list of pinned case IDs
 * @param caseId - ID of the case to unpin
 * @returns New pinned list without the specified case
 *
 * @example
 * ```ts
 * const pinned = unpinCase(['case-1', 'case-2'], 'case-1');
 * // ['case-2']
 * ```
 */
export function unpinCase(pinnedIds: string[], caseId: string): string[] {
  return pinnedIds.filter((id) => id !== caseId);
}

/**
 * Toggle the pin state for a case.
 * If pinned, unpins it. If not pinned, pins it (respecting maxPins).
 *
 * @param pinnedIds - Current list of pinned case IDs
 * @param caseId - ID of the case to toggle
 * @param maxPins - Maximum allowed pins (default unlimited)
 * @returns New pinned list with the case's pin state toggled
 *
 * @example
 * ```ts
 * let pinned = togglePin([], 'case-1');
 * // ['case-1']
 *
 * pinned = togglePin(pinned, 'case-1');
 * // []
 * ```
 */
export function togglePin(
  pinnedIds: string[],
  caseId: string,
  maxPins: number = DEFAULT_MAX_PINS
): string[] {
  if (isPinned(pinnedIds, caseId)) {
    return unpinCase(pinnedIds, caseId);
  }
  return pinCase(pinnedIds, caseId, maxPins);
}

/**
 * Check if a case is pinned.
 *
 * @param pinnedIds - List of pinned case IDs
 * @param caseId - ID of the case to check
 * @returns True if the case is pinned
 *
 * @example
 * ```ts
 * isPinned(['case-1', 'case-2'], 'case-1'); // true
 * isPinned(['case-1', 'case-2'], 'case-3'); // false
 * ```
 */
export function isPinned(pinnedIds: string[], caseId: string): boolean {
  return pinnedIds.includes(caseId);
}

/**
 * Remove any pinned IDs that no longer exist in the case list.
 * Useful for cleanup after case deletion.
 *
 * @param pinnedIds - Current list of pinned case IDs
 * @param existingCaseIds - IDs of cases that still exist
 * @returns New pinned list with only valid case IDs
 *
 * @example
 * ```ts
 * const pinned = ['case-1', 'case-2', 'case-3'];
 * const existing = ['case-1', 'case-3'];
 * const cleaned = pruneDeletedCases(pinned, existing);
 * // ['case-1', 'case-3'] - case-2 was removed
 * ```
 */
export function pruneDeletedCases(
  pinnedIds: string[],
  existingCaseIds: string[]
): string[] {
  const existingSet = new Set(existingCaseIds);
  return pinnedIds.filter((id) => existingSet.has(id));
}

/**
 * Get the count of pinned cases.
 *
 * @param pinnedIds - List of pinned case IDs
 * @returns Number of pinned cases
 */
export function getPinnedCount(pinnedIds: string[]): number {
  return pinnedIds.length;
}

/**
 * Check if more cases can be pinned (under the limit).
 *
 * @param pinnedIds - Current list of pinned case IDs
 * @param maxPins - Maximum allowed pins (default unlimited)
 * @returns True if another case can be pinned
 */
export function canPinMore(
  pinnedIds: string[],
  maxPins: number = DEFAULT_MAX_PINS
): boolean {
  return pinnedIds.length < maxPins;
}

/**
 * Reorder pinned cases by moving a case to a new position.
 * Useful for drag-and-drop reordering.
 *
 * @param pinnedIds - Current list of pinned case IDs
 * @param caseId - ID of the case to move
 * @param newIndex - Target index (0-based)
 * @returns New pinned list with the case at the new position
 *
 * @example
 * ```ts
 * const pinned = reorderPinnedCase(['a', 'b', 'c'], 'c', 0);
 * // ['c', 'a', 'b']
 * ```
 */
export function reorderPinnedCase(
  pinnedIds: string[],
  caseId: string,
  newIndex: number
): string[] {
  const currentIndex = pinnedIds.indexOf(caseId);

  // Case not found - return unchanged
  if (currentIndex === -1) {
    return pinnedIds;
  }

  // Clamp new index to valid range
  const clampedIndex = Math.max(0, Math.min(newIndex, pinnedIds.length - 1));

  // Same position - no change needed
  if (currentIndex === clampedIndex) {
    return pinnedIds;
  }

  // Create new array with case moved
  const result = [...pinnedIds];
  result.splice(currentIndex, 1);
  result.splice(clampedIndex, 0, caseId);

  return result;
}
