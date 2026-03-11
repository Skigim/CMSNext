import { beforeEach, describe, expect, it, vi } from "vitest";

import { FileStorageService } from "@/utils/services/FileStorageService";
import { createMockPerson, createMockStoredCase } from "@/src/test/testUtils";
import { mergeCategoryConfig } from "@/types/categoryConfig";
import type AutosaveFileService from "@/utils/AutosaveFileService";

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

  it("migrates v2.0 files to hydrated v2.1 data on read", async () => {
    mockFileService.readFile.mockResolvedValue({
      version: "2.0",
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
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    });

    const result = await fileStorage.readFileData();

    expect(result?.version).toBe("2.1");
    expect(result?.people).toHaveLength(1);
    expect(result?.people[0].updatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result?.cases[0].people).toEqual([
      { personId: "person-1", role: "applicant", isPrimary: true },
    ]);
    expect(result?.cases[0].person.id).toBe("person-1");
    expect(mockFileService.writeFile).toHaveBeenCalledTimes(1);
  });

  it("hydrates persisted v2.1 data on read without rewriting it", async () => {
    mockFileService.readFile.mockResolvedValue({
      version: "2.1",
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
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    });

    const result = await fileStorage.readFileData();

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

  it("dehydrates runtime data to root people plus case refs on write", async () => {
    const runtimeData = {
      version: "2.1" as const,
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
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    };

    mockFileService.readFile.mockResolvedValue(null);

    const writtenRuntimeData = await fileStorage.writeNormalizedData(runtimeData);

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
