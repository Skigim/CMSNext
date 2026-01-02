/**
 * Financial Item Validation
 *
 * Pure validation functions for financial item form data.
 * No I/O, no React, no side effects.
 *
 * @module domain/financials/validation
 */

/**
 * Validation result for a financial item.
 */
export interface FinancialValidationResult {
  /** Whether the data is valid */
  isValid: boolean;
  /** Error messages keyed by field name */
  errors: Record<string, string>;
}

/**
 * Input data for financial item validation.
 * Matches the form data structure from useFinancialItemFlow.
 */
export interface FinancialItemInput {
  description: string;
  amount: number;
  verificationStatus: string;
  verificationSource: string;
}

/**
 * Validates financial item form data.
 *
 * Business Rules:
 * - Description is required (non-empty after trim)
 * - Amount cannot be negative
 * - When verificationStatus is "Verified", verificationSource is required
 *
 * @param data - The financial item data to validate
 * @returns Validation result with isValid flag and field-level errors
 *
 * @example
 * ```typescript
 * const result = validateFinancialItem({
 *   description: "Savings Account",
 *   amount: 1000,
 *   verificationStatus: "Verified",
 *   verificationSource: "Bank Statement"
 * });
 * // { isValid: true, errors: {} }
 *
 * const invalid = validateFinancialItem({
 *   description: "",
 *   amount: -100,
 *   verificationStatus: "Verified",
 *   verificationSource: ""
 * });
 * // { isValid: false, errors: { description: "...", amount: "...", verificationSource: "..." } }
 * ```
 */
export function validateFinancialItem(
  data: FinancialItemInput
): FinancialValidationResult {
  const errors: Record<string, string> = {};

  // Rule 1: Description is required
  if (!data.description.trim()) {
    errors.description = "Description is required";
  }

  // Rule 2: Amount cannot be negative
  if (data.amount < 0) {
    errors.amount = "Amount cannot be negative";
  }

  // Rule 3: Verification source required when status is "Verified"
  if (
    data.verificationStatus === "Verified" &&
    !data.verificationSource.trim()
  ) {
    errors.verificationSource =
      "Verification source is required when status is Verified";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
