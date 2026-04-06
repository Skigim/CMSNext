import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockApplication, createMockNormalizedFileData, createMockStoredCase } from "@/src/test/testUtils";
import { ApplicationService } from "@/utils/services/ApplicationService";
import type { FileStorageService, NormalizedFileData } from "@/utils/services/FileStorageService";

type ApplicationServiceFileStorageMock = Pick<
  FileStorageService,
  "readFileData" | "writeNormalizedData"
>;

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

    const readFileData = vi
      .fn<() => Promise<NormalizedFileData | null>>()
      .mockImplementation(() => Promise.resolve(storedData));

    const writeNormalizedData = vi
      .fn<(data: NormalizedFileData) => Promise<NormalizedFileData>>()
      .mockImplementation((data) => {
        storedData = data;
        return Promise.resolve(data);
      });

    return {
      readFileData,
      writeNormalizedData,
      setData: (data: typeof storedData) => {
        storedData = data;
      },
    } satisfies ApplicationServiceFileStorageMock & {
      setData: (data: NormalizedFileData) => void;
    };
  }

  beforeEach(() => {
    mockFileStorage = createMockFileStorage();
    service = new ApplicationService({
      fileStorage: mockFileStorage as unknown as FileStorageService,
    });
  });

  it("returns applications for a case", async () => {
    // Arrange

    // Act
    const result = await service.getApplicationsForCase("case-1");

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "application-1",
      caseId: "case-1",
    });
  });

  it("adds an application through the canonical write path", async () => {
    // Arrange
    const application = createMockApplication({
      id: "application-2",
      caseId: "case-1",
    });

    // Act
    const result = await service.addApplication(application);

    // Assert
    expect(result).toMatchObject({
      id: "application-2",
      caseId: "case-1",
    });
    expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledTimes(1);
    const writtenData = mockFileStorage.writeNormalizedData.mock.calls[0][0] as NormalizedFileData;
    expect(writtenData.applications).toHaveLength(2);
  });

  it("updates an application while preserving immutable identifiers", async () => {
    // Arrange

    // Act
    const result = await service.updateApplication("case-1", "application-1", {
      applicationType: "Renewal",
      retroMonths: ["2026-02"],
      verification: {
        ...createMockApplication().verification,
        isAppValidated: true,
      },
    });

    // Assert
    expect(result).toMatchObject({
      id: "application-1",
      caseId: "case-1",
      applicationType: "Renewal",
      retroMonths: ["2026-02"],
    });
    expect(result.verification.isAppValidated).toBe(true);
    expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledTimes(1);
  });

  it("fails to update application if it belongs to a different case", async () => {
    // Arrange
    mockFileStorage.setData(
      createMockNormalizedFileData({
        cases: [createMockStoredCase({ id: "case-1" }), createMockStoredCase({ id: "case-2" })],
        applications: [createMockApplication({ id: "application-1", caseId: "case-2" })],
      }),
    );

    // Act & Assert
    await expect(
      service.updateApplication("case-1", "application-1", { applicationType: "Renewal" }),
    ).rejects.toThrow("Application does not belong to the specified case");
  });

  it("appends status history and updates the top-level status", async () => {
    // Arrange
    const initialApplication = createMockApplication({
      id: "application-1",
      caseId: "case-1",
      statusHistory: [
        {
          id: "history-1",
          status: "Pending",
          effectiveDate: "2026-01-01",
          changedAt: "2026-01-01T00:00:00.000Z",
          source: "migration",
        },
      ],
    });
    mockFileStorage.setData(
      createMockNormalizedFileData({
        cases: [createMockStoredCase({ id: "case-1" })],
        applications: [initialApplication],
      }),
    );

    // Act
    const result = await service.addStatusHistory("case-1", "application-1", {
      id: "history-2",
      status: "Approved",
      effectiveDate: "2026-02-01",
      changedAt: "2026-02-01T00:00:00.000Z",
      source: "user",
    });

    // Assert
    expect(result.status).toBe("Approved");
    expect(result.statusHistory).toHaveLength(initialApplication.statusHistory.length + 1);
    expect(result.statusHistory[1]).toMatchObject({
      id: "history-2",
      status: "Approved",
    });
  });

  it("fails to add status history if application belongs to a different case", async () => {
    // Arrange
    mockFileStorage.setData(
      createMockNormalizedFileData({
        cases: [createMockStoredCase({ id: "case-1" }), createMockStoredCase({ id: "case-2" })],
        applications: [createMockApplication({ id: "application-1", caseId: "case-2" })],
      }),
    );

    // Act & Assert
    await expect(
      service.addStatusHistory("case-1", "application-1", {
        id: "history-2",
        status: "Approved",
        effectiveDate: "2026-02-01",
        changedAt: "2026-02-01T00:00:00.000Z",
        source: "user",
      }),
    ).rejects.toThrow("Application does not belong to the specified case");
  });
});