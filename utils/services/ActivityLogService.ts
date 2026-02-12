import { v4 as uuidv4 } from 'uuid';
import type { CaseActivityEntry, CaseStatusChangeActivity, CaseViewedActivity } from "../../types/activityLog";
import { toActivityDateKey } from "../activityReport";
import { createLogger } from "../logger";
import { extractErrorMessage } from "../errorUtils";
import type { FileStorageService, NormalizedFileData } from "./FileStorageService";
import type AutosaveFileService from "../AutosaveFileService";

const logger = createLogger("ActivityLogService");

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Configuration for ActivityLogService initialization.
 * @interface ActivityLogServiceConfig
 */
interface ActivityLogServiceConfig {
  /** File storage service for reading/writing activity log data */
  fileStorage: FileStorageService;
  /** Optional file service for writing archive files */
  fileService?: AutosaveFileService;
}

/** Default number of days to retain activity entries before archiving */
export const DEFAULT_ACTIVITY_RETENTION_DAYS = 90;

/** Result from an auto-archive operation */
export interface ActivityArchiveResult {
  /** Number of entries archived */
  archivedCount: number;
  /** Number of entries retained in the main file */
  retainedCount: number;
  /** Names of the archive files written (empty if none) */
  archiveFileNames: string[];
}

// ============================================================================
// ActivityLogService
// ============================================================================

/**
 * ActivityLogService - Activity log retrieval and management
 * 
 * This service provides centralized access to case activity history with
 * date-based filtering capabilities. Activity log entries are created by
 * domain operations (case mutations, note additions, etc.) throughout the system.
 * 
 * ## Architecture
 * 
 * ```
 * ActivityLogService
 *     ↓
 * FileStorageService (read/write operations)
 *     ↓
 * AutosaveFileService (file I/O)
 * ```
 * 
 * ## Data Format
 * 
 * Activity log entries are stored in a flat array:
 * 
 * ```typescript
 * {
 *   id: string,
 *   timestamp: string,  // ISO timestamp
 *   caseId: string,
 *   caseName: string,
 *   caseMcn: string | null,
 *   type: 'status-change' | 'priority-change' | 'note-added' | 'case-created' | 'case-deleted',
 *   payload: object     // Type-specific details
 * }
 * ```
 * 
 * ## Core Responsibilities
 * 
 * ### Read Operations
 * - Retrieve all activity log entries
 * - Entries are sorted newest first
 * 
 * ### Maintenance Operations
 * - Clear activity log entries by date
 * - Filter and remove specific date ranges
 * 
 * ### Utility Operations
 * - Merge new entries with existing log
 * - Sort entries by timestamp
 * 
 * ## Important Notes
 * 
 * - **Read-Only Creation**: This service does NOT create activity entries.
 *   Entries are created by domain services (CaseService, NotesService, etc.)
 *   as part of their operations.
 * 
 * - **Automatic Sorting**: Activity log is always sorted newest first when
 *   retrieved or merged.
 * 
 * - **Date-Based Cleanup**: Provides date-based filtering for log maintenance
 *   and storage management.
 * 
 * ## Pattern: Read → Modify → Write
 * 
 * Operations follow the stateless pattern:
 * 1. Read current data from file
 * 2. Filter/modify entries in memory
 * 3. Write updated data back to file
 * 4. Return result
 * 
 * @class ActivityLogService
 * @see {@link FileStorageService} for underlying storage operations
 * @see {@link CaseService} for case activity creation
 * @see {@link NotesService} for note activity creation
 */
export class ActivityLogService {
  /** File storage service for data persistence */
  private readonly fileStorage: FileStorageService;
  /** Optional file service for writing named archive files */
  private readonly fileService: AutosaveFileService | null;
  /** In-flight auto-archive promise to prevent concurrent runs */
  private autoArchiveInFlight: Promise<ActivityArchiveResult> | null = null;

