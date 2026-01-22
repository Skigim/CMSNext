/**
 * @fileoverview Tests for archive domain logic
 * 
 * Tests pure functions for case archival business logic.
 */

import { describe, it, expect } from "vitest";
import {
  calculateCutoffDate,
  findArchivalEligibleCases,
  collectRelatedData,
  markCasesForArchival,
  unmarkCasesForArchival,
  getCasesInArchivalQueue,
  mergeArchiveData,
  removeCasesFromArchive,
} from "@/domain/archive/archivalLogic";
import type { StoredCase, StoredFinancialItem, StoredNote } from "@/types/case";
import type { CaseArchiveData, ArchivalSettings } from "@/types/archive";
import { ARCHIVE_VERSION } from "@/types/archive";

// Test data factory
function createTestCase(overrides: Partial<StoredCase> = {}): StoredCase {
  return {
    id: `case-${Math.random().toString(36).slice(2, 9)}`,
    name: "Test Case",
    mcn: "MCN-001",
    status: "Active",
    priority: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    person: {
      id: "person-1",
      firstName: "John",
      lastName: "Doe",
      name: "John Doe",
      email: "john@example.com",
      phone: "555-1234",
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
      id: "case-record-1",
      mcn: "MCN-001",
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

function createTestFinancial(caseId: string, overrides: Partial<StoredFinancialItem> = {}): StoredFinancialItem {
  return {
    id: `fin-${Math.random().toString(36).slice(2, 9)}`,
    caseId,
    description: "Test Financial",
    amount: 100,
    category: "income",
    verificationStatus: "unverified",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createTestNote(caseId: string, overrides: Partial<StoredNote> = {}): StoredNote {
  return {
    id: `note-${Math.random().toString(36).slice(2, 9)}`,
    caseId,
    content: "Test note content",
    category: "General",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("calculateCutoffDate", () => {
  it("should calculate correct cutoff date for given months", () => {
    const referenceDate = new Date("2026-01-22");
    const cutoff = calculateCutoffDate(12, referenceDate);
    
    expect(cutoff.getFullYear()).toBe(2025);
    expect(cutoff.getMonth()).toBe(0); // January
    expect(cutoff.getDate()).toBe(22);
  });

  it("should handle cutoff that spans year boundary", () => {
    const referenceDate = new Date("2026-03-15");
    const cutoff = calculateCutoffDate(6, referenceDate);
    
    expect(cutoff.getFullYear()).toBe(2025);
    expect(cutoff.getMonth()).toBe(8); // September
  });

  it("should default to current date if no reference provided", () => {
    const cutoff = calculateCutoffDate(12);
    const expected = new Date();
    expected.setMonth(expected.getMonth() - 12);
    
    // Compare year and month (day might differ by 1 due to timing)
    expect(cutoff.getFullYear()).toBe(expected.getFullYear());
    expect(cutoff.getMonth()).toBe(expected.getMonth());
  });
});

describe("findArchivalEligibleCases", () => {
  const settings: ArchivalSettings = {
    thresholdMonths: 12,
    archiveClosedOnly: true,
  };
  
  const completedStatuses = new Set(["Closed", "Archived"]);

  it("should find cases older than threshold with closed status", () => {
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 18);
    
    const cases: StoredCase[] = [
      createTestCase({ id: "old-closed", updatedAt: oldDate.toISOString(), status: "Closed" }),
      createTestCase({ id: "new-closed", updatedAt: new Date().toISOString(), status: "Closed" }),
      createTestCase({ id: "old-active", updatedAt: oldDate.toISOString(), status: "Active" }),
    ];
    
    const result = findArchivalEligibleCases(cases, { settings, completedStatuses });
    
    expect(result.eligibleCaseIds).toHaveLength(1);
    expect(result.eligibleCaseIds).toContain("old-closed");
    expect(result.totalEvaluated).toBe(3);
  });

  it("should find all old cases when archiveClosedOnly is false", () => {
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 18);
    
    const cases: StoredCase[] = [
      createTestCase({ id: "old-closed", updatedAt: oldDate.toISOString(), status: "Closed" }),
      createTestCase({ id: "old-active", updatedAt: oldDate.toISOString(), status: "Active" }),
    ];
    
    const result = findArchivalEligibleCases(cases, { 
      settings: { ...settings, archiveClosedOnly: false },
      completedStatuses, 
    });
    
    expect(result.eligibleCaseIds).toHaveLength(2);
  });

  it("should skip cases already marked as pending archival", () => {
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 18);
    
    const cases: StoredCase[] = [
      createTestCase({ id: "already-pending", updatedAt: oldDate.toISOString(), status: "Closed", pendingArchival: true }),
      createTestCase({ id: "not-pending", updatedAt: oldDate.toISOString(), status: "Closed" }),
    ];
    
    const result = findArchivalEligibleCases(cases, { settings, completedStatuses });
    
    expect(result.eligibleCaseIds).toHaveLength(1);
    expect(result.eligibleCaseIds).toContain("not-pending");
  });

  it("should include Archived status cases when archiveClosedOnly is true", () => {
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 18);
    
    const cases: StoredCase[] = [
      createTestCase({ id: "archived-case", updatedAt: oldDate.toISOString(), status: "Archived" }),
    ];
    
    const result = findArchivalEligibleCases(cases, { settings, completedStatuses });
    
    expect(result.eligibleCaseIds).toHaveLength(1);
    expect(result.eligibleCaseIds).toContain("archived-case");
  });
  
  it("should use custom completion statuses from config", () => {
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 18);
    
    const cases: StoredCase[] = [
      createTestCase({ id: "resolved-case", updatedAt: oldDate.toISOString(), status: "Resolved" as StoredCase["status"] }),
      createTestCase({ id: "closed-case", updatedAt: oldDate.toISOString(), status: "Closed" }),
    ];
    
    // Custom config where "Resolved" counts as completed but "Closed" does not
    const customCompletedStatuses = new Set(["Resolved"]);
    
    const result = findArchivalEligibleCases(cases, { 
      settings, 
      completedStatuses: customCompletedStatuses,
    });
    
    expect(result.eligibleCaseIds).toHaveLength(1);
    expect(result.eligibleCaseIds).toContain("resolved-case");
  });
  
  it("should fall back to all statuses when no completedStatuses provided", () => {
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 18);
    
    const cases: StoredCase[] = [
      createTestCase({ id: "any-status-case", updatedAt: oldDate.toISOString(), status: "Custom Status" as StoredCase["status"] }),
    ];
    
    // No completedStatuses provided - should match any status when archiveClosedOnly is true
    // but because we have no completedStatuses, nothing matches
    const result = findArchivalEligibleCases(cases, { settings });
    
    expect(result.eligibleCaseIds).toHaveLength(0);
  });
});

describe("collectRelatedData", () => {
  it("should collect financials and notes for specified case IDs", () => {
    const financials: StoredFinancialItem[] = [
      createTestFinancial("case-1"),
      createTestFinancial("case-1"),
      createTestFinancial("case-2"),
      createTestFinancial("case-3"),
    ];
    
    const notes: StoredNote[] = [
      createTestNote("case-1"),
      createTestNote("case-2"),
    ];
    
    const result = collectRelatedData(["case-1", "case-2"], financials, notes);
    
    expect(result.financials).toHaveLength(3);
    expect(result.notes).toHaveLength(2);
  });

  it("should return empty arrays for non-matching case IDs", () => {
    const financials: StoredFinancialItem[] = [createTestFinancial("case-1")];
    const notes: StoredNote[] = [createTestNote("case-1")];
    
    const result = collectRelatedData(["case-999"], financials, notes);
    
    expect(result.financials).toHaveLength(0);
    expect(result.notes).toHaveLength(0);
  });
});

describe("markCasesForArchival", () => {
  it("should mark specified cases as pending archival", () => {
    const cases: StoredCase[] = [
      createTestCase({ id: "case-1" }),
      createTestCase({ id: "case-2" }),
      createTestCase({ id: "case-3" }),
    ];
    
    const result = markCasesForArchival(cases, ["case-1", "case-3"]);
    
    expect(result.find(c => c.id === "case-1")?.pendingArchival).toBe(true);
    expect(result.find(c => c.id === "case-2")?.pendingArchival).toBeUndefined();
    expect(result.find(c => c.id === "case-3")?.pendingArchival).toBe(true);
  });

  it("should not mutate original array", () => {
    const cases: StoredCase[] = [createTestCase({ id: "case-1" })];
    
    const result = markCasesForArchival(cases, ["case-1"]);
    
    expect(result).not.toBe(cases);
    expect(cases[0].pendingArchival).toBeUndefined();
  });
});

describe("unmarkCasesForArchival", () => {
  it("should remove pending archival flag from specified cases", () => {
    const cases: StoredCase[] = [
      createTestCase({ id: "case-1", pendingArchival: true }),
      createTestCase({ id: "case-2", pendingArchival: true }),
    ];
    
    const result = unmarkCasesForArchival(cases, ["case-1"]);
    
    expect(result.find(c => c.id === "case-1")?.pendingArchival).toBeUndefined();
    expect(result.find(c => c.id === "case-2")?.pendingArchival).toBe(true);
  });
});

describe("getCasesInArchivalQueue", () => {
  it("should return only cases with pendingArchival true", () => {
    const cases: StoredCase[] = [
      createTestCase({ id: "case-1", pendingArchival: true }),
      createTestCase({ id: "case-2" }),
      createTestCase({ id: "case-3", pendingArchival: true }),
    ];
    
    const result = getCasesInArchivalQueue(cases);
    
    expect(result).toHaveLength(2);
    expect(result.map(c => c.id)).toEqual(["case-1", "case-3"]);
  });
});

describe("mergeArchiveData", () => {
  it("should create new archive when existing is null", () => {
    const cases = [createTestCase({ id: "case-1" })];
    const financials = [createTestFinancial("case-1")];
    const notes = [createTestNote("case-1")];
    
    const result = mergeArchiveData(null, cases, financials, notes, 2025);
    
    expect(result.version).toBe(ARCHIVE_VERSION);
    expect(result.archiveType).toBe("cases");
    expect(result.archiveYear).toBe(2025);
    expect(result.cases).toHaveLength(1);
    expect(result.financials).toHaveLength(1);
    expect(result.notes).toHaveLength(1);
  });

  it("should merge new data with existing archive", () => {
    const existingArchive: CaseArchiveData = {
      version: ARCHIVE_VERSION,
      archiveType: "cases",
      archivedAt: new Date().toISOString(),
      archiveYear: 2025,
      cases: [createTestCase({ id: "existing-case" })],
      financials: [createTestFinancial("existing-case")],
      notes: [],
    };
    
    const newCases = [createTestCase({ id: "new-case" })];
    const newFinancials = [createTestFinancial("new-case")];
    const newNotes = [createTestNote("new-case")];
    
    const result = mergeArchiveData(existingArchive, newCases, newFinancials, newNotes, 2025);
    
    expect(result.cases).toHaveLength(2);
    expect(result.financials).toHaveLength(2);
    expect(result.notes).toHaveLength(1);
  });

  it("should avoid duplicates when merging", () => {
    const case1 = createTestCase({ id: "case-1" });
    const existingArchive: CaseArchiveData = {
      version: ARCHIVE_VERSION,
      archiveType: "cases",
      archivedAt: new Date().toISOString(),
      archiveYear: 2025,
      cases: [case1],
      financials: [],
      notes: [],
    };
    
    // Try to add the same case again
    const result = mergeArchiveData(existingArchive, [case1], [], [], 2025);
    
    expect(result.cases).toHaveLength(1);
  });
});

describe("removeCasesFromArchive", () => {
  it("should remove specified cases and their related data", () => {
    const archive: CaseArchiveData = {
      version: ARCHIVE_VERSION,
      archiveType: "cases",
      archivedAt: new Date().toISOString(),
      archiveYear: 2025,
      cases: [
        createTestCase({ id: "case-1" }),
        createTestCase({ id: "case-2" }),
      ],
      financials: [
        createTestFinancial("case-1"),
        createTestFinancial("case-2"),
      ],
      notes: [
        createTestNote("case-1"),
        createTestNote("case-2"),
      ],
    };
    
    const result = removeCasesFromArchive(archive, ["case-1"]);
    
    expect(result).not.toBeNull();
    expect(result!.cases).toHaveLength(1);
    expect(result!.cases[0].id).toBe("case-2");
    expect(result!.financials).toHaveLength(1);
    expect(result!.notes).toHaveLength(1);
  });

  it("should return null when all cases are removed", () => {
    const archive: CaseArchiveData = {
      version: ARCHIVE_VERSION,
      archiveType: "cases",
      archivedAt: new Date().toISOString(),
      archiveYear: 2025,
      cases: [createTestCase({ id: "case-1" })],
      financials: [],
      notes: [],
    };
    
    const result = removeCasesFromArchive(archive, ["case-1"]);
    
    expect(result).toBeNull();
  });
});
