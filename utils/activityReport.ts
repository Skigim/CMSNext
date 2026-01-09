/**
 * Activity Report Generation
 *
 * @deprecated Import from '@/domain/dashboard' instead.
 * This file re-exports from the domain layer for backwards compatibility.
 *
 * @module utils/activityReport
 */

export {
  toActivityDateKey,
  filterActivityEntriesByDate,
  groupActivityEntriesByDate,
  generateDailyActivityReport,
  getTopCasesForReport,
  serializeDailyActivityReport,
} from "@/domain/dashboard";
