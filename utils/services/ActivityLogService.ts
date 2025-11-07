import type { CaseActivityEntry } from "../../types/activityLog";
import { toActivityDateKey } from "../activityReport";
import { createLogger } from "../logger";
import type { FileStorageService, FileData } from "./FileStorageService";

const logger = createLogger("ActivityLogService");

// ============================================================================
// Type Definitions
// ============================================================================

interface ActivityLogServiceConfig {
  fileStorage: FileStorageService;
}

// ============================================================================
// ActivityLogService
// ============================================================================

/**
 * ActivityLogService
 * 
 * Handles all activity log operations.
 * Provides centralized access to case activity history with date-based filtering.
 * 
 * Responsibilities:
 * - Retrieve activity log entries
 * - Clear activity log entries by date
 * - Merge activity entries (utility)
 * 
 * Note: Activity log entries are created by domain operations (case mutations,
 * note additions, etc.) and stored in FileData.activityLog array.
 */
export class ActivityLogService {
  private fileStorage: FileStorageService;

  constructor(config: ActivityLogServiceConfig) {
    this.fileStorage = config.fileStorage;
  }

  /**
   * Get all activity log entries
   * Returns sorted array (newest first)
   */
  async getActivityLog(): Promise<CaseActivityEntry[]> {
    const data = await this.fileStorage.readFileData();
    return data?.activityLog ?? [];
  }

  /**
   * Clear activity log entries for a specific date
   * Returns the number of entries removed
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

    const updatedData: FileData = {
      ...currentData,
      activityLog: filtered,
    };

    await this.fileStorage.writeFileData(updatedData);

    logger.info("Cleared activity log entries for date", {
      dateKey,
      removedCount,
    });

    return removedCount;
  }

  /**
   * Merge activity entries (utility helper)
   * Combines current and new entries, removing duplicates and sorting by timestamp
   */
  static mergeActivityEntries(
    current: CaseActivityEntry[] | undefined,
    additions: CaseActivityEntry[],
  ): CaseActivityEntry[] {
    const combined = [...(current ?? []), ...additions];
    return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}
