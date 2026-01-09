import { v4 as uuidv4 } from 'uuid';
import type { NewPersonData, NewCaseRecordData, CaseStatus } from '../../types/case';
import type { CaseActivityEntry } from '../../types/activityLog';
import type { CategoryConfig } from '../../types/categoryConfig';
import type { FileStorageService, NormalizedFileData, StoredCase } from './FileStorageService';
import { ActivityLogService } from './ActivityLogService';
import { CaseBulkOperationsService } from './CaseBulkOperationsService';
import { toLocalDateString } from '../../domain/common';
import { formatCaseDisplayName } from '../../domain/cases/formatting';

// formatCaseDisplayName imported from domain layer

/**
 * Configuration for CaseService initialization.
 * @interface CaseServiceConfig
 */
interface CaseServiceConfig {
  /** File storage service for reading/writing case data */
  fileStorage: FileStorageService;
}

/**
 * CaseService - Case CRUD operations and lifecycle management
 * 
 * This service handles all case-related operations in the normalized v2.0 format.
 * It maintains the separation between cases, financials, and notes using foreign
 * key references instead of nested structures.
 * 
 * ## Architecture
 * 
 * ```
 * CaseService
 *     ↓
 * FileStorageService (read/write operations)
 *     ↓
 * AutosaveFileService (file I/O)
 * ```
 * 
 * ## Data Format
 * 
 * Cases are stored in a flat array without nested relations:
 * 
 * ```typescript
 * {
 *   id: string,
 *   person: PersonData,
 *   caseRecord: CaseRecordData,
 *   createdAt: string,
 *   updatedAt: string,
 *   name: string  // Generated display name
 * }
 * ```
 * 
 * Financials and notes reference cases by `caseId` foreign key.
 * 
 * ## Core Responsibilities
 * 
 * ### Read Operations
 * - Get all cases
 * - Get case by ID
 * - Get case count
 * 
 * ### Write Operations
 * - Create complete case (person + case record)
 * - Update complete case
 * - Update case status
 * - Delete single case
 * - Bulk delete cases
 * - Bulk status updates
 * - Bulk priority updates
 * 
 * ### Bulk Operations
 * - Import multiple cases
 * - Clear all data
 * 
 * ### Activity Logging
 * - Logs all case modifications to activity log
 * - Tracks status changes
 * - Tracks priority changes
 * - Tracks deletions
 * 
 * ## Pattern: Read → Modify → Write
 * 
 * All operations follow the stateless pattern:
 * 1. Read current data from file
 * 2. Modify data in memory
 * 3. Write updated data back to file
 * 4. Return updated entity
 * 
 * No data is cached - file system is single source of truth.
 * 
 * @class CaseService
 * @see {@link FileStorageService} for underlying storage operations
 * @see {@link ActivityLogService} for activity logging
 * @see {@link CaseBulkOperationsService} for bulk operations
 */
export class CaseService {
  /** File storage service for data persistence */
  private fileStorage: FileStorageService;
  /** Bulk operations service for batch operations */
  private bulkOperations: CaseBulkOperationsService;

  /**
   * Create a new CaseService instance.
   * 
   * @param {CaseServiceConfig} config - Configuration object
   * @param {FileStorageService} config.fileStorage - File storage service instance
   */
  constructor(config: CaseServiceConfig) {
    this.fileStorage = config.fileStorage;
    this.bulkOperations = new CaseBulkOperationsService({
      fileStorage: config.fileStorage,
    });
  }

  // =============================================================================
  // READ OPERATIONS
  // =============================================================================

  /**
   * Get all cases from the file system.
   * 
   * Always reads fresh data from disk - no caching.
   * Returns cases in normalized format without nested financials or notes.
   * 
   * @returns {Promise<StoredCase[]>} Array of all cases, or empty array if no data
   * @example
   * const cases = await caseService.getAllCases();
   * console.log(`Found ${cases.length} cases`);
   */
  async getAllCases(): Promise<StoredCase[]> {
    const data = await this.fileStorage.readFileData();
    return data ? data.cases : [];
  }

