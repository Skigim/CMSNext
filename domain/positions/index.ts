/**
 * @fileoverview Position Assignments Domain Module
 *
 * Pure functions for parsing N-FOCUS position assignment exports and
 * comparing them against stored cases to identify archival candidates.
 *
 * @module domain/positions
 */

export {
  parsePositionAssignments,
  type ParsedPositionEntry,
  type PositionParseResult,
} from "./parser";

export {
  compareAssignments,
  buildAssignmentMcnSet,
  type AssignmentsSummary,
  type AssignmentsCompareResult,
} from "./matching";
