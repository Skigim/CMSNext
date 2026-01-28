import { v4 as uuidv4 } from 'uuid';
import type { CaseStatus, NewNoteData } from '../../types/case';
import type { CaseActivityEntry } from '../../types/activityLog';
import type { CategoryConfig } from '../../types/categoryConfig';
import type { FileStorageService, NormalizedFileData, StoredCase, StoredNote } from './FileStorageService';
import { ActivityLogService } from './ActivityLogService';
import { formatCaseDisplayName } from '../../domain/cases/formatting';
import { createLogger } from '../logger';
import type { AlertWithMatch } from '@/domain/alerts';

const logger = createLogger('CaseBulkOperationsService');

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

      // Create activity log entry using factory method
      activityEntries.push(
        ActivityLogService.createStatusChangeEntry({
          caseId: c.id,
          caseName: formatCaseDisplayName(c),
          caseMcn: c.caseRecord?.mcn ?? c.mcn ?? null,
          fromStatus: currentStatus,
          toStatus: status,
          timestamp,
        })
      );

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
          logger.warn('Skipping import: case already exists', { caseId: caseItem.id });
          return false;
        }
        return true;
      });

    // Only proceed if there are new cases to import
    if (casesToImport.length === 0) {
      logger.info('No new cases to import (all IDs already exist)');
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

  // =============================================================================
  // BULK ALERT OPERATIONS
  // =============================================================================

  /**
   * Resolve alerts for multiple cases matching a description filter.
   * 
   * This method:
   * 1. Filters provided alerts by caseId (must be in caseIds) and description
   * 2. Marks all matching alerts as 'resolved' with timestamp and default note
   * 3. Writes updated alerts back to file
   * 
   * **Pattern:** Read → Modify → Write (single operation)
   * 
   * @param {string[]} caseIds - Array of case IDs whose alerts should be resolved
   * @param {AlertWithMatch[]} alerts - All alerts (pre-filtered for open status by caller)
   * @param {string} descriptionFilter - Alert description to match (exact match)
   * @returns {Promise<{resolvedCount: number, caseCount: number}>} Count of resolved alerts and affected cases
   * 
   * @example
   * const result = await bulkOpsService.resolveAlertsForCases(
   *   [caseId1, caseId2],
   *   openAlerts,
   *   "Court Notice"
   * );
   * console.log(`Resolved ${result.resolvedCount} alerts across ${result.caseCount} cases`);
   */
  async resolveAlertsForCases(
    caseIds: string[],
    alerts: AlertWithMatch[],
    descriptionFilter: string
  ): Promise<{ resolvedCount: number; caseCount: number }> {
    if (caseIds.length === 0) {
      return { resolvedCount: 0, caseCount: 0 };
    }

    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    const caseIdSet = new Set(caseIds);
    const timestamp = new Date().toISOString();

    // Find alerts matching the criteria
    const alertsToResolve = alerts.filter(
      a => a.matchedCaseId && caseIdSet.has(a.matchedCaseId) && a.description === descriptionFilter
    );

    if (alertsToResolve.length === 0) {
      return { resolvedCount: 0, caseCount: 0 };
    }

    // Track unique case IDs affected
    const affectedCaseIds = new Set<string>();
    const alertIdsToResolve = new Set(alertsToResolve.map(a => a.id));

    // Update alerts in the stored data
    const updatedAlerts = currentData.alerts.map(a => {
      if (alertIdsToResolve.has(a.id)) {
        const matchedAlert = alertsToResolve.find(ma => ma.id === a.id);
        if (matchedAlert?.matchedCaseId) {
          affectedCaseIds.add(matchedAlert.matchedCaseId);
        }
        return {
          ...a,
          status: 'resolved' as const,
          resolvedAt: timestamp,
          resolutionNotes: 'Bulk resolved',
        };
      }
      return a;
    });

    // Write updated data
    await this.fileStorage.writeNormalizedData({
      ...currentData,
      alerts: updatedAlerts,
    });

    logger.info('Bulk resolved alerts', { 
      resolvedCount: alertsToResolve.length, 
      caseCount: affectedCaseIds.size,
      descriptionFilter,
    });

    return { resolvedCount: alertsToResolve.length, caseCount: affectedCaseIds.size };
  }

  // =============================================================================
  // BULK NOTE OPERATIONS
  // =============================================================================

  /**
   * Add an identical note to multiple cases.
   * 
   * This method:
   * 1. Creates a note with the same content for each case
   * 2. Generates sanitized previews for activity logging
   * 3. Creates activity log entries for each note addition
   * 4. Updates case timestamps
   * 5. Writes all changes in a single file operation
   * 
   * **Pattern:** Read → Modify → Write (single operation)
   * 
   * @param {string[]} caseIds - Array of case IDs to add notes to
   * @param {NewNoteData} noteData - The note data (content, category)
   * @returns {Promise<{addedCount: number}>} Count of notes added
   * 
   * @example
   * const result = await bulkOpsService.addNoteToCases(
   *   [caseId1, caseId2, caseId3],
   *   { content: "Discussed case status with client.", category: "Client Contact" }
   * );
   * console.log(`Added note to ${result.addedCount} cases`);
   */
  async addNoteToCases(
    caseIds: string[],
    noteData: NewNoteData
  ): Promise<{ addedCount: number }> {
    if (caseIds.length === 0) {
      return { addedCount: 0 };
    }

    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    const timestamp = new Date().toISOString();
    const existingCaseIds = new Set(currentData.cases.map(c => c.id));
    const caseMap = new Map(currentData.cases.map(c => [c.id, c]));

    // Filter to only valid case IDs
    const validCaseIds = caseIds.filter(id => existingCaseIds.has(id));
    if (validCaseIds.length === 0) {
      return { addedCount: 0 };
    }

    // Create notes for each case
    const newNotes: StoredNote[] = validCaseIds.map(caseId => ({
      id: uuidv4(),
      caseId,
      content: noteData.content,
      category: noteData.category || 'General',
      author: 'System',
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    // Build sanitized preview for activity log
    const sanitizedPreview = noteData.content
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "***@***")
      .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, "***-**-****")
      .replace(/\b\d{10,}\b/g, "***")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);

    // Create activity log entries
    const activityEntries: CaseActivityEntry[] = validCaseIds.map(caseId => {
      const caseData = caseMap.get(caseId);
      const noteForCase = newNotes.find(n => n.caseId === caseId);
      return {
        id: uuidv4(),
        timestamp,
        caseId,
        caseName: caseData ? formatCaseDisplayName(caseData) : 'Unknown Case',
        caseMcn: caseData?.caseRecord?.mcn ?? caseData?.mcn ?? null,
        type: 'note-added' as const,
        payload: {
          noteId: noteForCase?.id ?? '',
          category: noteData.category || 'General',
          preview: sanitizedPreview,
        },
      };
    });

    // Touch case timestamps
    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(
      currentData.cases,
      validCaseIds
    );

    // Write updated data
    await this.fileStorage.writeNormalizedData({
      ...currentData,
      cases: casesWithTouchedTimestamps,
      notes: [...currentData.notes, ...newNotes],
      activityLog: ActivityLogService.mergeActivityEntries(currentData.activityLog, activityEntries),
    });

    logger.info('Bulk added notes', { addedCount: validCaseIds.length });

    return { addedCount: validCaseIds.length };
  }
}