  /**
   * Get a specific case by its ID.
   * 
   * Always reads fresh data from disk.
   * 
   * @param {string} caseId - The unique identifier of the case
   * @returns {Promise<StoredCase | null>} The case if found, null otherwise
   * @example
   * const case = await caseService.getCaseById("abc-123");
   * if (case) {
   *   console.log(`Case: ${case.name}`);
   * }
   */
  async getCaseById(caseId: string): Promise<StoredCase | null> {
    const data = await this.fileStorage.readFileData();
    if (!data) return null;
    
    return this.fileStorage.getCaseById(data, caseId) ?? null;
  }

  /**
   * Get the total count of cases.
   * 
   * @returns {Promise<number>} Number of cases in the system
   */
  async getCasesCount(): Promise<number> {
    const data = await this.fileStorage.readFileData();
    return data ? data.cases.length : 0;
  }

  // =============================================================================
  // CREATE/UPDATE OPERATIONS
  // =============================================================================

  /**
   * Create a new complete case with person and case record data.
   * 
   * This method:
   * 1. Reads current data from file
   * 2. Generates UUIDs for case, person, and case record
   * 3. Creates a complete StoredCase object with all required fields
   * 4. Adds to cases array
   * 5. Updates timestamps
   * 6. Writes back to file
   * 7. Returns the created case
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * The created case is in normalized format without nested financials or notes.
   * Financials and notes must be added separately using their respective services.
   * 
   * @param {Object} caseData - The case data
   * @param {NewPersonData} caseData.person - Person information
   * @param {NewCaseRecordData} caseData.caseRecord - Case record information
   * @returns {Promise<StoredCase>} The created case
   * @throws {Error} If failed to read current data
   * 
   * @example
   * const newCase = await caseService.createCompleteCase({
   *   person: {
   *     firstName: "John",
   *     lastName: "Doe",
   *     email: "john@example.com",
   *     phone: "555-1234",
   *     dateOfBirth: "1990-01-01",
   *     status: "Active",
   *     address: { street: "123 Main St", city: "Anytown", state: "CA", zip: "12345" }
   *   },
   *   caseRecord: {
   *     mcn: "12345",
   *     status: "Active",
   *     applicationDate: new Date().toISOString(),
   *     caseType: "Medical Assistance"
   *   }
   * });
   */
  async createCompleteCase(caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<StoredCase> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    const timestamp = new Date().toISOString();
    const todayDate = toLocalDateString(); // For date-only fields
    const caseId = uuidv4();
    const personId = uuidv4();

    // Create new case (StoredCase - without nested financials/notes)
    const newCase: StoredCase = {
      id: caseId,
      name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
      mcn: caseData.caseRecord.mcn,
      status: caseData.caseRecord.status,
      priority: Boolean(caseData.caseRecord.priority),
      createdAt: timestamp,
      updatedAt: timestamp,
      person: {
        id: personId,
        firstName: caseData.person.firstName,
        lastName: caseData.person.lastName,
        name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
        dateOfBirth: caseData.person.dateOfBirth || '',
        ssn: caseData.person.ssn || '',
        phone: caseData.person.phone || '',
        email: caseData.person.email || '',
        organizationId: caseData.person.organizationId || null,
        livingArrangement: caseData.person.livingArrangement || '',
        address: caseData.person.address || {
          street: '',
          city: '',
          state: '',
          zip: ''
        },
        mailingAddress: caseData.person.mailingAddress || {
          street: '',
          city: '',
          state: '',
          zip: '',
          sameAsPhysical: true
        },
        authorizedRepIds: caseData.person.authorizedRepIds || [],
        familyMembers: caseData.person.familyMembers || [],
        relationships: caseData.person.relationships || [],
        status: caseData.person.status || 'Active',
        dateAdded: timestamp,
        createdAt: timestamp
      },
      caseRecord: {
        id: uuidv4(),
        personId,
        mcn: caseData.caseRecord.mcn,
        applicationDate: caseData.caseRecord.applicationDate || todayDate,
        caseType: caseData.caseRecord.caseType || 'General',
        spouseId: caseData.caseRecord.spouseId || '',
        status: caseData.caseRecord.status,
        description: caseData.caseRecord.description || '',
        priority: Boolean(caseData.caseRecord.priority),
        livingArrangement: caseData.caseRecord.livingArrangement || '',
        withWaiver: Boolean(caseData.caseRecord.withWaiver),
        admissionDate: caseData.caseRecord.admissionDate || todayDate,
        organizationId: caseData.caseRecord.organizationId || '',
        authorizedReps: caseData.caseRecord.authorizedReps || [],
        retroRequested: caseData.caseRecord.retroRequested || '',
        // Intake checklist fields
        appValidated: caseData.caseRecord.appValidated ?? false,
        retroMonths: caseData.caseRecord.retroMonths ?? [],
        contactMethods: caseData.caseRecord.contactMethods ?? [],
        agedDisabledVerified: caseData.caseRecord.agedDisabledVerified ?? false,
        citizenshipVerified: caseData.caseRecord.citizenshipVerified ?? false,
        residencyVerified: caseData.caseRecord.residencyVerified ?? false,
        avsSubmitted: caseData.caseRecord.avsSubmitted ?? false,
        interfacesReviewed: caseData.caseRecord.interfacesReviewed ?? false,
        reviewVRs: caseData.caseRecord.reviewVRs ?? false,
        reviewPriorBudgets: caseData.caseRecord.reviewPriorBudgets ?? false,
        reviewPriorNarr: caseData.caseRecord.reviewPriorNarr ?? false,
        pregnancy: caseData.caseRecord.pregnancy ?? false,
        avsConsentDate: caseData.caseRecord.avsConsentDate ?? '',
        maritalStatus: caseData.caseRecord.maritalStatus ?? '',
        voterFormStatus: caseData.caseRecord.voterFormStatus ?? '',
        // Note: financials and notes are NOT included in StoredCase
        createdDate: timestamp,
        updatedDate: timestamp
      }
    };

    // Add to cases array
    const updatedCases = [...currentData.cases, newCase];
    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(updatedCases, [caseId]);

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    return casesWithTouchedTimestamps.find(c => c.id === caseId) ?? newCase;
  }

