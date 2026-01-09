/**
 * @fileoverview Domain Common Module
 *
 * Exports foundational pure utilities used across all domain modules.
 *
 * @module domain/common
 */

export {
  toLocalDateString,
  parseLocalDate,
  formatDateForDisplay,
  formatShortDate,
  formatDateTime,
  isoToDateInputValue,
  dateInputValueToISO,
} from "./dates";

export {
  type PhoneFormat,
  type PhoneFormatterOptions,
  stripPhoneNumber,
  formatUSPhone,
  formatE164Phone,
  formatInternationalPhone,
  formatPhoneNumber,
  isValidPhoneNumber,
  isValidUSPhoneNumber,
  formatPhoneNumberAsTyped,
  getDisplayPhoneNumber,
  normalizePhoneNumber,
  getAreaCode,
} from "./phone";

export {
  formatCurrency,
  formatFrequency,
  formatAccountNumber,
  parseNumericInput,
  getDisplayAmount,
} from "./formatters";
