/**
 * MIGRATION: Financial items without history entries
 * 
 * This file handles auto-migration of financial items that have an amount
 * but no amountHistory entries. These are items created before the history
 * feature or created inline without going through the proper flow.
 * 
 * Migration:
 * - If item has amount > 0 and no amountHistory, create a history entry
 * - Copy item-level verificationStatus and verificationSource to the entry
 * - Use item.createdAt or item.dateAdded as startDate for the entry
 * 
 * Migration date: January 2026
 */

import { v4 as uuidv4 } from "uuid";
import type { AmountHistoryEntry, FinancialItem } from "@/types/case";
import type { StoredFinancialItem } from "./services/FileStorageService";
import { getFirstOfMonth } from "@/domain/financials";

/**
 * Check if a financial item needs migration (has amount but no history entries).
 */
export function needsHistoryMigration(item: FinancialItem | StoredFinancialItem): boolean {
  const hasAmount = item.amount !== undefined && item.amount !== 0;
  const hasHistory = item.amountHistory && item.amountHistory.length > 0;
  return hasAmount && !hasHistory;
}

/**
 * Determine the start date for a migrated history entry.
 * Uses the item's creation date, falling back to first of current month.
 */
function getStartDateForMigration(item: FinancialItem | StoredFinancialItem): string {
  // Try to use createdAt first
  if (item.createdAt) {
    const date = new Date(item.createdAt);
    if (!Number.isNaN(date.getTime())) {
      return getFirstOfMonth(date);
    }
  }
  
  // Fall back to dateAdded
  if (item.dateAdded) {
    const date = new Date(item.dateAdded);
    if (!Number.isNaN(date.getTime())) {
      return getFirstOfMonth(date);
    }
  }
  
  // Default to first of current month
  return getFirstOfMonth();
}

/**
 * Migrate a single financial item by creating a history entry from its current amount.
 * Clears deprecated item-level dynamic fields after migration.
 * Returns the migrated item, or the original if no migration needed.
 */
export function migrateFinancialItem<T extends FinancialItem | StoredFinancialItem>(
  item: T
): T {
  if (!needsHistoryMigration(item)) {
    return item;
  }
  
  const startDate = getStartDateForMigration(item);
  
  const historyEntry: AmountHistoryEntry = {
    id: uuidv4(),
    amount: item.amount,
    startDate,
    endDate: null,
    verificationStatus: item.verificationStatus,
    verificationSource: item.verificationSource,
    createdAt: item.createdAt ?? new Date().toISOString(),
  };
  
  // Clear deprecated item-level dynamic fields after migrating to entry-level
  return {
    ...item,
    amountHistory: [historyEntry],
    // Set amount to 0 since it's now stored in entries
    amount: 0,
    // Clear item-level verification (now per-entry)
    verificationStatus: "Needs VR",
    verificationSource: undefined,
  };
}

/**
 * Migrate an array of financial items, creating history entries where needed.
 * Returns a tuple of [migratedItems, migrationCount].
 */
export function migrateFinancialItems<T extends FinancialItem | StoredFinancialItem>(
  items: T[]
): [T[], number] {
  let migrationCount = 0;
  
  const migratedItems = items.map(item => {
    if (needsHistoryMigration(item)) {
      migrationCount++;
      return migrateFinancialItem(item);
    }
    return item;
  });
  
  return [migratedItems, migrationCount];
}

/**
 * Check if any items in an array need migration.
 */
export function hasItemsNeedingMigration(
  items: Array<FinancialItem | StoredFinancialItem>
): boolean {
  return items.some(needsHistoryMigration);
}
