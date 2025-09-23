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

import { FinancialItem } from '../types/case';

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
 * Normalize financial item data with backward compatibility fallbacks
 * @deprecated Remove when legacy data migration is complete
 */
export const getNormalizedItem = (sourceItem: FinancialItem): NormalizedItem => ({
  displayName: sourceItem.description || sourceItem.name || 'Untitled Item', // Legacy: item.name
  verificationStatus: (sourceItem.verificationStatus || 'Needs VR').toLowerCase(),
  amount: sourceItem.amount || 0,
  safeId: sourceItem.id || generateFallbackId(), // Type safety for operations
  location: sourceItem.location || '',
  accountNumber: sourceItem.accountNumber || '',
  notes: sourceItem.notes || '',
  frequency: sourceItem.frequency || '',
  verificationSource: sourceItem.verificationSource || '',
  dateAdded: sourceItem.dateAdded || 'No date'
});

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
  verificationSource: sourceFormData.verificationSource || ''
});