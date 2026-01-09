/**
 * @fileoverview Pure date formatting and parsing utilities.
 *
 * Domain Layer - No I/O, no React, no side effects.
 *
 * ## Key Principles
 * - Date-only values (applicationDate, DOB) use LOCAL timezone
 * - Full timestamps (createdAt, updatedAt) use UTC via toISOString()
 * - Never use `.toISOString().split('T')[0]` for user-facing local dates
 *
 * @module domain/common/dates
 */

/**
 * Get today's date as a YYYY-MM-DD string in local timezone.
 *
 * Use this for date-only fields like applicationDate, dateOfBirth, etc.
 * Unlike `new Date().toISOString().split('T')[0]`, this won't shift
 * to "tomorrow" for users in western timezones during evening hours.
 *
 * @param date - Optional date to format (defaults to now)
 * @returns Local date string in YYYY-MM-DD format
 *
 * @example
 * // User in PST at 10pm on Jan 5, 2026
 * toLocalDateString() // Returns "2026-01-05" (correct!)
 * new Date().toISOString().split('T')[0] // Would return "2026-01-06" (wrong!)
 */
export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse a date string as local time (no UTC conversion).
 * Handles both yyyy-MM-dd and ISO timestamps.
 *
 * CRITICAL: When parsing date-only strings like "2024-12-15", JavaScript's
 * Date constructor interprets them as UTC midnight. This causes dates to
 * shift backward for users in negative UTC offset timezones (Americas).
 *
 * This function ensures dates are always parsed as LOCAL midnight.
 *
 * @param dateString Date string (yyyy-MM-dd or ISO timestamp)
 * @returns Date object in local time, or null if invalid
 */
export function parseLocalDate(
  dateString: string | null | undefined
): Date | null {
  if (!dateString) return null;

  try {
    // Handle yyyy-MM-dd format - parse as LOCAL time
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split("-").map(Number);
      // Month is 0-indexed in Date constructor
      return new Date(year, month - 1, day);
    }

    // Handle ISO timestamps - these already have timezone info
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Format a date for display in MM/DD/YYYY format
 * @param dateString ISO date string or yyyy-MM-dd
 * @returns Formatted date string or "None" if invalid
 */
export function formatDateForDisplay(
  dateString: string | null | undefined
): string {
  if (!dateString) return "None";

  const date = parseLocalDate(dateString);
  if (!date) return "None";

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}

/**
 * Format a date as short display (e.g., "Dec 15")
 * @param dateString ISO date string or yyyy-MM-dd
 * @returns Formatted short date string
 */
export function formatShortDate(dateString: string | null | undefined): string {
  if (!dateString) return "";

  const date = parseLocalDate(dateString);
  if (!date) return "";

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format a datetime for display with time (e.g., "Dec 15, 2024, 3:45 PM")
 * @param dateString ISO timestamp
 * @returns Formatted datetime string
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "";

  const date = parseLocalDate(dateString);
  if (!date) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Convert ISO timestamp to yyyy-MM-dd format for HTML date inputs
 * @param isoDate ISO 8601 timestamp (e.g., "2025-10-29T18:07:06.766Z")
 * @returns Date string in yyyy-MM-dd format or empty string if invalid
 */
export function isoToDateInputValue(
  isoDate: string | null | undefined
): string {
  if (!isoDate) return "";

  try {
    // Handle already formatted dates
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return isoDate;
    }

    // Convert ISO to yyyy-MM-dd
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return "";

    return date.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

/**
 * Convert date input value to date-only string for storage (no timezone issues)
 *
 * NOTE: For date-only fields like dateOfBirth and admissionDate, we store dates
 * as yyyy-MM-dd strings WITHOUT time components to avoid timezone shift bugs.
 *
 * Example: User enters "2025-11-05" → stored as "2025-11-05" (not "2025-11-05T00:00:00.000Z")
 * This prevents PST users from seeing "2025-11-04" due to UTC midnight conversion.
 *
 * @param dateValue Date string from HTML input (yyyy-MM-dd)
 * @returns Date-only string (yyyy-MM-dd) or null if empty
 */
export function dateInputValueToISO(
  dateValue: string | null | undefined
): string | null {
  if (!dateValue) return null;

  try {
    // If already in yyyy-MM-dd format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }

    // If it's an ISO-like timestamp (with or without offset), extract just the date part
    if (dateValue.includes("T")) {
      const iso = new Date(dateValue);
      if (isNaN(iso.getTime())) return null;
      return iso.toISOString().split("T")[0];
    }

    // Parse and validate the date
    const date = new Date(dateValue + "T00:00:00.000Z");
    if (isNaN(date.getTime())) return null;

    // Return date-only string (no time component)
    return date.toISOString().split("T")[0];
  } catch {
    return null;
  }
}
