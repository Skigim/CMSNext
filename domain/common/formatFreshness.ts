/**
 * @fileoverview Freshness Label Formatting
 *
 * Pure function to format "time ago" labels for widget freshness indicators.
 * Extracted from widget components to eliminate duplication.
 *
 * @module domain/common/formatFreshness
 */

export interface FreshnessData {
  /** Timestamp of last update (number = epoch ms, Date, or ISO string) */
  lastUpdatedAt: number | Date | string | null;
  /** Minutes since last update */
  minutesAgo: number | null;
}

/**
 * Formats a freshness indicator into a human-readable "time ago" label.
 *
 * @param freshness - The freshness data containing lastUpdatedAt and minutesAgo
 * @returns A formatted string like "Just now", "5 minutes ago", "2 hours ago"
 *
 * @example
 * ```typescript
 * const label = formatFreshnessLabel({ lastUpdatedAt: new Date(), minutesAgo: 0 });
 * // Returns: "Just now"
 *
 * const label2 = formatFreshnessLabel({ lastUpdatedAt: new Date(), minutesAgo: 45 });
 * // Returns: "45 minutes ago"
 *
 * const label3 = formatFreshnessLabel({ lastUpdatedAt: new Date(), minutesAgo: 120 });
 * // Returns: "2 hours ago"
 * ```
 */
export function formatFreshnessLabel(freshness: FreshnessData): string {
  if (!freshness.lastUpdatedAt) {
    return "Never updated";
  }

  if (freshness.minutesAgo === 0) {
    return "Just now";
  }

  if (freshness.minutesAgo === 1) {
    return "1 minute ago";
  }

  if (freshness.minutesAgo !== null && freshness.minutesAgo < 60) {
    return `${freshness.minutesAgo} minutes ago`;
  }

  const hoursAgo = Math.floor((freshness.minutesAgo ?? 0) / 60);
  return hoursAgo <= 1 ? "1 hour ago" : `${hoursAgo} hours ago`;
}
