/**
 * @fileoverview Dashboard Domain Module
 * 
 * Exports pure domain logic for dashboard features.
 */

export * from './priorityQueue';

// Recent cases - rename pruneDeletedCases to avoid collision
export {
  addRecentCase,
  removeRecentCase,
  getRecentCaseIds,
  pruneOldEntries,
  isRecentCase,
  pruneDeletedCases as pruneDeletedRecentCases,
  type RecentCaseEntry,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MAX_AGE_DAYS,
} from './recentCases';

// Pinned cases - rename pruneDeletedCases to avoid collision  
export {
  pinCase,
  unpinCase,
  togglePin,
  isPinned,
  pruneDeletedCases as pruneDeletedPinnedCases,
  getPinnedCount,
  canPinMore,
  reorderPinnedCase,
  DEFAULT_MAX_PINS,
} from './pinnedCases';
