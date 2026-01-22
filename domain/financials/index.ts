/**
 * Domain Layer: Financials Module
 *
 * Pure business logic for financial calculations and validation.
 * No I/O, no React, no side effects.
 *
 * @module domain/financials
 */

export {
  validateFinancialItem,
  type FinancialValidationResult,
  type FinancialItemInput,
} from "./validation";

export {
  calculateCategoryTotal,
  calculateFinancialTotals,
  type CaseCategory,
} from "./calculations";

export {
  getFirstOfMonth,
  getLastOfMonth,
  isDateInEntryRange,
  sortHistoryEntries,
  getAmountForMonth,
  getEntryForMonth,
  /**
   * Adds a new history entry to a financial item, auto-closing previous ongoing entries.
   */
  addHistoryEntryToItem,
  /**
   * Formats a date for display in the history modal.
   */
  formatHistoryDate,
  /**
   * Formats a date as "Month YYYY" for month-based display.
   */
  formatMonthYear,
  createHistoryEntry,
  closePreviousOngoingEntry,
} from "./history";

export {
  type VerificationStatusInfo,
  getVerificationStatusDotColor,
  getVerificationStatusInfo,
  shouldShowVerificationSource,
} from "./verification";
