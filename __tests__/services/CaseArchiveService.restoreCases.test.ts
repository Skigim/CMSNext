/**
 * @fileoverview Tests for CaseArchiveService.restoreCases
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaseArchiveService } from "@/utils/services/CaseArchiveService";

function createStoredCase(id: string, status = "Archived") {
  return {
    id,
    name: `Case ${id}`,
    caseNumber: `CN-${id}`,
    mcn: `MCN-${id}`,
    status,
    priority: false,
    createdAt: new Date("2025-01-01").toISOString(),
    updatedAt: new Date("2025-12-01").toISOString(),
    person: {
      firstName: "Test",
      lastName: id,
    },
  };
}

function createArchiveData() {
  return {
    version: "1.0",
    archiveType: "cases" as const,
    archivedAt: new Date("2025-12-01").toISOString(),
    archiveYear: 2025,
    cases: [createStoredCase("c1"), createStoredCase("c2")],
    financials: [
      { id: "f1", caseId: "c1", amount: 100, type: "resource", createdAt: "2025-01-01", updatedAt: "2025-01-01" },
      { id: "f2", caseId: "c2", amount: 200, type: "income", createdAt: "2025-01-01", updatedAt: "2025-01-01" },
    ],
    notes: [
      { id: "n1", caseId: "c1", content: "note 1", createdAt: "2025-01-01", updatedAt: "2025-01-01" },
      { id: "n2", caseId: "c2", content: "note 2", createdAt: "2025-01-01", updatedAt: "2025-01-01" },
    ],
  };
}

describe("CaseArchiveService.restoreCases", () => {
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
      readFileData: vi.fn().mockResolvedValue({
        cases: [createStoredCase("existing", "Active")],
        financials: [],
        notes: [],
        alerts: [],
        categoryConfig: { caseStatuses: [], caseTypes: [], livingArrangements: [] },
        activityLog: [],
      }),
      writeNormalizedData: vi.fn().mockResolvedValue(undefined),
    };

    fileService = {
      readNamedFile: vi.fn().mockResolvedValue(createArchiveData()),
      writeNamedFile: vi.fn().mockResolvedValue(true),
      listDataFiles: vi.fn().mockResolvedValue([]),
    };

    service = new CaseArchiveService({
      fileStorage: fileStorage as any,
      fileService: fileService as any,
    });
  });

  it("restores selected cases and related data to main file", async () => {
    const result = await service.restoreCases("archived-cases-2025.json", ["c1"]);

    expect(result.restoredCount).toBe(1);
    expect(result.financialsRestored).toBe(1);
    expect(result.notesRestored).toBe(1);
    expect(result.restoredCaseIds).toEqual(["c1"]);

    expect(fileStorage.writeNormalizedData).toHaveBeenCalledTimes(1);
    const writtenMain = fileStorage.writeNormalizedData.mock.calls[0][0];
    expect(writtenMain.cases.map((c: { id: string }) => c.id)).toEqual(["existing", "c1"]);
    expect(writtenMain.financials.map((f: { id: string }) => f.id)).toEqual(["f1"]);
    expect(writtenMain.notes.map((n: { id: string }) => n.id)).toEqual(["n1"]);

    expect(fileService.writeNamedFile).toHaveBeenCalledTimes(1);
    expect(fileService.writeNamedFile).toHaveBeenCalledWith(
      "archived-cases-2025.json",
      expect.objectContaining({
        cases: [expect.objectContaining({ id: "c2" })],
      })
    );
  });

  it("returns empty result and performs no I/O for empty case IDs", async () => {
    const result = await service.restoreCases("archived-cases-2025.json", []);

    expect(result).toEqual({
      restoredCount: 0,
      financialsRestored: 0,
      notesRestored: 0,
      restoredCaseIds: [],
    });
    expect(fileStorage.readFileData).not.toHaveBeenCalled();
    expect(fileStorage.writeNormalizedData).not.toHaveBeenCalled();
    expect(fileService.readNamedFile).not.toHaveBeenCalled();
    expect(fileService.writeNamedFile).not.toHaveBeenCalled();
  });

  it("throws when archive file is missing or invalid", async () => {
    fileService.readNamedFile.mockResolvedValue(null);

    await expect(
      service.restoreCases("archived-cases-2025.json", ["c1"])
    ).rejects.toThrow("Archive file not found or invalid");

    expect(fileStorage.writeNormalizedData).not.toHaveBeenCalled();
    expect(fileService.writeNamedFile).not.toHaveBeenCalled();
  });

  it("rolls back main file when archive update fails", async () => {
    fileService.writeNamedFile.mockRejectedValue(new Error("archive write failed"));

    await expect(
      service.restoreCases("archived-cases-2025.json", ["c1"])
    ).rejects.toThrow("Failed to update archive file after restore");

    expect(fileStorage.writeNormalizedData).toHaveBeenCalledTimes(2);

    const firstWrite = fileStorage.writeNormalizedData.mock.calls[0][0];
    expect(firstWrite.cases.map((c: { id: string }) => c.id)).toEqual(["existing", "c1"]);

    const rollbackWrite = fileStorage.writeNormalizedData.mock.calls[1][0];
    expect(rollbackWrite.cases.map((c: { id: string }) => c.id)).toEqual(["existing"]);
  });
});
