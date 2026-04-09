/**
 * @fileoverview Tests for Position Assignments Matching
 *
 * Tests the comparison of parsed position assignment entries against
 * stored cases to identify archival candidates.
 */

import { describe, it, expect } from "vitest";
import {
  compareAssignments,
} from "@/domain/positions/matching";
import type { ParsedPositionEntry } from "@/domain/positions/parser";
import type { StatusConfig } from "@/types/categoryConfig";
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
      intakeCompleted: true,
    },
    ...overrides,
  };
}

function createEntry(mcn: string, name = "TEST, NAME", status?: string): ParsedPositionEntry {
  return status !== undefined ? { mcn, name, status } : { mcn, name };
}

// ============================================================================
// Tests
// ============================================================================

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
        createTestCase({ id: "c2", mcn: "200002", isPendingArchival: true }),
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

  describe("status change detection", () => {
    it("should populate matchedWithStatusChange when imported status differs", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001", status: "Active" }),
      ];
      const entries = [createEntry("100001", "DOE, JOHN", "Pending")];

      const result = compareAssignments(cases, entries);

      expect(result.matchedWithStatusChange).toHaveLength(1);
      expect(result.matchedWithStatusChange[0]).toMatchObject({
        importedStatus: "Pending",
        currentStatus: "Active",
      });
      expect(result.matchedWithStatusChange[0].case.id).toBe("c1");
      expect(result.summary.statusUpdateCandidates).toBe(1);
    });

    it("should not add to matchedWithStatusChange when imported status matches canonically", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001", status: "Pending" }),
      ];
      const entries = [createEntry("100001", "DOE, JOHN", "Active")];

      const result = compareAssignments(cases, entries);

      expect(result.matchedWithStatusChange).toHaveLength(0);
      expect(result.summary.statusUpdateCandidates).toBe(0);
    });

    it("should treat canonical status comparison as case-insensitive", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001", status: "Pending" }),
      ];
      const entries = [createEntry("100001", "DOE, JOHN", "active")];

      const result = compareAssignments(cases, entries);

      // "active" canonicalizes to "Pending", which matches the stored canonical status.
      expect(result.matchedWithStatusChange).toHaveLength(0);
    });

    it("should not add to matchedWithStatusChange when entry has no status", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001", status: "Active" }),
      ];
      // No status field in entry
      const entries = [createEntry("100001")];

      const result = compareAssignments(cases, entries);

      expect(result.matchedWithStatusChange).toHaveLength(0);
      expect(result.summary.statusUpdateCandidates).toBe(0);
    });

    it("should still count a status-update case as matched", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001", status: "Active" }),
      ];
      const entries = [createEntry("100001", "DOE, JOHN", "Closed")];

      const result = compareAssignments(cases, entries);

      expect(result.summary.matched).toBe(1);
      expect(result.unmatchedCases).toHaveLength(0);
      expect(result.matchedWithStatusChange).toHaveLength(1);
    });

    it("should map XML status abbreviations to full status labels", () => {
      const statusPairs = [
        { abbreviation: "PE", fullStatus: "Pending" },
        { abbreviation: "AC", fullStatus: "Approved" },
        { abbreviation: "SP", fullStatus: "Withdrawn" },
        { abbreviation: "CL", fullStatus: "Withdrawn" },
        { abbreviation: "DE", fullStatus: "Denied" },
      ];

      for (const { abbreviation, fullStatus } of statusPairs) {
        const caseId = `c-${abbreviation.toLowerCase()}`;
        const cases: StoredCase[] = [
          createTestCase({ id: caseId, mcn: "100001", status: "Active" }),
        ];
        const entries = [createEntry("100001", "DOE, JOHN", abbreviation)];

        const result = compareAssignments(cases, entries);

        expect(result.matchedWithStatusChange).toHaveLength(1);
        expect(result.matchedWithStatusChange[0]).toMatchObject({
          importedStatus: fullStatus,
          currentStatus: "Active",
        });
      }
    });

    it("should normalize legacy imported labels onto canonical application statuses", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001", status: "Active" }),
        createTestCase({ id: "c2", mcn: "200002", status: "Closed" }),
      ];
      const entries = [
        createEntry("100001", "DOE, JOHN", "closed"),
        createEntry("200002", "SMITH, JANE", "active"),
      ];

      const result = compareAssignments(cases, entries);

      expect(result.matchedWithStatusChange).toHaveLength(2);
      expect(result.matchedWithStatusChange).toEqual([
        expect.objectContaining({
          importedStatus: "Withdrawn",
          currentStatus: "Active",
        }),
        expect.objectContaining({
          importedStatus: "Pending",
          currentStatus: "Closed",
        }),
      ]);
    });

    it("should treat mapped abbreviation status as equal when labels match", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001", status: "Pending" }),
      ];
      const entries = [createEntry("100001", "DOE, JOHN", "PE")];

      const result = compareAssignments(cases, entries);

      expect(result.matchedWithStatusChange).toHaveLength(0);
      expect(result.summary.statusUpdateCandidates).toBe(0);
    });

    it("should treat legacy active import labels as equal to canonical pending", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001", status: "Pending" }),
      ];
      const entries = [createEntry("100001", "DOE, JOHN", "Active")];

      const result = compareAssignments(cases, entries);

      expect(result.matchedWithStatusChange).toHaveLength(0);
      expect(result.summary.statusUpdateCandidates).toBe(0);
    });

    it("should resolve imported open statuses against the configured status list", () => {
      // ARRANGE
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001", status: "Pending Review" as StoredCase["status"] }),
      ];
      const entries = [createEntry("100001", "DOE, JOHN", "Active")];
      const existingStatuses: StatusConfig[] = [
        { name: "Pending Review", colorSlot: "amber", countsAsCompleted: false },
        { name: "Approved", colorSlot: "green", countsAsCompleted: true },
      ];

      // ACT
      const result = compareAssignments(cases, entries, existingStatuses);

      // ASSERT
      expect(result.matchedWithStatusChange).toHaveLength(0);
      expect(result.summary.statusUpdateCandidates).toBe(0);
    });
  });

  describe("summary statistics", () => {
    it("should provide accurate summary", () => {
      const cases: StoredCase[] = [
        createTestCase({ id: "c1", mcn: "100001", status: "Active" }),
        createTestCase({ id: "c2", mcn: "200002", status: "Pending" }),
        createTestCase({ id: "c3", mcn: "300003", status: "Archived" }),
        createTestCase({ id: "c4", mcn: "400004", isPendingArchival: true }),
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
        matched: 2,               // c1, c5
        statusUpdateCandidates: 0, // no status fields in entries
        unmatched: 1,              // c2
        alreadyFlagged: 1,         // c4
        archivedExcluded: 1,       // c3
      });
    });
  });
});
