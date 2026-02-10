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
  formatRelativeTime,
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
  formatAddress,
  formatMailingAddress,
} from "./formatters";

export {
  sanitizeText,
  sanitizeJSON,
  sanitizeFormField,
  sanitizeFormData,
} from "./sanitization";

// Data normalization (deprecated - for legacy support)
export {
  type NormalizedItem,
  type NormalizedFormData,
  getNormalizedItem,
  getNormalizedFormData,
} from "./normalization";

export {
  type FreshnessData,
  formatFreshnessLabel,
} from "./formatFreshness";

export {
  type USState,
  US_STATES,
  getStateLabel,
} from "./usStates";