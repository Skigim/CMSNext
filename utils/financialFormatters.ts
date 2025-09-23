/**
 * Financial Item Formatting Utilities
 * ==================================
 * Extracted from FinancialItemCard component for reusability.
 * These utilities handle currency, frequency, and account number formatting.
 * 
 * @created Phase 2 of FinancialItemCard refactoring
 * @author GitHub Copilot
 */

/**
 * Format currency amounts using US locale
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

/**
 * Format frequency display for income/expense items
 */
export const formatFrequency = (frequency?: string): string => {
  const frequencyMap: Record<string, string> = {
    monthly: '/mo',
    yearly: '/yr',
    weekly: '/wk',
    daily: '/day',
    'one-time': ' (1x)',
  };
  return frequency ? frequencyMap[frequency] || '' : '';
};

/**
 * Format account number to show only last 4 digits
 */
export const formatAccountNumber = (accountNumber?: string): string => {
  if (!accountNumber) return '';
  const digits = accountNumber.replace(/\D/g, ''); // Remove non-digits
  
  if (digits.length < 4) {
    // For short account numbers, show as-is to avoid confusion
    return digits;
  }
  // Mask all but last 4 digits
  return `****${digits.slice(-4)}`;
};

/**
 * Safe numeric input parsing with fallback
 */
export const parseNumericInput = (value: string): number => {
  return parseFloat(value) || 0;
};

/**
 * Get display amount with frequency (for financial items)
 */
export const getDisplayAmount = (amount: number, frequency?: string, itemType?: string): string => {
  const baseAmount = formatCurrency(amount);

  // Only show frequency for income and expense items, not resources
  if (frequency && itemType !== 'resources') {
    return baseAmount + formatFrequency(frequency);
  }

  return baseAmount;
};