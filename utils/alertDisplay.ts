import type { AlertWithMatch } from "./alertsData";

/**
 * Alert Display Utilities
 * =======================
 * Formatting and extraction helpers for displaying alerts in the UI.
 * Centralizes alert presentation logic for consistency across components.
 * 
 * ## Features
 * 
 * - **Description**: Extract first non-empty description from multiple fields
 * - **Due Dates**: Format alert dates for display with proper null handling
 * - **Client Names**: Extract and validate person/case names
 * - **MCN Numbers**: Clean and validate medical certification numbers
 * 
 * ## Usage Example
 * 
 * ```typescript
 * const alert = { description: "...", personName: "John Doe", ... };
 * const desc = getAlertDisplayDescription(alert);
 * const dueDate = getAlertDueDateInfo(alert);
 * const clientName = getAlertClientName(alert);
 * ```
 * 
 * @module alertDisplay
 * @see {@link AlertWithMatch} for alert structure
 */

const mediumDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export interface AlertDueDateInfo {
  label: string;
  hasDate: boolean;
}

/**
 * Extract a display-friendly description from an alert.
 * 
 * Checks multiple fields in priority order:
 * 1. description
 * 2. alertType
 * 3. alertCode
 * 
 * Returns the first non-empty string, or default message if all are empty.
 * 
 * @param {AlertWithMatch} alert - Alert to extract description from
 * @returns {string} Display-friendly description (never empty)
 */
export function getAlertDisplayDescription(alert: AlertWithMatch): string {
  const parts = [alert.description, alert.alertType, alert.alertCode];
  const firstValid = parts.find(
    value => typeof value === "string" && value.trim().length > 0,
  );
  return firstValid ? firstValid.trim() : "No description provided";
}

/**
 * Extract due date information from an alert.
 * 
 * Checks alertDate and createdAt fields. Returns a label and boolean indicating
 * whether a valid date was found. Invalid dates are returned as string labels.
 * 
 * @param {AlertWithMatch} alert - Alert to extract due date from
 * @returns {AlertDueDateInfo} Object with label (formatted date or message) and hasDate flag
 */
export function getAlertDueDateInfo(alert: AlertWithMatch): AlertDueDateInfo {
  const raw = alert.alertDate ?? alert.createdAt ?? null;
  if (!raw) {
    return { label: "Due date not set", hasDate: false };
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return { label: String(raw), hasDate: false };
  }

  return { label: mediumDateFormatter.format(date), hasDate: true };
}

/**
 * Extract client name from an alert.
 * 
 * Checks personName and matchedCaseName fields. Returns the first non-empty value,
 * or null if both are empty.
 * 
 * @param {AlertWithMatch} alert - Alert to extract client name from
 * @returns {string | null} Client name or null if not found
 */
export function getAlertClientName(alert: AlertWithMatch): string | null {
  const candidates = [alert.personName, alert.matchedCaseName];
  const firstValid = candidates.find(
    candidate => typeof candidate === "string" && candidate.trim().length > 0,
  );
  return firstValid ? firstValid.trim() : null;
}

/**
 * Extract and clean Medical Certification Number (MCN) from an alert.
 * 
 * Validates that MCN is a non-empty string after trimming.
 * 
 * @param {AlertWithMatch} alert - Alert to extract MCN from
 * @returns {string | null} Cleaned MCN or null if empty/invalid
 */
export function getAlertMcn(alert: AlertWithMatch): string | null {
  const value = typeof alert.mcNumber === "string" ? alert.mcNumber.trim() : "";
  return value.length > 0 ? value : null;
}
