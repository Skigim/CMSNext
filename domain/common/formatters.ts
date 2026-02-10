/**
 * Financial & Address Formatting Utilities
 *
 * Pure functions for formatting currency, frequency, account numbers, and addresses.
 *
 * @module domain/common/formatters
 */

import type { Address, MailingAddress } from "@/types/case";

/**
 * Format currency amounts using US locale
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

/**
 * Format frequency display for income/expense items
 */
export const formatFrequency = (frequency?: string): string => {
  const frequencyMap: Record<string, string> = {
    monthly: "/mo",
    yearly: "/yr",
    weekly: "/wk",
    daily: "/day",
    "one-time": " (1x)",
  };
  return frequency ? frequencyMap[frequency] || "" : "";
};

/**
 * Format account number to show only last 4 digits
 */
export const formatAccountNumber = (accountNumber?: string): string => {
  if (!accountNumber) return "";
  const digits = accountNumber.replace(/\D/g, ""); // Remove non-digits

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
export const getDisplayAmount = (
  amount: number,
  frequency?: string,
  itemType?: string
): string => {
  const baseAmount = formatCurrency(amount);

  // Only show frequency for income and expense items, not resources
  if (frequency && itemType !== "resources") {
    return baseAmount + formatFrequency(frequency);
  }

  return baseAmount;
};

/**
 * Format an address to a single-line display string.
 *
 * Includes the optional apt/unit field when present.
 * Returns `null` if the address has no street value.
 *
 * @example
 * formatAddress({ street: "123 Main St", apt: "4B", city: "NY", state: "NY", zip: "10001" })
 * // "123 Main St, Apt 4B, NY, NY 10001"
 */
export const formatAddress = (
  address: Address | MailingAddress,
): string | null => {
  if (!address.street) return null;
  const parts = [address.street];
  if (address.apt) parts.push(`Apt ${address.apt}`);
  parts.push(`${address.city}, ${address.state} ${address.zip}`);
  return parts.join(", ");
};

/**
 * Format a mailing address, returning `null` when "same as physical" is checked.
 */
export const formatMailingAddress = (
  mailingAddress: MailingAddress,
): string | null => {
  if (mailingAddress.sameAsPhysical) return null;
  return formatAddress(mailingAddress);
};
