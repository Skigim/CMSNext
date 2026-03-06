/**
 * @fileoverview Domain validation module - pure validation functions.
 */

export { findDuplicateIndices } from "./duplicates";
export type { NormalizedEntry } from "./duplicates";

export {
  // Schemas
  AddressSchema,
  MailingAddressSchema,
  PersonSchema,
  FinancialItemSchema,
  NoteSchema,
  CaseRecordSchema,
  
  // Types
  type ValidationResult,
} from "./forms";

export {
  IntakeApplicantSchema,
  IntakeContactSchema,
  IntakeCaseDetailsSchema,
  IntakeChecklistSchema,
  IntakeFormSchema,
  createBlankIntakeForm,
  type IntakeApplicantData,
  type IntakeContactData,
  type IntakeCaseDetailsData,
  type IntakeChecklistData,
  type IntakeFormData,
} from "./intake.schema";