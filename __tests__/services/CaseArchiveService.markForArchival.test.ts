/**
 * @fileoverview Tests for CaseArchiveService.markForArchival
 *
 * Tests the new method for marking arbitrary cases for archival review,
 * used by the position assignments import feature.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CaseArchiveService } from "@/utils/services/CaseArchiveService";
import type { StoredCase } from "@/types/case";
import { createMockStoredCase } from "@/src/test/testUtils";
import type { FileStorageService } from "@/utils/services/FileStorageService";
import type AutosaveFileService from "@/utils/AutosaveFileService";

// ============================================================================
// Mocks
// ============================================================================

function createMockFileStorage(cases: StoredCase[]) {
  return {
    readFileData: vi.fn().mockResolvedValue({
      cases,
      financials: [],
      notes: [],
      alerts: [],
      categoryConfig: { caseStatuses: [], caseTypes: [], livingArrangements: [] },
      activityLog: [],
    }),
    writeNormalizedData: vi.fn().mockResolvedValue(undefined),
  } as unknown as FileStorageService;
}

function createMockFileService() {
  return {
    readExistingContent: vi.fn().mockResolvedValue(null),
    writeContentToFile: vi.fn().mockResolvedValue(undefined),
    listJsonFiles: vi.fn().mockResolvedValue([]),
    getStatus: vi.fn().mockReturnValue({ isRunning: false }),
  } as unknown as AutosaveFileService;
}

// ============================================================================
// Tests
// ============================================================================

describe("CaseArchiveService.markForArchival", () => {
  let service: CaseArchiveService;
  let mockFileStorage: ReturnType<typeof createMockFileStorage>;

  beforeEach(() => {
    const cases = [
      createMockStoredCase({ id: "c1", mcn: "100001" }),
      createMockStoredCase({ id: "c2", mcn: "200002" }),
      createMockStoredCase({ id: "c3", mcn: "300003", isPendingArchival: true }),
    ];
    mockFileStorage = createMockFileStorage(cases);

    service = new CaseArchiveService({
      fileStorage: mockFileStorage,
      fileService: createMockFileService(),
    });
  });

  it("should mark specified cases as pending archival", async () => {
    const result = await service.markForArchival(["c1", "c2"]);

    expect(result.markedCount).toBe(2);
    expect(result.markedIds).toEqual(["c1", "c2"]);
    expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledTimes(1);

    const writtenData = (mockFileStorage.writeNormalizedData as any).mock.calls[0][0];
    const markedCases = writtenData.cases.filter(
      (c: StoredCase) => c.isPendingArchival
    );
    expect(markedCases).toHaveLength(3); // c1, c2, and c3 (already pending)
  });

  it("should skip cases already pending archival", async () => {
    // c3 is already pending
    const result = await service.markForArchival(["c3"]);

    expect(result.markedCount).toBe(0);
    expect(result.markedIds).toEqual([]);
    expect(mockFileStorage.writeNormalizedData).not.toHaveBeenCalled();
  });

  it("should return empty result for empty array", async () => {
    const result = await service.markForArchival([]);

    expect(result.markedCount).toBe(0);
    expect(result.markedIds).toEqual([]);
    expect(mockFileStorage.readFileData).not.toHaveBeenCalled();
  });

  it("should return empty result when file data is null", async () => {
    (mockFileStorage.readFileData as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await service.markForArchival(["c1"]);

    expect(result.markedCount).toBe(0);
    expect(result.markedIds).toEqual([]);
  });

  it("should handle mixed pending and non-pending case IDs", async () => {
    // c1 is not pending, c3 is already pending
    const result = await service.markForArchival(["c1", "c3"]);

    expect(result.markedCount).toBe(1);
    expect(result.markedIds).toEqual(["c1"]);
    expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledTimes(1);
  });

  it("should ignore unknown case IDs", async () => {
    const result = await service.markForArchival(["unknown-id"]);

    expect(result.markedCount).toBe(0);
    expect(result.markedIds).toEqual([]);
    expect(mockFileStorage.writeNormalizedData).not.toHaveBeenCalled();
  });

  it("should deduplicate input case IDs", async () => {
    const result = await service.markForArchival(["c1", "c1", "c2", "c2"]);

    expect(result.markedCount).toBe(2);
    expect(result.markedIds).toEqual(expect.arrayContaining(["c1", "c2"]));
    expect(result.markedIds).toHaveLength(2);
    expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledTimes(1);
  });

  it("should ignore unknown IDs mixed with valid ones", async () => {
    const result = await service.markForArchival(["c1", "ghost-1", "ghost-2"]);

    expect(result.markedCount).toBe(1);
    expect(result.markedIds).toEqual(["c1"]);
    expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledTimes(1);
  });
});
