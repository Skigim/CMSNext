/**
 * Form Validation Schemas
 *
 * All core logic has moved to @/domain/validation.
 * This file re-exports for backwards compatibility.
 */

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
} from "@/domain/validation";

// Re-export with original name for backwards compatibility
export { validateFinancialItemForm as validateFinancialItem } from "@/domain/validation";
