import type { CaseDisplay } from "../../types/case";
import type { CaseActivityEntry } from "../../types/activityLog";
import type { CategoryConfig } from "../../types/categoryConfig";
import { mergeCategoryConfig } from "../../types/categoryConfig";
import AutosaveFileService from "../AutosaveFileService";
import { transformImportedData } from "../dataTransform";
import { createLogger } from "../logger";
import { reportFileStorageError, type FileStorageOperation } from "../fileStorageErrorReporter";

const logger = createLogger("FileStorageService");

// ============================================================================
// Type Definitions
// ============================================================================

export interface FileData {
  cases: CaseDisplay[];
  exported_at: string;
  total_cases: number;
  categoryConfig: CategoryConfig;
  activityLog: CaseActivityEntry[];
}

interface FileStorageServiceConfig {
  fileService: AutosaveFileService;
  persistNormalizationFixes?: boolean;
  normalizeCaseNotes?: (cases: CaseDisplay[]) => { cases: CaseDisplay[]; changed: boolean };
}

// ============================================================================
// FileStorageService
// ============================================================================

/**
 * FileStorageService
 * 
 * Handles all file I/O operations for case data.
 * Abstracts storage format and provides clean interface for reading/writing.
 * 
 * Responsibilities:
 * - Read/write FileData to/from disk
 * - Handle format transformations (raw → CaseDisplay)
 * - Normalize activity logs
 * - Validate data integrity before writes
 * - Error handling and reporting
 */
export class FileStorageService {
  private fileService: AutosaveFileService;
  private persistNormalizationFixes: boolean;
  private normalizeCaseNotes: (cases: CaseDisplay[]) => { cases: CaseDisplay[]; changed: boolean };

  constructor(config: FileStorageServiceConfig) {
    this.fileService = config.fileService;
    this.persistNormalizationFixes = config.persistNormalizationFixes ?? true;
    this.normalizeCaseNotes = config.normalizeCaseNotes ?? ((cases) => ({ cases, changed: false }));
  }

