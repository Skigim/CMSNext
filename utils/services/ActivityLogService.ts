import { v4 as uuidv4 } from 'uuid';
import type { CaseActivityEntry, CaseStatusChangeActivity } from "../../types/activityLog";
import { toActivityDateKey } from "../activityReport";
import { createLogger } from "../logger";
import type { FileStorageService, NormalizedFileData } from "./FileStorageService";

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
  private fileStorage: FileStorageService;

  /**
   * Create a new ActivityLogService instance.
   * 
   * @param {ActivityLogServiceConfig} config - Configuration object
   * @param {FileStorageService} config.fileStorage - File storage service instance
   */
  constructor(config: ActivityLogServiceConfig) {
    this.fileStorage = config.fileStorage;
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
          error: error instanceof Error ? error.message : error,
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
    return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}