  /**
   * Create a new ActivityLogService instance.
   * 
   * @param {ActivityLogServiceConfig} config - Configuration object
   * @param {FileStorageService} config.fileStorage - File storage service instance
   * @param {AutosaveFileService} [config.fileService] - Optional file service for archive writes
   */
  constructor(config: ActivityLogServiceConfig) {
    this.fileStorage = config.fileStorage;
    this.fileService = config.fileService ?? null;
  }

  /**
   * Get all activity log entries.
   * 
   * Returns entries sorted by timestamp (newest first).
   * Always reads fresh data from disk.
   * 
   * @returns {Promise<CaseActivityEntry[]>} Array of activity log entries, or empty array if no data
   * 
   * @example
   * const activities = await activityLogService.getActivityLog();
   * console.log(`Found ${activities.length} activity entries`);
   * // Entries are sorted newest first
   */
  async getActivityLog(): Promise<CaseActivityEntry[]> {
    const data = await this.fileStorage.readFileData();
    return data?.activityLog ?? [];
  }

  /**
   * Clear activity log entries for a specific date.
   * 
   * This method:
   * 1. Reads current data from file
   * 2. Converts target date to activity date key (YYYY-MM-DD)
   * 3. Filters out entries matching the date
   * 4. Handles entries with invalid timestamps gracefully
   * 5. Writes updated log back to file
   * 6. Returns count of removed entries
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * **Use Case:** Cleanup old entries, remove specific date ranges, or
   * manage log storage size.
   * 
   * @param {string | Date} targetDate - The date to clear entries for (ISO string or Date object)
   * @returns {Promise<number>} Number of entries removed
   * @throws {Error} If failed to read current data
   * 
   * @example
   * const removed = await activityLogService.clearActivityLogForDate('2024-01-15');
   * console.log(`Removed ${removed} activity entries for 2024-01-15`);
   * 
   * // Or using Date object
   * const date = new Date('2024-01-15');
   * const count = await activityLogService.clearActivityLogForDate(date);
   */
  async clearActivityLogForDate(targetDate: string | Date): Promise<number> {
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error("Failed to read current data");
    }

    const { activityLog } = currentData;
    if (!activityLog || activityLog.length === 0) {
      return 0;
    }

    const dateKey = toActivityDateKey(targetDate);

    const filtered = activityLog.filter((entry) => {
      try {
        return toActivityDateKey(entry.timestamp) !== dateKey;
      } catch (error) {
        logger.warn("Skipping activity entry with invalid timestamp during clear operation", {
          entryId: entry.id,
          timestamp: entry.timestamp,
          error: extractErrorMessage(error),
        });
        return true;
      }
    });

    const removedCount = activityLog.length - filtered.length;
    if (removedCount === 0) {
      return 0;
    }

    const updatedData: NormalizedFileData = {
      ...currentData,
      activityLog: filtered,
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    logger.info("Cleared activity log entries for date", {
      dateKey,
      removedCount,
    });

    return removedCount;
  }

  /**
   * Archive old activity log entries beyond a cutoff date.
   * 
   * Moves entries older than the cutoff to a separate archive.
   * Returns both the current (recent) entries and archived entries.
   * The main data file is updated to only contain recent entries.
   * 
   * Recommended: Call with 1 year cutoff during file load for auto-archiving.
   * Archive file naming: `activityLog-archive-{year}.json`
   * 
   * @param cutoffDate - Entries older than this date will be archived
   * @returns Object with recentEntries, archivedEntries arrays, and count
   * 
   * @example
   * const oneYearAgo = new Date();
   * oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
   * const result = await activityLogService.archiveOldEntries(oneYearAgo);
   * console.log(`Archived ${result.archivedCount} old entries`);
   */
  async archiveOldEntries(cutoffDate: Date): Promise<{
    recentEntries: CaseActivityEntry[];
    archivedEntries: CaseActivityEntry[];
    archivedCount: number;
  }> {
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      return { recentEntries: [], archivedEntries: [], archivedCount: 0 };
    }

