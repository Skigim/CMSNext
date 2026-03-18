import { describe, expect, it } from "vitest";

import { createMockPerson, createMockStoredCase } from "@/src/test/testUtils";
import { mergeCategoryConfig } from "@/types/categoryConfig";
import { validatePersistedV21Data } from "@/utils/workspaceV21Migration";

function createValidationPerson(id: string) {
  return createMockPerson({
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    dateAdded: "2026-01-01T00:00:00.000Z",
  });
}

function toPersistedValidationCase(caseItem: ReturnType<typeof createMockStoredCase>) {
  return {
    ...caseItem,
    person: undefined,
    linkedPeople: undefined,
  };
}

function createPersistedValidationWorkspace(options: {
  people: Array<Record<string, unknown>>;
  cases: Array<ReturnType<typeof createMockStoredCase>>;
}) {
  return {
    version: "2.1" as const,
    people: options.people,
    cases: options.cases.map(toPersistedValidationCase),
    financials: [],
    notes: [],
    alerts: [],
    exported_at: "2026-03-01T00:00:00.000Z",
    total_cases: options.cases.length,
    categoryConfig: mergeCategoryConfig(),
    activityLog: [],
  };
}

describe("workspaceV21Migration", () => {
  it("reports missing required root fields for partially-corrupted v2.1 data", () => {
    // ARRANGE
    const corruptedData = {
      version: "2.1",
      people: [],
      cases: [],
    };

    // ACT
    const result = validatePersistedV21Data(corruptedData);

    // ASSERT
    expect(result.counts).toEqual({
      people: 0,
      cases: 0,
      financials: 0,
      notes: 0,
      alerts: 0,
    });
    expect(result.validationErrors).toEqual([
      "Root financials[] collection is missing.",
      "Root notes[] collection is missing.",
      "Root alerts[] collection is missing.",
      "Root exported_at timestamp is missing.",
      "Root total_cases count is missing.",
      "Root categoryConfig object is missing.",
      "Root activityLog[] collection is missing.",
    ]);
  });

  it("accepts structurally valid persisted v2.1 data after canonical hydration succeeds", () => {
    // ARRANGE
    const person = createValidationPerson("person-1");
    const caseItem = createMockStoredCase({
      id: "case-1",
      person,
      people: [{ personId: person.id, role: "applicant", isPrimary: true }],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: person.id,
      },
    });
    const persistedData = createPersistedValidationWorkspace({
      people: [
        {
          ...person,
          familyMemberIds: [],
          relationships: [],
        },
      ],
      cases: [caseItem],
    });

    // ACT
    const result = validatePersistedV21Data(persistedData);

    // ASSERT
    expect(result.counts).toEqual({
      people: 1,
      cases: 1,
      financials: 0,
      notes: 0,
      alerts: 0,
    });
    expect(result.validationErrors).toEqual([]);
  });

  it("reports canonical hydration failures after structural validation passes", () => {
    // ARRANGE
    const person = {
      ...createValidationPerson("person-1"),
      familyMemberIds: [],
      relationships: null,
    };
    const caseItem = createMockStoredCase({
      id: "case-1",
      person: createMockPerson({ id: "person-1" }),
      people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: "person-1",
      },
    });
    const persistedData = createPersistedValidationWorkspace({
      people: [person],
      cases: [caseItem],
    });

    // ACT
    const result = validatePersistedV21Data(persistedData);

    // ASSERT
    expect(result.validationErrors).toHaveLength(1);
    expect(result.validationErrors[0]).toContain("Canonical hydration failed:");
  });

  it("reports cases that are missing an explicit primary people ref", () => {
    // ARRANGE
    const person = createValidationPerson("person-1");
    const caseItem = createMockStoredCase({
      id: "case-1",
      person,
      people: [{ personId: person.id, role: "applicant", isPrimary: false }],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: person.id,
      },
    });
    const persistedData = createPersistedValidationWorkspace({
      people: [
        {
          ...person,
          familyMemberIds: [],
          relationships: [],
        },
      ],
      cases: [caseItem],
    });

    // ACT
    const result = validatePersistedV21Data(persistedData);

    // ASSERT
    expect(result.validationErrors).toContain(
      "Case case-1 is missing a primary people[] ref.",
    );
  });

  it("reports cases whose caseRecord.personId disagrees with the primary people ref", () => {
    // ARRANGE
    const primaryPerson = createValidationPerson("person-1");
    const secondaryPerson = createValidationPerson("person-2");
    const caseItem = createMockStoredCase({
      id: "case-1",
      person: primaryPerson,
      people: [
        { personId: primaryPerson.id, role: "applicant", isPrimary: true },
        { personId: secondaryPerson.id, role: "contact", isPrimary: false },
      ],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: secondaryPerson.id,
      },
    });
    const persistedData = createPersistedValidationWorkspace({
      people: [
        {
          ...primaryPerson,
          familyMemberIds: [],
          relationships: [],
        },
        {
          ...secondaryPerson,
          familyMemberIds: [],
          relationships: [],
        },
      ],
      cases: [caseItem],
    });

    // ACT
    const result = validatePersistedV21Data(persistedData);

    // ASSERT
    expect(result.validationErrors).toContain(
      'Case case-1 caseRecord.personId "person-2" does not match primary people[] ref "person-1".',
    );
  });
});
