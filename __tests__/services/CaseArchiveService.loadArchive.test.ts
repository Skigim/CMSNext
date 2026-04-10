import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockPerson, createMockStoredCase } from "@/src/test/testUtils";
import { mergeCategoryConfig } from "@/types/categoryConfig";
import { dehydrateNormalizedData } from "@/utils/persistedV22Storage";
import { LegacyFormatError } from "@/utils/services/FileStorageService";
import { CaseArchiveService } from "@/utils/services/CaseArchiveService";

function createPersistedArchiveDataV22() {
  const person = createMockPerson({
    id: "archive-person-1",
    firstName: "Archived",
    lastName: "Case",
    name: "Archived Case",
  });
  const caseItem = createMockStoredCase({
    id: "archive-case-1",
    person,
    people: [{ personId: person.id, role: "applicant", isPrimary: true }],
  });

  return {
    ...dehydrateNormalizedData({
      version: "2.2" as const,
      people: [person],
      cases: [caseItem],
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
    archiveYear: 2026,
    archivedAt: "2026-03-01T00:00:00.000Z",
  };
}

describe("CaseArchiveService.loadArchivedCases", () => {
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

  it("loads canonical persisted v2.2 archive payloads", async () => {
    // ARRANGE
    fileService.readNamedFile.mockResolvedValue(createPersistedArchiveDataV22());

    // ACT
    const result = await service.loadArchivedCases("archived-cases-2026.json");

    // ASSERT
    expect(result).toMatchObject({
      archiveType: "cases",
      archiveYear: 2026,
      cases: [expect.objectContaining({ id: "archive-case-1" })],
    });
  });

  it("rejects legacy archive payloads instead of upgrading them", async () => {
    // ARRANGE
    fileService.readNamedFile.mockResolvedValue({ version: "2.1", archiveType: "cases" });

    // ACT & ASSERT
    await expect(service.loadArchivedCases("archived-cases-2026.json")).rejects.toThrow(
      LegacyFormatError,
    );
  });
});