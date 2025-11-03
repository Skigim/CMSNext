/**
 * Utilities for date formatting between storage and UI
 */

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
 * Convert date input value to ISO timestamp for storage
 * @param dateValue Date string from HTML input (yyyy-MM-dd)
 * @returns ISO 8601 timestamp or null if empty
 */
export function dateInputValueToISO(dateValue: string | null | undefined): string | null {
  if (!dateValue) return null;
  
  try {
    // If already ISO format, return as-is
    if (/T.*Z$/.test(dateValue)) {
      return dateValue;
    }
    
    // Convert yyyy-MM-dd to ISO at midnight UTC
    const date = new Date(dateValue + 'T00:00:00.000Z');
    if (isNaN(date.getTime())) return null;
    
    return date.toISOString();
  } catch {
    return null;
  }
}
