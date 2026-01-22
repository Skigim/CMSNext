/**
 * Case Summary Generator
 *
 * All core logic has moved to @/domain/templates.
 * This file re-exports for backwards compatibility.
 */

// Re-export everything from domain/templates/summary
export {
  formatResourceItem,
  formatIncomeItem,
  formatExpenseItem,
  generateCaseSummary,
  type SummarySections,
  DEFAULT_SUMMARY_SECTIONS,
} from "@/domain/templates";
