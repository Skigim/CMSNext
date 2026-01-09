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

// Widget data processors
export {
  type DailyAlertStats,
  type DailyCaseStats,
  type StatusBreakdown,
  type AlertDescriptionStats,
  type AlertAgeStats,
  type ProcessingTimeStats,
  calculateAlertsClearedPerDay,
  calculateCasesProcessedPerDay,
  calculateTotalCasesByStatus,
  calculateTotalAlertsByDescription,
  calculateAvgAlertAge,
  calculateAvgCaseProcessingTime,
  widgetDateUtils,
} from './widgets';

// Activity report generation
export {
  toActivityDateKey,
  filterActivityEntriesByDate,
  groupActivityEntriesByDate,
  generateDailyActivityReport,
  getTopCasesForReport,
  serializeDailyActivityReport,
} from './activityReport';
