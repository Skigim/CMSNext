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
import {
  createBlankIntakeForm,
  type IntakeFormData,
} from "@/domain/validation/intake.schema";
import { getPrimaryCasePerson } from "./people";

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
    avsSubmitDate: record?.avsSubmitDate ?? "",
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
  const person = existingCase ? getPrimaryCasePerson(existingCase) : null;
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

/**
 * Creates intake-form data from an existing stored case.
 *
 * Supported intake fields are copied so the workflow can act as the canonical
 * create/edit authoring surface, while unsupported fields stay on the source
 * case and are preserved by the edit submit path.
 */
export function createIntakeFormData(
  existingCase?: StoredCase | null,
): IntakeFormData {
  const blankForm = createBlankIntakeForm();
  const person = existingCase ? getPrimaryCasePerson(existingCase) : null;
  const record = existingCase?.caseRecord;

  if (!existingCase || !record) {
    return blankForm;
  }

  return {
    ...blankForm,
    firstName: person?.firstName ?? "",
    lastName: person?.lastName ?? "",
    dateOfBirth: person?.dateOfBirth ?? "",
    ssn: person?.ssn ?? "",
    maritalStatus: record.maritalStatus ?? "",
    phone: person?.phone ?? "",
    email: person?.email ?? "",
    address: {
      ...blankForm.address,
      street: person?.address?.street ?? "",
      apt: person?.address?.apt ?? "",
      city: person?.address?.city ?? "",
      state: person?.address?.state ?? blankForm.address.state,
      zip: person?.address?.zip ?? "",
    },
    mailingAddress: {
      ...blankForm.mailingAddress,
      street: person?.mailingAddress?.street ?? "",
      apt: person?.mailingAddress?.apt ?? "",
      city: person?.mailingAddress?.city ?? "",
      state: person?.mailingAddress?.state ?? blankForm.mailingAddress.state,
      zip: person?.mailingAddress?.zip ?? "",
      sameAsPhysical: person?.mailingAddress?.sameAsPhysical ?? true,
    },
    mcn: record.mcn ?? "",
    applicationDate: record.applicationDate ?? "",
    caseType: record.caseType ?? "",
    applicationType: record.applicationType ?? "",
    livingArrangement:
      record.livingArrangement ?? person?.livingArrangement ?? "",
    withWaiver: record.withWaiver ?? false,
    admissionDate: record.admissionDate ?? "",
    organizationId:
      record.organizationId ?? person?.organizationId ?? blankForm.organizationId,
    retroRequested:
      record.retroMonths && record.retroMonths.length > 0
        ? record.retroMonths.join(", ")
        : (record.retroRequested ?? ""),
    appValidated: record.appValidated ?? false,
    agedDisabledVerified: record.agedDisabledVerified ?? false,
    citizenshipVerified: record.citizenshipVerified ?? false,
    residencyVerified: record.residencyVerified ?? false,
    contactMethods: record.contactMethods ?? [],
    voterFormStatus: record.voterFormStatus ?? "",
    pregnancy: record.pregnancy ?? false,
    avsConsentDate: record.avsConsentDate ?? "",
  };
}
