import { v4 as uuidv4 } from "uuid";
import type { AmountHistoryEntry, FinancialItem } from "@/types/case";

/**
 * Returns the first day of the given month as a date string (YYYY-MM-DD).
 * @param date The date to get the first of month for (defaults to current date)
 */
export function getFirstOfMonth(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * Returns the last day of the given month as a date string (YYYY-MM-DD).
 * @param date The date to get the last of month for
 */
export function getLastOfMonth(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  // Day 0 of next month = last day of current month
  const lastDay = new Date(year, month + 1, 0);
  const monthStr = String(lastDay.getMonth() + 1).padStart(2, '0');
  const dayStr = String(lastDay.getDate()).padStart(2, '0');
  return `${lastDay.getFullYear()}-${monthStr}-${dayStr}`;
}

/**
 * Checks if a date falls within a history entry's date range.
 * @param entry The amount history entry
 * @param targetDate The date to check (defaults to current date)
 */
export function isDateInEntryRange(
  entry: AmountHistoryEntry,
  targetDate: Date = new Date()
): boolean {
  // Parse dates at noon to avoid any timezone edge cases
  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 12, 0, 0);
  const start = new Date(entry.startDate + 'T12:00:00');
  
  if (Number.isNaN(start.getTime()) || target < start) {
    return false;
  }
  
  // No end date means ongoing
  if (!entry.endDate) {
    return true;
  }
  
  const end = new Date(entry.endDate + 'T12:00:00');
  if (Number.isNaN(end.getTime())) {
    return true; // Invalid end date treated as ongoing
  }
  
  return target <= end;
}

/**
 * Gets the applicable amount for a financial item for a given month.
 * Searches amountHistory for an entry that covers the target date.
 * Falls back to item.amount if no matching entry exists.
 * 
 * @param item The financial item
 * @param targetDate The date to get the amount for (defaults to current date)
 * @returns The applicable amount for the given date
 */
export function getAmountForMonth(
  item: FinancialItem,
  targetDate: Date = new Date()
): number {
  if (!item.amountHistory || item.amountHistory.length === 0) {
    return item.amount;
  }
  
  // Find the most recent entry that covers the target date
  const sortedHistory = sortHistoryEntries(item.amountHistory);
  
  for (const entry of sortedHistory) {
    if (isDateInEntryRange(entry, targetDate)) {
      return entry.amount;
    }
  }
  
  // No matching entry found, fall back to item.amount
  return item.amount;
}

/**
 * Gets the history entry that applies for a given month.
 * Returns undefined if no matching entry exists.
 */
export function getEntryForMonth(
  item: FinancialItem,
  targetDate: Date = new Date()
): AmountHistoryEntry | undefined {
  if (!item.amountHistory || item.amountHistory.length === 0) {
    return undefined;
  }
  
  const sortedHistory = sortHistoryEntries(item.amountHistory);
  
  for (const entry of sortedHistory) {
    if (isDateInEntryRange(entry, targetDate)) {
      return entry;
    }
  }
  
  return undefined;
}

/**
 * Sorts history entries in reverse chronological order (most recent first).
 */
export function sortHistoryEntries(entries: AmountHistoryEntry[]): AmountHistoryEntry[] {
  return [...entries].sort((a, b) => {
    // Simple string comparison works for YYYY-MM-DD format
    return b.startDate.localeCompare(a.startDate);
  });
}

/**
 * Creates a new amount history entry.
 * @param amount The amount value
 * @param startDate The start date (defaults to first of current month)
 * @param options Optional end date and verification source
 */
export function createHistoryEntry(
  amount: number,
  startDate?: string,
  options?: {
    endDate?: string | null;
    verificationSource?: string;
  }
): AmountHistoryEntry {
  return {
    id: uuidv4(),
    amount,
    startDate: startDate ?? getFirstOfMonth(),
    endDate: options?.endDate ?? null,
    verificationSource: options?.verificationSource,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Finds and closes the previous ongoing entry when adding a new one.
 * Sets the previous entry's endDate to the day before the new entry's startDate.
 * 
 * @param history The current amount history array
 * @param newEntryStartDate The start date of the new entry being added (YYYY-MM-DD)
 * @returns Updated history array with previous ongoing entry closed
 */
export function closePreviousOngoingEntry(
  history: AmountHistoryEntry[],
  newEntryStartDate: string
): AmountHistoryEntry[] {
  if (!history || history.length === 0) {
    return history;
  }
  
  // Parse the new start date
  const newStart = new Date(newEntryStartDate + 'T12:00:00');
  if (Number.isNaN(newStart.getTime())) {
    return history;
  }
  
  // Calculate day before new start date
  const dayBefore = new Date(newStart);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const endDateStr = `${dayBefore.getFullYear()}-${String(dayBefore.getMonth() + 1).padStart(2, '0')}-${String(dayBefore.getDate()).padStart(2, '0')}`;
  
  return history.map(entry => {
    // Only close entries that are ongoing (no endDate) and start before new entry
    if (!entry.endDate) {
      const entryStart = new Date(entry.startDate + 'T12:00:00');
      if (!Number.isNaN(entryStart.getTime()) && entryStart < newStart) {
        return { ...entry, endDate: endDateStr };
      }
    }
    return entry;
  });
}

/**
 * Adds a new history entry to a financial item, auto-closing previous ongoing entries.
 * Also updates the item's top-level amount if the new entry is the most recent.
 * 
 * @param item The financial item to update
 * @param newEntry The new history entry to add
 * @returns Updated financial item with new history entry
 */
export function addHistoryEntryToItem(
  item: FinancialItem,
  newEntry: AmountHistoryEntry
): FinancialItem {
  const existingHistory = item.amountHistory ?? [];
  
  // Close any previous ongoing entries
  const updatedHistory = closePreviousOngoingEntry(existingHistory, newEntry.startDate);
  
  // Add new entry
  const newHistory = [...updatedHistory, newEntry];
  
  // Determine if new entry is the "current" one (applies to today)
  const currentAmount = getAmountForMonth({ ...item, amountHistory: newHistory });
  
  return {
    ...item,
    amount: currentAmount,
    amountHistory: newHistory,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Formats a date for display in the history modal.
 */
export function formatHistoryDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return "Ongoing";
  }
  
  // Parse as local time by appending T12:00:00 to avoid timezone shift
  const date = new Date(isoDate + 'T12:00:00');
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats a date as "Month YYYY" for month-based display.
 */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
