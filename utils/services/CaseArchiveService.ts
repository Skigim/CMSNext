/**
 * @fileoverview Case Archive Service
 * 
 * Service for managing case archival operations. Handles:
 * - Marking cases for archival review
 * - Archiving approved cases to separate files
 * - Loading archived cases on demand
 * - Restoring cases from archives
 * 
 * Archive files use the naming pattern `archived-cases-{year}.json`.
 * Multiple archive operations in the same year append to existing files.
 * 
 * @module utils/services/CaseArchiveService
 */

import type { StoredCase } from "../../types/case";
import type { 
  CaseArchiveData, 
  ArchivalSettings, 
  ArchiveResult, 
  RestoreResult 
} from "../../types/archive";
import { 
  buildArchiveFileName, 
  parseArchiveYear, 
  isCaseArchiveData,
  DEFAULT_ARCHIVAL_SETTINGS 
} from "../../types/archive";
import { 
  findArchivalEligibleCases,
  collectRelatedData,
  markCasesForArchival,
  unmarkCasesForArchival,
  mergeArchiveData,
  removeCasesFromArchive,
  getCasesInArchivalQueue,
} from "../../domain/archive";
import type { FileStorageService, NormalizedFileData } from "./FileStorageService";
import AutosaveFileService from "../AutosaveFileService";
import { createLogger } from "../logger";

const logger = createLogger("CaseArchiveService");

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Configuration for CaseArchiveService initialization.
 */
interface CaseArchiveServiceConfig {
  /** File storage service for reading/writing case data */
  fileStorage: FileStorageService;
  /** Autosave file service for archive file operations */
  fileService: AutosaveFileService;
}

/**
 * Result of refreshing the archival queue.
 */
export interface RefreshQueueResult {
  /** Number of new cases marked for archival */
  newlyMarked: number;
  /** Total cases now in the archival queue */
  totalPending: number;
  /** IDs of newly marked cases */
  newlyMarkedIds: string[];
}

/**
 * Information about an archive file.
 */
export interface ArchiveFileInfo {
  /** Filename (e.g., "archived-cases-2025.json") */
  fileName: string;
  /** Year extracted from filename */
  year: number;
  /** Number of cases in the archive (if loaded) */
  caseCount?: number;
}

// ============================================================================
// CaseArchiveService
// ============================================================================

/**
 * CaseArchiveService - Case archival and restoration operations
 * 
 * This service manages the case archival workflow:
 * 
 * 1. **Queue Refresh**: Automatically identifies cases eligible for archival
 *    based on age and status, marking them as `pendingArchival`.
 * 
 * 2. **User Review**: Users review pending cases in the "archival-review" segment.
 * 
 * 3. **Approval**: Approved cases are moved to archive files with their
 *    related financials and notes.
 * 
 * 4. **Restoration**: Archived cases can be restored on demand.
 * 
 * ## Architecture
 * 
 * ```
 * CaseArchiveService
 *     ├── FileStorageService (main data file operations)
 *     └── AutosaveFileService (archive file operations)
 * ```
 * 
 * ## Archive File Format
 * 
 * Archive files are stored as `archived-cases-{year}.json`:
 * 
 * ```typescript
 * {
 *   version: "1.0",
 *   archiveType: "cases",
 *   archivedAt: "2026-01-22T10:30:00.000Z",
 *   archiveYear: 2025,
 *   cases: [...],
 *   financials: [...],
 *   notes: [...]
 * }
 * ```
 * 
 * @class CaseArchiveService
 */
export class CaseArchiveService {
  private readonly fileStorage: FileStorageService;
  private readonly fileService: AutosaveFileService;

  /**
   * Create a new CaseArchiveService instance.
   * 
   * @param config - Configuration object
   */
  constructor(config: CaseArchiveServiceConfig) {
    this.fileStorage = config.fileStorage;
    this.fileService = config.fileService;
  }

  // ==========================================================================
  // Queue Management
  // ==========================================================================