    const { activityLog } = currentData;
    if (!activityLog || activityLog.length === 0) {
      return { recentEntries: [], archivedEntries: [], archivedCount: 0 };
    }

    const cutoffTime = cutoffDate.getTime();
    const recentEntries: CaseActivityEntry[] = [];
    const archivedEntries: CaseActivityEntry[] = [];

    for (const entry of activityLog) {
      try {
        const entryTime = new Date(entry.timestamp).getTime();
        if (entryTime >= cutoffTime) {
          recentEntries.push(entry);
        } else {
          archivedEntries.push(entry);
        }
      } catch (error) {
        // Keep entries with invalid timestamps in recent to avoid data loss
        logger.warn("Activity entry has invalid timestamp, keeping in recent", {
          entryId: entry.id,
          timestamp: entry.timestamp,
          error: extractErrorMessage(error),
        });
        recentEntries.push(entry);
      }
    }

    if (archivedEntries.length === 0) {
      return { recentEntries: activityLog, archivedEntries: [], archivedCount: 0 };
    }

    // Update the main data file with only recent entries
    const updatedData: NormalizedFileData = {
      ...currentData,
      activityLog: recentEntries,
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    logger.info("Archived old activity log entries", {
      recentCount: recentEntries.length,
      archivedCount: archivedEntries.length,
      cutoffDate: cutoffDate.toISOString(),
    });

    return {
      recentEntries,
      archivedEntries,
      archivedCount: archivedEntries.length,
    };
  }

  /**
   * Auto-archive old activity entries to a separate file.
   * 
   * Archives entries older than `retentionDays` to a yearly JSON archive file
   * named `activityLog-archive-{year}.json`. If an archive file already exists
   * for the year, new entries are merged in (deduplicated by ID).
   * 
   * Requires `fileService` to be set for writing archive files.
   * 
   * @param retentionDays - How many days of entries to keep (default: 90)
   * @returns Archive result with counts and file name
   * 
   * @example
   * const result = await activityLogService.autoArchive();
   * if (result.archivedCount > 0) {
   *   console.log(`Archived ${result.archivedCount} entries to ${result.archiveFileNames.join(', ')}`);
   * }
   */
  async autoArchive(retentionDays: number = DEFAULT_ACTIVITY_RETENTION_DAYS): Promise<ActivityArchiveResult> {
    // Serialize: if an archive is already in flight, return its result
    if (this.autoArchiveInFlight) {
      return this.autoArchiveInFlight;
    }

    this.autoArchiveInFlight = this._doAutoArchive(retentionDays);
    try {
      return await this.autoArchiveInFlight;
    } finally {
      this.autoArchiveInFlight = null;
    }
  }

  /**
   * Internal implementation of auto-archive.
   * @private
   */
  private async _doAutoArchive(retentionDays: number): Promise<ActivityArchiveResult> {
    if (!Number.isFinite(retentionDays) || retentionDays < 1) {
      throw new Error(`Invalid retentionDays: ${retentionDays}. Must be a finite number >= 1.`);
    }

    if (!this.fileService) {
      logger.warn("Cannot auto-archive activity log: no fileService configured");
      return { archivedCount: 0, retainedCount: 0, archiveFileNames: [] };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.archiveOldEntries(cutoffDate);

    if (result.archivedCount === 0) {
      return { archivedCount: 0, retainedCount: result.recentEntries.length, archiveFileNames: [] };
    }

    // Group archived entries by year
    const byYear = new Map<number, CaseActivityEntry[]>();
    for (const entry of result.archivedEntries) {
      const year = new Date(entry.timestamp).getFullYear();
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year)!.push(entry);
    }

    const archiveFileNames: string[] = [];

    for (const [year, entries] of byYear) {
      const fileName = `activityLog-archive-${year}.json`;
      archiveFileNames.push(fileName);

      // Read existing archive if present
      let existingEntries: CaseActivityEntry[] = [];
      try {
        const existing = await this.fileService.readNamedFile(fileName);
        if (existing && Array.isArray((existing as { entries?: unknown }).entries)) {
          existingEntries = (existing as { entries: CaseActivityEntry[] }).entries;
        }
      } catch {
        // File doesn't exist yet — that's fine
      }

      // Merge, deduplicate by ID, sort by precomputed timestamps
      const existingIds = new Set(existingEntries.map(e => e.id));
      const merged = [...existingEntries, ...entries.filter(e => !existingIds.has(e.id))];
      const timeCache = new Map<string, number>(merged.map(e => [e.id, Date.parse(e.timestamp)]));
      merged.sort((a, b) => (timeCache.get(b.id) ?? 0) - (timeCache.get(a.id) ?? 0));

      const archivePayload = {
        type: 'activityLog-archive' as const,
        year,
        entryCount: merged.length,
        archivedAt: new Date().toISOString(),
        entries: merged,
      };

      await this.fileService.writeNamedFile(fileName, archivePayload);
      logger.info("Wrote activity log archive file", { fileName, entryCount: merged.length, newEntries: entries.length });
    }

    return {
      archivedCount: result.archivedCount,
      retainedCount: result.recentEntries.length,
      archiveFileNames,
    };
  }

