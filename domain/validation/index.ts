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
  
  // Validation functions
  validatePersonData,
  validateCaseRecordData,
  validateFinancialItemData,
  validateNoteData,
  validateCompleteCase,
  createValidator,
  
  // Pre-built validators
  validatePerson,
  validateCaseRecord,
  validateFinancialItemForm,
  validateNote,
} from "./forms";