/**
 * Utility for formatting timestamps as human-readable relative time strings.
 *
 * Used by dashboard widgets and autosave status to display "2min ago" style labels.
 *
 * @module utils/formatFreshness
 */

/**
 * Format a timestamp as a relative time string (e.g., "just now", "5m ago").
 *
 * This provides a consistent format for freshness indicators across the UI:
 * - `< 10s`: "just now"
 * - `< 60s`: "45s ago"
 * - `< 60m`: "12min ago"
 * - `< 24h`: "2h ago"
 * - `< 7d`: "3d ago"
 * - `>= 7d`: Full date string
 *
 * @param timestamp - Timestamp in milliseconds since epoch, or ISO date string
 * @returns Human-readable relative time string, or null if timestamp is invalid
 *
 * @example
 * ```typescript
 * getFreshnessLabel(Date.now() - 5000); // "just now"
 * getFreshnessLabel(Date.now() - 120000); // "2min ago"
 * getFreshnessLabel(new Date().toISOString()); // "just now"
 * getFreshnessLabel(null); // null
 * ```
 */
export function getFreshnessLabel(timestamp: number | string | null | undefined): string | null {
  if (timestamp === null || timestamp === undefined) {
    return null;
  }

  // Convert ISO string to timestamp if needed
  const timestampMs = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp;

  // Handle invalid dates
  if (isNaN(timestampMs)) {
    return null;
  }

  const diffMs = Date.now() - timestampMs;
  const diffSeconds = Math.round(diffMs / 1000);

  if (diffSeconds < 10) {
    return "just now";
  }

  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return new Date(timestampMs).toLocaleDateString();
}

/**
 * Format a timestamp as relative time from a numeric epoch timestamp.
 *
 * This is an alias for getFreshnessLabel that only accepts numeric timestamps.
 * Used primarily by useAutosaveStatus for consistency with existing API.
 *
 * @param timestamp - Timestamp in milliseconds since epoch
 * @returns Human-readable relative time string, or null if timestamp is null
 */
export function formatRelativeTime(timestamp: number | null): string | null {
  return getFreshnessLabel(timestamp);
}
