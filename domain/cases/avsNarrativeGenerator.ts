/**
 * @fileoverview AVS Narrative Generator
 *
 * Pure function to generate AVS submission narrative text.
 * Extracted from IntakeColumn and IntakeChecklistView to eliminate duplication.
 *
 * @module domain/cases/avsNarrativeGenerator
 */

/**
 * Formats a date string for display in US format (MM/DD/YYYY).
 *
 * @param dateString - ISO date string or undefined
 * @returns Formatted date string or null if invalid
 */
function formatDateForNarrative(dateString?: string): string | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * Options for generating AVS narrative.
 */
export interface GenerateAvsNarrativeOptions {
  /** The consent date in ISO format */
  avsConsentDate?: string;
  /** Optional reference date (defaults to today) */
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
  const { avsConsentDate, referenceDate = new Date() } = options;

  const consentDate = formatDateForNarrative(avsConsentDate) || "MM/DD/YYYY";

  const submitDate = referenceDate.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  const fiveDay = new Date(referenceDate);
  fiveDay.setDate(referenceDate.getDate() + 5);
  const fiveDayDate = fiveDay.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  const elevenDay = new Date(referenceDate);
  elevenDay.setDate(referenceDate.getDate() + 11);
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
