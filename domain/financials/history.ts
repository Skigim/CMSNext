/**
 * @fileoverview Domain logic for financial amount history tracking.
 * 
 * Pure functions for managing amount history entries, detecting changes,
 * and querying historical amounts.
 */

import { v4 as uuidv4 } from "uuid";
import { parseLocalDate } from "@/domain/common/dates";
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
    const entryTimeA = getEntryStartTime(a);
    const entryTimeB = getEntryStartTime(b);

    if (entryTimeA === null && entryTimeB === null) {
      return 0;
    }

    if (entryTimeA === null) {
      return 1;
    }

    if (entryTimeB === null) {
      return -1;
    }

    return entryTimeB - entryTimeA;
  });
}

/**
 * Gets the most recent valid history entry by startDate.
 * Invalid or missing start dates are ignored.
 */
export function getLatestHistoryEntry(
  entries: AmountHistoryEntry[] | undefined
): AmountHistoryEntry | undefined {
  if (!entries?.length) {
    return undefined;
  }

  let latestEntry: AmountHistoryEntry | undefined;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const entry of entries) {
    const entryTime = getEntryStartTime(entry);

    if (entryTime === null || entryTime <= latestTime) {
      continue;
    }

    latestEntry = entry;
    latestTime = entryTime;
  }

  return latestEntry;
}

function getEntryStartTime(entry: Pick<AmountHistoryEntry, "startDate">): number | null {
  const parsedDate = parseLocalDate(entry.startDate);
  return parsedDate ? parsedDate.getTime() : null;
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
 * Sets the previous entry's endDate to the last day of the month prior to the
 * new entry's start month (e.g., new entry starts 10/01 → end date = 09/30).
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
  
  // Calculate the last day of the month prior to the new entry's start month
  const firstDayOfPriorMonth = new Date(newStart.getFullYear(), newStart.getMonth() - 1, 1);
  const endDateStr = getLastOfMonth(firstDayOfPriorMonth);
  
  return history.map(entry => {
    // Only close entries that are ongoing (no endDate) and start before new entry
    if (!entry.endDate) {
      const entryStart = new Date(entry.startDate + 'T12:00:00');
      if (!Number.isNaN(entryStart.getTime()) && entryStart < newStart) {
        // Clamp: endDate must not be earlier than the entry's own startDate
        // (can happen when new entry starts in the same month as the existing entry)
        const clampedEndDate = endDateStr < entry.startDate ? entry.startDate : endDateStr;
        return { ...entry, endDate: clampedEndDate };
      }
    }
    return entry;
  });
}

/**
 * Computes the automatic end date for a new entry based on subsequent entries.
 * If there are existing entries that start after the new entry's start date,
 * returns the last day of the month prior to the earliest such entry's start date.
 * Returns null if no later entries exist (new entry stays ongoing).
 *
 * @param history The current amount history array
 * @param newEntryStartDate The start date of the new entry being added (YYYY-MM-DD)
 * @returns End date string (YYYY-MM-DD) or null if the entry should remain ongoing
 */
export function getAutoEndDateForNewEntry(
  history: AmountHistoryEntry[],
  newEntryStartDate: string
): string | null {
  if (!history || history.length === 0) {
    return null;
  }

  const newStart = new Date(newEntryStartDate + 'T12:00:00');
  if (Number.isNaN(newStart.getTime())) {
    return null;
  }

  // Find all entries that start strictly after the new entry's start date
  const laterEntries = history.filter(entry => {
    const entryStart = new Date(entry.startDate + 'T12:00:00');
    return !Number.isNaN(entryStart.getTime()) && entryStart > newStart;
  });

  if (laterEntries.length === 0) {
    return null;
  }

  // Sort ascending to find the earliest later entry
  const sorted = [...laterEntries].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const earliestLaterStart = new Date(sorted[0].startDate + 'T12:00:00');

  // End date = last day of month prior to earliest later entry's start month
  const priorMonthFirst = new Date(earliestLaterStart.getFullYear(), earliestLaterStart.getMonth() - 1, 1);
  const candidateEnd = getLastOfMonth(priorMonthFirst);

  // Clamp so we never return an end date earlier than the new entry's start
  return candidateEnd < newEntryStartDate ? newEntryStartDate : candidateEnd;
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
