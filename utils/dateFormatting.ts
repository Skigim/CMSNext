/**
 * Utilities for date formatting between storage and UI
 */

/**
 * Format a date for display in MM/DD/YYYY format
 * @param dateString ISO date string or yyyy-MM-dd
 * @returns Formatted date string or "None" if invalid
 */
export function formatDateForDisplay(
  dateString: string | null | undefined
): string {
  if (!dateString) return "None";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "None";

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();

    return `${month}/${day}/${year}`;
  } catch {
    return "None";
  }
}

/**
 * Convert ISO timestamp to yyyy-MM-dd format for HTML date inputs
 * @param isoDate ISO 8601 timestamp (e.g., "2025-10-29T18:07:06.766Z")
 * @returns Date string in yyyy-MM-dd format or empty string if invalid
 */
export function isoToDateInputValue(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  
  try {
    // Handle already formatted dates
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return isoDate;
    }
    
    // Convert ISO to yyyy-MM-dd
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '';
    
    return date.toISOString().split('T')[0];
  } catch {
    return '';
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
export function dateInputValueToISO(dateValue: string | null | undefined): string | null {
  if (!dateValue) return null;
  
  try {
    // If already in yyyy-MM-dd format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    
    // If it's an ISO-like timestamp (with or without offset), extract just the date part
    if (dateValue.includes('T')) {
      const iso = new Date(dateValue);
      if (isNaN(iso.getTime())) return null;
      return iso.toISOString().split('T')[0];
    }
    
    // Parse and validate the date
    const date = new Date(dateValue + 'T00:00:00.000Z');
    if (isNaN(date.getTime())) return null;
    
    // Return date-only string (no time component)
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}