  /**
   * Get activity log with a maximum entry limit.
   * 
   * Returns the most recent entries up to the specified limit.
   * Useful for pagination or limiting memory usage with large logs.
   * 
   * @param maxEntries - Maximum number of entries to return
   * @returns Array of most recent activity entries (already sorted newest first)
   * 
   * @example
   * const recent100 = await activityLogService.getActivityLogWithLimit(100);
   */
  async getActivityLogWithLimit(maxEntries: number): Promise<CaseActivityEntry[]> {
    const entries = await this.getActivityLog();
    return entries.slice(0, maxEntries);
  }

  /**
   * Get the total count of activity log entries.
   * 
   * Useful for displaying pagination info or size warnings.
   * 
   * @returns Total number of activity log entries
   */
  async getActivityLogCount(): Promise<number> {
    const entries = await this.getActivityLog();
    return entries.length;
  }

  /**
   * Create a status change activity log entry.
   * 
   * Factory method that creates a properly typed status change entry
   * with all required fields. Use this instead of manually constructing
   * activity entries to ensure consistency across the codebase.
   * 
   * @static
   * @param {Object} params - Entry parameters
   * @param {string} params.caseId - The case ID
   * @param {string} params.caseName - Display name of the case
   * @param {string | null} params.caseMcn - MCN of the case (optional)
   * @param {string | null} params.fromStatus - Previous status (optional for new cases)
   * @param {string} params.toStatus - New status
   * @param {string} [params.timestamp] - ISO timestamp (defaults to now)
   * @returns {CaseStatusChangeActivity} A properly typed activity entry
   * 
   * @example
   * const entry = ActivityLogService.createStatusChangeEntry({
   *   caseId: 'case-123',
   *   caseName: 'John Doe',
   *   caseMcn: 'MCN-456',
   *   fromStatus: 'Pending',
   *   toStatus: 'Approved',
   * });
   */
  static createStatusChangeEntry(params: {
    caseId: string;
    caseName: string;
    caseMcn: string | null;
    fromStatus: string | null | undefined;
    toStatus: string;
    timestamp?: string;
  }): CaseStatusChangeActivity {
    return {
      id: uuidv4(),
      timestamp: params.timestamp ?? new Date().toISOString(),
      caseId: params.caseId,
      caseName: params.caseName,
      caseMcn: params.caseMcn,
      type: "status-change",
      payload: {
        fromStatus: params.fromStatus ?? null,
        toStatus: params.toStatus,
      },
    };
  }

