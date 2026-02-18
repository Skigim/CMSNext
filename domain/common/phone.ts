/**
 * Phone Number Formatting Utilities
 *
 * Pure functions for formatting, validating, and normalizing phone numbers.
 * Supports US and international formats.
 *
 * @module domain/common/phone
 */

export type PhoneFormat = "us" | "international" | "e164";

export interface PhoneFormatterOptions {
  format?: PhoneFormat;
  countryCode?: string;
}

/**
 * Removes all non-digit characters from a phone number
 */
export function stripPhoneNumber(phone: string): string {
  return phone.replaceAll(/\D/g, "");
}

/**
 * Formats a US phone number as (XXX) XXX-XXXX
 */
export function formatUSPhone(phone: string): string {
  const digits = stripPhoneNumber(phone);

  if (digits.length === 0) {
    return "";
  }

  if (digits.length <= 3) {
    return `(${digits}`;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Handle 11 digits (with country code)
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  }

  // Return first 10 digits formatted
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

/**
 * Formats a phone number in E.164 format (+1XXXXXXXXXX)
 */
export function formatE164Phone(phone: string, countryCode = "1"): string {
  const digits = stripPhoneNumber(phone);

  if (digits.length === 0) {
    return "";
  }

  // If already has country code, return as-is
  if (digits.startsWith(countryCode)) {
    return `+${digits}`;
  }

  return `+${countryCode}${digits}`;
}

/**
 * Formats an international phone number
 */
export function formatInternationalPhone(phone: string): string {
  const digits = stripPhoneNumber(phone);

  if (digits.length === 0) {
    return "";
  }

  // If starts with country code
  if (digits.length > 10) {
    const countryCode = digits.slice(0, -10);
    const areaCode = digits.slice(-10, -7);
    const prefix = digits.slice(-7, -4);
    const lineNumber = digits.slice(-4);
    return `+${countryCode} ${areaCode} ${prefix} ${lineNumber}`;
  }

  // Default to US format
  return formatUSPhone(digits);
}

/**
 * Main formatting function - chooses format based on options
 */
export function formatPhoneNumber(
  phone: string,
  options: PhoneFormatterOptions = {}
): string {
  const { format = "us", countryCode = "1" } = options;

  if (!phone) {
    return "";
  }

  switch (format) {
    case "e164":
      return formatE164Phone(phone, countryCode);
    case "international":
      return formatInternationalPhone(phone);
    case "us":
    default:
      return formatUSPhone(phone);
  }
}

/**
 * Validates if a phone number has enough digits to be valid
 */
export function isValidPhoneNumber(phone: string, minDigits = 10): boolean {
  const digits = stripPhoneNumber(phone);
  return digits.length >= minDigits;
}

/**
 * Validates if a phone number is a complete US phone number
 */
export function isValidUSPhoneNumber(phone: string): boolean {
  const digits = stripPhoneNumber(phone);
  // Accept 10 digits or 11 digits starting with 1
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

/**
 * Formats a phone number as the user types (for input fields).
 * Strips non-numeric characters and formats as a US phone number.
 */
export function formatPhoneNumberAsTyped(value: string): string {
  return formatUSPhone(stripPhoneNumber(value));
}

/**
 * Gets the display format for a phone number (for read-only display)
 */
export function getDisplayPhoneNumber(phone: string | undefined | null): string {
  if (!phone) {
    return "";
  }

  const digits = stripPhoneNumber(phone);

  if (digits.length === 0) {
    return "";
  }

  if (digits.length < 10) {
    return phone; // Return as-is if incomplete
  }

  return formatUSPhone(phone);
}

/**
 * Normalizes a phone number to just digits (for storage)
 */
export function normalizePhoneNumber(phone: string): string {
  return stripPhoneNumber(phone);
}

/**
 * Extracts area code from a phone number
 */
export function getAreaCode(phone: string): string {
  const digits = stripPhoneNumber(phone);

  if (digits.length >= 3) {
    // Handle 11-digit numbers starting with 1
    if (digits.length === 11 && digits.startsWith("1")) {
      return digits.slice(1, 4);
    }
    return digits.slice(0, 3);
  }

  return "";
}
