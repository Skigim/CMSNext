import { v4 as uuidv4 } from 'uuid';
import type { CaseStatus } from '../../types/case';
import type { CaseActivityEntry } from '../../types/activityLog';
import type { CategoryConfig } from '../../types/categoryConfig';
import type { FileStorageService, NormalizedFileData, StoredCase } from './FileStorageService';
import { ActivityLogService } from './ActivityLogService';
import { formatCaseDisplayName } from '../../domain/cases/formatting';

// formatCaseDisplayName imported from domain layer

/**
 * Configuration for CaseBulkOperationsService initialization.
 * @interface CaseBulkOperationsServiceConfig
 */
interface CaseBulkOperationsServiceConfig {
  /** File storage service for reading/writing case data */
  fileStorage: FileStorageService;
}

/**
 * CaseBulkOperationsService - Batch and bulk case operations
 * 
 * This service handles all bulk case-related operations in the normalized v2.0 format.
 * It is optimized for batch operations that affect multiple cases at once.
 * 
 * ## Architecture
 * 
 * ```
 * CaseBulkOperationsService
 *     ↓
 * FileStorageService (read/write operations)
 *     ↓
 * AutosaveFileService (file I/O)
 * ```
 * 
 * ## Core Responsibilities
 * 
 * ### Bulk Delete
 * - Delete multiple cases at once
 * - Cascade delete related financials, notes, and alerts
 * 
 * ### Bulk Updates
 * - Update status for multiple cases
 * - Update priority for multiple cases
 * - Activity logging for all changes
 * 
 * ### Bulk Import/Export
 * - Import multiple cases at once
 * - Clear all data (destructive)
 * 
 * ## Pattern: Read → Modify → Write
 * 
 * All operations follow the stateless pattern:
 * 1. Read current data from file
 * 2. Modify data in memory
 * 3. Write updated data back to file
 * 4. Return result
 * 
 * No data is cached - file system is single source of truth.
 * 
 * @class CaseBulkOperationsService
 * @see {@link FileStorageService} for underlying storage operations
 * @see {@link ActivityLogService} for activity logging
 * @see {@link CaseService} for single-case operations
 */
export class CaseBulkOperationsService {
  /** File storage service for data persistence */
  private fileStorage: FileStorageService;

  /**
   * Create a new CaseBulkOperationsService instance.
   * 
   * @param {CaseBulkOperationsServiceConfig} config - Configuration object
   * @param {FileStorageService} config.fileStorage - File storage service instance
   */
  constructor(config: CaseBulkOperationsServiceConfig) {
    this.fileStorage = config.fileStorage;
  }

  // =============================================================================
  // BULK DELETE OPERATIONS
  // =============================================================================

  /**
   * Delete multiple cases at once.
   * 
   * This is a batch delete operation that removes multiple cases and their
   * associated data (financials, notes, alerts) in a single file operation
   * for better performance.
   * 
   * **Pattern:** Read → Modify → Write (single operation)
   * 
   * **Warning:** This operation is permanent and cannot be undone.
   * 
   * @param {string[]} caseIds - Array of case IDs to delete
   * @returns {Promise<{deleted: number, notFound: string[]}>} Result with count and missing IDs
   * 
   * @example
   * const result = await bulkOpsService.deleteCases([id1, id2, id3]);
   * console.log(`Deleted ${result.deleted} cases`);
   * if (result.notFound.length > 0) {
   *   console.log(`Not found: ${result.notFound.join(', ')}`);
   * }
   */
  async deleteCases(caseIds: string[]): Promise<{ deleted: number; notFound: string[] }> {
    if (caseIds.length === 0) {
      return { deleted: 0, notFound: [] };
    }

    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    const idsToDelete = new Set(caseIds);
    const existingIds = new Set(currentData.cases.map(c => c.id));
    
    // Track which IDs don't exist
    const notFound = caseIds.filter(id => !existingIds.has(id));
    
    // Filter out cases and their associated data (including alerts)
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: currentData.cases.filter(c => !idsToDelete.has(c.id)),
      financials: currentData.financials.filter(f => !idsToDelete.has(f.caseId)),
      notes: currentData.notes.filter(n => !idsToDelete.has(n.caseId)),
      alerts: currentData.alerts.filter(a => !a.caseId || !idsToDelete.has(a.caseId)),
    };

    const deletedCount = currentData.cases.length - updatedData.cases.length;

    // Write back to file
    await this.fileStorage.writeNormalizedData(updatedData);

