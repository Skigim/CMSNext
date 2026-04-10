import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FileStorageService,
  LegacyFormatError,
  type NormalizedFileData,
} from "@/utils/services/FileStorageService";
import type { CategoryConfig } from "@/types/categoryConfig";
import {
  createMockApplication,
  createMockNormalizedFileData,
  createMockNormalizedFileDataV20,
  createMockPersistedNormalizedFileData,
  createMockPersistedNormalizedFileDataV21,
  createMockPerson,
  createMockStoredCase,
} from "@/src/test/testUtils";
import type AutosaveFileService from "@/utils/AutosaveFileService";
import {
  migrateV20ToV21,
  type PersistedNormalizedFileDataV21,
} from "@/utils/persistedV22Storage";

describe("FileStorageService v2.2", () => {
  let fileStorage: FileStorageService;
  let mockFileService: {
    readFile: ReturnType<typeof vi.fn>;
    writeFile: ReturnType<typeof vi.fn>;
    broadcastDataUpdate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockFileService = {
      readFile: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(true),
      broadcastDataUpdate: vi.fn(),
    };

    fileStorage = new FileStorageService({
      fileService: mockFileService as unknown as AutosaveFileService,
    });
  });

  function createSingleApplicantStoredCase(
    personOverrides: Parameters<typeof createMockPerson>[0],
    caseOverrides: Parameters<typeof createMockStoredCase>[0] = {},
  ) {
    const person = createMockPerson(personOverrides);

    return createMockStoredCase({
      id: "case-1",
      person,
      people: [{ personId: person.id, role: "applicant", isPrimary: true }],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: person.id,
        ...caseOverrides.caseRecord,
      },
      ...caseOverrides,
    });
  }

  function expectCanonicalCaseApplicationFields(
    writtenRuntimeData: NormalizedFileData,
    expectedFields: { applicationType: string; applicationDate?: string; retroRequested?: string },
  ) {
    expect(writtenRuntimeData.cases[0].caseRecord.applicationType).toBe(expectedFields.applicationType);

    if (expectedFields.applicationDate) {
      expect(writtenRuntimeData.cases[0].caseRecord.applicationDate).toBe(expectedFields.applicationDate);
    }

    if (expectedFields.retroRequested) {
      expect(writtenRuntimeData.cases[0].caseRecord.retroRequested).toBe(expectedFields.retroRequested);
    }
  }

  function createSingleApplicantRuntimeData(
    overrides: Partial<NormalizedFileData> = {},
  ) {
    const person = createMockPerson({ id: "person-1" });

    return createMockNormalizedFileData({
      people: [person],
      cases: [
        createMockStoredCase({
          id: "case-1",
          person,
          people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
        }),
      ],
      ...overrides,
    });
  }

  it("rejects persisted v2.0 files during normal runtime reads", async () => {
    // ARRANGE
    mockFileService.readFile.mockResolvedValue(createMockNormalizedFileDataV20({
      cases: [
        createMockStoredCase({
          id: "case-1",
          person: createMockPerson({
            id: "person-1",
            relationships: undefined,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: undefined,
          }),
          people: undefined,
        }),
      ],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
    }));

    // ACT & ASSERT
    const readPromise = fileStorage.readFileData();
    await expect(readPromise).rejects.toThrow(LegacyFormatError);
    await expect(readPromise).rejects.toThrow(
      "This workspace is using an outdated schema (v2.1 or older). To load this file, it must be upgraded using a previous version of CMSNext.",
    );
    expect(mockFileService.writeFile).not.toHaveBeenCalled();
  });

  it("rejects persisted v2.1 workspaces during normal runtime reads until they are upgraded", async () => {
    // ARRANGE
    mockFileService.readFile.mockResolvedValue(
      migrateV20ToV21(createMockNormalizedFileDataV20()),
    );

    // ACT & ASSERT
    const readPromise = fileStorage.readFileData();
    await expect(readPromise).rejects.toThrow(LegacyFormatError);
    expect(mockFileService.writeFile).not.toHaveBeenCalled();
  });

  it("rejects invalid persisted v2.2 workspaces without offering runtime migration", async () => {
    // ARRANGE
    mockFileService.readFile.mockResolvedValue({ version: "2.2", people: [] });

    // ACT & ASSERT
    const readPromise = fileStorage.readFileData();
    await expect(readPromise).rejects.toThrow(LegacyFormatError);
    await expect(readPromise).rejects.toThrow(
      "This workspace file is not in a valid canonical v2.2 format.",
    );
    expect(mockFileService.writeFile).not.toHaveBeenCalled();
  });

  it("returns null when no workspace file exists", async () => {
    // ARRANGE
    mockFileService.readFile.mockResolvedValue(null);

    // ACT
    const result = await fileStorage.readFileData();

    // ASSERT
    expect(result).toBeNull();
    expect(mockFileService.writeFile).not.toHaveBeenCalled();
  });

  it("returns persisted v2.1 data unchanged for explicit migration utilities", async () => {
    // ARRANGE
    const hydratedCase = createSingleApplicantStoredCase(
      {
        id: "person-1",
        firstName: "Hydrated",
        lastName: "Person",
        name: "Hydrated Person",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        dateAdded: "2026-01-01T00:00:00.000Z",
      },
      {
        name: "Hydrated Person",
        mcn: "MCN123456",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    );
    const persistedData = createMockPersistedNormalizedFileDataV21({
      people: [hydratedCase.person],
      cases: [hydratedCase],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
    });
    mockFileService.readFile.mockResolvedValue(persistedData);

    // ACT
    const result = await fileStorage.readRawFileData() as PersistedNormalizedFileDataV21 | null;

    // ASSERT
    expect(result?.version).toBe("2.1");
    expect(result?.people).toHaveLength(1);
    expect(result?.people[0]).toMatchObject({ id: "person-1", name: "Hydrated Person" });
    expect(result?.cases).toHaveLength(1);
    expect(result?.cases[0]).toMatchObject({
      name: "Hydrated Person",
      people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
      caseRecord: expect.objectContaining({ personId: "person-1" }),
    });
    expect(mockFileService.writeFile).not.toHaveBeenCalled();
  });

  it("returns migrated applications unchanged for explicit migration utilities", async () => {
    // ARRANGE
    const migratedPersistedData = migrateV20ToV21({
      ...createMockNormalizedFileDataV20(),
      cases: [
        createMockStoredCase({
          id: "case-application-migration",
          person: createMockPerson({
            id: "person-application-migration",
            firstName: "Mira",
            lastName: "Grant",
            name: "Mira Grant",
            relationships: undefined,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: undefined,
          }),
          people: undefined,
          caseRecord: {
            ...createMockStoredCase().caseRecord,
            applicationDate: "2026-02-14",
            applicationType: "Renewal",
            withWaiver: true,
            retroRequested: "2026-02-01",
          },
        }),
      ],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
    });
    mockFileService.readFile.mockResolvedValue(migratedPersistedData);

    // ACT
    const result = await fileStorage.readRawFileData() as PersistedNormalizedFileDataV21 | null;

    // ASSERT
    expect(result?.applications).toHaveLength(1);
    expect(result?.applications?.[0]).toMatchObject({
      caseId: "case-application-migration",
      applicationType: "Renewal",
      hasWaiver: true,
      retroRequestedAt: "2026-02-01",
    });
    expect(mockFileService.writeFile).not.toHaveBeenCalled();
  });

  it("returns invalid persisted v2.1 payloads unchanged for explicit migration validation", async () => {
    // ARRANGE
    const invalidPersistedData = createMockPersistedNormalizedFileDataV21({
      cases: [
        createMockStoredCase({
          id: "case-invalid",
          person: createMockPerson({ id: "person-missing" }),
          people: [{ personId: "person-missing", role: "applicant", isPrimary: true }],
          caseRecord: {
            ...createMockStoredCase().caseRecord,
            personId: "person-missing",
          },
        }),
      ],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
    });
    mockFileService.readFile.mockResolvedValue({
      ...invalidPersistedData,
      people: [],
    });

    // ACT
    const result = await fileStorage.readRawFileData() as PersistedNormalizedFileDataV21 | null;

    // ASSERT
    expect(result).toMatchObject({
      version: "2.1",
      people: [],
      cases: [expect.objectContaining({ id: "case-invalid" })],
    });
  });

  it("returns v2.1 workspaces migrated from v2.0 unchanged for explicit migration utilities", async () => {
    // ARRANGE
    const migratedPersistedData = migrateV20ToV21({
      ...createMockNormalizedFileDataV20(),
      cases: [
        createSingleApplicantStoredCase(
          {
            id: "person-1",
            firstName: "Migrated",
            lastName: "Workspace",
            name: "Migrated Workspace",
            relationships: undefined,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: undefined,
          },
          {
            people: undefined,
          },
        ),
      ],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
    });
    mockFileService.readFile.mockResolvedValue(migratedPersistedData);

    // ACT
    const result = await fileStorage.readRawFileData() as PersistedNormalizedFileDataV21 | null;

    // ASSERT
    expect(result?.version).toBe("2.1");
    expect(result?.people).toHaveLength(1);
    expect(result?.people[0]).toMatchObject({ id: "person-1", name: "Migrated Workspace" });
    expect(result?.cases).toHaveLength(1);
    expect(result?.cases[0]).toMatchObject({
      name: "Migrated Workspace",
      caseRecord: expect.objectContaining({ personId: "person-1" }),
    });
    expect(mockFileService.writeFile).not.toHaveBeenCalled();
  });

  it("hydrates dehydrated writes from the canonical terminal application order instead of the first match", async () => {
    // ARRANGE
    const categoryConfig: CategoryConfig = {
      ...createMockNormalizedFileData().categoryConfig,
      caseStatuses: [
        { name: "Closed", colorSlot: "slate", countsAsCompleted: true },
        { name: "Archived", colorSlot: "purple", countsAsCompleted: true },
        { name: "Pending", colorSlot: "amber", countsAsCompleted: false },
      ],
    };
    const persistedData = createMockPersistedNormalizedFileData({
      categoryConfig,
      people: [createMockPerson({ id: "person-1" })],
      cases: [
        createMockStoredCase({
          id: "case-1",
          person: createMockPerson({ id: "person-1" }),
          people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
          caseRecord: {
            ...createMockStoredCase().caseRecord,
            personId: "person-1",
            applicationType: "Stale Embedded Value",
          },
        }),
      ],
      applications: [
        createMockApplication({
          id: "application-z-newer",
          caseId: "case-1",
          applicantPersonId: "person-1",
          applicationDate: "2026-03-01",
          createdAt: "2026-03-01T00:00:00.000Z",
          status: "Archived",
          applicationType: "Newer Terminal",
        }),
        createMockApplication({
          id: "application-a-older",
          caseId: "case-1",
          applicantPersonId: "person-1",
          applicationDate: "2026-01-01",
          createdAt: "2026-01-01T00:00:00.000Z",
          status: "Closed",
          applicationType: "Older Terminal",
        }),
      ],
    });
    mockFileService.readFile.mockResolvedValue(null);

    // ACT
    const writtenRuntimeData = await fileStorage.writeNormalizedData(persistedData);

    // ASSERT
    expectCanonicalCaseApplicationFields(writtenRuntimeData, {
      applicationType: "Older Terminal",
      applicationDate: "2026-01-01",
    });
  });

  it("dehydrates runtime data to root people plus case refs on write", async () => {
    // ARRANGE
    const runtimeData = createMockNormalizedFileData({
      people: [],
      cases: [
        createMockStoredCase({
          id: "case-1",
          person: createMockPerson({
            id: "person-1",
            familyMembers: [
              "44444444-4444-4444-8444-444444444444",
              "Unresolved Parent",
            ],
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          }),
          people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
        }),
      ],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
    });

    mockFileService.readFile.mockResolvedValue(null);

    // ACT
    const writtenRuntimeData = await fileStorage.writeNormalizedData(runtimeData);

    // ASSERT
    const writtenData = mockFileService.writeFile.mock.calls[0][0];

    expect(writtenData.version).toBe("2.2");
    expect(writtenData.people).toHaveLength(1);
    expect(writtenData.people[0].familyMemberIds).toEqual([
      "44444444-4444-4444-8444-444444444444",
    ]);
    expect(writtenData.people[0].legacyFamilyMemberNames).toEqual(["Unresolved Parent"]);
    expect(writtenData.cases[0]).not.toHaveProperty("person");
    expect(writtenData.cases[0].people).toEqual([
      { personId: "person-1", role: "applicant", isPrimary: true },
    ]);
    expect(writtenData.applications).toEqual([]);
    expect(writtenData.cases[0].caseRecord).not.toHaveProperty("applicationDate");
    expect(writtenData.cases[0].caseRecord).not.toHaveProperty("applicationType");
    expect(writtenData.cases[0].caseRecord).not.toHaveProperty("withWaiver");
    expect(writtenRuntimeData.people).toHaveLength(1);
    expect(writtenRuntimeData.people[0].id).toBe("person-1");
    expect(writtenRuntimeData.cases[0].person.id).toBe("person-1");
    expect(mockFileService.broadcastDataUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        version: "2.2",
        people: [
          expect.objectContaining({
            id: "person-1",
          }),
        ],
      }),
    );
  });

  it("preserves explicit applications on write and rehydrates legacy case fields from them", async () => {
    // ARRANGE
      const runtimeData = createSingleApplicantRuntimeData({
      applications: [
        createMockApplication({
          id: "application-1",
          caseId: "case-1",
          applicantPersonId: "person-1",
          applicationType: "Renewal",
          retroRequestedAt: "2026-02-01",
        }),
      ],
    });

    mockFileService.readFile.mockResolvedValue(null);

    // ACT
    const writtenRuntimeData = await fileStorage.writeNormalizedData(runtimeData);

    // ASSERT
    expect(writtenRuntimeData.applications).toHaveLength(1);
    expectCanonicalCaseApplicationFields(writtenRuntimeData, {
      applicationType: "Renewal",
      retroRequested: "2026-02-01",
    });

    // Verify persists both the explicit application and the hydrated case legacy field
    expect(mockFileService.writeFile).toHaveBeenCalledTimes(1);
    const writtenData = mockFileService.writeFile.mock.calls[0][0];
    expect(writtenData.applications).toHaveLength(1);
    expect(writtenData.applications[0]).toMatchObject({
      id: "application-1",
      caseId: "case-1",
      applicationType: "Renewal",
      retroRequestedAt: "2026-02-01",
    });
  });
});
