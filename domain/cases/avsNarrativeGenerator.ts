/**
 * @fileoverview AVS Narrative Generator
 *
 * Pure function to generate AVS submission narrative text.
 * Extracted from IntakeColumn and IntakeChecklistView to eliminate duplication.
 *
 * @module domain/cases/avsNarrativeGenerator
 */

import { parseLocalDate } from "@/domain/common";

/**
 * Formats a Date object for display in US format (MM/DD/YYYY).
 *
 * @param date - Date object, or null/undefined
 * @returns Formatted date string or null if no date provided
 */
function formatDateForNarrative(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

/**
 * Options for generating AVS narrative.
 */
export interface GenerateAvsNarrativeOptions {
  /** The consent date in ISO format */
  avsConsentDate?: string;
  /** The AVS submit date in ISO format. When provided, overrides `referenceDate`. */
  avsSubmitDate?: string;
  /** Optional reference date used as the submit date (defaults to today). Ignored when `avsSubmitDate` is provided. */
  referenceDate?: Date;
}

/**
 * Generates an AVS submission narrative with consent date and calculated milestone dates.
 *
 * @param options - The narrative generation options
 * @returns Formatted narrative string with consent, submit, 5-day, and 11-day dates
 *
 * @example
 * ```typescript
 * const narrative = generateAvsNarrative({ avsConsentDate: "2026-01-10" });
 * // Returns:
 * // "MLTC: AVS Submitted
 * // Consent Date: 01/10/2026
 * // Submit Date: 01/12/2026
 * // 5 Day: 01/17/2026
 * // 11 Day: 01/23/2026"
 * ```
 */
export function generateAvsNarrative(options: GenerateAvsNarrativeOptions): string {
  const { avsConsentDate, avsSubmitDate, referenceDate = new Date() } = options;

  // Parse date-only strings as local time to avoid UTC midnight offset in negative-offset
  // timezones (e.g. America/Los_Angeles shifts "2026-01-10" to Jan 9 when parsed as UTC).
  const consentDate = formatDateForNarrative(parseLocalDate(avsConsentDate)) ?? "MM/DD/YYYY";

  // Use the explicitly saved AVS submit date when available; fall back to referenceDate.
  // Parse directly via parseLocalDate — no format→split→rebuild roundtrip.
  const submitRef: Date = (avsSubmitDate ? parseLocalDate(avsSubmitDate) : null) ?? referenceDate;

  const submitDate = submitRef.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  const fiveDay = new Date(submitRef);
  fiveDay.setDate(submitRef.getDate() + 5);
  const fiveDayDate = fiveDay.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  const elevenDay = new Date(submitRef);
  elevenDay.setDate(submitRef.getDate() + 11);
  const elevenDayDate = elevenDay.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  return `MLTC: AVS Submitted
Consent Date: ${consentDate}
Submit Date: ${submitDate}
5 Day: ${fiveDayDate}
11 Day: ${elevenDayDate}`;
}
