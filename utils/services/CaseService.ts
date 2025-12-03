import { v4 as uuidv4 } from 'uuid';
import type { NewPersonData, NewCaseRecordData, CaseStatus } from '../../types/case';
import type { CaseActivityEntry } from '../../types/activityLog';
import type { CategoryConfig } from '../../types/categoryConfig';
import type { FileStorageService, NormalizedFileData, StoredCase } from './FileStorageService';
import { ActivityLogService } from './ActivityLogService';

function formatCaseDisplayName(caseData: StoredCase): string {
  const trimmedName = (caseData.name ?? "").trim();
  if (trimmedName.length > 0) {
    return trimmedName;
  }

  const firstName = caseData.person?.firstName?.trim() ?? "";
  const lastName = caseData.person?.lastName?.trim() ?? "";
  const composed = `${firstName} ${lastName}`.trim();

  if (composed.length > 0) {
    return composed;
  }

  return "Unknown Case";
}

interface CaseServiceConfig {
  fileStorage: FileStorageService;
}

/**
 * CaseService - Handles all case CRUD operations
 * 
 * Works directly with normalized v2.0 data format:
 * - Cases stored as StoredCase[] (without nested financials/notes)
 * - Financials and notes stored in separate arrays
 * 
 * Responsibilities:
 * - Read operations: getAllCases, getCaseById, getCasesCount
 * - Create/Update/Delete operations: createCompleteCase, updateCompleteCase, updateCaseStatus, deleteCase
 * - Bulk operations: importCases, clearAllData
 * - Maintain case timestamps and metadata
 * 
 * Pattern: read → modify → write (file system is single source of truth)
 */
export class CaseService {
  private fileStorage: FileStorageService;

  constructor(config: CaseServiceConfig) {
    this.fileStorage = config.fileStorage;
  }

  // =============================================================================
  // READ OPERATIONS
  // =============================================================================

  /**
   * Get all cases (always reads fresh from file)
   */
  async getAllCases(): Promise<StoredCase[]> {
    const data = await this.fileStorage.readFileData();
    return data ? data.cases : [];
  }

  /**
   * Get a specific case by ID (always reads fresh from file)
   */
  async getCaseById(caseId: string): Promise<StoredCase | null> {
    const data = await this.fileStorage.readFileData();
    if (!data) return null;
    
    return this.fileStorage.getCaseById(data, caseId) ?? null;
  }

  /**
   * Get cases count (always reads fresh from file)
   */
  async getCasesCount(): Promise<number> {
    const data = await this.fileStorage.readFileData();
    return data ? data.cases.length : 0;
  }

  // =============================================================================
  // CREATE/UPDATE OPERATIONS
  // =============================================================================

  /**
   * Create a new complete case
   * Pattern: read → modify → write
   */
  async createCompleteCase(caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<StoredCase> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    const timestamp = new Date().toISOString();
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
        applicationDate: caseData.caseRecord.applicationDate || timestamp,
        caseType: caseData.caseRecord.caseType || 'General',
        spouseId: caseData.caseRecord.spouseId || '',
        status: caseData.caseRecord.status,
        description: caseData.caseRecord.description || '',
        priority: Boolean(caseData.caseRecord.priority),
        livingArrangement: caseData.caseRecord.livingArrangement || '',
        withWaiver: Boolean(caseData.caseRecord.withWaiver),
        admissionDate: caseData.caseRecord.admissionDate || timestamp,
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
   * Update an existing complete case
   * Pattern: read → modify → write
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
   * Update case status
   * Pattern: read → modify → write
   * Includes activity log entry for status changes
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
   * Delete a case
   * Pattern: read → modify → write
   * Also removes associated financials and notes
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

    // Remove case and its associated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: currentData.cases.filter(c => c.id !== caseId),
      financials: currentData.financials.filter(f => f.caseId !== caseId),
      notes: currentData.notes.filter(n => n.caseId !== caseId),
    };

    // Write back to file
    await this.fileStorage.writeNormalizedData(updatedData);
  }

  /**
   * Delete multiple cases at once
   * Pattern: read → modify → write (single operation for efficiency)
   * Also removes associated financials and notes for all deleted cases
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
    
    // Filter out cases and their associated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: currentData.cases.filter(c => !idsToDelete.has(c.id)),
      financials: currentData.financials.filter(f => !idsToDelete.has(f.caseId)),
      notes: currentData.notes.filter(n => !idsToDelete.has(n.caseId)),
    };

    const deletedCount = currentData.cases.length - updatedData.cases.length;

    // Write back to file
    await this.fileStorage.writeNormalizedData(updatedData);

    return { deleted: deletedCount, notFound };
  }

  /**
   * Update status for multiple cases at once
   * Pattern: read → modify → write (single operation for efficiency)
   * Creates activity log entries for each status change
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
   * Update priority for multiple cases at once
   * Pattern: read → modify → write (single operation for efficiency)
   * Creates activity log entries for each priority change
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
  // BULK OPERATIONS
  // =============================================================================

  /**
   * Import multiple cases at once
   * Pattern: read → modify → write (single operation)
   * Strategy: Preserve existing cases; skip incoming duplicates by ID
   * Note: Imported cases should be StoredCase format (no nested financials/notes)
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
   * Clear all data
   * Pattern: write empty structure
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
