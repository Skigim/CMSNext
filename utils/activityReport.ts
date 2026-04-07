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
  formatReportCaseSummary,
  generateDailyActivityReport,
  getTopCasesForReport,
  isApplicationActivityType,
  serializeDailyActivityReport,
} from "@/domain/dashboard";
