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

import type { StatusConfig } from "@/types/categoryConfig";
import type { StoredCase } from "../../types/case";
import type { ParsedPositionEntry } from "./parser";
import { normalizeMcn } from "../alerts/matching";
import { resolveImportedStatusForConfig } from "./importStatusHelpers";

// ============================================================================
// Types
// ============================================================================

/**
 * A matched case whose status in the import file differs from its current status.
 */
export interface CaseStatusUpdate {
  /** The stored case to update */
  case: StoredCase;
  /** Exact status string from the XML export */
  importedStatus: string;
  /** The case's current status in the system */
  currentStatus: string;
}

/**
 * Summary of the position assignments comparison.
 */
export interface AssignmentsSummary {
  /** Total unique entries parsed from the position assignments file */
  totalParsed: number;
  /** Number of stored cases that matched an entry on the list */
  matched: number;
  /** Number of matched cases whose status differs from the imported status */
  statusUpdateCandidates: number;
  /** Number of stored cases NOT found on the list (candidates for archival) */
  unmatched: number;
  /** Number of unmatched cases already flagged as isPendingArchival (excluded) */
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
  /** Matched cases whose status in the XML differs from their current status */
  matchedWithStatusChange: CaseStatusUpdate[];
  /** Summary statistics */
  summary: AssignmentsSummary;
}

// ============================================================================
// Matching Functions
// ============================================================================

/**
 * Build a Map from normalized MCN to its parsed entry, for O(1) status lookup.
 * First occurrence of each MCN wins (matches deduplication in the parser).
 */
function buildAssignmentMcnMap(
  entries: ParsedPositionEntry[]
): Map<string, ParsedPositionEntry> {
  const mcnMap = new Map<string, ParsedPositionEntry>();
  for (const entry of entries) {
    const normalized = normalizeMcn(entry.mcn);
    if (normalized && !mcnMap.has(normalized)) {
      mcnMap.set(normalized, entry);
    }
  }
  return mcnMap;
}

/**
 * Find stored cases that are NOT present on the position assignments list.
 *
 * Compares all stored cases (excluding Archived status) against the parsed
 * assignment entries by MCN. Cases not found on the list are candidates for
 * archival. Cases already flagged as `isPendingArchival` are excluded from
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
  entries: ParsedPositionEntry[],
  existingStatuses: StatusConfig[] = [],
): AssignmentsCompareResult {
  const assignmentMcnMap = buildAssignmentMcnMap(entries);

  let matched = 0;
  let alreadyFlagged = 0;
  let archivedExcluded = 0;
  const unmatchedCases: StoredCase[] = [];
  const matchedWithStatusChange: CaseStatusUpdate[] = [];

  for (const caseItem of cases) {
    // Skip archived cases — they're already out of active management
    if (caseItem.status === "Archived") {
      archivedExcluded++;
      continue;
    }

    const caseMcn = normalizeMcn(caseItem.mcn || caseItem.caseRecord?.mcn);

    if (!caseMcn) {
      // Cases without an MCN can't be matched — treat as unmatched
      if (caseItem.isPendingArchival) {
        alreadyFlagged++;
      } else {
        unmatchedCases.push(caseItem);
      }
      continue;
    }

    const matchedEntry = assignmentMcnMap.get(caseMcn);
    if (matchedEntry) {
      matched++;
      const importedStatus = matchedEntry.status
        ? resolveImportedStatusForConfig(matchedEntry.status, existingStatuses)
        : undefined;
      if (
        importedStatus &&
        importedStatus.toLowerCase() !== caseItem.status.toLowerCase()
      ) {
        matchedWithStatusChange.push({
          case: caseItem,
          importedStatus,
          currentStatus: caseItem.status,
        });
      }
    } else if (caseItem.isPendingArchival) {
      alreadyFlagged++;
    } else {
      unmatchedCases.push(caseItem);
    }
  }

  return {
    unmatchedCases,
    matchedWithStatusChange,
    summary: {
      totalParsed: entries.length,
      matched,
      statusUpdateCandidates: matchedWithStatusChange.length,
      unmatched: unmatchedCases.length,
      alreadyFlagged,
      archivedExcluded,
    },
  };
}
