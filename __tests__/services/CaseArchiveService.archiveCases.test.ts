import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockPerson, createMockStoredCase } from "@/src/test/testUtils";
import { mergeCategoryConfig } from "@/types/categoryConfig";
import { dehydrateNormalizedData } from "@/utils/persistedV22Storage";
import { CaseArchiveService } from "@/utils/services/CaseArchiveService";

const mockSafeNotifyFileStorageChange = vi.hoisted(() => vi.fn());

vi.mock("@/utils/fileStorageNotify", () => ({
  safeNotifyFileStorageChange: mockSafeNotifyFileStorageChange,
}));

function createArchivableCase(id: string) {
  const person = createMockPerson({
    id: `person-${id}`,
    firstName: "Archive",
    lastName: id,
    name: `Archive ${id}`,
  });

  return createMockStoredCase({
    id,
    name: `Case ${id}`,
    mcn: `MCN-${id}`,
    person,
    people: [{ personId: person.id, role: "applicant", isPrimary: true }],
    caseRecord: {
      ...createMockStoredCase().caseRecord,
      personId: person.id,
    },
    isPendingArchival: true,
  });
}

function createPersistedArchiveDataV22() {
  const archivedCase = createArchivableCase("existing");

  return {
    ...dehydrateNormalizedData({
      version: "2.2" as const,
      people: [archivedCase.person],
      cases: [archivedCase],
      applications: [],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    }),
    archiveType: "cases" as const,
    archivedAt: "2026-03-01T00:00:00.000Z",
    archiveYear: 2026,
  };
}

describe("CaseArchiveService.archiveCases", () => {
  let fileStorage: {
    readFileData: ReturnType<typeof vi.fn>;
    writeNormalizedData: ReturnType<typeof vi.fn>;
  };

  let fileService: {
    readNamedFile: ReturnType<typeof vi.fn>;
    writeNamedFile: ReturnType<typeof vi.fn>;
    listDataFiles: ReturnType<typeof vi.fn>;
  };

  let service: CaseArchiveService;

  beforeEach(() => {
    mockSafeNotifyFileStorageChange.mockReset();

    fileStorage = {
      readFileData: vi.fn(),
      writeNormalizedData: vi.fn(),
    };

    fileService = {
      readNamedFile: vi.fn(),
      writeNamedFile: vi.fn(),
      listDataFiles: vi.fn(),
    };

    service = new CaseArchiveService({
      fileStorage: fileStorage as never,
      fileService: fileService as never,
    });
  });

  it("restores the exact previously-read archive payload on rollback", async () => {
    // ARRANGE
    const caseToArchive = createArchivableCase("new");
    const persistedArchiveData = createPersistedArchiveDataV22();

    fileStorage.readFileData.mockResolvedValue({
      version: "2.1",
      people: [caseToArchive.person],
      cases: [caseToArchive],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: { caseStatuses: [], caseTypes: [], livingArrangements: [] },
      activityLog: [],
    });
    fileStorage.writeNormalizedData.mockRejectedValue(new Error("main write failed"));
    fileService.readNamedFile.mockResolvedValue(persistedArchiveData);
    fileService.writeNamedFile.mockResolvedValue(true);

    // ACT & ASSERT
    await expect(service.archiveCases(["new"])).rejects.toThrow("main write failed");

    expect(fileService.writeNamedFile).toHaveBeenCalledTimes(2);
    expect(fileService.writeNamedFile).toHaveBeenNthCalledWith(
      1,
      "archived-cases-2026.json",
      expect.objectContaining({
        version: "2.2",
        archiveType: "cases",
      }),
    );
    expect(fileService.writeNamedFile).toHaveBeenNthCalledWith(
      2,
      "archived-cases-2026.json",
      persistedArchiveData,
    );
    expect(fileService.writeNamedFile.mock.calls[0][1]).toMatchObject({
      version: "2.2",
      archiveType: "cases",
    });
  });

  it("notifies file storage changes after a successful archive write", async () => {
    // ARRANGE
    const caseToArchive = createArchivableCase("new");

    fileStorage.readFileData.mockResolvedValue({
      version: "2.1",
      people: [caseToArchive.person],
      cases: [caseToArchive],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: { caseStatuses: [], caseTypes: [], livingArrangements: [] },
      activityLog: [],
    });
    fileStorage.writeNormalizedData.mockResolvedValue(undefined);
    fileService.readNamedFile.mockResolvedValue(null);
    fileService.writeNamedFile.mockResolvedValue(true);

    // ACT
    const result = await service.archiveCases(["new"]);

    // ASSERT
    expect(result).toMatchObject({
      archivedCount: 1,
      archiveFileName: "archived-cases-2026.json",
      archivedCaseIds: ["new"],
    });
    expect(mockSafeNotifyFileStorageChange).toHaveBeenCalledTimes(1);
  });

  it("throws when an existing archive file cannot be normalized", async () => {
    // ARRANGE
    const caseToArchive = createArchivableCase("new");

    fileStorage.readFileData.mockResolvedValue({
      version: "2.1",
      people: [caseToArchive.person],
      cases: [caseToArchive],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: { caseStatuses: [], caseTypes: [], livingArrangements: [] },
      activityLog: [],
    });
    fileService.readNamedFile.mockResolvedValue({ version: "broken" });

    // ACT & ASSERT
    await expect(service.archiveCases(["new"])).rejects.toThrow(
      "This workspace is using an outdated schema (v2.1 or older). To load this file, it must be upgraded using a previous version of CMSNext.",
    );
    expect(fileService.writeNamedFile).not.toHaveBeenCalled();
    expect(fileStorage.writeNormalizedData).not.toHaveBeenCalled();
  });
});
