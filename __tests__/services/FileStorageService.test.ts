import { beforeEach, describe, expect, it, vi } from "vitest";

import { FileStorageService, LegacyFormatError } from "@/utils/services/FileStorageService";
import type { CategoryConfig } from "@/types/categoryConfig";
import {
  createMockApplication,
  createMockNormalizedFileData,
  createMockNormalizedFileDataV20,
  createMockPersistedNormalizedFileData,
  createMockPerson,
  createMockStoredCase,
} from "@/src/test/testUtils";
import type AutosaveFileService from "@/utils/AutosaveFileService";
import { migrateV20ToV21 } from "@/utils/storageV21Migration";

describe("FileStorageService v2.1", () => {
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
      "Use the persisted v2.1 migration tool in Settings → Diagnostics",
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

  it("hydrates persisted v2.1 data on read without rewriting it", async () => {
    // ARRANGE
    const hydratedPerson = {
      ...createMockPerson({
        id: "person-1",
        firstName: "Hydrated",
        lastName: "Person",
        name: "Hydrated Person",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        dateAdded: "2026-01-01T00:00:00.000Z",
      }),
      familyMemberIds: [],
      relationships: [],
    };
    mockFileService.readFile.mockResolvedValue(createMockPersistedNormalizedFileData({
      people: [hydratedPerson],
      cases: [
        createMockStoredCase({
          id: "case-1",
          name: "Hydrated Person",
          mcn: "MCN123456",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          person: hydratedPerson,
          people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
          caseRecord: {
            ...createMockStoredCase().caseRecord,
            personId: "person-1",
          },
        }),
      ],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
    }));

    // ACT
    const result = await fileStorage.readFileData();

    // ASSERT
    expect(result?.version).toBe("2.1");
    expect(result?.people).toHaveLength(1);
    expect(result?.cases[0].person.name).toBe("Hydrated Person");
    expect(result?.cases[0].linkedPeople).toEqual([
      {
        person: expect.objectContaining({
          id: "person-1",
          name: "Hydrated Person",
        }),
        ref: {
          personId: "person-1",
          role: "applicant",
          isPrimary: true,
        },
      },
    ]);
    expect(mockFileService.writeFile).not.toHaveBeenCalled();
  });

  it("migrates legacy case-embedded application fields into canonical applications on read", async () => {
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
    const result = await fileStorage.readFileData();

    // ASSERT
    expect(result?.applications).toHaveLength(1);
    expect(result?.applications?.[0]).toMatchObject({
      caseId: "case-application-migration",
      applicationType: "Renewal",
      hasWaiver: true,
      retroRequestedAt: "2026-02-01",
    });
    expect(mockFileService.broadcastDataUpdate).toHaveBeenCalledWith(result);
    expect(mockFileService.writeFile).toHaveBeenCalledTimes(1);
    const writtenData = mockFileService.writeFile.mock.calls[0][0];
    expect(writtenData.applications).toHaveLength(1);
    expect(writtenData.cases[0].caseRecord).not.toHaveProperty("applicationDate");
    expect(writtenData.cases[0].caseRecord).not.toHaveProperty("withWaiver");
  });

  it("rejects invalid persisted v2.1 payloads that fail hydration", async () => {
    // ARRANGE
    const invalidPersistedData = createMockPersistedNormalizedFileData({
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

    // ACT & ASSERT
    const readPromise = fileStorage.readFileData();
    await expect(readPromise).rejects.toThrow(LegacyFormatError);
    await expect(readPromise).rejects.toThrow("invalid v2.1 workspace");
    await expect(readPromise).rejects.toThrow(
      "Use the persisted v2.1 migration tool in Settings → Diagnostics",
    );
  });

  it("hydrates v2.1 workspaces that were migrated from v2.0", async () => {
    // ARRANGE
    const migratedPersistedData = migrateV20ToV21({
      ...createMockNormalizedFileDataV20(),
      cases: [
        createMockStoredCase({
          id: "case-1",
          person: createMockPerson({
            id: "person-1",
            firstName: "Migrated",
            lastName: "Workspace",
            name: "Migrated Workspace",
            relationships: undefined,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: undefined,
          }),
          people: undefined,
        }),
      ],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
    });
    mockFileService.readFile.mockResolvedValue(migratedPersistedData);

    // ACT
    const result = await fileStorage.readFileData();

    // ASSERT
    expect(result?.version).toBe("2.1");
    expect(result?.people).toHaveLength(1);
    expect(result?.people[0].id).toBe("person-1");
    expect(result?.cases[0].person.name).toBe("Migrated Workspace");
    expect(result?.cases[0].people).toEqual([
      { personId: "person-1", role: "applicant", isPrimary: true },
    ]);
    expect(mockFileService.writeFile).toHaveBeenCalledTimes(1);
  });

  it("hydrates dehydrated writes from the canonical terminal application order instead of the first match", async () => {
    // ARRANGE
    const categoryConfig: CategoryConfig = {
      ...createMockNormalizedFileData().categoryConfig,
      caseStatuses: [
        { name: "Approved", colorSlot: "green", countsAsCompleted: true },
        { name: "Denied", colorSlot: "red", countsAsCompleted: true },
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
          status: "Denied",
          applicationType: "Newer Terminal",
        }),
        createMockApplication({
          id: "application-a-older",
          caseId: "case-1",
          applicantPersonId: "person-1",
          applicationDate: "2026-01-01",
          createdAt: "2026-01-01T00:00:00.000Z",
          status: "Approved",
          applicationType: "Older Terminal",
        }),
      ],
    });
    mockFileService.readFile.mockResolvedValue(null);

    // ACT
    const writtenRuntimeData = await fileStorage.writeNormalizedData(persistedData);

    // ASSERT
    expect(writtenRuntimeData.cases[0].caseRecord.applicationType).toBe("Older Terminal");
    expect(writtenRuntimeData.cases[0].caseRecord.applicationDate).toBe("2026-01-01");
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

    expect(writtenData.version).toBe("2.1");
    expect(writtenData.people).toHaveLength(1);
    expect(writtenData.people[0].familyMemberIds).toEqual([
      "44444444-4444-4444-8444-444444444444",
    ]);
    expect(writtenData.people[0].legacyFamilyMemberNames).toEqual(["Unresolved Parent"]);
    expect(writtenData.cases[0]).not.toHaveProperty("person");
    expect(writtenData.cases[0].people).toEqual([
      { personId: "person-1", role: "applicant", isPrimary: true },
    ]);
    expect(writtenData.applications).toHaveLength(1);
    expect(writtenData.applications[0]).toMatchObject({
      caseId: "case-1",
      applicantPersonId: "person-1",
    });
    expect(writtenData.cases[0].caseRecord).not.toHaveProperty("applicationDate");
    expect(writtenData.cases[0].caseRecord).not.toHaveProperty("applicationType");
    expect(writtenData.cases[0].caseRecord).not.toHaveProperty("withWaiver");
    expect(writtenRuntimeData.people).toHaveLength(1);
    expect(writtenRuntimeData.people[0].id).toBe("person-1");
    expect(writtenRuntimeData.cases[0].person.id).toBe("person-1");
    expect(mockFileService.broadcastDataUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        version: "2.1",
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
    const runtimeData = createMockNormalizedFileData({
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
    expect(writtenRuntimeData.cases[0].caseRecord.applicationType).toBe("Renewal");
    expect(writtenRuntimeData.cases[0].caseRecord.retroRequested).toBe("2026-02-01");

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
