import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockPerson, createMockStoredCase } from "@/src/test/testUtils";
import { CaseArchiveService } from "@/utils/services/CaseArchiveService";

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
    pendingArchival: true,
  });
}

function createLegacyArchiveData() {
  const archivedCase = createArchivableCase("existing");

  return {
    version: "1.0" as const,
    archiveType: "cases" as const,
    archivedAt: "2026-03-01T00:00:00.000Z",
    archiveYear: 2026,
    cases: [archivedCase],
    financials: [],
    notes: [],
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
    const legacyArchiveData = createLegacyArchiveData();

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
    fileService.readNamedFile.mockResolvedValue(legacyArchiveData);
    fileService.writeNamedFile.mockResolvedValue(true);

    // ACT & ASSERT
    await expect(service.archiveCases(["new"])).rejects.toThrow("main write failed");

    expect(fileService.writeNamedFile).toHaveBeenCalledTimes(2);
    expect(fileService.writeNamedFile).toHaveBeenNthCalledWith(
      1,
      "archived-cases-2026.json",
      expect.objectContaining({
        version: "2.1",
        archiveType: "cases",
      }),
    );
    expect(fileService.writeNamedFile).toHaveBeenNthCalledWith(
      2,
      "archived-cases-2026.json",
      legacyArchiveData,
    );
    expect(fileService.writeNamedFile.mock.calls[0][1]).toMatchObject({
      version: "2.1",
      archiveType: "cases",
    });
  });
});
