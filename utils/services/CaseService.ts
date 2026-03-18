import { v4 as uuidv4 } from 'uuid';
import type {
  CasePersonRole,
  HouseholdMemberData,
  NewPersonData,
  NewCaseRecordData,
  CaseStatus,
  NewNoteData,
  CaseRecord,
  AlertRecord,
  Person,
  PersonRelationship,
  Relationship,
  PersistedCase,
  StoredCase,
} from '../../types/case';
import type { CategoryConfig } from '../../types/categoryConfig';
import type { FileStorageService, NormalizedFileData } from './FileStorageService';
import { ActivityLogService } from './ActivityLogService';
import { CaseBulkOperationsService } from './CaseBulkOperationsService';
import { PersonService } from './PersonService';
import { toLocalDateString } from '../../domain/common';
import { formatCaseDisplayName } from '../../domain/cases/formatting';
import type { AlertWithMatch } from '@/domain/alerts';
import { dehydrateStoredCase, hydrateStoredCase } from '../storageV21Migration';

// formatCaseDisplayName imported from domain layer
const PRIMARY_CASE_PERSON_ROLE: CasePersonRole = 'applicant';

interface CompleteCaseData {
  person: NewPersonData;
  caseRecord: NewCaseRecordData;
  householdMembers?: HouseholdMemberData[];
}

interface ResolvedHouseholdMember {
  ref: PersistedCase["people"][number];
  person: Person;
  relationship: Relationship;
  normalizedRelationship: PersonRelationship;
}

function normalizeRole(role?: HouseholdMemberData["role"]): CasePersonRole {
  return role ?? "household_member";
}