    return { deleted: deletedCount, notFound };
  }

  // =============================================================================
  // BULK UPDATE OPERATIONS
  // =============================================================================

  /**
   * Update status for multiple cases at once.
   * 
   * This is a batch status update operation that:
   * 1. Updates multiple case statuses in a single file operation
   * 2. Creates activity log entries for each status change
   * 3. Only updates cases whose status differs from the target
   * 4. Tracks which IDs don't exist
   * 
   * **Pattern:** Read → Modify → Write (single operation)
   * 
   * More efficient than calling updateCaseStatus() multiple times as it
   * only performs one file read and one file write.
   * 
   * @param {string[]} caseIds - Array of case IDs to update
   * @param {CaseStatus} status - The new status to apply
   * @returns {Promise<{updated: StoredCase[], notFound: string[]}>} Result with updated cases and missing IDs
   * 
   * @example
   * const result = await bulkOpsService.updateCasesStatus([id1, id2, id3], "Approved");
   * console.log(`Updated ${result.updated.length} cases`);
   * if (result.notFound.length > 0) {
   *   console.log(`Not found: ${result.notFound.join(', ')}`);
   * }
   */
  async updateCasesStatus(caseIds: string[], status: CaseStatus): Promise<{ updated: StoredCase[]; notFound: string[] }> {
    if (caseIds.length === 0) {
      return { updated: [], notFound: [] };
    }

    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error("Failed to read current data");
    }

    const idsToUpdate = new Set(caseIds);
    const timestamp = new Date().toISOString();
    const updatedCases: StoredCase[] = [];
    const activityEntries: CaseActivityEntry[] = [];
    const notFound: string[] = [];

    // Track which IDs exist
    const existingIds = new Set(currentData.cases.map(c => c.id));
    caseIds.forEach(id => {
      if (!existingIds.has(id)) {
        notFound.push(id);
      }
    });

    // Update matching cases
    const casesWithChanges = currentData.cases.map(c => {
      if (!idsToUpdate.has(c.id)) {
        return c;
      }

      const currentStatus = c.caseRecord?.status ?? c.status;
      
      // Skip if status is already the same
      if (currentStatus === status) {
        updatedCases.push(c);
        return c;
      }

      const updatedCase: StoredCase = {
        ...c,
        status,
        caseRecord: {
          ...c.caseRecord,
          status,
          updatedDate: timestamp,
        },
      };

      updatedCases.push(updatedCase);

      // Create activity log entry
      activityEntries.push({
        id: uuidv4(),
        timestamp,
        caseId: c.id,
        caseName: formatCaseDisplayName(c),
        caseMcn: c.caseRecord?.mcn ?? c.mcn ?? null,
        type: "status-change",
        payload: {
          fromStatus: currentStatus,
          toStatus: status,
        },
      });

      return updatedCase;
    });

    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(
      casesWithChanges,
      caseIds.filter(id => existingIds.has(id))
    );

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
      activityLog: ActivityLogService.mergeActivityEntries(currentData.activityLog, activityEntries),
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    return { updated: updatedCases, notFound };
  }

  /**
   * Update priority flag for multiple cases at once.
   * 
   * This is a batch priority update operation that:
   * 1. Updates multiple case priority flags in a single file operation
   * 2. Creates activity log entries for each priority change
   * 3. Only updates cases whose priority differs from the target
   * 4. Tracks which IDs don't exist
   * 
   * **Pattern:** Read → Modify → Write (single operation)
   * 
   * Priority is a boolean flag indicating whether a case requires immediate attention.
   * More efficient than calling individual updates as it performs one file read/write.
   * 
   * @param {string[]} caseIds - Array of case IDs to update
   * @param {boolean} priority - The priority flag to set (true = priority case)
   * @returns {Promise<{updated: StoredCase[], notFound: string[]}>} Result with updated cases and missing IDs
   * 
   * @example
   * const result = await bulkOpsService.updateCasesPriority([id1, id2], true);
   * console.log(`Marked ${result.updated.length} cases as priority`);
   */
  async updateCasesPriority(caseIds: string[], priority: boolean): Promise<{ updated: StoredCase[]; notFound: string[] }> {
    if (caseIds.length === 0) {
      return { updated: [], notFound: [] };
    }

    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error("Failed to read current data");
    }

    const idsToUpdate = new Set(caseIds);
    const timestamp = new Date().toISOString();
    const updatedCases: StoredCase[] = [];
    const activityEntries: CaseActivityEntry[] = [];
    const notFound: string[] = [];

    // Track which IDs exist
    const existingIds = new Set(currentData.cases.map(c => c.id));
    caseIds.forEach(id => {
      if (!existingIds.has(id)) {
        notFound.push(id);
      }
    });

    // Update matching cases
    const casesWithChanges = currentData.cases.map(c => {
      if (!idsToUpdate.has(c.id)) {
        return c;
      }

      const currentPriority = c.priority ?? false;
      
      // Skip if priority is already the same
      if (currentPriority === priority) {
        updatedCases.push(c);
        return c;
      }

      const updatedCase: StoredCase = {
        ...c,
        priority,
        caseRecord: {
          ...c.caseRecord,
          priority,
          updatedDate: timestamp,
        },
      };

      updatedCases.push(updatedCase);

      // Create activity log entry
      activityEntries.push({
        id: uuidv4(),
        timestamp,
        caseId: c.id,
        caseName: formatCaseDisplayName(c),
        caseMcn: c.caseRecord?.mcn ?? c.mcn ?? null,
        type: "priority-change",
        payload: {
          fromPriority: currentPriority,
          toPriority: priority,
        },
      });

      return updatedCase;
    });

    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(
      casesWithChanges,
      caseIds.filter(id => existingIds.has(id))
    );

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
      activityLog: ActivityLogService.mergeActivityEntries(currentData.activityLog, activityEntries),
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    return { updated: updatedCases, notFound };
  }

  // =============================================================================
  // BULK IMPORT/EXPORT OPERATIONS
  // =============================================================================

  /**
   * Import multiple cases at once.
   * 
   * This method:
   * 1. Reads current data
   * 2. Validates incoming cases
   * 3. Filters out cases with duplicate IDs (preserves existing)
   * 4. Generates IDs for cases without them
   * 5. Updates timestamps
   * 6. Combines with existing cases
   * 7. Writes back to file
   * 
   * **Pattern:** Read → Modify → Write (single operation)
   * 
   * **Strategy:** Preserve existing cases; skip incoming duplicates by ID
   * 
   * **Note:** Imported cases should be in StoredCase format (normalized, 
   * without nested financials/notes). Financials and notes must be
   * imported separately.
   * 
   * @param {StoredCase[]} cases - Array of cases to import in normalized format
   * @returns {Promise<void>}
   * @throws {Error} If failed to read current data
   * 
   * @example
   * await bulkOpsService.importCases(importedCases);
   * console.log('Cases imported successfully');
   */
  async importCases(cases: StoredCase[]): Promise<void> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    const timestamp = new Date().toISOString();

    // Build set of existing case IDs to detect duplicates
    const existingIds = new Set(currentData.cases.map(c => c.id));

    // Validate, ensure unique IDs, and filter out duplicates
    const casesToImport = cases
      .map(caseItem => ({
        ...caseItem,
        id: caseItem.id || uuidv4(),
        caseRecord: {
          ...caseItem.caseRecord,
          updatedDate: timestamp,
        },
      }))
      .filter(caseItem => {
        if (existingIds.has(caseItem.id)) {
          console.warn(`Skipping import: case with ID ${caseItem.id} already exists`);
          return false;
        }
        return true;
      });

    // Only proceed if there are new cases to import
    if (casesToImport.length === 0) {
      console.info('No new cases to import (all IDs already exist)');
      return;
    }

    const touchedCaseIds = casesToImport.map(caseItem => caseItem.id);
    const combinedCases = [...currentData.cases, ...casesToImport];
    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(combinedCases, touchedCaseIds);

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    await this.fileStorage.writeNormalizedData(updatedData);
  }

  /**
   * Clear all data from the system.
   * 
   * This destructive operation:
   * 1. Removes all cases
   * 2. Removes all financials
   * 3. Removes all notes
   * 4. Removes all alerts
   * 5. Clears activity log
   * 6. Preserves category configuration
   * 7. Writes empty structure to file
   * 
   * **Pattern:** Write empty structure
   * 
   * **Warning:** This operation is permanent and cannot be undone.
   * Only category configuration is preserved.
   * 
   * @param {CategoryConfig} categoryConfig - The category config to preserve
   * @returns {Promise<void>}
   * 
   * @example
   * const config = await getCurrentCategoryConfig();
   * await bulkOpsService.clearAllData(config);
   * console.log('All data cleared, configuration preserved');
   */
  async clearAllData(categoryConfig: CategoryConfig): Promise<void> {
    const emptyData: NormalizedFileData = {
      version: "2.0",
      cases: [],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: new Date().toISOString(),
      total_cases: 0,
      categoryConfig,
      activityLog: [],
    };

    await this.fileStorage.writeNormalizedData(emptyData);
  }
}
