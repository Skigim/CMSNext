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
  createValidator,
} from "@/domain/validation";