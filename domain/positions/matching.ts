/**
 * @fileoverview Position Assignments Matching
 *
 * Pure functions to compare parsed position assignment entries against
 * stored cases. Identifies cases NOT present on the exported assignment
 * list, which should be flagged for archival review.
 *
 * Uses `normalizeMcn()` from the alerts domain for consistent MCN comparison.
 *
 * @module domain/positions/matching
 */

import type { StoredCase } from "../../types/case";
import type { ParsedPositionEntry } from "./parser";
import { normalizeMcn } from "../alerts/matching";

// ============================================================================
// Types
// ============================================================================

/**
 * Summary of the position assignments comparison.
 */
export interface AssignmentsSummary {
  /** Total unique entries parsed from the position assignments file */
  totalParsed: number;
  /** Number of stored cases that matched an entry on the list */
  matched: number;
  /** Number of stored cases NOT found on the list (candidates for archival) */
  unmatched: number;
  /** Number of unmatched cases already flagged as pendingArchival (excluded) */
  alreadyFlagged: number;
  /** Number of archived cases excluded from comparison */
  archivedExcluded: number;
}

/**
 * Complete result of comparing assignments against stored cases.
 */
export interface AssignmentsCompareResult {
  /** Cases not found on the assignment list (eligible for archival flagging) */
  unmatchedCases: StoredCase[];
  /** Summary statistics */
  summary: AssignmentsSummary;
}

// ============================================================================
// Matching Functions
// ============================================================================

/**
 * Build a Set of normalized MCNs from parsed position assignment entries.
 *
 * @param entries - Parsed entries from the position assignments file
 * @returns Set of normalized MCN strings for O(1) lookup
 */
export function buildAssignmentMcnSet(entries: ParsedPositionEntry[]): Set<string> {
  const mcnSet = new Set<string>();
  for (const entry of entries) {
    const normalized = normalizeMcn(entry.mcn);
    if (normalized) {
      mcnSet.add(normalized);
    }
  }
  return mcnSet;
}

/**
 * Find stored cases that are NOT present on the position assignments list.
 *
 * Compares all stored cases (excluding Archived status) against the parsed
 * assignment entries by MCN. Cases not found on the list are candidates for
 * archival. Cases already flagged as `pendingArchival` are excluded from
 * the result but counted in the summary.
 *
 * @param cases - All stored cases in the system
 * @param entries - Parsed entries from the position assignments file
 * @returns Comparison result with unmatched cases and summary stats
 *
 * @example
 * const result = compareAssignments(allCases, parsedEntries);
 * console.log(`${result.unmatchedCases.length} cases not on your assignment list`);
 */
export function compareAssignments(
  cases: StoredCase[],
  entries: ParsedPositionEntry[]
): AssignmentsCompareResult {
  const assignmentMcns = buildAssignmentMcnSet(entries);

  let matched = 0;
  let alreadyFlagged = 0;
  let archivedExcluded = 0;
  const unmatchedCases: StoredCase[] = [];

  for (const caseItem of cases) {
    // Skip archived cases — they're already out of active management
    if (caseItem.status === "Archived") {
      archivedExcluded++;
      continue;
    }

    const caseMcn = normalizeMcn(caseItem.mcn || caseItem.caseRecord?.mcn);

    if (!caseMcn) {
      // Cases without an MCN can't be matched — treat as unmatched
      if (caseItem.pendingArchival) {
        alreadyFlagged++;
      } else {
        unmatchedCases.push(caseItem);
      }
      continue;
    }

    if (assignmentMcns.has(caseMcn)) {
      matched++;
    } else if (caseItem.pendingArchival) {
      alreadyFlagged++;
    } else {
      unmatchedCases.push(caseItem);
    }
  }

  return {
    unmatchedCases,
    summary: {
      totalParsed: entries.length,
      matched,
      unmatched: unmatchedCases.length,
      alreadyFlagged,
      archivedExcluded,
    },
  };
}
