import type { FinancialItem, Financials } from "@/types/case";
import { getAmountForMonth } from "./history";

export type CaseCategory = keyof Financials;

/**
 * Calculate the total value of financial items in a category.
 * Uses historical amounts if a target date is provided.
 *
 * @param items List of financial items (resources, income, or expenses)
 * @param category The category name (used for filtering if a mixed list is provided, though usually redundant if list is pre-filtered)
 * @param targetDate The date to calculate totals for (defaults to today)
 * @returns Total amount as a number
 */
export function calculateCategoryTotal(
  items: FinancialItem[],
  targetDate: Date = new Date()
): number {
  if (!items || items.length === 0) return 0;

  return items.reduce((sum, item) => {
    return sum + getAmountForMonth(item, targetDate);
  }, 0);
}

/**
 * Calculate totals for all financial categories for a specific date.
 * 
 * @param financials The full financials object containing all categories
 * @param targetDate The date to calculate totals for
 * @returns Object containing totals for each category
 */
export function calculateFinancialTotals(
  financials: Financials,
  targetDate: Date = new Date()
): Record<CaseCategory, number> {
  return {
    resources: calculateCategoryTotal(financials.resources, targetDate),
    income: calculateCategoryTotal(financials.income, targetDate),
    expenses: calculateCategoryTotal(financials.expenses, targetDate),
  };
}
