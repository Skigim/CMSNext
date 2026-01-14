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