  /**
   * Refresh the archival queue by marking eligible cases as pending.
   * 
   * Cases become eligible based on archivalSettings:
   * - Age exceeds thresholdMonths (based on updatedAt)
   * - If archiveClosedOnly is true, status must be marked as "completed" in config
   * - Not already marked as pendingArchival
   * 
   * @param settings - Archival settings (threshold, closedOnly flag)
   * @param completedStatuses - Set of status names that count as completed
   * @returns Result with count of newly marked cases
   * 
   * @example
   * const result = await archiveService.refreshArchivalQueue(
   *   { thresholdMonths: 12, archiveClosedOnly: true },
   *   new Set(['Closed', 'Archived'])
   * );
   * if (result.newlyMarked > 0) {
   *   toast.info(`${result.newlyMarked} cases pending archival review`);
   * }
   */
  async refreshArchivalQueue(
    settings: ArchivalSettings = DEFAULT_ARCHIVAL_SETTINGS,
    completedStatuses: Set<string> = new Set()
  ): Promise<RefreshQueueResult> {
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      return { newlyMarked: 0, totalPending: 0, newlyMarkedIds: [] };
    }

    // Find cases eligible for archival
    const eligibility = findArchivalEligibleCases(currentData.cases, {
      settings,
      completedStatuses,
    });

    if (eligibility.eligibleCaseIds.length === 0) {
      // No new cases to mark, but count existing pending
      const existingPending = getCasesInArchivalQueue(currentData.cases);
      return { 
        newlyMarked: 0, 
        totalPending: existingPending.length, 
        newlyMarkedIds: [] 
      };
    }

    // Mark eligible cases as pending archival
    const updatedCases = markCasesForArchival(
      currentData.cases, 
      eligibility.eligibleCaseIds
    );

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: updatedCases,
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    // Count total pending after update
    const totalPending = getCasesInArchivalQueue(updatedCases).length;

    logger.info("Refreshed archival queue", {
      newlyMarked: eligibility.eligibleCaseIds.length,
      totalPending,
      thresholdMonths: settings.thresholdMonths,
      archiveClosedOnly: settings.archiveClosedOnly,
    });

