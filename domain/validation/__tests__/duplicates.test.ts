import { describe, it, expect } from "vitest";
import { findDuplicateIndices, NormalizedEntry } from "../duplicates";

describe("findDuplicateIndices", () => {
  describe("basic duplicate detection", () => {
    it("returns empty set when no duplicates", () => {
      const entries: NormalizedEntry[] = [
        { normalized: "active", trimmed: "Active" },
        { normalized: "pending", trimmed: "Pending" },
        { normalized: "closed", trimmed: "Closed" },
      ];

      const result = findDuplicateIndices(entries);

      expect(result.size).toBe(0);
    });

    it("detects two identical entries", () => {
      const entries: NormalizedEntry[] = [
        { normalized: "active", trimmed: "Active" },
        { normalized: "active", trimmed: "ACTIVE" },
      ];

      const result = findDuplicateIndices(entries);

      expect(result).toEqual(new Set([0, 1]));
    });

    it("detects duplicates among many entries", () => {
      const entries: NormalizedEntry[] = [
        { normalized: "active", trimmed: "Active" },
        { normalized: "pending", trimmed: "Pending" },
        { normalized: "active", trimmed: "ACTIVE" },
        { normalized: "closed", trimmed: "Closed" },
      ];

      const result = findDuplicateIndices(entries);

      expect(result).toEqual(new Set([0, 2]));
    });

    it("detects multiple duplicate groups", () => {
      const entries: NormalizedEntry[] = [
        { normalized: "active", trimmed: "Active" },
        { normalized: "pending", trimmed: "Pending" },
        { normalized: "active", trimmed: "ACTIVE" },
        { normalized: "pending", trimmed: "PENDING" },
      ];

      const result = findDuplicateIndices(entries);

      expect(result).toEqual(new Set([0, 1, 2, 3]));
    });

    it("handles three or more of the same value", () => {
      const entries: NormalizedEntry[] = [
        { normalized: "active", trimmed: "Active" },
        { normalized: "active", trimmed: "ACTIVE" },
        { normalized: "active", trimmed: "active" },
      ];

      const result = findDuplicateIndices(entries);

      expect(result).toEqual(new Set([0, 1, 2]));
    });
  });

  describe("empty and blank handling", () => {
    it("skips empty normalized values", () => {
      const entries: NormalizedEntry[] = [
        { normalized: "", trimmed: "" },
        { normalized: "active", trimmed: "Active" },
        { normalized: "", trimmed: "" },
      ];

      const result = findDuplicateIndices(entries);

      expect(result.size).toBe(0);
    });

    it("handles all empty entries", () => {
      const entries: NormalizedEntry[] = [
        { normalized: "", trimmed: "" },
        { normalized: "", trimmed: "" },
        { normalized: "", trimmed: "" },
      ];

      const result = findDuplicateIndices(entries);

      expect(result.size).toBe(0);
    });

    it("returns empty set for empty array", () => {
      const result = findDuplicateIndices([]);

      expect(result.size).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("handles single entry", () => {
      const entries: NormalizedEntry[] = [
        { normalized: "active", trimmed: "Active" },
      ];

      const result = findDuplicateIndices(entries);

      expect(result.size).toBe(0);
    });

    it("works without optional trimmed property", () => {
      const entries: NormalizedEntry[] = [
        { normalized: "active" },
        { normalized: "pending" },
        { normalized: "active" },
      ];

      const result = findDuplicateIndices(entries);

      expect(result).toEqual(new Set([0, 2]));
    });

    it("handles mixed empty and duplicate entries", () => {
      const entries: NormalizedEntry[] = [
        { normalized: "", trimmed: "" },
        { normalized: "active", trimmed: "Active" },
        { normalized: "", trimmed: "" },
        { normalized: "active", trimmed: "ACTIVE" },
        { normalized: "pending", trimmed: "Pending" },
      ];

      const result = findDuplicateIndices(entries);

      expect(result).toEqual(new Set([1, 3]));
    });

    it("preserves original indices correctly", () => {
      const entries: NormalizedEntry[] = [
        { normalized: "a" },
        { normalized: "b" },
        { normalized: "c" },
        { normalized: "d" },
        { normalized: "b" }, // duplicate of index 1
      ];

      const result = findDuplicateIndices(entries);

      expect(result.has(1)).toBe(true);
      expect(result.has(4)).toBe(true);
      expect(result.has(0)).toBe(false);
      expect(result.has(2)).toBe(false);
      expect(result.has(3)).toBe(false);
    });
  });
});
