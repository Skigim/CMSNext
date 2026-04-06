import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockApplication, createMockNormalizedFileData, createMockStoredCase } from "@/src/test/testUtils";
import { ApplicationService } from "@/utils/services/ApplicationService";
import type { FileStorageService } from "@/utils/services/FileStorageService";

describe("ApplicationService", () => {
  let service: ApplicationService;
  let mockFileStorage: ReturnType<typeof createMockFileStorage>;

  function createMockFileStorage() {
    let storedData = createMockNormalizedFileData({
      cases: [createMockStoredCase({ id: "case-1" })],
      applications: [
        createMockApplication({
          id: "application-1",
          caseId: "case-1",
        }),
      ],
    });

    return {
      readFileData: vi.fn().mockImplementation(() => Promise.resolve(storedData)),
      writeNormalizedData: vi.fn().mockImplementation((data) => {
        storedData = data;
        return Promise.resolve(data);
      }),
      setData: (data: typeof storedData) => {
        storedData = data;
      },
    };
  }

  beforeEach(() => {
    mockFileStorage = createMockFileStorage();
    service = new ApplicationService({
      fileStorage: mockFileStorage as unknown as FileStorageService,
    });
  });

  it("returns applications for a case", async () => {
    const result = await service.getApplicationsForCase("case-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "application-1",
      caseId: "case-1",
    });
  });

  it("adds an application through the canonical write path", async () => {
    const application = createMockApplication({
      id: "application-2",
      caseId: "case-1",
    });

    const result = await service.addApplication(application);

    expect(result).toMatchObject({
      id: "application-2",
      caseId: "case-1",
    });
    expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledTimes(1);
    expect(mockFileStorage.writeNormalizedData.mock.calls[0][0].applications).toHaveLength(2);
  });

  it("updates an application while preserving immutable identifiers", async () => {
    const result = await service.updateApplication("application-1", {
      applicationType: "Renewal",
      retroMonths: ["2026-02"],
      verification: {
        ...createMockApplication().verification,
        isAppValidated: true,
      },
    });

    expect(result).toMatchObject({
      id: "application-1",
      caseId: "case-1",
      applicationType: "Renewal",
      retroMonths: ["2026-02"],
    });
    expect(result.verification.isAppValidated).toBe(true);
    expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledTimes(1);
  });

  it("appends status history and updates the top-level status", async () => {
    const result = await service.addStatusHistory("application-1", {
      id: "history-2",
      status: "Approved",
      effectiveDate: "2026-02-01",
      changedAt: "2026-02-01T00:00:00.000Z",
      source: "user",
    });

    expect(result.status).toBe("Approved");
    expect(result.statusHistory).toHaveLength(2);
    expect(result.statusHistory[1]).toMatchObject({
      id: "history-2",
      status: "Approved",
    });
  });
});