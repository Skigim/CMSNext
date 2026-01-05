/**
 * @fileoverview Recent Cases Domain Logic
 *
 * Pure functions for tracking recently viewed cases.
 * Used by the dashboard to show cases the user has recently accessed.
 *
 * Features:
 * - Track case views with timestamps
 * - Maintain a bounded list (default 10 entries)
 * - Automatic deduplication (viewing same case moves it to front)
 * - Age-based pruning (default 30 days)
 */

/**
 * Entry representing a recently viewed case
 */
export interface RecentCaseEntry {
  /** Unique identifier of the case */
  caseId: string;
  /** ISO 8601 timestamp when the case was viewed */
  viewedAt: string;
}

/** Default maximum number of recent entries to keep */
export const DEFAULT_MAX_ENTRIES = 10;

/** Default maximum age in days before entries are pruned */
export const DEFAULT_MAX_AGE_DAYS = 30;

/**
 * Add a case to the recent list, moving it to front if already present.
 * Maintains max entries, dropping oldest when exceeded.
 *
 * @param recentList - Current list of recent case entries
 * @param caseId - ID of the case being viewed
 * @param viewedAt - ISO timestamp of when the case was viewed
 * @param maxEntries - Maximum entries to keep (default 10)
 * @returns New recent list with the case at the front
 *
 * @example
 * ```ts
 * const list = addRecentCase([], 'case-1', '2024-01-15T10:00:00.000Z');
 * // [{ caseId: 'case-1', viewedAt: '2024-01-15T10:00:00.000Z' }]
 * ```
 */
export function addRecentCase(
  recentList: RecentCaseEntry[],
  caseId: string,
  viewedAt: string,
  maxEntries: number = DEFAULT_MAX_ENTRIES
): RecentCaseEntry[] {
  // Remove existing entry for this case (if present)
  const filtered = recentList.filter((entry) => entry.caseId !== caseId);

  // Add new entry at the front
  const newEntry: RecentCaseEntry = { caseId, viewedAt };
  const updated = [newEntry, ...filtered];

  // Trim to max entries
  return updated.slice(0, maxEntries);
}

/**
 * Remove a case from the recent list.
 * Typically called when a case is deleted.
 *
 * @param recentList - Current list of recent case entries
 * @param caseId - ID of the case to remove
 * @returns New recent list without the specified case
 *
 * @example
 * ```ts
 * const list = [{ caseId: 'case-1', viewedAt: '...' }];
 * const updated = removeRecentCase(list, 'case-1');
 * // []
 * ```
 */
export function removeRecentCase(
  recentList: RecentCaseEntry[],
  caseId: string
): RecentCaseEntry[] {
  return recentList.filter((entry) => entry.caseId !== caseId);
}

/**
 * Get recent case IDs in order (most recent first).
 * Useful for quick lookups without full entry data.
 *
 * @param recentList - List of recent case entries
 * @returns Array of case IDs in most-recent-first order
 *
 * @example
 * ```ts
 * const ids = getRecentCaseIds([
 *   { caseId: 'case-2', viewedAt: '2024-01-15T11:00:00.000Z' },
 *   { caseId: 'case-1', viewedAt: '2024-01-15T10:00:00.000Z' },
 * ]);
 * // ['case-2', 'case-1']
 * ```
 */
export function getRecentCaseIds(recentList: RecentCaseEntry[]): string[] {
  return recentList.map((entry) => entry.caseId);
}

/**
 * Prune entries older than a threshold.
 * Removes entries where viewedAt is older than maxAgeDays from now.
 *
 * @param recentList - List of recent case entries
 * @param maxAgeDays - Maximum age in days (default 30)
 * @param now - Current date (for testing, defaults to now)
 * @returns New list with old entries removed
 *
 * @example
 * ```ts
 * const list = [
 *   { caseId: 'case-1', viewedAt: '2024-01-01T00:00:00.000Z' }, // old
 *   { caseId: 'case-2', viewedAt: '2024-01-15T00:00:00.000Z' }, // recent
 * ];
 * // If today is 2024-01-20, pruning with 7 days keeps only case-2
 * const pruned = pruneOldEntries(list, 7, new Date('2024-01-20'));
 * ```
 */
export function pruneOldEntries(
  recentList: RecentCaseEntry[],
  maxAgeDays: number = DEFAULT_MAX_AGE_DAYS,
  now: Date = new Date()
): RecentCaseEntry[] {
  const cutoffMs = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;

  return recentList.filter((entry) => {
    const viewedTime = new Date(entry.viewedAt).getTime();
    // Keep entries that are newer than the cutoff
    return viewedTime >= cutoffMs;
  });
}

/**
 * Check if a case is in the recent list.
 *
 * @param recentList - List of recent case entries
 * @param caseId - ID of the case to check
 * @returns True if the case is in the recent list
 */
export function isRecentCase(
  recentList: RecentCaseEntry[],
  caseId: string
): boolean {
  return recentList.some((entry) => entry.caseId === caseId);
}

/**
 * Remove any entries for cases that no longer exist.
 * Useful for cleanup after bulk case deletions.
 *
 * @param recentList - List of recent case entries
 * @param existingCaseIds - IDs of cases that still exist
 * @returns New list with only valid case entries
 */
export function pruneDeletedCases(
  recentList: RecentCaseEntry[],
  existingCaseIds: string[]
): RecentCaseEntry[] {
  const existingSet = new Set(existingCaseIds);
  return recentList.filter((entry) => existingSet.has(entry.caseId));
}
