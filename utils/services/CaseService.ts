import { v4 as uuidv4 } from 'uuid';
import type { CaseDisplay, NewPersonData, NewCaseRecordData } from '../../types/case';
import type { CaseActivityEntry } from '../../types/activityLog';
import type { FileStorageService, FileData } from './FileStorageService';
import { ActivityLogService } from './ActivityLogService';

function formatCaseDisplayName(caseData: CaseDisplay): string {
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
 * Responsibilities:
 * - Read operations: getAllCases, getCaseById, getCasesCount
 * - Create/Update/Delete operations (to be added)
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
  async getAllCases(): Promise<CaseDisplay[]> {
    const data = await this.fileStorage.readFileData();
    return data ? data.cases : [];
  }

  /**
   * Get a specific case by ID (always reads fresh from file)
   */
  async getCaseById(caseId: string): Promise<CaseDisplay | null> {
    const data = await this.fileStorage.readFileData();
    if (!data) return null;
    
    const caseItem = data.cases.find(c => c.id === caseId);
    return caseItem || null;
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
  async createCompleteCase(caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Create new case
    const newCase: CaseDisplay = {
      id: uuidv4(),
      name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
      mcn: caseData.caseRecord.mcn,
      status: caseData.caseRecord.status,
      priority: Boolean(caseData.caseRecord.priority),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      person: {
        id: uuidv4(),
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
        status: caseData.person.status || 'Active',
        dateAdded: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      caseRecord: {
        id: uuidv4(),
        personId: '', // Will be set below
        mcn: caseData.caseRecord.mcn,
        applicationDate: caseData.caseRecord.applicationDate || new Date().toISOString(),
        caseType: caseData.caseRecord.caseType || 'General',
        spouseId: caseData.caseRecord.spouseId || '',
        status: caseData.caseRecord.status,
        description: caseData.caseRecord.description || '',
        priority: Boolean(caseData.caseRecord.priority),
        livingArrangement: caseData.caseRecord.livingArrangement || '',
        withWaiver: Boolean(caseData.caseRecord.withWaiver),
        admissionDate: caseData.caseRecord.admissionDate || new Date().toISOString(),
        organizationId: caseData.caseRecord.organizationId || '',
        authorizedReps: caseData.caseRecord.authorizedReps || [],
        retroRequested: caseData.caseRecord.retroRequested || '',
        financials: {
          resources: [],
          income: [],
          expenses: []
        },
        notes: [],
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString()
      }
    };

    // Set the person ID reference
    newCase.caseRecord.personId = newCase.person.id;

    // Modify data
    const casesWithNewCase = [...currentData.cases, newCase];
    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(casesWithNewCase, [newCase.id]);

    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.fileStorage.writeFileData(updatedData);

    return casesWithTouchedTimestamps.find(c => c.id === newCase.id) ?? newCase;
  }

  /**
   * Update an existing complete case
   * Pattern: read → modify → write
   */
  async updateCompleteCase(caseId: string, caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<CaseDisplay> {
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
      status: caseData.person.status || 'Active'
    };

    // Update case record data
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
      // Preserve existing financials and notes
      financials: existingCase.caseRecord.financials,
      notes: existingCase.caseRecord.notes,
      updatedDate: new Date().toISOString()
    };

    const caseWithChanges: CaseDisplay = {
      ...existingCase,
      name: updatedPerson.name,
      mcn: updatedCaseRecord.mcn,
      status: updatedCaseRecord.status,
      priority: updatedCaseRecord.priority,
      person: updatedPerson,
      caseRecord: updatedCaseRecord,
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithChanges : c,
    );

    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Modify data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.fileStorage.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Update case status
   * Pattern: read → modify → write
   * Includes activity log entry for status changes
   */
  async updateCaseStatus(caseId: string, status: CaseDisplay["status"]): Promise<CaseDisplay> {
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

    const caseWithUpdatedStatus: CaseDisplay = {
      ...targetCase,
      status,
      caseRecord: {
        ...targetCase.caseRecord,
        status,
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithUpdatedStatus : c,
    );

    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(casesWithChanges, [caseId]);

    const activityEntry: CaseActivityEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      caseId: targetCase.id,
      caseName: formatCaseDisplayName(targetCase),
      caseMcn: targetCase.caseRecord?.mcn ?? targetCase.mcn ?? null,
      type: "status-change",
      payload: {
        fromStatus: targetCase.caseRecord?.status ?? targetCase.status,
        toStatus: status,
      },
    };

    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
      activityLog: ActivityLogService.mergeActivityEntries(currentData.activityLog, [activityEntry]),
    };

    await this.fileStorage.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  // =============================================================================
  // DELETE OPERATIONS
  // =============================================================================

  /**
   * Delete a case
   * Pattern: read → modify → write
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

    // Modify data (remove case)
    const updatedData: FileData = {
      ...currentData,
      cases: currentData.cases.filter(c => c.id !== caseId)
    };

    // Write back to file
    await this.fileStorage.writeFileData(updatedData);
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  /**
   * Import multiple cases at once
   * Pattern: read → modify → write (single operation)
   */
  async importCases(cases: CaseDisplay[]): Promise<void> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Validate and ensure unique IDs
    const casesToImport = cases.map(caseItem => ({
      ...caseItem,
      id: caseItem.id || uuidv4(),
      caseRecord: {
        ...caseItem.caseRecord,
        updatedDate: new Date().toISOString(),
      },
    }));

    const touchedCaseIds = casesToImport.map(caseItem => caseItem.id);

    const combinedCases = [...currentData.cases, ...casesToImport];
    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(combinedCases, touchedCaseIds);

    // Modify data (append new cases)
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.fileStorage.writeFileData(updatedData);
  }

  /**
   * Clear all data
   * Pattern: write empty structure
   */
  async clearAllData(categoryConfig: any): Promise<void> {
    const emptyData: FileData = {
      cases: [],
      exported_at: new Date().toISOString(),
      total_cases: 0,
      categoryConfig,
      activityLog: [],
    };

    await this.fileStorage.writeFileData(emptyData);
  }
}
