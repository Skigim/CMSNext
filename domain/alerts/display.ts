/**
 * Alert Display Utilities
 *
 * Pure functions for extracting and formatting alert data for UI display.
 * No I/O, no React, no side effects.
 *
 * @module domain/alerts/display
 */

import type { AlertWithMatch } from "./types";
import { parseLocalDate } from "@/domain/common";

const mediumDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export interface AlertDueDateInfo {
  label: string;
  hasDate: boolean;
}

/**
 * Extract the description from an alert.
 *
 * Returns the description field only, or a default message if empty.
 *
 * @param {AlertWithMatch} alert - Alert to extract description from
 * @returns {string} Description or default message (never empty)
 */
export function getAlertDisplayDescription(alert: AlertWithMatch): string {
  const desc = alert.description;
  if (typeof desc === "string" && desc.trim().length > 0) {
    return desc.trim();
  }
  return "No description provided";
}

/**
 * Extract due date information from an alert.
 *
 * Checks alertDate and createdAt fields. Returns a label and boolean indicating
 * whether a valid date was found. Invalid dates are returned as string labels.
 *
 * Uses parseLocalDate to avoid timezone offset issues with date-only strings.
 *
 * @param {AlertWithMatch} alert - Alert to extract due date from
 * @returns {AlertDueDateInfo} Object with label (formatted date or message) and hasDate flag
 */
export function getAlertDueDateInfo(alert: AlertWithMatch): AlertDueDateInfo {
  const raw = alert.alertDate ?? alert.createdAt ?? null;
  if (!raw) {
    return { label: "Due date not set", hasDate: false };
  }

  // Use parseLocalDate to handle date-only strings correctly
  // This prevents the off-by-one-day issue in negative UTC offset timezones
  const date = parseLocalDate(raw);
  if (!date) {
    return { label: String(raw), hasDate: false };
  }

  return { label: mediumDateFormatter.format(date), hasDate: true };
}
