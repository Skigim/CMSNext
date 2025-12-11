/**
 * Financial Item Data Normalization Utilities
 * ==========================================
 * Handles backward compatibility and data normalization for FinancialItem objects.
 * Centralizes fallback logic for easier maintenance and debugging.
 * 
 * @deprecated These utilities support legacy data formats.
 * Remove after nightingaleMigration.ts and dataTransform.ts are updated.
 * Target removal: Q2 2025
 * 
 * @created Phase 2 of FinancialItemCard refactoring
 * @author GitHub Copilot
 */

import { FinancialItem } from '@/types/case';

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
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `fallback-${crypto.randomUUID()}`;
  }
  return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Get the most recent date from amount history entries
 * Returns the latest startDate from the history, or null if no history
 */
const getMostRecentHistoryDate = (amountHistory?: { startDate: string }[]): string | null => {
  if (!amountHistory || amountHistory.length === 0) {
    return null;
  }
  
  // Find the entry with the most recent startDate
  const sorted = [...amountHistory].sort((a, b) => 
    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
  
  return sorted[0].startDate;
};

/**
 * Normalize financial item data with backward compatibility fallbacks
 * @deprecated Remove when legacy data migration is complete
 */
export const getNormalizedItem = (sourceItem: FinancialItem): NormalizedItem => {
  // Use most recent history entry date, fallback to dateAdded, then 'No date'
  const historyDate = getMostRecentHistoryDate(sourceItem.amountHistory);
  const displayDate = historyDate || sourceItem.dateAdded || 'No date';
  
  return {
    displayName: sourceItem.description || sourceItem.name || 'Untitled Item', // Legacy: item.name
    verificationStatus: (sourceItem.verificationStatus || 'Needs VR').toLowerCase(),
    amount: sourceItem.amount || 0,
    safeId: sourceItem.id || generateFallbackId(), // Type safety for operations
    location: sourceItem.location || '',
    accountNumber: sourceItem.accountNumber || '',
    notes: sourceItem.notes || '',
    frequency: sourceItem.frequency || '',
    verificationSource: sourceItem.verificationSource || '',
    dateAdded: displayDate
  };
};

/**
 * Normalize form data with safe string fallbacks
 * @deprecated Remove when form validation is improved
 */
export const getNormalizedFormData = (sourceFormData: FinancialItem): NormalizedFormData => ({
  description: sourceFormData.description || '',
  amount: sourceFormData.amount || '',
  location: sourceFormData.location || '',
  accountNumber: sourceFormData.accountNumber || '',
  notes: sourceFormData.notes || '',
  frequency: sourceFormData.frequency || '',
  verificationStatus: sourceFormData.verificationStatus || 'Needs VR',
  verificationSource: sourceFormData.verificationSource || ''
});