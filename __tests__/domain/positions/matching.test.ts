/**
 * @fileoverview Tests for Position Assignments Matching
 *
 * Tests the comparison of parsed position assignment entries against
 * stored cases to identify archival candidates.
 */

import { describe, it, expect } from "vitest";
import {
  compareAssignments,
  buildAssignmentMcnSet,
} from "@/domain/positions/matching";
import type { ParsedPositionEntry } from "@/domain/positions/parser";
import type { StoredCase } from "@/types/case";

// ============================================================================
// Test Data Factories
// ============================================================================

function createTestCase(
  overrides: Partial<StoredCase> = {}
): StoredCase {
  return {
    id: `case-${Math.random().toString(36).slice(2, 9)}`,
    name: "Test Case",
    mcn: "100001",
    status: "Active",
    priority: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    person: {
      id: "person-1",
      firstName: "John",
      lastName: "Doe",
      name: "John Doe",
      email: "",
      phone: "",
      dateOfBirth: "1990-01-01",
      ssn: "",
      organizationId: null,
      livingArrangement: "Alone",
      address: { street: "", city: "", state: "", zip: "" },
      mailingAddress: { street: "", city: "", state: "", zip: "", sameAsPhysical: true },
      authorizedRepIds: [],
      familyMembers: [],
      status: "active",
      createdAt: new Date().toISOString(),
      dateAdded: new Date().toISOString(),
    },
    caseRecord: {
      id: "record-1",
      mcn: "100001",
      applicationDate: new Date().toISOString(),
      caseType: "SNAP",
      applicationType: "New",
      personId: "person-1",
      spouseId: "",
      status: "Active",
      description: "",
      priority: false,
      livingArrangement: "Alone",
      withWaiver: false,
      admissionDate: new Date().toISOString(),
      organizationId: "",
      authorizedReps: [],
      retroRequested: "",
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    },
    ...overrides,
  };
}

function createEntry(mcn: string, name = "TEST, NAME"): ParsedPositionEntry {
  return { mcn, name };
}

// ============================================================================
// Tests
// ============================================================================

describe("buildAssignmentMcnSet", () => {
  it("should build a set of normalized MCNs", () => {
    const entries = [createEntry("100001"), createEntry("200002"), createEntry("300003")];
    const set = buildAssignmentMcnSet(entries);

    expect(set.size).toBe(3);
    expect(set.has("100001")).toBe(true);
    expect(set.has("200002")).toBe(true);
    expect(set.has("300003")).toBe(true);
  });

  it("should skip entries with empty MCN", () => {
    const entries = [createEntry("100001"), createEntry("")];
    const set = buildAssignmentMcnSet(entries);

    expect(set.size).toBe(1);
  });

  it("should normalize MCN values", () => {
    const entries = [createEntry("MCN-100001")];
    const set = buildAssignmentMcnSet(entries);

    // normalizeMcn strips non-alphanumeric and uppercases
    expect(set.has("MCN100001")).toBe(true);
  });
});

