/**
 * @fileoverview Archive Domain Logic
 * 
 * Pure functions for case archival business logic.
 * 
 * @module domain/archive/archivalLogic
 */

import type { StoredCase, StoredFinancialItem, StoredNote } from "../../types/case";
import type { CaseArchiveData, ArchivalSettings } from "../../types/archive";
import { ARCHIVE_VERSION } from "../../types/archive";
import { parseLocalDate } from "../common/dates";

/**
 * Result of finding archival-eligible cases.
 */
export interface ArchivalEligibilityResult {
  /** Cases that are eligible for archival */
  eligibleCases: StoredCase[];
  /** Case IDs that are eligible */
  eligibleCaseIds: string[];
  /** Total cases evaluated */
  totalEvaluated: number;
  /** Cutoff date used for evaluation */
  cutoffDate: Date;
}

/**
 * Collection of related data for a set of cases.
 */
export interface RelatedDataCollection {
  /** Financial items belonging to the specified cases */
  financials: StoredFinancialItem[];
  /** Notes belonging to the specified cases */
  notes: StoredNote[];
}

/**
 * Options for finding archival-eligible cases.
 */
export interface FindArchivalEligibleOptions {
  /** Archival settings (threshold, closedOnly flag) */
  settings: ArchivalSettings;
  /** 
   * Set of status names that count as "completed" (for closedOnly filtering).
   * Derived from StatusConfig.countsAsCompleted in category config.
   * If not provided or empty and archiveClosedOnly is true, no cases will match.
   */
  completedStatuses?: Set<string>;
  /** Date to calculate cutoff from (defaults to now) */
  referenceDate?: Date;
}

/**
 * Calculate the cutoff date based on threshold months.
 * Cases with applicationDate before this date are eligible for archival.
 * 
 * @param thresholdMonths - Number of months of inactivity before eligibility
 * @param referenceDate - Date to calculate from (defaults to now)
 * @returns Cutoff date
 * 
 * @example
 * calculateCutoffDate(12) // Date 12 months ago from now
 * calculateCutoffDate(6, new Date('2026-01-22')) // Date 6 months before Jan 22, 2026
 */
export function calculateCutoffDate(
  thresholdMonths: number,
  referenceDate: Date = new Date()
): Date {
  const cutoff = new Date(referenceDate);
  cutoff.setMonth(cutoff.getMonth() - thresholdMonths);
  return cutoff;
}

/**
 * Find cases that are eligible for archival based on settings.
 * 
 * A case is eligible if:
 * 1. Its applicationDate is before the cutoff date (based on thresholdMonths)
 * 2. If archiveClosedOnly is true, status must be in the completedStatuses set
 *    (derived from StatusConfig.countsAsCompleted in category config)
 * 3. It's not already pending archival
 * 
 * @param cases - All cases to evaluate
 * @param options - Options including settings, completedStatuses, and referenceDate
 * @returns Result containing eligible cases and metadata
 * 
 * @example
 * // With completed statuses from config
 * const completedStatuses = new Set(
 *   statusConfigs.filter(s => s.countsAsCompleted).map(s => s.name)
 * );
 * const result = findArchivalEligibleCases(cases, {
 *   settings: { thresholdMonths: 12, archiveClosedOnly: true },
 *   completedStatuses,
 * });
 * console.log(`${result.eligibleCases.length} cases eligible for archival`);
 */
export function findArchivalEligibleCases(
  cases: StoredCase[],
  options: FindArchivalEligibleOptions
): ArchivalEligibilityResult {
  const { settings, completedStatuses, referenceDate = new Date() } = options;
  const cutoffDate = calculateCutoffDate(settings.thresholdMonths, referenceDate);
  const cutoffTime = cutoffDate.getTime();
  
  const eligibleCases: StoredCase[] = [];
  const eligibleCaseIds: string[] = [];
  
  for (const caseItem of cases) {
    // Skip if already pending archival
    if (caseItem.pendingArchival) {
      continue;
    }
    
    // Check status eligibility using completedStatuses from config
    if (settings.archiveClosedOnly) {
      // If no completed statuses defined, nothing matches
      if (!completedStatuses || completedStatuses.size === 0) {
        continue;
      }
      if (!completedStatuses.has(caseItem.status)) {
        continue;
      }
    }
    
    // Check age eligibility based on applicationDate
    // Uses the case's original application date for archival eligibility
    const applicationDate = caseItem.caseRecord?.applicationDate;
    if (!applicationDate) {
      continue; // Skip cases without an application date
    }
    const parsedApplicationDate = parseLocalDate(applicationDate);
    if (!parsedApplicationDate) {
      continue;
    }
    const applicationTime = parsedApplicationDate.getTime();
    if (applicationTime >= cutoffTime) {
      continue;
    }
    
    // Case is eligible
    eligibleCases.push(caseItem);
    eligibleCaseIds.push(caseItem.id);
  }
  
  return {
    eligibleCases,
    eligibleCaseIds,
    totalEvaluated: cases.length,
    cutoffDate,
  };
}

/**
 * Collect related financials and notes for a set of case IDs.
 * 
 * @param caseIds - IDs of cases to collect related data for
 * @param allFinancials - All financial items to filter
 * @param allNotes - All notes to filter
 * @returns Collection of related data
 * 
 * @example
 * const related = collectRelatedData(['case-1', 'case-2'], financials, notes);
 * // related.financials contains all financials with caseId in ['case-1', 'case-2']
 */
