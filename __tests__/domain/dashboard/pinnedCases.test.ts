/**
 * @fileoverview Tests for Pinned Cases Domain Logic
 *
 * Comprehensive unit tests for pure pinned case management functions.
 * Tests cover pinning/unpinning, toggling, limits, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  pinCase,
  unpinCase,
  togglePin,
  isPinned,
  pruneDeletedCases,
  getPinnedCount,
  canPinMore,
  reorderPinnedCase,
  DEFAULT_MAX_PINS,
} from '../../../domain/dashboard/pinnedCases';

describe('Pinned Cases Domain Logic', () => {
  describe('Constants', () => {
    it('should have default max pins as Infinity (unlimited)', () => {
      expect(DEFAULT_MAX_PINS).toBe(Infinity);
    });
  });

  describe('pinCase', () => {
    it('should add a case to an empty pinned list', () => {
      const result = pinCase([], 'case-1');

      expect(result).toEqual(['case-1']);
    });

    it('should add a case to existing pinned list', () => {
      const result = pinCase(['case-1'], 'case-2');

      expect(result).toEqual(['case-1', 'case-2']);
    });

    it('should not add duplicate if case already pinned', () => {
      const pinned = ['case-1', 'case-2'];
      const result = pinCase(pinned, 'case-1');

      expect(result).toEqual(pinned);
      // Should return same reference for no-op
      expect(result).toBe(pinned);
    });

    it('should not mutate the original array', () => {
      const original = ['case-1'];
      const originalCopy = [...original];
      pinCase(original, 'case-2');

      expect(original).toEqual(originalCopy);
    });

    it('should respect max pins limit', () => {
      const pinned = ['case-1', 'case-2', 'case-3'];
      const result = pinCase(pinned, 'case-4', 3);

      expect(result).toEqual(pinned);
      expect(result).toBe(pinned); // Same reference - no change
    });

    it('should allow pinning up to max limit', () => {
      const pinned = ['case-1', 'case-2'];
      const result = pinCase(pinned, 'case-3', 3);

      expect(result).toEqual(['case-1', 'case-2', 'case-3']);
    });

    it('should handle max pins of 1', () => {
      const result1 = pinCase([], 'case-1', 1);
      expect(result1).toEqual(['case-1']);

      const result2 = pinCase(result1, 'case-2', 1);
      expect(result2).toEqual(['case-1']);
    });

    it('should handle max pins of 0', () => {
      const result = pinCase([], 'case-1', 0);
      expect(result).toEqual([]);
    });
  });

  describe('unpinCase', () => {
    it('should remove a pinned case', () => {
      const result = unpinCase(['case-1', 'case-2', 'case-3'], 'case-2');

      expect(result).toEqual(['case-1', 'case-3']);
    });

    it('should return empty array when unpinning last case', () => {
      const result = unpinCase(['case-1'], 'case-1');

      expect(result).toEqual([]);
    });

    it('should return unchanged array when case not found', () => {
      const pinned = ['case-1', 'case-2'];
      const result = unpinCase(pinned, 'case-99');

      expect(result).toEqual(pinned);
    });

    it('should not mutate the original array', () => {
      const original = ['case-1', 'case-2'];
      const originalLength = original.length;
      unpinCase(original, 'case-1');

      expect(original).toHaveLength(originalLength);
    });

    it('should handle empty list', () => {
      const result = unpinCase([], 'case-1');
      expect(result).toEqual([]);
    });
  });

  describe('togglePin', () => {
    it('should pin an unpinned case', () => {
      const result = togglePin([], 'case-1');

      expect(result).toEqual(['case-1']);
    });

    it('should unpin a pinned case', () => {
      const result = togglePin(['case-1', 'case-2'], 'case-1');

      expect(result).toEqual(['case-2']);
    });

    it('should respect max pins when pinning', () => {
      const pinned = ['case-1', 'case-2'];
      const result = togglePin(pinned, 'case-3', 2);

      // Can't pin because at limit
      expect(result).toEqual(pinned);
    });

    it('should allow unpinning even when at max', () => {
      const pinned = ['case-1', 'case-2'];
      const result = togglePin(pinned, 'case-1', 2);

      expect(result).toEqual(['case-2']);
    });

    it('should toggle correctly in sequence', () => {
      let pinned: string[] = [];

      pinned = togglePin(pinned, 'case-1');
      expect(pinned).toEqual(['case-1']);

      pinned = togglePin(pinned, 'case-2');
      expect(pinned).toEqual(['case-1', 'case-2']);

      pinned = togglePin(pinned, 'case-1');
      expect(pinned).toEqual(['case-2']);

      pinned = togglePin(pinned, 'case-1');
      expect(pinned).toEqual(['case-2', 'case-1']);
    });

    it('should not mutate the original array', () => {
      const original = ['case-1'];
      const originalCopy = [...original];
      togglePin(original, 'case-2');

      expect(original).toEqual(originalCopy);
    });
  });

  describe('isPinned', () => {
    it('should return true for pinned case', () => {
      expect(isPinned(['case-1', 'case-2'], 'case-1')).toBe(true);
      expect(isPinned(['case-1', 'case-2'], 'case-2')).toBe(true);
    });

    it('should return false for unpinned case', () => {
      expect(isPinned(['case-1', 'case-2'], 'case-3')).toBe(false);
    });

    it('should return false for empty list', () => {
      expect(isPinned([], 'case-1')).toBe(false);
    });
  });

  describe('pruneDeletedCases', () => {
    it('should remove pinned IDs for deleted cases', () => {
      const pinned = ['case-1', 'case-2', 'case-3'];
      const existing = ['case-1', 'case-3'];

      const result = pruneDeletedCases(pinned, existing);

      expect(result).toEqual(['case-1', 'case-3']);
    });

    it('should preserve order of remaining pins', () => {
      const pinned = ['case-3', 'case-1', 'case-2'];
      const existing = ['case-1', 'case-2'];

      const result = pruneDeletedCases(pinned, existing);

      expect(result).toEqual(['case-1', 'case-2']);
    });

    it('should return empty array when no cases exist', () => {
      const result = pruneDeletedCases(['case-1', 'case-2'], []);

      expect(result).toEqual([]);
    });

    it('should return empty array when pinned list is empty', () => {
      const result = pruneDeletedCases([], ['case-1']);

      expect(result).toEqual([]);
    });

    it('should not mutate the original array', () => {
      const original = ['case-1', 'case-2'];
      const originalLength = original.length;
      pruneDeletedCases(original, ['case-1']);

      expect(original).toHaveLength(originalLength);
    });

    it('should handle large existing case lists efficiently', () => {
      const pinned = ['case-5', 'case-500', 'case-999'];
      const existing = Array.from({ length: 1000 }, (_, i) => `case-${i + 1}`);

      const result = pruneDeletedCases(pinned, existing);

      expect(result).toEqual(['case-5', 'case-500', 'case-999']);
    });
  });

  describe('getPinnedCount', () => {
    it('should return count of pinned cases', () => {
      expect(getPinnedCount(['case-1', 'case-2', 'case-3'])).toBe(3);
      expect(getPinnedCount(['case-1'])).toBe(1);
    });

    it('should return 0 for empty list', () => {
      expect(getPinnedCount([])).toBe(0);
    });
  });

  describe('canPinMore', () => {
    it('should return true when under limit', () => {
      expect(canPinMore(['case-1'], 5)).toBe(true);
      expect(canPinMore([], 1)).toBe(true);
    });

    it('should return false when at limit', () => {
      expect(canPinMore(['case-1', 'case-2'], 2)).toBe(false);
    });

    it('should return true when no limit (default)', () => {
      const manyPins = Array.from({ length: 100 }, (_, i) => `case-${i}`);
      expect(canPinMore(manyPins)).toBe(true);
    });

    it('should return false for limit of 0', () => {
      expect(canPinMore([], 0)).toBe(false);
    });
  });

  describe('reorderPinnedCase', () => {
    it('should move case to beginning', () => {
      const result = reorderPinnedCase(['a', 'b', 'c'], 'c', 0);

      expect(result).toEqual(['c', 'a', 'b']);
    });

    it('should move case to end', () => {
      const result = reorderPinnedCase(['a', 'b', 'c'], 'a', 2);

      expect(result).toEqual(['b', 'c', 'a']);
    });

    it('should move case to middle', () => {
      const result = reorderPinnedCase(['a', 'b', 'c', 'd'], 'a', 2);

      expect(result).toEqual(['b', 'c', 'a', 'd']);
    });

    it('should handle case not in list (return unchanged)', () => {
      const pinned = ['a', 'b', 'c'];
      const result = reorderPinnedCase(pinned, 'x', 1);

      expect(result).toBe(pinned); // Same reference
    });

    it('should handle same position (no change)', () => {
      const pinned = ['a', 'b', 'c'];
      const result = reorderPinnedCase(pinned, 'b', 1);

      expect(result).toBe(pinned); // Same reference
    });

    it('should clamp index to valid range (negative)', () => {
      const result = reorderPinnedCase(['a', 'b', 'c'], 'c', -5);

      expect(result).toEqual(['c', 'a', 'b']);
    });

    it('should clamp index to valid range (too high)', () => {
      const result = reorderPinnedCase(['a', 'b', 'c'], 'a', 100);

      expect(result).toEqual(['b', 'c', 'a']);
    });

    it('should not mutate the original array', () => {
      const original = ['a', 'b', 'c'];
      const originalCopy = [...original];
      reorderPinnedCase(original, 'c', 0);

      expect(original).toEqual(originalCopy);
    });

    it('should handle empty list', () => {
      const result = reorderPinnedCase([], 'a', 0);
      expect(result).toEqual([]);
    });

    it('should handle single element list', () => {
      const pinned = ['a'];
      const result = reorderPinnedCase(pinned, 'a', 0);

      expect(result).toBe(pinned); // Same position
    });
  });
});