  /**
   * Read current data from file system
   * Returns null if no file exists or error occurs
   */
  async readFileData(): Promise<FileData | null> {
    try {
      const rawData = await this.fileService.readFile();

      if (!rawData) {
        // No file exists yet - return empty structure
        return {
          cases: [],
          exported_at: new Date().toISOString(),
          total_cases: 0,
          categoryConfig: mergeCategoryConfig(),
          activityLog: [],
        };
      }

      // Handle different data formats
      let cases: CaseDisplay[] = [];

      if (rawData.cases && Array.isArray(rawData.cases)) {
        // Already in CaseDisplay array format - use directly
        cases = rawData.cases;
      } else if (rawData.people && rawData.caseRecords) {
        // Raw format - transform using the data transformer
        logger.info("Transforming raw data format to cases");
        cases = transformImportedData(rawData);
      } else {
        // Try to transform whatever format this is
        cases = transformImportedData(rawData);
      }

      const categoryConfig = mergeCategoryConfig(rawData.categoryConfig);
      const activityLog = this.normalizeActivityLog((rawData as { activityLog?: unknown })?.activityLog);

      const { cases: normalizedCases, changed } = this.normalizeCaseNotes(cases);

      let finalCases = normalizedCases;
      let finalExportedAt = rawData.exported_at || rawData.exportedAt || new Date().toISOString();

      // Persist if notes were normalized
      if (changed && this.persistNormalizationFixes) {
        const persistedData = await this.writeFileData({
          cases: normalizedCases,
          exported_at: finalExportedAt,
          total_cases: normalizedCases.length,
          categoryConfig,
          activityLog,
        });

        finalCases = persistedData.cases;
        finalExportedAt = persistedData.exported_at;
      } else if (changed) {
        logger.warn("Note normalization needed but persistence disabled");
      }

      return {
        cases: finalCases,
        exported_at: finalExportedAt,
        total_cases: finalCases.length,
        categoryConfig,
        activityLog,
      };
    } catch (error) {
      logger.error("Failed to read file data", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      this.reportStorageError("readData", error, { method: "readFileData" });
      throw new Error(`Failed to read case data: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Write data to file system with retry logic
   * Throws error if write fails after retries
   */
  async writeFileData(data: FileData): Promise<FileData> {
    try {
      // Ensure data integrity before writing
      const validatedData: FileData = {
        ...data,
        exported_at: new Date().toISOString(),
        total_cases: data.cases.length,
        categoryConfig: mergeCategoryConfig(data.categoryConfig),
        cases: data.cases.map((caseItem) => ({ ...caseItem })),
        activityLog: [...(data.activityLog ?? [])]
          .map(
            (entry): CaseActivityEntry =>
              entry.type === "status-change"
                ? {
                    ...entry,
                    payload: { ...entry.payload },
                  }
                : {
                    ...entry,
                    payload: { ...entry.payload },
                  },
          )
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      };

      const success = await this.fileService.writeFile(validatedData);

      if (!success) {
        throw new Error("File write operation failed");
      }

      return validatedData;
    } catch (error) {
      logger.error("Failed to write file data", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Provide specific error messaging based on error type
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        if (
          error.message.includes("state cached in an interface object") ||
          error.message.includes("state had changed")
        ) {
          errorMessage = "File was modified by another process. Please try again.";
        } else if (error.message.includes("permission")) {
          errorMessage = "Permission denied. Please check file permissions.";
        } else {
          errorMessage = error.message;
        }
      }

      this.reportStorageError("writeData", error, {
        method: "writeFileData",
        errorMessage,
      });

      throw new Error(`Failed to save case data: ${errorMessage}`);
    }
  }

  /**
   * Update case timestamps for modified cases
   */
  touchCaseTimestamps(cases: CaseDisplay[], touchedCaseIds?: Iterable<string>): CaseDisplay[] {
    if (!touchedCaseIds) {
      return cases;
    }

    const ids = touchedCaseIds instanceof Set ? touchedCaseIds : new Set(touchedCaseIds);
    if (ids.size === 0) {
      return cases;
    }

    const timestamp = new Date().toISOString();

    return cases.map((caseItem) => (ids.has(caseItem.id) ? { ...caseItem, updatedAt: timestamp } : caseItem));
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private normalizeActivityLog(rawActivityLog: unknown): CaseActivityEntry[] {
    if (!Array.isArray(rawActivityLog)) {
      return [];
    }

    const normalized: CaseActivityEntry[] = [];

    for (const candidate of rawActivityLog) {
      if (!candidate || typeof candidate !== "object") {
        continue;
      }

      const base = candidate as Partial<CaseActivityEntry> & { payload?: unknown };
      if (
        typeof base.id !== "string" ||
        typeof base.timestamp !== "string" ||
        typeof base.caseId !== "string" ||
        typeof base.caseName !== "string" ||
        typeof base.type !== "string"
      ) {
        continue;
      }

      const parsedTimestamp = new Date(base.timestamp);
      if (Number.isNaN(parsedTimestamp.getTime())) {
        continue;
      }
      const normalizedTimestamp = parsedTimestamp.toISOString();

      if (base.type === "status-change") {
        const payload = base.payload as CaseActivityEntry["payload"] | undefined;
        if (!payload || typeof payload !== "object") {
          continue;
        }

        const fromStatus = (payload as any).fromStatus;
        const toStatus = (payload as any).toStatus;

        if (typeof toStatus !== "string") {
          continue;
        }

        normalized.push({
          id: base.id,
          timestamp: normalizedTimestamp,
          caseId: base.caseId,
          caseName: base.caseName,
          caseMcn: base.caseMcn ?? null,
          type: "status-change",
          payload: {
            fromStatus: typeof fromStatus === "string" || fromStatus === null ? fromStatus ?? null : undefined,
            toStatus,
          },
        });
        continue;
      }

      if (base.type === "note-added") {
        const payload = base.payload as CaseActivityEntry["payload"] | undefined;
        if (!payload || typeof payload !== "object") {
          continue;
        }

        const noteId = (payload as any).noteId;
        const category = (payload as any).category;
        const preview = (payload as any).preview;

        if (typeof noteId !== "string" || typeof category !== "string" || typeof preview !== "string") {
          continue;
        }

        normalized.push({
          id: base.id,
          timestamp: normalizedTimestamp,
          caseId: base.caseId,
          caseName: base.caseName,
          caseMcn: base.caseMcn ?? null,
          type: "note-added",
          payload: {
            noteId,
            category,
            preview,
          },
        });
      }
    }

    return normalized.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private reportStorageError(operation: FileStorageOperation, error: unknown, context?: Record<string, unknown>) {
    reportFileStorageError({
      operation,
      error,
      source: "FileStorageService",
      context,
    });
  }
}
