/**
 * Financial Item Data Normalization
 *
 * Pure functions for normalizing FinancialItem data with backward compatibility.
 * No I/O, no React, no side effects.
 *
 * @deprecated These utilities support legacy data formats.
 * Remove after nightingaleMigration.ts and dataTransform.ts are updated.
 * Target removal: Q2 2025
 *
 * @module domain/common/normalization
 */

import type { FinancialItem } from "@/types/case";
import { dateInputValueToISO } from "./dates";
import { getLatestHistoryEntry } from "@/domain/financials";

export interface NormalizedItem {
  displayName: string;
  verificationStatus: string;
  amount: number;
  safeId: string;
  location: string;
  accountNumber: string;
  notes: string;
  frequency: string;
  verificationSource: string;
  dateAdded: string;
}

export interface NormalizedFormData {
  description: string;
  amount: string | number;
  location: string;
  accountNumber: string;
  notes: string;
  frequency: string;
  verificationStatus: string;
  verificationSource: string;
}

/**
 * Generate a unique fallback ID
 */
const generateFallbackId = (): string => {
  // Use crypto.randomUUID if available, fallback to timestamp + random
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `fallback-${crypto.randomUUID()}`;
  }
  return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Normalize financial item data with backward compatibility fallbacks
 * @deprecated Remove when legacy data migration is complete
 */
export const getNormalizedItem = (sourceItem: FinancialItem): NormalizedItem => {
  // Use most recent history entry date, fallback to dateAdded, then 'No date'
  const historyDate = getLatestHistoryEntry(sourceItem.amountHistory)?.startDate ?? null;
  const normalizedDateAdded = dateInputValueToISO(sourceItem.dateAdded) ?? sourceItem.dateAdded;
  const displayDate = historyDate || normalizedDateAdded || "No date";

  return {
    displayName: sourceItem.description || sourceItem.name || "Untitled Item", // Legacy: item.name
    verificationStatus: (sourceItem.verificationStatus || "Needs VR").toLowerCase(),
    amount: sourceItem.amount || 0,
    safeId: sourceItem.id || generateFallbackId(), // Type safety for operations
    location: sourceItem.location || "",
    accountNumber: sourceItem.accountNumber || "",
    notes: sourceItem.notes || "",
    frequency: sourceItem.frequency || "",
    verificationSource: sourceItem.verificationSource || "",
    dateAdded: displayDate,
  };
};

/**
 * Normalize form data with safe string fallbacks
 * @deprecated Remove when form validation is improved
 */
export const getNormalizedFormData = (sourceFormData: FinancialItem): NormalizedFormData => ({
  description: sourceFormData.description || "",
  amount: sourceFormData.amount || "",
  location: sourceFormData.location || "",
  accountNumber: sourceFormData.accountNumber || "",
  notes: sourceFormData.notes || "",
  frequency: sourceFormData.frequency || "",
  verificationStatus: sourceFormData.verificationStatus || "Needs VR",
  verificationSource: sourceFormData.verificationSource || "",
});