export function collectRelatedData(
  caseIds: string[],
  allFinancials: StoredFinancialItem[],
  allNotes: StoredNote[]
): RelatedDataCollection {
  const caseIdSet = new Set(caseIds);
  
  return {
    financials: allFinancials.filter(f => caseIdSet.has(f.caseId)),
    notes: allNotes.filter(n => caseIdSet.has(n.caseId)),
  };
}

/**
 * Mark cases as pending archival review.
 * Returns a new array with updated cases (does not mutate input).
 * 
 * @param cases - All cases
 * @param caseIdsToMark - IDs of cases to mark as pending
 * @returns New array with marked cases
 * 
 * @example
 * const updated = markCasesForArchival(cases, ['case-1', 'case-2']);
 */
export function markCasesForArchival(
  cases: StoredCase[],
  caseIdsToMark: string[]
): StoredCase[] {
  const idsToMark = new Set(caseIdsToMark);
  
  return cases.map(caseItem => {
    if (idsToMark.has(caseItem.id)) {
      return { ...caseItem, pendingArchival: true };
    }
    return caseItem;
  });
}

/**
 * Remove pending archival flag from cases.
 * Returns a new array with updated cases (does not mutate input).
 * 
 * @param cases - All cases
 * @param caseIdsToUnmark - IDs of cases to unmark
 * @returns New array with unmarked cases
 * 
 * @example
 * const updated = unmarkCasesForArchival(cases, ['case-1', 'case-2']);
 */
export function unmarkCasesForArchival(
  cases: StoredCase[],
  caseIdsToUnmark: string[]
): StoredCase[] {
  const idsToUnmark = new Set(caseIdsToUnmark);
  
  return cases.map(caseItem => {
    if (idsToUnmark.has(caseItem.id)) {
      // Create new object without pendingArchival
      const { pendingArchival: _pendingArchival, ...rest } = caseItem;
      return rest as StoredCase;
    }
    return caseItem;
  });
}

/**
 * Get all cases currently in the archival review queue.
 * 
 * @param cases - All cases
 * @returns Cases with pendingArchival === true
 */
export function getCasesInArchivalQueue(cases: StoredCase[]): StoredCase[] {
  return cases.filter(c => c.pendingArchival === true);
}

/**
 * Merge new archive data with existing archive data.
 * Appends new cases/financials/notes to existing, avoiding duplicates by ID.
 * Updates the archivedAt timestamp.
 * 
 * @param existing - Existing archive data (or null for new archive)
 * @param newCases - New cases to add
 * @param newFinancials - New financials to add
 * @param newNotes - New notes to add
 * @param archiveYear - Year for the archive
 * @returns Merged archive data
 * 
 * @example
 * const merged = mergeArchiveData(existingArchive, newCases, newFinancials, newNotes, 2025);
 */
export function mergeArchiveData(
  existing: CaseArchiveData | null,
  newCases: StoredCase[],
  newFinancials: StoredFinancialItem[],
  newNotes: StoredNote[],
  archiveYear: number
): CaseArchiveData {
  const now = new Date().toISOString();
  
  if (!existing) {
    // Create new archive
    return {
      version: ARCHIVE_VERSION,
      archiveType: "cases",
      archivedAt: now,
      archiveYear,
      cases: newCases,
      financials: newFinancials,
      notes: newNotes,
    };
  }
  
  // Merge with existing, avoiding duplicates
  const existingCaseIds = new Set(existing.cases.map(c => c.id));
  const existingFinancialIds = new Set(existing.financials.map(f => f.id));
  const existingNoteIds = new Set(existing.notes.map(n => n.id));
  
  const mergedCases = [
    ...existing.cases,
    ...newCases.filter(c => !existingCaseIds.has(c.id)),
  ];
  
  const mergedFinancials = [
    ...existing.financials,
    ...newFinancials.filter(f => !existingFinancialIds.has(f.id)),
  ];
  
  const mergedNotes = [
    ...existing.notes,
    ...newNotes.filter(n => !existingNoteIds.has(n.id)),
  ];
  
  return {
    ...existing,
    archivedAt: now,
    cases: mergedCases,
    financials: mergedFinancials,
    notes: mergedNotes,
  };
}

/**
 * Remove cases (and their related data) from archive data.
 * Used when restoring cases from an archive.
 * 
 * @param archive - Archive data to remove from
 * @param caseIdsToRemove - IDs of cases to remove
 * @returns Updated archive data (or null if archive would be empty)
 */
export function removeCasesFromArchive(
  archive: CaseArchiveData,
  caseIdsToRemove: string[]
): CaseArchiveData | null {
  const idsToRemove = new Set(caseIdsToRemove);
  
  const remainingCases = archive.cases.filter(c => !idsToRemove.has(c.id));
  const remainingFinancials = archive.financials.filter(f => !idsToRemove.has(f.caseId));
  const remainingNotes = archive.notes.filter(n => !idsToRemove.has(n.caseId));
  
  // Return null if archive would be empty (caller can delete the file)
  if (remainingCases.length === 0) {
    return null;
  }
  
  return {
    ...archive,
    archivedAt: new Date().toISOString(),
    cases: remainingCases,
    financials: remainingFinancials,
    notes: remainingNotes,
  };
}
