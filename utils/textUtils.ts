/**
 * Text manipulation utilities for consistent string handling.
 *
 * Provides standardized functions for normalizing, cleaning, and validating
 * string values throughout the application.
 *
 * @module utils/textUtils
 */

/**
 * Normalize a string value by trimming whitespace.
 *
 * Returns null if the value is null, undefined, or empty after trimming.
 * This standardizes the pattern of checking for empty/whitespace-only strings.
 *
 * @param value - String to normalize, or null/undefined
 * @returns Trimmed string if non-empty, null otherwise
 *
 * @example
 * ```typescript
 * normalizeString("  hello  "); // "hello"
 * normalizeString(""); // null
 * normalizeString("   "); // null
 * normalizeString(null); // null
 * normalizeString(undefined); // null
 * ```
 */
export function normalizeString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Check if a string value is empty or whitespace-only.
 *
 * @param value - String to check, or null/undefined
 * @returns true if empty, whitespace-only, null, or undefined
 *
 * @example
 * ```typescript
 * isEmpty(""); // true
 * isEmpty("   "); // true
 * isEmpty(null); // true
 * isEmpty("hello"); // false
 * ```
 */
export function isEmpty(value: string | null | undefined): boolean {
  return normalizeString(value) === null;
}

/**
 * Check if a string value is non-empty (has content after trimming).
 *
 * @param value - String to check, or null/undefined
 * @returns true if contains non-whitespace characters
 *
 * @example
 * ```typescript
 * isNotEmpty("hello"); // true
 * isNotEmpty(""); // false
 * isNotEmpty(null); // false
 * ```
 */
export function isNotEmpty(value: string | null | undefined): value is string {
  return normalizeString(value) !== null;
}
