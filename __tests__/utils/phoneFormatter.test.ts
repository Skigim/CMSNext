import { describe, it, expect } from 'vitest';
import {
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
} from '@/utils/phoneFormatter';

describe('phoneFormatter', () => {
  describe('stripPhoneNumber', () => {
    it('removes all non-digit characters', () => {
      expect(stripPhoneNumber('(555) 123-4567')).toBe('5551234567');
      expect(stripPhoneNumber('+1-555-123-4567')).toBe('15551234567');
      expect(stripPhoneNumber('555.123.4567')).toBe('5551234567');
      expect(stripPhoneNumber('abc555def123ghi4567')).toBe('5551234567');
    });

    it('returns empty string for no digits', () => {
      expect(stripPhoneNumber('')).toBe('');
      expect(stripPhoneNumber('abc')).toBe('');
      expect(stripPhoneNumber('---')).toBe('');
    });
  });

  describe('formatUSPhone', () => {
    it('formats 10-digit US phone numbers', () => {
      expect(formatUSPhone('5551234567')).toBe('(555) 123-4567');
      expect(formatUSPhone('1234567890')).toBe('(123) 456-7890');
    });

    it('handles partial phone numbers', () => {
      expect(formatUSPhone('5')).toBe('(5');
      expect(formatUSPhone('55')).toBe('(55');
      expect(formatUSPhone('555')).toBe('(555');
      expect(formatUSPhone('5551')).toBe('(555) 1');
      expect(formatUSPhone('555123')).toBe('(555) 123');
      expect(formatUSPhone('5551234')).toBe('(555) 123-4');
    });

    it('handles 11-digit numbers with country code', () => {
      expect(formatUSPhone('15551234567')).toBe('+1 (555) 123-4567');
    });

    it('truncates numbers longer than 10 digits (without country code)', () => {
      expect(formatUSPhone('55512345678')).toBe('(555) 123-4567');
    });

    it('handles already formatted numbers', () => {
      expect(formatUSPhone('(555) 123-4567')).toBe('(555) 123-4567');
    });

    it('returns empty string for empty input', () => {
      expect(formatUSPhone('')).toBe('');
    });
  });

  describe('formatE164Phone', () => {
    it('formats to E.164 standard', () => {
      expect(formatE164Phone('5551234567')).toBe('+15551234567');
      expect(formatE164Phone('5551234567', '1')).toBe('+15551234567');
    });

    it('handles different country codes', () => {
      expect(formatE164Phone('5551234567', '44')).toBe('+445551234567');
    });

    it('preserves existing country code', () => {
      expect(formatE164Phone('15551234567', '1')).toBe('+15551234567');
    });

    it('returns empty string for empty input', () => {
      expect(formatE164Phone('')).toBe('');
    });
  });

  describe('formatInternationalPhone', () => {
    it('formats international numbers', () => {
      expect(formatInternationalPhone('15551234567')).toBe('+1 555 123 4567');
      expect(formatInternationalPhone('445551234567')).toBe('+44 555 123 4567');
    });

    it('defaults to US format for 10-digit numbers', () => {
      expect(formatInternationalPhone('5551234567')).toBe('(555) 123-4567');
    });

    it('returns empty string for empty input', () => {
      expect(formatInternationalPhone('')).toBe('');
    });
  });

  describe('formatPhoneNumber', () => {
    it('defaults to US format', () => {
      expect(formatPhoneNumber('5551234567')).toBe('(555) 123-4567');
    });

    it('formats to E.164 when specified', () => {
      expect(formatPhoneNumber('5551234567', { format: 'e164' })).toBe('+15551234567');
    });

    it('formats to international when specified', () => {
      expect(formatPhoneNumber('15551234567', { format: 'international' })).toBe('+1 555 123 4567');
    });

    it('uses custom country code', () => {
      expect(formatPhoneNumber('5551234567', { format: 'e164', countryCode: '44' })).toBe('+445551234567');
    });

    it('returns empty string for empty input', () => {
      expect(formatPhoneNumber('')).toBe('');
      expect(formatPhoneNumber(null as any)).toBe('');
      expect(formatPhoneNumber(undefined as any)).toBe('');
    });
  });

  describe('isValidPhoneNumber', () => {
    it('validates based on minimum digits', () => {
      expect(isValidPhoneNumber('5551234567')).toBe(true);
      expect(isValidPhoneNumber('555123456')).toBe(false);
    });

    it('accepts custom minimum digits', () => {
      expect(isValidPhoneNumber('555123', 6)).toBe(true);
      expect(isValidPhoneNumber('55512', 6)).toBe(false);
    });

    it('ignores formatting characters', () => {
      expect(isValidPhoneNumber('(555) 123-4567')).toBe(true);
      expect(isValidPhoneNumber('+1-555-123-4567')).toBe(true);
    });
  });

  describe('isValidUSPhoneNumber', () => {
    it('validates 10-digit US numbers', () => {
      expect(isValidUSPhoneNumber('5551234567')).toBe(true);
      expect(isValidUSPhoneNumber('(555) 123-4567')).toBe(true);
    });

    it('validates 11-digit numbers starting with 1', () => {
      expect(isValidUSPhoneNumber('15551234567')).toBe(true);
      expect(isValidUSPhoneNumber('+1 (555) 123-4567')).toBe(true);
    });

    it('rejects invalid lengths', () => {
      expect(isValidUSPhoneNumber('555123456')).toBe(false);
      expect(isValidUSPhoneNumber('555')).toBe(false);
    });

    it('rejects 11-digit numbers not starting with 1', () => {
      expect(isValidUSPhoneNumber('25551234567')).toBe(false);
    });
  });

  describe('formatPhoneNumberAsTyped', () => {
    it('formats as user types', () => {
      expect(formatPhoneNumberAsTyped('5')).toBe('(5');
      expect(formatPhoneNumberAsTyped('55')).toBe('(55');
      expect(formatPhoneNumberAsTyped('555')).toBe('(555');
      expect(formatPhoneNumberAsTyped('5551')).toBe('(555) 1');
      expect(formatPhoneNumberAsTyped('5551234567')).toBe('(555) 123-4567');
    });

    it('handles deletion', () => {
      expect(formatPhoneNumberAsTyped('555123', '5551234')).toBe('(555) 123');
      expect(formatPhoneNumberAsTyped('555', '5551')).toBe('(555');
    });

    it('strips non-numeric input', () => {
      expect(formatPhoneNumberAsTyped('555abc123')).toBe('(555) 123');
    });
  });

  describe('getDisplayPhoneNumber', () => {
    it('formats complete phone numbers for display', () => {
      expect(getDisplayPhoneNumber('5551234567')).toBe('(555) 123-4567');
      expect(getDisplayPhoneNumber('(555) 123-4567')).toBe('(555) 123-4567');
    });

    it('returns incomplete numbers as-is', () => {
      expect(getDisplayPhoneNumber('555')).toBe('555');
      expect(getDisplayPhoneNumber('555123')).toBe('555123');
    });

    it('handles null/undefined/empty', () => {
      expect(getDisplayPhoneNumber(null)).toBe('');
      expect(getDisplayPhoneNumber(undefined)).toBe('');
      expect(getDisplayPhoneNumber('')).toBe('');
    });
  });

  describe('normalizePhoneNumber', () => {
    it('normalizes to digits only for storage', () => {
      expect(normalizePhoneNumber('(555) 123-4567')).toBe('5551234567');
      expect(normalizePhoneNumber('+1-555-123-4567')).toBe('15551234567');
      expect(normalizePhoneNumber('555.123.4567')).toBe('5551234567');
    });
  });

  describe('getAreaCode', () => {
    it('extracts area code from 10-digit numbers', () => {
      expect(getAreaCode('5551234567')).toBe('555');
      expect(getAreaCode('(555) 123-4567')).toBe('555');
    });

    it('extracts area code from 11-digit numbers', () => {
      expect(getAreaCode('15551234567')).toBe('555');
      expect(getAreaCode('+1 (555) 123-4567')).toBe('555');
    });

    it('returns partial area code for incomplete numbers', () => {
      expect(getAreaCode('5')).toBe('');
      expect(getAreaCode('55')).toBe('');
      expect(getAreaCode('555')).toBe('555');
    });

    it('returns empty string for empty input', () => {
      expect(getAreaCode('')).toBe('');
    });
  });
});