  /**
   * Update an existing complete case.
   * 
   * This method:
   * 1. Reads current data from file
   * 2. Finds the case to update
   * 3. Updates person and case record data
   * 4. Maintains existing metadata (IDs, creation dates)
   * 5. Updates timestamps
   * 6. Writes back to file
   * 7. Returns the updated case
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * @param {string} caseId - The ID of the case to update
   * @param {Object} caseData - The updated case data
   * @param {NewPersonData} caseData.person - Updated person information
   * @param {NewCaseRecordData} caseData.caseRecord - Updated case record information
   * @returns {Promise<StoredCase>} The updated case
   * @throws {Error} If failed to read current data or case not found
   * 
   * @example
   * const updated = await caseService.updateCompleteCase(caseId, {
   *   person: {
   *     ...existingPerson,
   *     phone: "555-9999"  // Update phone
   *   },
   *   caseRecord: {
   *     ...existingRecord,
   *     status: "Pending"  // Update status
   *   }
   * });
   */
  async updateCompleteCase(caseId: string, caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<StoredCase> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const existingCase = currentData.cases[caseIndex];
    const timestamp = new Date().toISOString();

    // Update person data
    const updatedPerson = {
      ...existingCase.person,
      firstName: caseData.person.firstName,
      lastName: caseData.person.lastName,
      name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
      dateOfBirth: caseData.person.dateOfBirth || '',
      ssn: caseData.person.ssn || '',
      phone: caseData.person.phone || '',
      email: caseData.person.email || '',
      organizationId: caseData.person.organizationId || null,
      livingArrangement: caseData.person.livingArrangement || '',
      address: caseData.person.address || existingCase.person.address,
      mailingAddress: caseData.person.mailingAddress || existingCase.person.mailingAddress,
      authorizedRepIds: caseData.person.authorizedRepIds || [],
      familyMembers: caseData.person.familyMembers || [],
      relationships: caseData.person.relationships || [],
      status: caseData.person.status || 'Active'
    };

    // Update case record data (without financials/notes - they're stored separately)
    const updatedCaseRecord = {
      ...existingCase.caseRecord,
      mcn: caseData.caseRecord.mcn,
      applicationDate: caseData.caseRecord.applicationDate || existingCase.caseRecord.applicationDate,
      caseType: caseData.caseRecord.caseType || existingCase.caseRecord.caseType,
      spouseId: caseData.caseRecord.spouseId || '',
      status: caseData.caseRecord.status,
      description: caseData.caseRecord.description || '',
      priority: Boolean(caseData.caseRecord.priority),
      livingArrangement: caseData.caseRecord.livingArrangement || '',
      withWaiver: Boolean(caseData.caseRecord.withWaiver),
      admissionDate: caseData.caseRecord.admissionDate || existingCase.caseRecord.admissionDate,
      organizationId: caseData.caseRecord.organizationId || '',
      authorizedReps: caseData.caseRecord.authorizedReps || [],
      retroRequested: caseData.caseRecord.retroRequested || '',
      // Intake checklist fields
      appValidated: caseData.caseRecord.appValidated ?? existingCase.caseRecord.appValidated ?? false,
      retroMonths: caseData.caseRecord.retroMonths ?? existingCase.caseRecord.retroMonths ?? [],
      contactMethods: caseData.caseRecord.contactMethods ?? existingCase.caseRecord.contactMethods ?? [],
      agedDisabledVerified: caseData.caseRecord.agedDisabledVerified ?? existingCase.caseRecord.agedDisabledVerified ?? false,
      citizenshipVerified: caseData.caseRecord.citizenshipVerified ?? existingCase.caseRecord.citizenshipVerified ?? false,
      residencyVerified: caseData.caseRecord.residencyVerified ?? existingCase.caseRecord.residencyVerified ?? false,
      avsSubmitted: caseData.caseRecord.avsSubmitted ?? existingCase.caseRecord.avsSubmitted ?? false,
      interfacesReviewed: caseData.caseRecord.interfacesReviewed ?? existingCase.caseRecord.interfacesReviewed ?? false,
      reviewVRs: caseData.caseRecord.reviewVRs ?? existingCase.caseRecord.reviewVRs ?? false,
      reviewPriorBudgets: caseData.caseRecord.reviewPriorBudgets ?? existingCase.caseRecord.reviewPriorBudgets ?? false,
      reviewPriorNarr: caseData.caseRecord.reviewPriorNarr ?? existingCase.caseRecord.reviewPriorNarr ?? false,
      pregnancy: caseData.caseRecord.pregnancy ?? existingCase.caseRecord.pregnancy ?? false,
      avsConsentDate: caseData.caseRecord.avsConsentDate ?? existingCase.caseRecord.avsConsentDate ?? '',
      maritalStatus: caseData.caseRecord.maritalStatus ?? existingCase.caseRecord.maritalStatus ?? '',
      voterFormStatus: caseData.caseRecord.voterFormStatus ?? existingCase.caseRecord.voterFormStatus ?? '',
      updatedDate: timestamp
    };

    const caseWithChanges: StoredCase = {
      ...existingCase,
      name: updatedPerson.name,
      mcn: updatedCaseRecord.mcn,
      status: updatedCaseRecord.status,
      priority: updatedCaseRecord.priority,
      person: updatedPerson,
      caseRecord: updatedCaseRecord,
    };

    // Update cases array
    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithChanges : c,
    );

    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Update the status of a case.
   * 
   * This method:
   * 1. Reads current data from file
   * 2. Finds the case to update
   * 3. Updates case status if different from current
   * 4. Creates activity log entry for the status change
   * 5. Updates timestamps
   * 6. Writes back to file
   * 7. Returns the updated case
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * Activity logging tracks the status change with from/to values.
   * If the status is already the target value, returns the case unchanged.
   * 
   * @param {string} caseId - The ID of the case to update
   * @param {CaseStatus} status - The new status value
   * @returns {Promise<StoredCase>} The updated case
   * @throws {Error} If failed to read current data or case not found
   * 
   * @example
   * const updated = await caseService.updateCaseStatus(caseId, "Approved");
   * console.log(`Status changed to ${updated.status}`);
   */
  async updateCaseStatus(caseId: string, status: CaseStatus): Promise<StoredCase> {
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error("Failed to read current data");
    }

    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error("Case not found");
    }

    const targetCase = currentData.cases[caseIndex];
    const currentStatus = targetCase.caseRecord?.status ?? targetCase.status;
    
    if (currentStatus === status) {
      return targetCase;
    }

    const timestamp = new Date().toISOString();

    const caseWithUpdatedStatus: StoredCase = {
      ...targetCase,
      status,
      caseRecord: {
        ...targetCase.caseRecord,
        status,
        updatedDate: timestamp,
      },
    };

    // Update cases array
    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithUpdatedStatus : c,
    );

    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Create activity log entry
    const activityEntry: CaseActivityEntry = {
      id: uuidv4(),
      timestamp,
      caseId: targetCase.id,
      caseName: formatCaseDisplayName(targetCase),
      caseMcn: targetCase.caseRecord?.mcn ?? targetCase.mcn ?? null,
      type: "status-change",
      payload: {
        fromStatus: currentStatus,
        toStatus: status,
      },
    };

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
      activityLog: ActivityLogService.mergeActivityEntries(currentData.activityLog, [activityEntry]),
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  // =============================================================================
  // DELETE OPERATIONS
  // =============================================================================

  /**
   * Delete a case and all its associated data.
   * 
   * This method:
   * 1. Reads current data from file
   * 2. Verifies case exists
   * 3. Removes case from cases array
   * 4. Removes all associated financials (by caseId)
   * 5. Removes all associated notes (by caseId)
   * 6. Removes all associated alerts (by caseId)
   * 7. Writes back to file
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * **Warning:** This operation is permanent and cannot be undone.
   * All related data (financials, notes, alerts) is also deleted.
   * 
   * @param {string} caseId - The ID of the case to delete
   * @returns {Promise<void>}
   * @throws {Error} If failed to read current data or case not found
   * 
   * @example
   * await caseService.deleteCase(caseId);
   * console.log('Case and all associated data deleted');
   */
  async deleteCase(caseId: string): Promise<void> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Check if case exists
    const caseExists = currentData.cases.some(c => c.id === caseId);
    if (!caseExists) {
      throw new Error('Case not found');
    }

    // Remove case and its associated data (including alerts)
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: currentData.cases.filter(c => c.id !== caseId),
      financials: currentData.financials.filter(f => f.caseId !== caseId),
      notes: currentData.notes.filter(n => n.caseId !== caseId),
      alerts: currentData.alerts.filter(a => a.caseId !== caseId),
    };

    // Write back to file
    await this.fileStorage.writeNormalizedData(updatedData);
  }

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
   * const result = await caseService.deleteCases([id1, id2, id3]);
   * console.log(`Deleted ${result.deleted} cases`);
   * if (result.notFound.length > 0) {
   *   console.log(`Not found: ${result.notFound.join(', ')}`);
   * }
   */
  async deleteCases(caseIds: string[]): Promise<{ deleted: number; notFound: string[] }> {
    return this.bulkOperations.deleteCases(caseIds);
  }

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
   * const result = await caseService.updateCasesStatus([id1, id2, id3], "Approved");
   * console.log(`Updated ${result.updated.length} cases`);
   * if (result.notFound.length > 0) {
   *   console.log(`Not found: ${result.notFound.join(', ')}`);
   * }
   */
  async updateCasesStatus(caseIds: string[], status: CaseStatus): Promise<{ updated: StoredCase[]; notFound: string[] }> {
    return this.bulkOperations.updateCasesStatus(caseIds, status);
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
   * const result = await caseService.updateCasesPriority([id1, id2], true);
   * console.log(`Marked ${result.updated.length} cases as priority`);
   */
  async updateCasesPriority(caseIds: string[], priority: boolean): Promise<{ updated: StoredCase[]; notFound: string[] }> {
    return this.bulkOperations.updateCasesPriority(caseIds, priority);
  }

  // =============================================================================
  // BULK OPERATIONS
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
   * await caseService.importCases(importedCases);
   * console.log('Cases imported successfully');
   */
  async importCases(cases: StoredCase[]): Promise<void> {
    return this.bulkOperations.importCases(cases);
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
   * await caseService.clearAllData(config);
   * console.log('All data cleared, configuration preserved');
   */
  async clearAllData(categoryConfig: CategoryConfig): Promise<void> {
    return this.bulkOperations.clearAllData(categoryConfig);
  }
}