    return {
      newlyMarked: eligibility.eligibleCaseIds.length,
      totalPending,
      newlyMarkedIds: eligibility.eligibleCaseIds,
    };
  }

  /**
   * Cancel archival for specified cases (remove from pending queue).
   * 
   * @param caseIds - IDs of cases to remove from archival queue
   * @returns Number of cases removed from queue
   */
  async cancelArchival(caseIds: string[]): Promise<number> {
    if (caseIds.length === 0) {
      return 0;
    }

    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      return 0;
    }

    const updatedCases = unmarkCasesForArchival(currentData.cases, caseIds);

    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: updatedCases,
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    logger.info("Cancelled archival for cases", {
      count: caseIds.length,
      caseIds,
    });

    return caseIds.length;
  }

  /**
   * Mark arbitrary cases as pending archival review.
   * 
   * Unlike `refreshArchivalQueue()` which uses age/status-based eligibility,
   * this method marks any specified cases directly. Used by the position
   * assignments import to flag cases not found on a worker's assignment list.
   * 
   * @param caseIds - IDs of cases to mark as pending archival
   * @returns Object with count and IDs of newly marked cases
   */
  async markForArchival(caseIds: string[]): Promise<{ markedCount: number; markedIds: string[] }> {
    if (caseIds.length === 0) {
      return { markedCount: 0, markedIds: [] };
    }

    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      return { markedCount: 0, markedIds: [] };
    }

    // Dedupe input and intersect with existing case IDs, excluding already-pending
    const uniqueRequestedIds = [...new Set(caseIds)];
    const caseIdSet = new Set(currentData.cases.map(c => c.id));
    const alreadyPending = new Set(
      currentData.cases.filter(c => c.pendingArchival).map(c => c.id)
    );
    const newIds = uniqueRequestedIds.filter(
      id => caseIdSet.has(id) && !alreadyPending.has(id)
    );

    if (newIds.length === 0) {
      return { markedCount: 0, markedIds: [] };
    }

    const updatedCases = markCasesForArchival(currentData.cases, newIds);

    // Count actual changes by comparing before/after
    const markedIds = updatedCases
      .filter(c => c.pendingArchival && !alreadyPending.has(c.id) && newIds.includes(c.id))
      .map(c => c.id);

    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: updatedCases,
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    logger.info("Marked cases for archival via position assignments", {
      markedCount: markedIds.length,
      markedIds,
    });

    return { markedCount: markedIds.length, markedIds };
  }

  // ==========================================================================
  // Archive Operations
  // ==========================================================================

  /**
   * Archive approved cases to the archive file for the current year.
   * 
   * This operation:
   * 1. Collects cases and their related financials/notes
   * 2. Reads existing archive file (if any) for the current year
   * 3. Merges new data with existing archive
   * 4. Writes updated archive file
   * 5. Removes archived cases from main data file
   * 
   * @param caseIds - IDs of cases to archive
   * @returns Result with count and archive filename
   * 
   * @example
   * const result = await archiveService.archiveCases(['case-1', 'case-2']);
   * toast.success(`Archived ${result.archivedCount} cases to ${result.archiveFileName}`);
   */
  async archiveCases(caseIds: string[]): Promise<ArchiveResult> {
    if (caseIds.length === 0) {
      return { archivedCount: 0, archiveFileName: "", archivedCaseIds: [] };
    }

    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error("Failed to read current data for archival");
    }

    // Collect cases to archive
    const caseIdSet = new Set(caseIds);
    const casesToArchive = currentData.cases.filter(c => caseIdSet.has(c.id));

    if (casesToArchive.length === 0) {
      return { archivedCount: 0, archiveFileName: "", archivedCaseIds: [] };
    }

    // Collect related financials and notes
    const archivedCaseIds = casesToArchive.map(c => c.id);
    const related = collectRelatedData(
      archivedCaseIds,
      currentData.financials,
      currentData.notes
    );

    // Determine archive file for current year
    const archiveYear = new Date().getFullYear();
    const archiveFileName = buildArchiveFileName(archiveYear);

    // Read existing archive (if any)
    const existingArchive = await this.readExistingArchive(archiveFileName);

    // Remove pendingArchival flag from cases before archiving
    const cleanedCases = casesToArchive.map(c => {
      const { pendingArchival: _pendingArchival, ...rest } = c;
      return rest as StoredCase;
    });

    // Merge with existing archive
    const mergedArchive = mergeArchiveData(
      existingArchive,
      cleanedCases,
      related.financials,
      related.notes,
      archiveYear
    );

    // Write archive file first
    const writeSuccess = await this.fileService.writeNamedFile(archiveFileName, mergedArchive);
    if (!writeSuccess) {
      throw new Error(`Failed to write archive file: ${archiveFileName}`);
    }

    // Remove archived data from main file
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: currentData.cases.filter(c => !caseIdSet.has(c.id)),
      financials: currentData.financials.filter(f => !caseIdSet.has(f.caseId)),
      notes: currentData.notes.filter(n => !caseIdSet.has(n.caseId)),
    };

    try {
      await this.fileStorage.writeNormalizedData(updatedData);
    } catch (mainWriteError) {
      await this.rollbackArchiveWrite(archiveFileName, existingArchive);
      throw mainWriteError;
    }

    logger.info("Archived cases successfully", {
      archivedCount: archivedCaseIds.length,
      archiveFileName,
      financialsArchived: related.financials.length,
      notesArchived: related.notes.length,
    });

    return {
      archivedCount: archivedCaseIds.length,
      archiveFileName,
      archivedCaseIds,
    };
  }

  /**
   * Attempt to read an existing archive file, returning null if not found.
   */
  private async readExistingArchive(archiveFileName: string): Promise<CaseArchiveData | null> {
    try {
      const existingData = await this.fileService.readNamedFile(archiveFileName);
      if (existingData && isCaseArchiveData(existingData)) {
        return existingData;
      }
    } catch {
      logger.debug("No existing archive file", { archiveFileName });
    }
    return null;
  }

  /**
   * Rollback an archive write by restoring the previous archive state.
   */
  private async rollbackArchiveWrite(
    archiveFileName: string,
    existingArchive: CaseArchiveData | null
  ): Promise<void> {
    logger.warn("Main file write failed, rolling back archive write", { archiveFileName });
    try {
      if (existingArchive) {
        await this.fileService.writeNamedFile(archiveFileName, existingArchive);
      } else {
        logger.warn("Cannot delete newly created archive file on rollback - duplicates may exist temporarily");
      }
    } catch (rollbackError) {
      logger.error("Failed to rollback archive file after main write failure", {
        archiveFileName,
        rollbackError: rollbackError instanceof Error ? rollbackError.message : "Unknown error",
      });
    }
  }

  // ==========================================================================
  // Archive Browsing
  // ==========================================================================

  /**
   * List all available archive files.
   * 
   * @returns Array of archive file information sorted by year (newest first)
   */
  async listArchiveFiles(): Promise<ArchiveFileInfo[]> {
    const allFiles = await this.fileService.listDataFiles();
    
    const archiveFiles: ArchiveFileInfo[] = [];
    
    for (const fileName of allFiles) {
      const year = parseArchiveYear(fileName);
      if (year !== null) {
        archiveFiles.push({ fileName, year });
      }
    }

    // Sort by year descending (newest first)
    archiveFiles.sort((a, b) => b.year - a.year);

    return archiveFiles;
  }

  /**
   * Load archived cases from a specific archive file.
   * 
   * This loads the archive data for viewing/searching but does NOT
   * merge it with the main data file.
   * 
   * @param fileName - Archive filename to load
   * @returns Archive data or null if not found/invalid
   */
  async loadArchivedCases(fileName: string): Promise<CaseArchiveData | null> {
    try {
      const data = await this.fileService.readNamedFile(fileName);
      if (!data) {
        logger.debug("Archive file not found", { fileName });
        return null;
      }

      if (!isCaseArchiveData(data)) {
        logger.warn("Invalid archive file format", { fileName });
        return null;
      }

      logger.info("Loaded archive file", {
        fileName,
        caseCount: data.cases.length,
        financialCount: data.financials.length,
        noteCount: data.notes.length,
      });

      return data;
    } catch (error) {
      logger.error("Failed to load archive file", {
        fileName,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  // ==========================================================================
  // Restoration
  // ==========================================================================

  /**
   * Restore cases from an archive back to the main data file.
   * 
   * This operation:
   * 1. Loads the archive file
   * 2. Extracts specified cases with their financials/notes
   * 3. Adds them back to the main data file
   * 4. Removes them from the archive file (or deletes archive if empty)
   * 
   * @param archiveFileName - Archive file to restore from
   * @param caseIds - IDs of cases to restore
   * @returns Result with counts of restored items
   * 
   * @example
   * const result = await archiveService.restoreCases('archived-cases-2025.json', ['case-1']);
   * toast.success(`Restored ${result.restoredCount} cases`);
   */
  async restoreCases(
    archiveFileName: string,
    caseIds: string[]
  ): Promise<RestoreResult> {
    const emptyResult: RestoreResult = { restoredCount: 0, financialsRestored: 0, notesRestored: 0, restoredCaseIds: [] };
    if (caseIds.length === 0) return emptyResult;

    // Load archive
    const archive = await this.loadArchivedCases(archiveFileName);
    if (!archive) {
      throw new Error(`Archive file not found or invalid: ${archiveFileName}`);
    }

    // Extract cases to restore
    const caseIdSet = new Set(caseIds);
    const casesToRestore = archive.cases.filter(c => caseIdSet.has(c.id));
    if (casesToRestore.length === 0) return emptyResult;

    // Collect related financials and notes from archive
    const restoredCaseIds = casesToRestore.map(c => c.id);
    const related = collectRelatedData(restoredCaseIds, archive.financials, archive.notes);

    // Load current main data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error("Failed to read current data for restoration");
    }

    // Deduplicate and merge into main file
    const { newCases, newFinancials, newNotes } = this.deduplicateForRestore(
      casesToRestore, related.financials, related.notes, currentData
    );

    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: [...currentData.cases, ...newCases],
      financials: [...currentData.financials, ...newFinancials],
      notes: [...currentData.notes, ...newNotes],
    };

    // Write main file first with restored cases
    await this.fileStorage.writeNormalizedData(updatedData);

    // Derive actually-restored IDs from the deduplicated set
    const actualRestoredCaseIds = newCases.map(c => c.id);

    // Update archive file (remove restored cases)
    await this.updateArchiveAfterRestore(archive, archiveFileName, actualRestoredCaseIds, currentData);

    logger.info("Restored cases from archive", {
      archiveFileName,
      restoredCount: newCases.length,
      financialsRestored: newFinancials.length,
      notesRestored: newNotes.length,
    });

    return {
      restoredCount: newCases.length,
      financialsRestored: newFinancials.length,
      notesRestored: newNotes.length,
      restoredCaseIds: actualRestoredCaseIds,
    };
  }

  /**
   * Deduplicate restored items against the current main data.
   */
  private deduplicateForRestore(
    casesToRestore: StoredCase[],
    financials: NormalizedFileData['financials'],
    notes: NormalizedFileData['notes'],
    currentData: NormalizedFileData
  ) {
    const existingCaseIds = new Set(currentData.cases.map(c => c.id));
    const existingFinancialIds = new Set(currentData.financials.map(f => f.id));
    const existingNoteIds = new Set(currentData.notes.map(n => n.id));

    return {
      newCases: casesToRestore.filter(c => !existingCaseIds.has(c.id)),
      newFinancials: financials.filter(f => !existingFinancialIds.has(f.id)),
      newNotes: notes.filter(n => !existingNoteIds.has(n.id)),
    };
  }

  /**
   * Update the archive file after restoring cases, rolling back main file on failure.
   */
  private async updateArchiveAfterRestore(
    archive: CaseArchiveData,
    archiveFileName: string,
    restoredCaseIds: string[],
    originalMainData: NormalizedFileData
  ): Promise<void> {
    const updatedArchive = removeCasesFromArchive(archive, restoredCaseIds);

    try {
      const archiveToWrite = updatedArchive ?? {
        ...archive,
        archivedAt: new Date().toISOString(),
        cases: [],
        financials: [],
        notes: [],
      };
      const archiveWriteSuccess = await this.fileService.writeNamedFile(archiveFileName, archiveToWrite);
      if (!archiveWriteSuccess) {
        throw new Error("Archive write returned false");
      }
    } catch (archiveWriteError) {
      logger.warn("Archive file update failed, rolling back main file restore", {
        archiveFileName,
        error: archiveWriteError instanceof Error ? archiveWriteError.message : "Unknown error",
      });
      
      try {
        await this.fileStorage.writeNormalizedData(originalMainData);
      } catch (rollbackError) {
        logger.error("Failed to rollback main file after archive write failure - duplicates may exist", {
          archiveFileName,
          rollbackError: rollbackError instanceof Error ? rollbackError.message : "Unknown error",
        });
      }
      
      throw new Error(`Failed to update archive file after restore: ${archiveWriteError instanceof Error ? archiveWriteError.message : "Unknown error"}`);
    }
  }

  /**
   * Get the current pending archival count.
   * 
   * @returns Number of cases pending archival review
   */
  async getPendingCount(): Promise<number> {
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      return 0;
    }
    return getCasesInArchivalQueue(currentData.cases).length;
  }
}