describe("compareAssignments", () => {
  describe("basic matching", () => {
    it("should report matched cases", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001" }),
        createTestCase({ id: "c2", mcn: "200002" }),
      ];
      const entries = [createEntry("100001"), createEntry("200002")];

      const result = compareAssignments(cases, entries);

      expect(result.unmatchedCases).toHaveLength(0);
      expect(result.summary.matched).toBe(2);
      expect(result.summary.unmatched).toBe(0);
    });

    it("should identify unmatched cases", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001" }),
        createTestCase({ id: "c2", mcn: "200002" }),
        createTestCase({ id: "c3", mcn: "300003" }),
      ];
      // Assignment list only has case 1
      const entries = [createEntry("100001")];

      const result = compareAssignments(cases, entries);

      expect(result.unmatchedCases).toHaveLength(2);
      expect(result.summary.matched).toBe(1);
      expect(result.summary.unmatched).toBe(2);
      expect(result.unmatchedCases.map((c) => c.id)).toEqual(
        expect.arrayContaining(["c2", "c3"])
      );
    });

    it("should return all cases as unmatched when list is empty", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001" }),
        createTestCase({ id: "c2", mcn: "200002" }),
      ];
      const entries: ParsedPositionEntry[] = [];

      const result = compareAssignments(cases, entries);

      expect(result.unmatchedCases).toHaveLength(2);
      expect(result.summary.totalParsed).toBe(0);
    });
  });

  describe("archived cases exclusion", () => {
    it("should exclude archived cases from comparison", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001", status: "Active" }),
        createTestCase({ id: "c2", mcn: "200002", status: "Archived" }),
      ];
      // Neither MCN is on the list
      const entries: ParsedPositionEntry[] = [];

      const result = compareAssignments(cases, entries);

      // Only c1 should be unmatched (c2 is excluded as Archived)
      expect(result.unmatchedCases).toHaveLength(1);
      expect(result.unmatchedCases[0].id).toBe("c1");
      expect(result.summary.archivedExcluded).toBe(1);
    });
  });

  describe("already flagged cases", () => {
    it("should exclude cases already pending archival", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001" }),
        createTestCase({ id: "c2", mcn: "200002", pendingArchival: true }),
        createTestCase({ id: "c3", mcn: "300003" }),
      ];
      // Only case 1 is on the list
      const entries = [createEntry("100001")];

      const result = compareAssignments(cases, entries);

      // c2 is NOT in unmatchedCases because it's already flagged
      expect(result.unmatchedCases).toHaveLength(1);
      expect(result.unmatchedCases[0].id).toBe("c3");
      expect(result.summary.alreadyFlagged).toBe(1);
      expect(result.summary.matched).toBe(1);
      expect(result.summary.unmatched).toBe(1);
    });
  });

  describe("status-agnostic matching", () => {
    it("should compare all non-archived statuses", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001", status: "Active" }),
        createTestCase({ id: "c2", mcn: "200002", status: "Pending" }),
        createTestCase({ id: "c3", mcn: "300003", status: "Closed" }),
      ];
      // Only case 1 is on the assignment list
      const entries = [createEntry("100001")];

      const result = compareAssignments(cases, entries);

      expect(result.summary.matched).toBe(1);
      expect(result.unmatchedCases).toHaveLength(2);
      expect(result.unmatchedCases.map((c) => c.status)).toEqual(
        expect.arrayContaining(["Pending", "Closed"])
      );
    });
  });

  describe("MCN normalization", () => {
    it("should match regardless of MCN format differences", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "MCN-100001" }),
      ];
      // Export has bare numeric MCN
      const entries = [createEntry("MCN-100001")];

      const result = compareAssignments(cases, entries);

      expect(result.summary.matched).toBe(1);
      expect(result.unmatchedCases).toHaveLength(0);
    });
  });

  describe("cases without MCN", () => {
    it("should treat cases without MCN as unmatched", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "", caseRecord: { ...createTestCase().caseRecord, mcn: "" } }),
      ];
      const entries = [createEntry("100001")];

      const result = compareAssignments(cases, entries);

      expect(result.unmatchedCases).toHaveLength(1);
      expect(result.unmatchedCases[0].id).toBe("c1");
    });
  });

  describe("summary statistics", () => {
    it("should provide accurate summary", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001", status: "Active" }),
        createTestCase({ id: "c2", mcn: "200002", status: "Pending" }),
        createTestCase({ id: "c3", mcn: "300003", status: "Archived" }),
        createTestCase({ id: "c4", mcn: "400004", pendingArchival: true }),
        createTestCase({ id: "c5", mcn: "500005" }),
      ];
      // Only cases 1 and 5 are on the assignment list
      const entries = [
        createEntry("100001"),
        createEntry("500005"),
        createEntry("600006"), // on list but not in stored cases
      ];

      const result = compareAssignments(cases, entries);

      expect(result.summary).toEqual({
        totalParsed: 3,
        matched: 2,        // c1, c5
        unmatched: 1,       // c2
        alreadyFlagged: 1,  // c4
        archivedExcluded: 1, // c3
      });
    });
  });
});
