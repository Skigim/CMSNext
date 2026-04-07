import { describe, expect, it } from "vitest";

import {
  createMockApplication,
  createMockNormalizedFileData,
  createMockPersistedNormalizedFileData,
} from "@/src/test/testUtils";
import type { NormalizedFileDataV20, PersistedNormalizedFileDataV21 } from "@/utils/storageV21Migration";
import {
  dehydrateNormalizedData,
  hydrateNormalizedData,
  isPersistedNormalizedFileDataV20,
  isPersistedNormalizedFileDataV21,
  migrateV20ToV21,
  persistedCasesContainLegacyApplicationFields,
  syncRuntimeApplications,
} from "@/utils/storageV21Migration";
import { createMockPerson, createMockStoredCase } from "@/src/test/testUtils";
import { mergeCategoryConfig } from "@/types/categoryConfig";

describe("storageV21Migration", () => {
  it("recognizes persisted normalized v2.0 payloads using the shared envelope guard", () => {
    // ARRANGE
    const v20Data: NormalizedFileDataV20 = {
      version: "2.0",
      cases: [],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 0,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    };

    // ACT
    const result = isPersistedNormalizedFileDataV20(v20Data);

    // ASSERT
    expect(result).toBe(true);
  });

  it("recognizes persisted normalized v2.1 payloads using the shared envelope guard", () => {
    // ARRANGE
    const v21Data: PersistedNormalizedFileDataV21 = {
      version: "2.1",
      people: [],
      cases: [],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 0,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    };

    // ACT
    const result = isPersistedNormalizedFileDataV21(v21Data);

    // ASSERT
    expect(result).toBe(true);
  });

  it("migrates v2.0 embedded person data into a root people registry without losing legacy family member names", () => {
    const primaryPersonId = "11111111-1111-4111-8111-111111111111";
    const familyMemberId = "33333333-3333-4333-8333-333333333333";
    const relatedPerson = createMockPerson({
      id: "22222222-2222-4222-8222-222222222222",
      firstName: "Jane",
      lastName: "Doe",
      name: "Jane Doe",
      phone: "(555) 222-2222",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: undefined,
    });
    const primaryPerson = createMockPerson({
      id: primaryPersonId,
      firstName: "John",
      lastName: "Doe",
      name: "John Doe",
      familyMembers: [familyMemberId, "Grandma Doe"],
      relationships: [{ type: "spouse", name: "Jane Doe", phone: "(555) 222-2222" }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: undefined,
    });

    const v20Data: NormalizedFileDataV20 = {
      version: "2.0",
      cases: [
        createMockStoredCase({
          id: "case-1",
          person: primaryPerson,
          people: undefined,
        }),
        createMockStoredCase({
          id: "case-2",
          person: relatedPerson,
          people: undefined,
        }),
      ],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 2,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    };

    const migrated = migrateV20ToV21(v20Data);
    const migratedPrimaryPerson = migrated.people.find((person) => person.id === primaryPerson.id);

    expect(migrated.version).toBe("2.1");
    expect(migrated.people).toHaveLength(2);
    expect(migratedPrimaryPerson?.familyMemberIds).toEqual([familyMemberId]);
    expect(migratedPrimaryPerson?.legacyFamilyMemberNames).toEqual(["Grandma Doe"]);
    expect(migratedPrimaryPerson?.updatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(migratedPrimaryPerson?.relationships).toHaveLength(1);
    expect(migratedPrimaryPerson?.relationships[0]).toMatchObject({
      type: "spouse",
      targetPersonId: relatedPerson.id,
      legacyPhone: "(555) 222-2222",
    });
    expect(migratedPrimaryPerson).not.toHaveProperty("status");
    expect(migrated.cases[0].people).toEqual([
      { personId: primaryPerson.id, role: "applicant", isPrimary: true },
    ]);
    expect(migrated.cases[0].caseRecord.personId).toBe(primaryPerson.id);
  });

  it("hydrates the primary person using the explicit primary ref and preserves linked people", () => {
    const persistedData: PersistedNormalizedFileDataV21 = {
      version: "2.1",
      people: [
        {
          ...createMockPerson({
            id: "person-1",
            name: "Primary Person",
            firstName: "Primary",
            lastName: "Person",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            dateAdded: "2026-01-01T00:00:00.000Z",
          }),
          familyMemberIds: [],
          relationships: [],
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
        {
          ...createMockPerson({
            id: "person-2",
            name: "Secondary Person",
            firstName: "Secondary",
            lastName: "Person",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            dateAdded: "2026-01-01T00:00:00.000Z",
          }),
          familyMemberIds: [],
          relationships: [],
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      cases: [
        {
          id: "case-1",
          name: "Primary Person",
          mcn: "MCN-1",
          status: "Pending",
          priority: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          people: [
            { personId: "person-2", role: "contact", isPrimary: false },
            { personId: "person-1", role: "applicant", isPrimary: true },
          ],
          caseRecord: createMockStoredCase().caseRecord,
        },
      ],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    };

    const hydrated = hydrateNormalizedData(persistedData);

    expect(hydrated.cases[0].person.id).toBe("person-1");
    expect(hydrated.cases[0].linkedPeople).toHaveLength(2);
    expect(hydrated.cases[0].linkedPeople?.[0].person.id).toBe("person-2");
  });

  it("defaults missing intakeCompleted to true when hydrating persisted cases", () => {
    // ARRANGE
    const runtimeCase = createMockStoredCase();
    delete (runtimeCase.caseRecord as { intakeCompleted?: boolean }).intakeCompleted;
    const persistedData = dehydrateNormalizedData({
      version: "2.1",
      people: [createMockPerson()],
      cases: [runtimeCase],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    });
    delete (persistedData.cases[0].caseRecord as { intakeCompleted?: boolean }).intakeCompleted;

    // ACT
    const hydrated = hydrateNormalizedData(persistedData);

    // ASSERT
    expect(hydrated.cases[0].caseRecord.intakeCompleted).toBe(true);
  });

  it("writes intakeCompleted as true when dehydrating historical runtime cases without the field", () => {
    // ARRANGE
    const runtimeCase = createMockStoredCase();
    delete (runtimeCase.caseRecord as { intakeCompleted?: boolean }).intakeCompleted;
    const runtimeData = {
      version: "2.1" as const,
      people: [createMockPerson()],
      cases: [runtimeCase],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    };

    // ACT
    const dehydrated = dehydrateNormalizedData(runtimeData);

    // ASSERT
    expect(dehydrated.applications).toBeDefined();
    expect(dehydrated.applications).toHaveLength(1);
    expect(dehydrated.applications![0].verification.isIntakeCompleted).toBe(true);
  });

  it("stores applications canonically and strips application-owned case fields during dehydration", () => {
    // ARRANGE
    const runtimeCase = createMockStoredCase({
      id: "case-1",
      person: createMockPerson({ id: "person-1" }),
      people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        applicationDate: "2026-03-01",
        applicationType: "Renewal",
        withWaiver: true,
        retroRequested: "2026-02-01",
      },
    });

    // ACT
    const dehydrated = dehydrateNormalizedData({
      version: "2.1",
      people: [createMockPerson({ id: "person-1" })],
      cases: [runtimeCase],
      applications: [],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    });

    // ASSERT
    expect(dehydrated.applications).toHaveLength(1);
    expect(dehydrated.applications?.[0]).toMatchObject({
      caseId: "case-1",
      applicationType: "Renewal",
      hasWaiver: true,
      retroRequestedAt: "2026-02-01",
    });
    expect(dehydrated.cases[0].caseRecord).not.toHaveProperty("applicationDate");
    expect(dehydrated.cases[0].caseRecord).not.toHaveProperty("retroRequested");
    expect(dehydrated.cases[0].caseRecord).not.toHaveProperty("withWaiver");
  });

  it("hydrates runtime case fields back from canonical applications", () => {
    // ARRANGE
    const persistedData = dehydrateNormalizedData({
      version: "2.1",
      people: [createMockPerson({ id: "person-1" })],
      cases: [
        createMockStoredCase({
          id: "case-1",
          person: createMockPerson({ id: "person-1" }),
          people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
        }),
      ],
      applications: [
        createMockApplication({
          id: "application-1",
          caseId: "case-1",
          applicantPersonId: "person-1",
          applicationDate: "2026-03-01",
          applicationType: "Renewal",
          retroRequestedAt: "2026-02-01",
          hasWaiver: true,
          verification: {
            ...createMockApplication().verification,
            isIntakeCompleted: false,
          },
        }),
      ],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    });

    // ACT
    const hydrated = hydrateNormalizedData(persistedData);

    // ASSERT
    expect(hydrated.applications).toHaveLength(1);
    expect(hydrated.cases[0].caseRecord.applicationType).toBe("Renewal");
    expect(hydrated.cases[0].caseRecord.retroRequested).toBe("2026-02-01");
    expect(hydrated.cases[0].caseRecord.withWaiver).toBe(true);
    expect(hydrated.cases[0].caseRecord.intakeCompleted).toBe(false);
  });

  it("preserves canonical applications when runtime case fields differ and runtime sync is not preferred", () => {
    // ARRANGE
    const runtimeData = createMockNormalizedFileData({
      people: [createMockPerson({ id: "person-1" })],
      cases: [
        createMockStoredCase({
          id: "case-1",
          person: createMockPerson({ id: "person-1" }),
          people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
          caseRecord: {
            ...createMockStoredCase().caseRecord,
            personId: "person-1",
            applicationDate: "2026-03-15",
            applicationType: "Legacy Runtime Value",
            withWaiver: false,
            retroRequested: "2026-02-01",
          },
        }),
      ],
      applications: [
        createMockApplication({
          id: "application-1",
          caseId: "case-1",
          applicantPersonId: "person-1",
          applicationDate: "2026-03-01",
          applicationType: "Canonical Value",
          hasWaiver: true,
          retroRequestedAt: null,
        }),
      ],
    });

    // ACT
    const result = syncRuntimeApplications(runtimeData);

    // ASSERT
    expect(result.hasChanged).toBe(false);
    expect(result.applications).toHaveLength(1);
    expect(result.applications[0]).toMatchObject({
      id: "application-1",
      applicationDate: "2026-03-01",
      applicationType: "Canonical Value",
      hasWaiver: true,
      retroRequestedAt: null,
    });
  });

  it("updates canonical applications from runtime case fields when runtime sync is preferred", () => {
    // ARRANGE
    const preservedApplication = createMockApplication({
      id: "application-2",
      caseId: "case-2",
      applicantPersonId: "person-2",
      applicationType: "Unchanged",
    });
    const runtimeData = createMockNormalizedFileData({
      people: [createMockPerson({ id: "person-1" }), createMockPerson({ id: "person-2" })],
      cases: [
        createMockStoredCase({
          id: "case-1",
          person: createMockPerson({ id: "person-1" }),
          people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
          caseRecord: {
            ...createMockStoredCase().caseRecord,
            personId: "person-1",
            applicationDate: "2026-03-20",
            applicationType: "Converted From Case",
            withWaiver: true,
            retroRequested: "2026-02-01",
          },
        }),
      ],
      applications: [
        createMockApplication({
          id: "application-1",
          caseId: "case-1",
          applicantPersonId: "person-1",
          applicationType: "Stale Canonical Value",
          hasWaiver: false,
          retroRequestedAt: null,
        }),
        preservedApplication,
      ],
    });

    // ACT
    const result = syncRuntimeApplications(runtimeData, true);

    // ASSERT
    expect(result.hasChanged).toBe(true);
    expect(result.applications).toHaveLength(2);
    expect(result.applications.find((application) => application.id === "application-1")).toMatchObject({
      caseId: "case-1",
      applicationType: "Converted From Case",
      hasWaiver: true,
      retroRequestedAt: "2026-02-01",
    });
    expect(result.applications.find((application) => application.id === "application-2")).toEqual(
      preservedApplication,
    );
  });

  it("detects persisted cases with legacy application fields", () => {
    // ARRANGE
    const persistedData = createMockPersistedNormalizedFileData({
      people: [createMockPerson({ id: "person-1" })],
      cases: [
        createMockStoredCase({
          id: "case-1",
          person: createMockPerson({ id: "person-1" }),
          people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
        }),
      ],
    });
    (persistedData.cases[0].caseRecord as Record<string, unknown>).applicationDate = "2026-03-01";

    // ACT
    const result = persistedCasesContainLegacyApplicationFields(persistedData.cases);

    // ASSERT
    expect(result).toBe(true);
  });

  it("ignores canonical persisted cases without legacy application fields", () => {
    // ARRANGE
    const runtimeCase = createMockStoredCase({
      id: "case-1",
      person: createMockPerson({ id: "person-1" }),
      people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
    });
    const persistedData = createMockPersistedNormalizedFileData({
      people: [createMockPerson({ id: "person-1" })],
      cases: [runtimeCase],
      applications: [
        createMockApplication({
          id: "application-1",
          caseId: "case-1",
          applicantPersonId: "person-1",
        }),
      ],
    });

    // ACT
    const result = persistedCasesContainLegacyApplicationFields(persistedData.cases);

    // ASSERT
    expect(result).toBe(false);
  });

  it("dehydrates runtime familyMembers into familyMemberIds and legacyFamilyMemberNames", () => {
    const runtimeData = hydrateNormalizedData(
      migrateV20ToV21({
        version: "2.0",
        cases: [
          createMockStoredCase({
            id: "case-1",
      person: createMockPerson({
        id: "person-1",
              familyMembers: [
                "33333333-3333-4333-8333-333333333333",
                "Unresolved Child",
              ],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: undefined,
            }),
            people: undefined,
          }),
        ],
        financials: [],
        notes: [],
        alerts: [],
        exported_at: "2026-03-01T00:00:00.000Z",
        total_cases: 1,
        categoryConfig: mergeCategoryConfig(),
        activityLog: [],
      }),
    );

    const dehydrated = dehydrateNormalizedData(runtimeData);

    expect(dehydrated.people[0].familyMemberIds).toEqual([
      "33333333-3333-4333-8333-333333333333",
    ]);
    expect(dehydrated.people[0].legacyFamilyMemberNames).toEqual(["Unresolved Child"]);
  });

  it("preserves an explicit updatedAt value during migration", () => {
    const explicitUpdatedAt = "2026-02-01T12:00:00.000Z";

    const migrated = migrateV20ToV21({
      version: "2.0",
      cases: [
        createMockStoredCase({
          id: "case-1",
          person: createMockPerson({
            id: "person-1",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: explicitUpdatedAt,
          }),
          people: undefined,
        }),
      ],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    });

    expect(migrated.people[0].updatedAt).toBe(explicitUpdatedAt);
  });

  it("round-trips runtime v2.1 data through dehydration and hydration without losing linked people", () => {
    const secondaryPerson = createMockPerson({
      id: "person-2",
      firstName: "Linked",
      lastName: "Person",
      name: "Linked Person",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      dateAdded: "2026-01-01T00:00:00.000Z",
    });
    const primaryPerson = createMockPerson({
      id: "person-1",
      firstName: "Primary",
      lastName: "Person",
      name: "Primary Person",
      relationships: [{ type: "spouse", name: "Linked Person", phone: secondaryPerson.phone }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      dateAdded: "2026-01-01T00:00:00.000Z",
    });
    const runtimeData = {
      version: "2.1" as const,
      people: [primaryPerson, secondaryPerson],
      cases: [
        createMockStoredCase({
          id: "case-1",
          person: primaryPerson,
          linkedPeople: [
            {
              ref: { personId: "person-1", role: "applicant", isPrimary: true },
              person: primaryPerson,
            },
            {
              ref: { personId: "person-2", role: "contact", isPrimary: false },
              person: secondaryPerson,
            },
          ],
          people: [
            { personId: "person-1", role: "applicant", isPrimary: true },
            { personId: "person-2", role: "contact", isPrimary: false },
          ],
          caseRecord: {
            ...createMockStoredCase().caseRecord,
            personId: "person-1",
          },
        }),
      ],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    };

    const roundTripped = hydrateNormalizedData(dehydrateNormalizedData(runtimeData));
    const roundTrippedPrimaryPerson = roundTripped.people.find((person) => person.id === "person-1");

    expect(roundTripped.version).toBe("2.1");
    expect(roundTripped.people).toHaveLength(2);
    expect(roundTrippedPrimaryPerson).toMatchObject({
      id: "person-1",
      name: "Primary Person",
    });
    if (!roundTrippedPrimaryPerson) {
      throw new Error("Expected round-tripped people registry to include person-1");
    }
    expect(roundTrippedPrimaryPerson).not.toHaveProperty("status");
    expect(roundTripped.cases[0].person.id).toBe("person-1");
    expect(roundTripped.cases[0].linkedPeople).toEqual([
      {
        person: expect.objectContaining({
          id: "person-1",
          name: "Primary Person",
        }),
        ref: { personId: "person-1", role: "applicant", isPrimary: true },
      },
      {
        person: expect.objectContaining({
          id: "person-2",
          name: "Linked Person",
        }),
        ref: { personId: "person-2", role: "contact", isPrimary: false },
      },
    ]);
    expect(roundTrippedPrimaryPerson.normalizedRelationships).toEqual([
      expect.objectContaining({
        type: "spouse",
        targetPersonId: "person-2",
      }),
    ]);
  });
});
