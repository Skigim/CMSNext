/**
 * @fileoverview Pure functions for duplicate detection in collections.
 *
 * Domain Layer - No I/O, no React, no side effects.
 */

/**
 * Entry with a normalized value for duplicate comparison.
 */
export interface NormalizedEntry {
  /** The normalized (lowercase, trimmed) value for comparison */
  normalized: string;
  /** Original trimmed value (optional, for context) */
  trimmed?: string;
}

/**
 * Finds indices of duplicate entries based on normalized values.
 *
 * Case-insensitive comparison using the `normalized` property.
 * Empty/blank entries are skipped (not considered duplicates).
 *
 * @param entries - Array of entries with normalized values
 * @returns Set of indices that have duplicate values
 *
 * @example
 * const entries = [
 *   { normalized: 'active', trimmed: 'Active' },
 *   { normalized: 'pending', trimmed: 'Pending' },
 *   { normalized: 'active', trimmed: 'ACTIVE' },  // duplicate of index 0
 * ];
 * const duplicates = findDuplicateIndices(entries);
 * // Returns Set { 0, 2 }
 */
export function findDuplicateIndices(entries: NormalizedEntry[]): Set<number> {
  const seen = new Map<string, number>();
  const duplicates = new Set<number>();

  entries.forEach((entry, index) => {
    // Skip empty entries
    if (!entry.normalized) return;

    if (seen.has(entry.normalized)) {
      // Mark both the current and the first occurrence as duplicates
      duplicates.add(index);
      duplicates.add(seen.get(entry.normalized)!);
    } else {
      seen.set(entry.normalized, index);
    }
  });

  return duplicates;
}
