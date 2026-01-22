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