function syncMailingAddress<T extends Pick<HouseholdMemberData, "address" | "mailingAddress">>(
  personData: T,
): T["mailingAddress"] {
  if (!personData.mailingAddress) {
    return {
      ...personData.address,
      sameAsPhysical: true,
    };
  }

  if (personData.mailingAddress.sameAsPhysical) {
    return {
      ...personData.address,
      sameAsPhysical: true,
    };
  }

  return personData.mailingAddress;
}

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
 * This service handles all case-related operations in the normalized v2.1 format.
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
 * Cases are stored in a flat array without nested relations and hydrated at the
 * service boundary:
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
  private readonly fileStorage: FileStorageService;
  /** Bulk operations service for batch operations */
  private readonly bulkOperations: CaseBulkOperationsService;
  /** Person service for runtime person normalization */
  private readonly people: PersonService;

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
    this.people = new PersonService({
      fileStorage: config.fileStorage,
    });
  }

  private resolveHouseholdMembers(
    currentData: NormalizedFileData,
    householdMembers: HouseholdMemberData[] | undefined,
    timestamp: string,
  ): ResolvedHouseholdMember[] {
    return (householdMembers ?? []).map((member) => {
      const requestedPersonId = member.personId?.trim() ?? "";
      const existingPerson = requestedPersonId
        ? currentData.people.find((person) => person.id === requestedPersonId) ?? null
        : null;

      if (requestedPersonId && !existingPerson) {
        throw new Error(`Person ${requestedPersonId} not found`);
      }

      const normalizedMember: HouseholdMemberData = {
        ...member,
        mailingAddress: syncMailingAddress(member),
      };
      const person = existingPerson
        ? this.people.mergePerson(
            existingPerson,
            normalizedMember,
            timestamp,
          )
        : this.people.buildNewPerson(normalizedMember, {
            personId: uuidv4(),
            timestamp,
          });
      const relationship: Relationship = {
        type: member.relationshipType,
        name: person.name,
        phone: person.phone,
      };

      return {
        ref: {
          personId: person.id,
          role: normalizeRole(member.role),
          isPrimary: false,
        },
        person,
        relationship,
        normalizedRelationship: {
          id: member.relationshipId ?? uuidv4(),
          type: member.relationshipType,
          targetPersonId: person.id,
          legacyPhone: person.phone || undefined,
        },
      };
    });
  }

  private mergePeopleRegistry(
    currentData: NormalizedFileData,
    people: Person[],
  ): NormalizedFileData {
    return people.reduce(
      (data, person) => this.people.upsertPerson(data, person),
      currentData,
    );
  }

  /**
   * Resolve persisted case person references into the runtime case model.
   *
   * @param {PersistedCase} caseItem - Stored-style case data with people references
   * @param {Person[]} people - Global people registry used to resolve references
   * @returns {StoredCase} Hydrated runtime case data with primary person and linked people
   * Delegates to the canonical v2.1 storage hydrator so all read boundaries
   * resolve primary person references consistently.
   *
   * @throws {Error} If no linked people exist or a referenced person cannot be found
   */
  hydrate(caseItem: PersistedCase, people: Person[]): StoredCase {
    return hydrateStoredCase(caseItem, people);
  }

  /**
   * Hydrate multiple persisted cases using the shared people registry.
   *
   * @param {PersistedCase[]} caseItems - Cases to hydrate
   * @param {Person[]} people - Global people registry used for all resolutions
   * @returns {StoredCase[]} Hydrated runtime cases
   * @throws {Error} Propagates any single-case hydration failure
   */
  hydrateAll(caseItems: PersistedCase[], people: Person[]): StoredCase[] {
    return caseItems.map((caseItem) => this.hydrate(caseItem, people));
  }

  /**
   * Strip runtime-only fields from a hydrated case before persistence.
   *
   * The optional alerts field is accepted because some runtime call sites carry
   * transient alert enrichments that must never be written to case storage.
   *
   * @param {StoredCase & { alerts?: AlertRecord[] }} caseItem - Runtime case data
   * @returns {PersistedCase} Persisted-style case data suitable for storage writes
   * @throws {Error} If the runtime case is missing canonical people[] refs
   */
  dehydrate(caseItem: StoredCase & { alerts?: AlertRecord[] }): PersistedCase {
    const {
      person: _person,
      linkedPeople: _linkedPeople,
      alerts: _alerts,
      caseRecord,
      ...rest
    } = caseItem;
    const {
      alerts: _dehydratedAlerts,
      ...dehydratedCase
    } = dehydrateStoredCase(caseItem) as PersistedCase & { alerts?: AlertRecord[] };
    const caseRecordWithRuntimeFields:
      StoredCase["caseRecord"] & Partial<Pick<CaseRecord, "financials" | "notes">> = caseRecord;
    const { financials: _financials, notes: _notes, ...storedCaseRecord } =
      caseRecordWithRuntimeFields;

    return {
      ...dehydratedCase,
      ...rest,
      people: dehydratedCase.people.map((ref) => ({ ...ref })),
      caseRecord: storedCaseRecord,
    };
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
   * 2. Resolves the primary person either by existing personId reference or by
   *    creating a new global person record
   * 3. Creates a persisted case linked through normalized person references
   * 4. Adds the case and any newly created person to the normalized data
   * 5. Writes back through the canonical storage seam
   * 6. Returns the hydrated created case
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
  async createCompleteCase(caseData: CompleteCaseData): Promise<StoredCase> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    const timestamp = new Date().toISOString();
    const todayDate = toLocalDateString(); // For date-only fields
    const caseId = uuidv4();
    const requestedPersonId = caseData.caseRecord.personId?.trim() ?? "";
    const existingPerson = requestedPersonId
      ? currentData.people.find((person) => person.id === requestedPersonId) ?? null
      : null;

    if (requestedPersonId && !existingPerson) {
      throw new Error(`Person ${requestedPersonId} not found`);
    }

    const primaryPersonBase =
      existingPerson ??
      this.people.buildNewPerson(caseData.person, {
        personId: uuidv4(),
        timestamp,
      });
    const resolvedHouseholdMembers = this.resolveHouseholdMembers(
      currentData,
      caseData.householdMembers,
      timestamp,
    );
    const primaryPerson: Person = {
      ...primaryPersonBase,
      familyMembers: resolvedHouseholdMembers.map(({ person }) => person.id),
      familyMemberIds: resolvedHouseholdMembers.map(({ person }) => person.id),
      legacyFamilyMemberNames: [],
      relationships: resolvedHouseholdMembers.map(({ relationship }) => ({ ...relationship })),
      normalizedRelationships: resolvedHouseholdMembers.map(
        ({ normalizedRelationship }) => ({ ...normalizedRelationship }),
      ),
      updatedAt: timestamp,
    };
    const personId = primaryPerson.id;

    const newCase: PersistedCase = {
      id: caseId,
      name: primaryPerson.name,
      mcn: caseData.caseRecord.mcn,
      status: caseData.caseRecord.status,
      priority: Boolean(caseData.caseRecord.priority),
      createdAt: timestamp,
      updatedAt: timestamp,
      people: [
        { personId, role: PRIMARY_CASE_PERSON_ROLE, isPrimary: true },
        ...resolvedHouseholdMembers.map(({ ref }) => ref),
      ],
      caseRecord: {
        id: uuidv4(),
        personId,
        mcn: caseData.caseRecord.mcn,
        applicationDate: caseData.caseRecord.applicationDate || todayDate,
        caseType: caseData.caseRecord.caseType || 'General',
        applicationType: caseData.caseRecord.applicationType || '',
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

    // Write updated data
    const updatedDataWithPeople = this.mergePeopleRegistry(currentData, [
      primaryPerson,
      ...resolvedHouseholdMembers.map(({ person }) => person),
    ]);
    const updatedPeople = updatedDataWithPeople.people;
    const createdRuntimeCase = this.hydrate(newCase, updatedPeople);

    const updatedData: NormalizedFileData = {
      ...updatedDataWithPeople,
      people: updatedPeople,
      cases: [...currentData.cases, createdRuntimeCase],
    };

    const writtenData = await this.fileStorage.writeNormalizedData(updatedData);

    return writtenData.cases.find((caseItem) => caseItem.id === caseId) ?? createdRuntimeCase;
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
  async updateCompleteCase(caseId: string, caseData: CompleteCaseData): Promise<StoredCase> {
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
    const resolvedHouseholdMembers = this.resolveHouseholdMembers(
      currentData,
      caseData.householdMembers,
      timestamp,
    );
    const updatedPersonBase = this.people.mergePerson(existingCase.person, caseData.person, timestamp);
    const updatedPerson: Person = {
      ...updatedPersonBase,
      familyMembers: resolvedHouseholdMembers.map(({ person }) => person.id),
      familyMemberIds: resolvedHouseholdMembers.map(({ person }) => person.id),
      legacyFamilyMemberNames: [],
      relationships: resolvedHouseholdMembers.map(({ relationship }) => ({ ...relationship })),
      normalizedRelationships: resolvedHouseholdMembers.map(
        ({ normalizedRelationship }) => ({ ...normalizedRelationship }),
      ),
    };

    // Update case record data (without financials/notes - they're stored separately)
    const updatedCaseRecord = {
      ...existingCase.caseRecord,
      mcn: caseData.caseRecord.mcn,
      applicationDate: caseData.caseRecord.applicationDate || existingCase.caseRecord.applicationDate,
      caseType: caseData.caseRecord.caseType || existingCase.caseRecord.caseType,
      applicationType: caseData.caseRecord.applicationType ?? existingCase.caseRecord.applicationType ?? '',
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
      people: [
        {
          personId: updatedPerson.id,
          role: PRIMARY_CASE_PERSON_ROLE,
          isPrimary: true,
        },
        ...resolvedHouseholdMembers.map(({ ref }) => ref),
      ],
      person: updatedPerson,
      linkedPeople: [
        {
          ref: {
            personId: updatedPerson.id,
            role: PRIMARY_CASE_PERSON_ROLE,
            isPrimary: true,
          },
          person: updatedPerson,
        },
        ...resolvedHouseholdMembers.map(({ ref, person }) => ({ ref, person })),
      ],
      caseRecord: updatedCaseRecord,
    };

    // Update cases array
    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithChanges : c,
    );

    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Write updated data
    const updatedData = this.mergePeopleRegistry(
      {
        ...currentData,
        cases: casesWithTouchedTimestamps,
      },
      [updatedPerson, ...resolvedHouseholdMembers.map(({ person }) => person)],
    );

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
    const caseData = await this.fileStorage.readFileData();
    if (!caseData) {
      throw new Error("Failed to read current data");
    }

    const caseIndex = caseData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error("Case not found");
    }

    const targetCase = caseData.cases[caseIndex];
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
    const casesWithChanges = caseData.cases.map((c, index) =>
      index === caseIndex ? caseWithUpdatedStatus : c,
    );

    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Create activity log entry using factory method
    const activityEntry = ActivityLogService.createStatusChangeEntry({
      caseId: targetCase.id,
      caseName: formatCaseDisplayName(targetCase),
      caseMcn: targetCase.caseRecord?.mcn ?? targetCase.mcn ?? null,
      fromStatus: currentStatus,
      toStatus: status,
      timestamp,
    });

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...caseData,
      cases: casesWithTouchedTimestamps,
      activityLog: ActivityLogService.mergeActivityEntries(caseData.activityLog, [activityEntry]),
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

  // =============================================================================
  // BULK ALERT AND NOTE OPERATIONS
  // =============================================================================

  /**
   * Resolve alerts for multiple cases matching a description filter.
   * 
   * @param {string[]} caseIds - Array of case IDs whose alerts should be resolved
   * @param {AlertWithMatch[]} alerts - All alerts (pre-filtered for open status by caller)
   * @param {string} descriptionFilter - Alert description to match (exact match)
   * @returns {Promise<{resolvedCount: number, caseCount: number}>} Count of resolved alerts and affected cases
   */
  async resolveAlertsForCases(
    caseIds: string[],
    alerts: AlertWithMatch[],
    descriptionFilter: string
  ): Promise<{ resolvedCount: number; caseCount: number }> {
    return this.bulkOperations.resolveAlertsForCases(caseIds, alerts, descriptionFilter);
  }

  /**
   * Add an identical note to multiple cases.
   * 
   * @param {string[]} caseIds - Array of case IDs to add notes to
   * @param {NewNoteData} noteData - The note data (content, category)
   * @returns {Promise<{addedCount: number}>} Count of notes added
   */
  async addNoteToCases(
    caseIds: string[],
    noteData: NewNoteData
  ): Promise<{ addedCount: number }> {
    return this.bulkOperations.addNoteToCases(caseIds, noteData);
  }
}
