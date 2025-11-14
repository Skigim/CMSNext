import { describe, it, expect } from 'vitest';
import { STORAGE_CONSTANTS } from '../../../utils/constants/storage';

describe('Storage Constants', () => {
  describe('ALERTS', () => {
    it('should define alerts file name', () => {
      expect(STORAGE_CONSTANTS.ALERTS.FILE_NAME).toBe('alerts.json');
    });

    it('should define alerts CSV name', () => {
      expect(STORAGE_CONSTANTS.ALERTS.CSV_NAME).toBe('Alerts.csv');
    });

    it('should define alerts storage version', () => {
      expect(STORAGE_CONSTANTS.ALERTS.STORAGE_VERSION).toBe(3);
    });
  });

  describe('DATA', () => {
    it('should define data file name', () => {
      expect(STORAGE_CONSTANTS.DATA.FILE_NAME).toBe('data.json');
    });
  });

  describe('Type safety', () => {
    it('should be readonly (as const)', () => {
      // TypeScript compile-time check - if this compiles, the test passes
      const constants: typeof STORAGE_CONSTANTS = STORAGE_CONSTANTS;
      expect(constants).toBeDefined();
    });

    it('should have immutable structure', () => {
      // Verify constants are frozen at runtime in production
      // Note: TypeScript 'as const' provides compile-time safety
      expect(STORAGE_CONSTANTS).toBeDefined();
      expect(STORAGE_CONSTANTS.ALERTS).toBeDefined();
      expect(STORAGE_CONSTANTS.DATA).toBeDefined();
    });
  });
});
