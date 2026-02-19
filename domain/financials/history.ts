/**
 * @fileoverview Domain logic for financial amount history tracking.
 * 
 * Pure functions for managing amount history entries, detecting changes,
 * and querying historical amounts.
 */

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
 * Sorts history entries in reverse chronological order (most recent first).
 */
export function sortHistoryEntries(entries: AmountHistoryEntry[]): AmountHistoryEntry[] {
  return [...entries].sort((a, b) => {
    // Simple string comparison works for YYYY-MM-DD format
    return b.startDate.localeCompare(a.startDate);
  });
}

/**
 * Result from getAmountInfoForMonth with fallback indicator.
 */
export interface AmountInfo {
  /** The amount value for display */
  amount: number;
  /** The source entry if found */
  entry: AmountHistoryEntry | undefined;
  /** Whether this is a fallback to a past entry (no entry covers target date) */
  isFallback: boolean;
  /** Whether this falls back to item.amount (no history entries at all) */
  isLegacyFallback: boolean;
}

/**
 * Gets the applicable amount for a financial item for a given month.
 * Searches amountHistory for an entry that covers the target date.
 * Falls back to most recent past entry if no exact match.
 * Falls back to item.amount only if no history exists.
 * 
 * @param item The financial item
 * @param targetDate The date to get the amount for (defaults to current date)
 * @returns The applicable amount for the given date
 */
export function getAmountForMonth(
  item: FinancialItem,
  targetDate: Date = new Date()
): number {
  return getAmountInfoForMonth(item, targetDate).amount;
}

/**
 * Gets detailed amount info for a financial item for a given month.
 * Returns the amount, source entry, and whether it's a fallback.
 * 
 * Priority:
 * 1. Entry that covers the target date exactly
 * 2. Most recent past entry (with isFallback=true)
 * 3. item.amount if no history (with isLegacyFallback=true)
 * 
 * @param item The financial item
 * @param targetDate The date to get the amount for (defaults to current date)
 * @returns AmountInfo with amount, entry, and fallback indicators
 */
export function getAmountInfoForMonth(
  item: FinancialItem,
  targetDate: Date = new Date()
): AmountInfo {
  if (!item.amountHistory || item.amountHistory.length === 0) {
    return {
      amount: item.amount,
      entry: undefined,
      isFallback: false,
      isLegacyFallback: true,
    };
  }
  
  // Find the most recent entry that covers the target date
  const sortedHistory = sortHistoryEntries(item.amountHistory);
  
  for (const entry of sortedHistory) {
    if (isDateInEntryRange(entry, targetDate)) {
      return {
        amount: entry.amount,
        entry,
        isFallback: false,
        isLegacyFallback: false,
      };
    }
  }
  
  // No exact match - find most recent past entry
  const targetTime = targetDate.getTime();
  let mostRecentPastEntry: AmountHistoryEntry | undefined;
  
  for (const entry of sortedHistory) {
    const entryEnd = entry.endDate 
      ? new Date(entry.endDate + 'T23:59:59').getTime()
      : new Date(entry.startDate + 'T12:00:00').getTime();
    
    if (entryEnd < targetTime) {
      // This entry ended before target date
      mostRecentPastEntry ??= entry;
      break; // sortedHistory is reverse-chronological, so first past entry is most recent
    }
  }
  
  if (mostRecentPastEntry) {
    return {
      amount: mostRecentPastEntry.amount,
      entry: mostRecentPastEntry,
      isFallback: true,
      isLegacyFallback: false,
    };
  }
  
  // No past entries found - fall back to item.amount
  return {
    amount: item.amount,
    entry: undefined,
    isFallback: false,
    isLegacyFallback: true,
  };
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
 * Creates a new amount history entry.
 * @param amount The amount value
 * @param startDate The start date (defaults to first of current month)
 * @param options Optional end date, verification status, and verification source
 */
export function createHistoryEntry(
  amount: number,
  startDate?: string,
  options?: {
    endDate?: string | null;
    verificationStatus?: string;
    verificationSource?: string;
  }
): AmountHistoryEntry {
  return {
    id: uuidv4(),
    amount,
    startDate: startDate ?? getFirstOfMonth(),
    endDate: options?.endDate ?? null,
    verificationStatus: options?.verificationStatus,
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
 * Updates an existing history entry in a financial item's amountHistory.
 * Preserves the entry's original ID and createdAt timestamp.
 * 
 * @param history The current history entries array
 * @param entryId The ID of the entry to update
 * @param updates Partial updates to apply to the entry
 * @returns Updated history array, or the original if entryId was not found
 */
export function updateHistoryEntry(
  history: AmountHistoryEntry[],
  entryId: string,
  updates: Partial<Omit<AmountHistoryEntry, "id" | "createdAt">>
): AmountHistoryEntry[] {
  let found = false;
  const updated = history.map((entry) => {
    if (entry.id === entryId) {
      found = true;
      return { ...entry, ...updates };
    }
    return entry;
  });
  return found ? updated : history;
}

/**
 * Removes a history entry from a history array by ID.
 * 
 * @param history The current history entries array
 * @param entryId The ID of the entry to remove
 * @returns Updated history array without the deleted entry
 */
export function deleteHistoryEntry(
  history: AmountHistoryEntry[],
  entryId: string
): AmountHistoryEntry[] {
  return history.filter((entry) => entry.id !== entryId);
}

/**
 * Formats a date for display in the history modal.
 * @param dateStr Date string in YYYY-MM-DD format
 */
export function formatHistoryDate(dateStr: string | null | undefined): string {
  if (!dateStr) {
    return "Ongoing";
  }
  
  // Parse as local time by appending T12:00:00 to avoid timezone shift
  const date = new Date(dateStr + 'T12:00:00');
  if (Number.isNaN(date.getTime())) {
    return dateStr;
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
