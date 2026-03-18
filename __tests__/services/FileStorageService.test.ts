import { beforeEach, describe, expect, it, vi } from "vitest";

import { FileStorageService, LegacyFormatError } from "@/utils/services/FileStorageService";
import {
  createMockNormalizedFileData,
  createMockNormalizedFileDataV20,
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

  it("hydrates persisted v2.1 data on read without rewriting it", async () => {
    // ARRANGE
    mockFileService.readFile.mockResolvedValue(createMockNormalizedFileData({
      people: [
        {
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
        },
      ],
      cases: [
        {
          id: "case-1",
          name: "Hydrated Person",
          mcn: "MCN123456",
          status: "Pending",
          priority: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
          caseRecord: {
            ...createMockStoredCase().caseRecord,
            personId: "person-1",
          },
        },
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

  it("preserves hydration behavior for manually migrated v2.1 workspaces", async () => {
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
    expect(mockFileService.writeFile).not.toHaveBeenCalled();
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
});