  /**
   * Merge activity entries utility helper.
   * 
   * This static utility method:
   * 1. Combines current entries with new additions
   * 2. Sorts all entries by timestamp (newest first)
   * 3. Returns the merged and sorted array
   * 
   * **Usage:** Called by domain services when adding new activity entries
   * to maintain proper chronological ordering.
   * 
   * @static
   * @param {CaseActivityEntry[] | undefined} current - Existing activity entries
   * @param {CaseActivityEntry[]} additions - New entries to add
   * @returns {CaseActivityEntry[]} Combined and sorted entries (newest first)
   * 
   * @example
   * const updated = ActivityLogService.mergeActivityEntries(
   *   currentData.activityLog,
   *   [newEntry1, newEntry2]
   * );
   * // Returns all entries sorted by timestamp descending
   */
  static mergeActivityEntries(
    current: CaseActivityEntry[] | undefined,
    additions: CaseActivityEntry[],
  ): CaseActivityEntry[] {
    const combined = [...(current ?? []), ...additions];
    const timeCache = new Map<string, number>(combined.map(e => [e.id, Date.parse(e.timestamp)]));
    return combined.sort((a, b) => (timeCache.get(b.id) ?? 0) - (timeCache.get(a.id) ?? 0));
  }

  /**
   * Create a case viewed activity log entry.
   * 
   * Factory method that creates a properly typed case viewed entry
   * with all required fields.
   * 
   * @static
   * @param {Object} params - Entry parameters
   * @param {string} params.caseId - The case ID
   * @param {string} params.caseName - Display name of the case
   * @param {string | null} params.caseMcn - MCN of the case (optional)
   * @param {string} [params.timestamp] - ISO timestamp (defaults to now)
   * @returns {CaseViewedActivity} A properly typed activity entry
   * 
   * @example
   * const entry = ActivityLogService.createCaseViewedEntry({
   *   caseId: 'case-123',
   *   caseName: 'John Doe',
   *   caseMcn: 'MCN-456',
   * });
   */
  static createCaseViewedEntry(params: {
    caseId: string;
    caseName: string;
    caseMcn: string | null;
    timestamp?: string;
  }): CaseViewedActivity {
    return {
      id: uuidv4(),
      timestamp: params.timestamp ?? new Date().toISOString(),
      caseId: params.caseId,
      caseName: params.caseName,
      caseMcn: params.caseMcn,
      type: "case-viewed",
      payload: {},
    };
  }

  /**
   * Log a case view activity.
   * 
   * Records that a case was viewed. Deduplicates consecutive views
   * of the same case within a short time window (5 minutes) to avoid
   * spamming the activity log.
   * 
   * @param {Object} params - Case details
   * @param {string} params.caseId - The case ID
   * @param {string} params.caseName - Display name of the case
   * @param {string | null} params.caseMcn - MCN of the case (optional)
   * @returns {Promise<boolean>} True if logged, false if deduplicated
   * 
   * @example
   * await activityLogService.logCaseView({
   *   caseId: 'case-123',
   *   caseName: 'John Doe',
   *   caseMcn: 'MCN-456',
   * });
   */
  async logCaseView(params: {
    caseId: string;
    caseName: string;
    caseMcn: string | null;
  }): Promise<boolean> {
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      logger.warn("Cannot log case view - no current data");
      return false;
    }

    const { activityLog = [] } = currentData;

    // Deduplicate: skip if same case was viewed within last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const recentViewOfSameCase = activityLog.find(
      (entry) =>
        entry.type === "case-viewed" &&
        entry.caseId === params.caseId &&
        new Date(entry.timestamp).getTime() > fiveMinutesAgo
    );

    if (recentViewOfSameCase) {
      logger.debug("Skipping duplicate case view within 5 minutes", {
        caseId: params.caseId,
      });
      return false;
    }

    const entry = ActivityLogService.createCaseViewedEntry(params);
    const updatedLog = ActivityLogService.mergeActivityEntries(activityLog, [entry]);

    const updatedData: NormalizedFileData = {
      ...currentData,
      activityLog: updatedLog,
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    logger.debug("Logged case view", {
      caseId: params.caseId,
      caseName: params.caseName,
    });

    return true;
  }
}
