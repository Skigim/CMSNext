/**
 * @fileoverview Archive Domain Module
 * 
 * Pure functions for case archival logic. No I/O, no React, no side effects.
 * These functions handle:
 * - Finding cases eligible for archival based on age and status
 * - Collecting related data (financials, notes) for archival
 * - Marking/unmarking cases for pending archival review
 * - Merging archive data when appending to existing archives
 * 
 * @module domain/archive
 */

export {
  findArchivalEligibleCases,
  collectRelatedData,
  markCasesForArchival,
  unmarkCasesForArchival,
  mergeArchiveData,
  removeCasesFromArchive,
  calculateCutoffDate,
  getCasesInArchivalQueue,
  type ArchivalEligibilityResult,
  type FindArchivalEligibleOptions,
  type RelatedDataCollection,
} from "./archivalLogic";
