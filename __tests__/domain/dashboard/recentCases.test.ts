/**
 * @fileoverview Tests for Recent Cases Domain Logic
 *
 * Comprehensive unit tests for pure recent case tracking functions.
 * Tests cover adding/removing entries, pruning, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  addRecentCase,
  removeRecentCase,
  getRecentCaseIds,
  pruneOldEntries,
  isRecentCase,
  pruneDeletedCases,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MAX_AGE_DAYS,
  type RecentCaseEntry,
} from '../../../domain/dashboard/recentCases';

// Test data factory
function createRecentEntry(
  caseId: string,
  viewedAt: string = new Date().toISOString()
): RecentCaseEntry {
  return { caseId, viewedAt };
}

describe('Recent Cases Domain Logic', () => {
  describe('Constants', () => {
    it('should have default max entries of 10', () => {
      expect(DEFAULT_MAX_ENTRIES).toBe(10);
    });

    it('should have default max age of 30 days', () => {
      expect(DEFAULT_MAX_AGE_DAYS).toBe(30);
    });
  });

  describe('addRecentCase', () => {
    it('should add a case to an empty list', () => {
      const result = addRecentCase([], 'case-1', '2024-01-15T10:00:00.000Z');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        caseId: 'case-1',
        viewedAt: '2024-01-15T10:00:00.000Z',
      });
    });

    it('should add new case at the front of the list', () => {
      const list = [createRecentEntry('case-1', '2024-01-14T10:00:00.000Z')];
      const result = addRecentCase(list, 'case-2', '2024-01-15T10:00:00.000Z');

      expect(result).toHaveLength(2);
      expect(result[0].caseId).toBe('case-2');
      expect(result[1].caseId).toBe('case-1');
    });

    it('should move existing case to front with updated timestamp', () => {
      const list = [
        createRecentEntry('case-2', '2024-01-15T10:00:00.000Z'),
        createRecentEntry('case-1', '2024-01-14T10:00:00.000Z'),
      ];
      const result = addRecentCase(list, 'case-1', '2024-01-16T10:00:00.000Z');

      expect(result).toHaveLength(2);
      expect(result[0].caseId).toBe('case-1');
      expect(result[0].viewedAt).toBe('2024-01-16T10:00:00.000Z');
      expect(result[1].caseId).toBe('case-2');
    });

    it('should not mutate the original array', () => {
      const original = [createRecentEntry('case-1')];
      const originalCopy = [...original];
      addRecentCase(original, 'case-2', '2024-01-15T10:00:00.000Z');

      expect(original).toEqual(originalCopy);
    });

    it('should respect the default max entries limit (10)', () => {
      // Create list with 10 entries (case-0 at front is newest, case-9 at end is oldest)
      const list = Array.from({ length: 10 }, (_, i) =>
        createRecentEntry(`case-${i}`, `2024-01-${String(10 - i).padStart(2, '0')}T10:00:00.000Z`)
      );

      const result = addRecentCase(list, 'case-new', '2024-01-20T10:00:00.000Z');

      expect(result).toHaveLength(10);
      expect(result[0].caseId).toBe('case-new');
      // Oldest entry (case-9 at end of list) should be dropped
      expect(result.map((e) => e.caseId)).not.toContain('case-9');
    });

    it('should respect custom max entries limit', () => {
      const list = [
        createRecentEntry('case-1'),
        createRecentEntry('case-2'),
        createRecentEntry('case-3'),
      ];

      const result = addRecentCase(list, 'case-4', '2024-01-15T10:00:00.000Z', 3);

      expect(result).toHaveLength(3);
      expect(result[0].caseId).toBe('case-4');
      expect(result.map((e) => e.caseId)).not.toContain('case-3');
    });

    it('should handle max entries of 1', () => {
      const list = [createRecentEntry('case-1')];
      const result = addRecentCase(list, 'case-2', '2024-01-15T10:00:00.000Z', 1);

      expect(result).toHaveLength(1);
      expect(result[0].caseId).toBe('case-2');
    });

    it('should handle viewing same case multiple times (idempotent except timestamp)', () => {
      const list = [createRecentEntry('case-1', '2024-01-14T10:00:00.000Z')];
      const result = addRecentCase(list, 'case-1', '2024-01-15T10:00:00.000Z');

      expect(result).toHaveLength(1);
      expect(result[0].viewedAt).toBe('2024-01-15T10:00:00.000Z');
    });
  });

  describe('removeRecentCase', () => {
    it('should remove a case from the list', () => {
      const list = [
        createRecentEntry('case-1'),
        createRecentEntry('case-2'),
        createRecentEntry('case-3'),
      ];

      const result = removeRecentCase(list, 'case-2');

      expect(result).toHaveLength(2);
      expect(result.map((e) => e.caseId)).toEqual(['case-1', 'case-3']);
    });

    it('should return empty array when removing from single-entry list', () => {
      const list = [createRecentEntry('case-1')];
      const result = removeRecentCase(list, 'case-1');

      expect(result).toHaveLength(0);
    });

    it('should return unchanged array when case not found', () => {
      const list = [createRecentEntry('case-1'), createRecentEntry('case-2')];
      const result = removeRecentCase(list, 'case-99');

      expect(result).toEqual(list);
    });

    it('should not mutate the original array', () => {
      const original = [createRecentEntry('case-1'), createRecentEntry('case-2')];
      const originalLength = original.length;
      removeRecentCase(original, 'case-1');

      expect(original).toHaveLength(originalLength);
    });

    it('should handle empty list', () => {
      const result = removeRecentCase([], 'case-1');
      expect(result).toEqual([]);
    });
  });

  describe('getRecentCaseIds', () => {
    it('should return case IDs in order', () => {
      const list = [
        createRecentEntry('case-3'),
        createRecentEntry('case-1'),
        createRecentEntry('case-2'),
      ];

      const result = getRecentCaseIds(list);

      expect(result).toEqual(['case-3', 'case-1', 'case-2']);
    });

    it('should return empty array for empty list', () => {
      const result = getRecentCaseIds([]);
      expect(result).toEqual([]);
    });

    it('should not mutate the original array', () => {
      const original = [createRecentEntry('case-1')];
      const result = getRecentCaseIds(original);

      // Mutating result should not affect original
      result.push('case-2');
      expect(original).toHaveLength(1);
    });
  });

  describe('pruneOldEntries', () => {
    it('should remove entries older than max age', () => {
      const now = new Date('2024-01-15T12:00:00.000Z');
      const list = [
        createRecentEntry('case-1', '2024-01-14T12:00:00.000Z'), // 1 day old - keep
        createRecentEntry('case-2', '2024-01-01T12:00:00.000Z'), // 14 days old - prune
      ];

      const result = pruneOldEntries(list, 7, now);

      expect(result).toHaveLength(1);
      expect(result[0].caseId).toBe('case-1');
    });

    it('should keep entries at exactly max age', () => {
      const now = new Date('2024-01-15T12:00:00.000Z');
      const list = [
        createRecentEntry('case-1', '2024-01-08T12:00:00.000Z'), // exactly 7 days old
      ];

      const result = pruneOldEntries(list, 7, now);

      expect(result).toHaveLength(1);
    });

    it('should use default max age of 30 days', () => {
      const now = new Date('2024-02-15T12:00:00.000Z');
      const list = [
        createRecentEntry('case-1', '2024-02-01T12:00:00.000Z'), // 14 days old - keep
        createRecentEntry('case-2', '2024-01-01T12:00:00.000Z'), // 45 days old - prune
      ];

      const result = pruneOldEntries(list, undefined, now);

      expect(result).toHaveLength(1);
      expect(result[0].caseId).toBe('case-1');
    });

    it('should return empty array when all entries are old', () => {
      const now = new Date('2024-01-15T12:00:00.000Z');
      const list = [
        createRecentEntry('case-1', '2024-01-01T12:00:00.000Z'),
        createRecentEntry('case-2', '2024-01-02T12:00:00.000Z'),
      ];

      const result = pruneOldEntries(list, 7, now);

      expect(result).toHaveLength(0);
    });

    it('should handle empty list', () => {
      const result = pruneOldEntries([], 7, new Date());
      expect(result).toEqual([]);
    });

    it('should not mutate the original array', () => {
      const now = new Date('2024-01-15T12:00:00.000Z');
      const original = [createRecentEntry('case-1', '2024-01-01T12:00:00.000Z')];
      const originalLength = original.length;
      pruneOldEntries(original, 7, now);

      expect(original).toHaveLength(originalLength);
    });

    it('should handle invalid date strings gracefully', () => {
      const now = new Date('2024-01-15T12:00:00.000Z');
      const list = [
        createRecentEntry('case-1', 'invalid-date'),
        createRecentEntry('case-2', '2024-01-14T12:00:00.000Z'),
      ];

      // Invalid dates become NaN which fails the >= comparison
      const result = pruneOldEntries(list, 7, now);

      // Only valid date entry should be kept
      expect(result).toHaveLength(1);
      expect(result[0].caseId).toBe('case-2');
    });
  });

  describe('isRecentCase', () => {
    it('should return true if case is in recent list', () => {
      const list = [createRecentEntry('case-1'), createRecentEntry('case-2')];

      expect(isRecentCase(list, 'case-1')).toBe(true);
      expect(isRecentCase(list, 'case-2')).toBe(true);
    });

    it('should return false if case is not in recent list', () => {
      const list = [createRecentEntry('case-1')];

      expect(isRecentCase(list, 'case-99')).toBe(false);
    });

    it('should return false for empty list', () => {
      expect(isRecentCase([], 'case-1')).toBe(false);
    });
  });

  describe('pruneDeletedCases', () => {
    it('should remove entries for deleted cases', () => {
      const list = [
        createRecentEntry('case-1'),
        createRecentEntry('case-2'),
        createRecentEntry('case-3'),
      ];
      const existingCaseIds = ['case-1', 'case-3'];

      const result = pruneDeletedCases(list, existingCaseIds);

      expect(result).toHaveLength(2);
      expect(result.map((e) => e.caseId)).toEqual(['case-1', 'case-3']);
    });

    it('should preserve order of remaining entries', () => {
      const list = [
        createRecentEntry('case-3'),
        createRecentEntry('case-1'),
        createRecentEntry('case-2'),
      ];
      const existingCaseIds = ['case-1', 'case-2'];

      const result = pruneDeletedCases(list, existingCaseIds);

      expect(result.map((e) => e.caseId)).toEqual(['case-1', 'case-2']);
    });

    it('should return empty array when no cases exist', () => {
      const list = [createRecentEntry('case-1'), createRecentEntry('case-2')];

      const result = pruneDeletedCases(list, []);

      expect(result).toHaveLength(0);
    });

    it('should return empty array when recent list is empty', () => {
      const result = pruneDeletedCases([], ['case-1', 'case-2']);
      expect(result).toEqual([]);
    });

    it('should not mutate the original array', () => {
      const original = [createRecentEntry('case-1'), createRecentEntry('case-2')];
      const originalLength = original.length;
      pruneDeletedCases(original, ['case-1']);

      expect(original).toHaveLength(originalLength);
    });

    it('should handle large existing case ID lists efficiently', () => {
      const list = [
        createRecentEntry('case-1'),
        createRecentEntry('case-50'),
        createRecentEntry('case-100'),
      ];
      const existingCaseIds = Array.from({ length: 1000 }, (_, i) => `case-${i + 1}`);

      const result = pruneDeletedCases(list, existingCaseIds);

      expect(result).toHaveLength(3);
    });
  });
});
