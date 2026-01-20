/**
 * Case Data Factories
 * ====================
 * Centralized factory functions for creating case-related data structures.
 * 
 * IMPORTANT: When adding a new field to NewCaseRecordData or NewPersonData,
 * update these factory functions to ensure the field is initialized everywhere.
 * 
 * @module domain/cases/factories
 */

import { 
  NewCaseRecordData, 
  NewPersonData, 
  CaseStatus, 
  StoredCase 
} from "@/types/case";

/**
 * Options for creating case record data.
 */
export interface CaseRecordDefaults {
  /** Default case type from category config */
  caseType?: string;
  /** Default case status from category config */
  caseStatus?: CaseStatus;
  /** Default living arrangement from category config */
  livingArrangement?: string;
  /** Application date (defaults to today) */
  applicationDate?: string;
}

/**
 * Creates a new NewCaseRecordData object with all fields initialized.
 * 
 * Use this factory instead of inline object literals to ensure all fields
 * are properly initialized when the type changes.
 * 
 * @param existingCase - Optional existing case to copy values from (for editing)
 * @param defaults - Default values from category config
 * @returns A fully initialized NewCaseRecordData object
 * 
 * @example
 * // Creating a new case
 * const caseData = createCaseRecordData(undefined, {
 *   caseType: config.caseTypes[0],
 *   caseStatus: config.caseStatuses[0]?.name,
 *   livingArrangement: config.livingArrangements[0],
 * });
 * 
 * @example
 * // Editing an existing case
 * const caseData = createCaseRecordData(existingCase, {
 *   caseStatus: 'Pending',
 *   livingArrangement: 'Community',
 * });
 */
export function createCaseRecordData(
  existingCase?: StoredCase | null,
  defaults: CaseRecordDefaults = {}
): NewCaseRecordData {
  const record = existingCase?.caseRecord;
  
  return {
    // Core fields
    mcn: record?.mcn ?? "",
    applicationDate: record?.applicationDate ?? defaults.applicationDate ?? "",
    caseType: record?.caseType ?? defaults.caseType ?? "",
    applicationType: record?.applicationType ?? "",
    personId: record?.personId ?? "",
    spouseId: record?.spouseId ?? "",
    status: (record?.status ?? defaults.caseStatus ?? "Pending") as CaseStatus,
    description: record?.description ?? "",
    priority: record?.priority ?? false,
    livingArrangement: record?.livingArrangement ?? defaults.livingArrangement ?? "",
    withWaiver: record?.withWaiver ?? false,
    admissionDate: record?.admissionDate ?? "",
    organizationId: record?.organizationId ?? "",
    authorizedReps: record?.authorizedReps ?? [],
    retroRequested: record?.retroRequested ?? "",
    
    // Intake checklist fields
    appValidated: record?.appValidated ?? false,
    retroMonths: record?.retroMonths ?? [],
    contactMethods: record?.contactMethods ?? [],
    agedDisabledVerified: record?.agedDisabledVerified ?? false,
    citizenshipVerified: record?.citizenshipVerified ?? false,
    residencyVerified: record?.residencyVerified ?? false,
    avsSubmitted: record?.avsSubmitted ?? false,
    interfacesReviewed: record?.interfacesReviewed ?? false,
    reviewVRs: record?.reviewVRs ?? false,
    reviewPriorBudgets: record?.reviewPriorBudgets ?? false,
    reviewPriorNarr: record?.reviewPriorNarr ?? false,
    pregnancy: record?.pregnancy ?? false,
    avsConsentDate: record?.avsConsentDate ?? "",
    maritalStatus: record?.maritalStatus ?? "",
    voterFormStatus: record?.voterFormStatus ?? "",
  };
}

/**
 * Options for creating person data.
 */
export interface PersonDefaults {
  /** Default living arrangement from category config */
  livingArrangement?: string;
  /** Default state for addresses */
  defaultState?: string;
}

/**
 * Creates a new NewPersonData object with all fields initialized.
 * 
 * Use this factory instead of inline object literals to ensure all fields
 * are properly initialized when the type changes.
 * 
 * @param existingCase - Optional existing case to copy person values from
 * @param defaults - Default values
 * @returns A fully initialized NewPersonData object
 */
export function createPersonData(
  existingCase?: StoredCase | null,
  defaults: PersonDefaults = {}
): NewPersonData {
  const person = existingCase?.person;
  const defaultState = defaults.defaultState ?? "NE";
  
  return {
    firstName: person?.firstName ?? "",
    lastName: person?.lastName ?? "",
    email: person?.email ?? "",
    phone: person?.phone ?? "",
    dateOfBirth: person?.dateOfBirth ?? "",
    ssn: person?.ssn ?? "",
    organizationId: person?.organizationId ?? null,
    livingArrangement: person?.livingArrangement ?? defaults.livingArrangement ?? "",
    address: {
      street: person?.address?.street ?? "",
      city: person?.address?.city ?? "",
      state: person?.address?.state ?? defaultState,
      zip: person?.address?.zip ?? "",
    },
    mailingAddress: {
      street: person?.mailingAddress?.street ?? "",
      city: person?.mailingAddress?.city ?? "",
      state: person?.mailingAddress?.state ?? defaultState,
      zip: person?.mailingAddress?.zip ?? "",
      sameAsPhysical: person?.mailingAddress?.sameAsPhysical ?? true,
    },
    authorizedRepIds: person?.authorizedRepIds ?? [],
    familyMembers: person?.familyMembers ?? [],
    relationships: person?.relationships ?? [],
    status: person?.status ?? "Active",
  };
}
