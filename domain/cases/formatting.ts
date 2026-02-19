/**
 * @fileoverview Pure formatting functions for case summary generation.
 *
 * Domain Layer - No I/O, no React, no side effects.
 */

import type { FinancialItem, StoredCase } from "@/types/case";
import { parseLocalDate } from "../common/dates";

/**
 * Bank account type keywords for institution extraction.
 * Case-insensitive matching against description field.
 */
const BANK_ACCOUNT_KEYWORDS = [
  "checking",
  "savings",
  "bank",
  "account",
  "cd",
  "money market",
  "ira",
  "401k",
];

/**
 * Format retro months into display string.
 *
 * @param retroMonths - Array of month abbreviations (e.g., ["Jan", "Feb", "Mar"])
 * @param applicationDate - ISO date string for year inference
 * @returns Formatted string like "Yes (Jan-Mar 2024)" or "No"
 *
 * @example
 * formatRetroMonths(["Jan", "Feb", "Mar"], "2024-06-15")
 * // Returns "Yes (Jan-Mar 2024)"
 *
 * formatRetroMonths([], "2024-06-15")
 * // Returns "No"
 */
export function formatRetroMonths(
  retroMonths: string[] | undefined,
  applicationDate: string | undefined
): string {
  if (!retroMonths || retroMonths.length === 0) {
    return "No";
  }

  // Get year from application date, default to current year
  let year: number;
  if (applicationDate) {
    try {
      const date = parseLocalDate(applicationDate);
      if (date) {
        year = date.getFullYear();
      } else {
        year = new Date().getFullYear();
      }
    } catch {
      year = new Date().getFullYear();
    }
  } else {
    year = new Date().getFullYear();
  }

  // Sort months in calendar order
  const monthOrder = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const sorted = [...retroMonths].sort(
    (a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b)
  );

  // Format as range if multiple, single month if one
  if (sorted.length === 1) {
    return `Yes (${sorted[0]} ${year})`;
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return `Yes (${first}-${last} ${year})`;
}

/**
 * Calculate age from date of birth.
 *
 * @param dateOfBirth - ISO date string or parseable date string
 * @returns Age in years, or null if invalid/missing
 *
 * @example
 * calculateAge("1950-01-15") // on Jan 2, 2026
 * // Returns 75
 */
export function calculateAge(dateOfBirth: string | undefined): number | null {
  if (!dateOfBirth) return null;

  try {
    const dob = parseLocalDate(dateOfBirth);
    if (!dob) return null;

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    // Adjust if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    return age;
  } catch {
    return null;
  }
}

/**
 * Voter form status display values.
 */
export type VoterFormStatus = "requested" | "declined" | "not_answered" | "";

/**
 * Format voter form status for display.
 *
 * @param status - Raw voter form status value
 * @returns Formatted display string
 *
 * @example
 * formatVoterStatus("declined") // Returns "Declined"
 * formatVoterStatus("not_answered") // Returns "Not Answered"
 * formatVoterStatus("") // Returns "Not Answered"
 */
export function formatVoterStatus(status: VoterFormStatus | undefined): string {
  switch (status) {
    case "requested":
      return "Requested";
    case "declined":
      return "Declined";
    case "not_answered":
    case "":
    case undefined:
      return "Not Answered";
    default:
      return "Not Answered";
  }
}

/**
 * AVS tracking dates result.
 */
export interface AVSTrackingDates {
  submitDate: string;
  consentDate: string;
  fiveDayDate: string;
  elevenDayDate: string;
}

/**
 * Calculate AVS tracking dates.
 *
 * @param consentDate - ISO date string for consent date
 * @param submitDate - Optional ISO date string or Date object for submit date. 
 *                     If not provided, current date is used.
 * @returns Object with formatted date strings
 */
export function calculateAVSTrackingDates(
  consentDate: string | undefined,
  submitDate?: string | Date
): AVSTrackingDates {
  let submit: Date;
  
  if (typeof submitDate === 'string' && submitDate) {
    // Parse ISO string (presuming YYYY-MM-DD from input)
    // We treat it as local date to avoid timezone shifts
    const [year, month, day] = submitDate.split('-').map(Number);
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
       submit = new Date(year, month - 1, day);
    } else {
       submit = new Date();
    }
  } else if (submitDate instanceof Date) {
    submit = new Date(
      submitDate.getUTCFullYear(),
      submitDate.getUTCMonth(),
      submitDate.getUTCDate()
    );
  } else {
    submit = new Date();
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const formatConsentDate = (dateStr: string | undefined): string => {
    if (!dateStr) return "MM/DD/YYYY";
    try {
      const date = parseLocalDate(dateStr);
      if (!date) return "MM/DD/YYYY";
      return formatDate(date);
    } catch {
      return "MM/DD/YYYY";
    }
  };

  const fiveDay = new Date(submit);
  fiveDay.setDate(submit.getDate() + 5);

  const elevenDay = new Date(submit);
  elevenDay.setDate(submit.getDate() + 11);

  return {
    submitDate: formatDate(submit),
    consentDate: formatConsentDate(consentDate),
    fiveDayDate: formatDate(fiveDay),
    elevenDayDate: formatDate(elevenDay),
  };
}

/**
 * Extract known institutions from resources.
 *
 * Filters resources by bank account keywords in description,
 * extracts unique location values.
 *
 * @param resources - Array of financial items (resources only)
 * @returns Comma-separated list of institutions, or "None Attested"
 *
 * @example
 * extractKnownInstitutions([
 *   { description: "Checking Account", location: "First National Bank", amount: 2450 },
 *   { description: "Savings", location: "Credit Union", amount: 15000 },
 *   { description: "Vehicle", location: "Toyota Dealer", amount: 8000 },
 * ])
 * // Returns "First National Bank, Credit Union"
 */
export function extractKnownInstitutions(
  resources: FinancialItem[] | undefined
): string {
  if (!resources || resources.length === 0) {
    return "None Attested";
  }

  const institutions = new Set<string>();

  for (const item of resources) {
    if (!item.location) continue;

    const descLower = (item.description || "").toLowerCase();
    const isBankAccount = BANK_ACCOUNT_KEYWORDS.some((keyword) =>
      descLower.includes(keyword)
    );

    if (isBankAccount) {
      institutions.add(item.location);
    }
  }

  if (institutions.size === 0) {
    return "None Attested";
  }

  return Array.from(institutions).join(", ");
}

/**
 * Format a case display name from case data.
 * 
 * Priority order:
 * 1. Uses case.name if set
 * 2. Falls back to person's firstName + lastName
 * 3. Returns "Unknown Case" if no name available
 * 
 * @param {StoredCase} caseData - The case data to format
 * @returns {string} Formatted display name
 */
export function formatCaseDisplayName(caseData: StoredCase): string {
  const trimmedName = (caseData.name ?? "").trim();
  if (trimmedName.length > 0) {
    return trimmedName;
  }

  const firstName = caseData.person?.firstName?.trim() ?? "";
  const lastName = caseData.person?.lastName?.trim() ?? "";
  const composed = `${firstName} ${lastName}`.trim();

  if (composed.length > 0) {
    return composed;
  }

  return "Unknown Case";
}
