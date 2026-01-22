/**
 * @fileoverview Archive Types
 * 
 * Type definitions for the case archival system. Archived cases (with their
 * related financials and notes) are stored in separate files that can be
 * loaded on-demand rather than by default.
 * 
 * @module types/archive
 */

import type { StoredCase, StoredFinancialItem, StoredNote } from "./case";

/**
 * Data format version for archive files.
 * Increment when making breaking changes to archive structure.
 */
export const ARCHIVE_VERSION = "1.0" as const;

/**
 * Data structure for case archive files.
 * 
 * Archive files contain cases along with their related financials and notes,
 * organized by archive year. Multiple archive operations in the same year
 * append to the existing archive file.
 * 
 * @example
 * File: archived-cases-2025.json
 * {
 *   version: "1.0",
 *   archiveType: "cases",
 *   archivedAt: "2026-01-22T10:30:00.000Z",
 *   archiveYear: 2025,
 *   cases: [...],
 *   financials: [...],
 *   notes: [...]
 * }
 */
export interface CaseArchiveData {
  /** Archive format version (always "1.0") */
  version: typeof ARCHIVE_VERSION;
  /** Type discriminator for archive files */
  archiveType: "cases";
  /** ISO timestamp of when the archive was last updated */
  archivedAt: string;
  /** Year identifier for this archive (based on archive date) */
  archiveYear: number;
  /** Archived cases (without nested financials/notes) */
  cases: StoredCase[];
  /** Financials belonging to archived cases (linked by caseId) */
  financials: StoredFinancialItem[];
  /** Notes belonging to archived cases (linked by caseId) */
  notes: StoredNote[];
}

/**
 * Type guard to check if data matches the CaseArchiveData format.
 * 
 * @param data - Data to validate
 * @returns true if data is a valid CaseArchiveData structure
 */
export function isCaseArchiveData(data: unknown): data is CaseArchiveData {
  if (data === null || typeof data !== "object") {
    return false;
  }
  
  const candidate = data as Record<string, unknown>;
  
  return (
    candidate.version === ARCHIVE_VERSION &&
    candidate.archiveType === "cases" &&
    typeof candidate.archivedAt === "string" &&
    typeof candidate.archiveYear === "number" &&
    Array.isArray(candidate.cases) &&
    Array.isArray(candidate.financials) &&
    Array.isArray(candidate.notes)
  );
}

/**
 * Configuration for the case archival system.
 * Stored as part of CategoryConfig in the main data file.
 */
export interface ArchivalSettings {
  /** Number of months of inactivity before a case becomes eligible for archival */
  thresholdMonths: number;
  /** When true, only cases with status "Closed" or "Archived" are eligible */
  archiveClosedOnly: boolean;
}

/**
 * Default archival settings.
 * - 12 months threshold
 * - Only archive closed cases
 */
export const DEFAULT_ARCHIVAL_SETTINGS: ArchivalSettings = Object.freeze({
  thresholdMonths: 12,
  archiveClosedOnly: true,
});

/**
 * File naming pattern for archive files.
 * 
 * @param year - The archive year
 * @returns Archive filename (e.g., "archived-cases-2025.json")
 */
export function buildArchiveFileName(year: number): string {
  return `archived-cases-${year}.json`;
}

/**
 * Parse archive year from a filename.
 * 
 * @param fileName - Archive filename to parse
 * @returns Archive year or null if not a valid archive filename
 */
export function parseArchiveYear(fileName: string): number | null {
  const match = fileName.match(/^archived-cases-(\d{4})\.json$/);
  if (!match) {
    return null;
  }
  return parseInt(match[1], 10);
}

/**
 * Result of an archive operation.
 */
export interface ArchiveResult {
  /** Number of cases successfully archived */
  archivedCount: number;
  /** Name of the archive file written to */
  archiveFileName: string;
  /** IDs of archived cases */
  archivedCaseIds: string[];
}

/**
 * Result of a restore operation.
 */
export interface RestoreResult {
  /** Number of cases successfully restored */
  restoredCount: number;
  /** Number of related financials restored */
  financialsRestored: number;
  /** Number of related notes restored */
  notesRestored: number;
  /** IDs of restored cases */
  restoredCaseIds: string[];
}
