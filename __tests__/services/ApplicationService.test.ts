import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTouchedCaseTimestamps,
  createClockSkewTouchCaseTimestamps,
  createMockApplication,
  createMockNormalizedFileData,
  createMockStoredCase,
  TEST_SKEWED_TRANSACTION_TIMESTAMP,
  TEST_TRANSACTION_TIMESTAMP,
  withFrozenSystemTime,
} from "@/src/test/testUtils";
import type { Application } from "@/types/application";
import {
  ApplicationService,
  type ApplicationFileStorage,
} from "@/utils/services/ApplicationService";
import type { NormalizedFileData } from "@/utils/services/FileStorageService";

type ApplicationServiceFileStorageMock = ApplicationFileStorage;

function createMockFileStorage() {
  let storedData = createMockNormalizedFileData({
    cases: [
      createMockStoredCase({
        id: "case-1",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ],
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

  const getApplicationsForCase = vi
    .fn<(data: NormalizedFileData, caseId: string) => Application[]>()
    .mockImplementation((data, caseId) =>
      (data.applications ?? []).filter((application) => application.caseId === caseId),
    );

  const touchCaseTimestamps = vi
    .fn<
      (
        cases: NormalizedFileData["cases"],
        touchedCaseIds?: Iterable<string>,
        timestampOverride?: string,
      ) => NormalizedFileData["cases"]
    >()
    .mockImplementation(applyTouchedCaseTimestamps);

  return {
    readFileData,
    writeNormalizedData,
    getApplicationsForCase,
    touchCaseTimestamps,
    setData: (data: typeof storedData) => {
      storedData = data;
    },
  } satisfies ApplicationServiceFileStorageMock & {
    setData: (data: NormalizedFileData) => void;
  };
}

describe("ApplicationService", () => {
  let service: ApplicationService;
  let mockFileStorage: ReturnType<typeof createMockFileStorage>;

  beforeEach(() => {
    mockFileStorage = createMockFileStorage();
    service = new ApplicationService({
      fileStorage: mockFileStorage,
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
    const writtenData = mockFileStorage.writeNormalizedData.mock.calls[0][0];
    expect(writtenData.applications).toHaveLength(2);
    expect(writtenData.activityLog).toHaveLength(1);
    expect(writtenData.activityLog[0]).toMatchObject({
      caseId: "case-1",
      type: "application-added",
      payload: {
        applicationId: "application-2",
        applicationType: application.applicationType,
        status: application.status,
      },
    });
    expect(writtenData.cases[0].updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
  });

  it("reuses one transaction timestamp when adding an application", async () => {
    // Arrange
    const application = createMockApplication({
      id: "application-2",
      caseId: "case-1",
    });

    mockFileStorage.touchCaseTimestamps.mockImplementation(
      createClockSkewTouchCaseTimestamps(TEST_SKEWED_TRANSACTION_TIMESTAMP),
    );

    await withFrozenSystemTime(TEST_TRANSACTION_TIMESTAMP, async () => {
      // Act
      await service.addApplication(application);
    });

    // Assert
    expect(mockFileStorage.touchCaseTimestamps).toHaveBeenCalledWith(
      expect.any(Array),
      ["case-1"],
      TEST_TRANSACTION_TIMESTAMP,
    );
    const writtenData = mockFileStorage.writeNormalizedData.mock.calls[0][0];
    expect(writtenData.cases[0].updatedAt).toBe(TEST_TRANSACTION_TIMESTAMP);
    expect(writtenData.activityLog[0].timestamp).toBe(TEST_TRANSACTION_TIMESTAMP);
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
    const writtenData = mockFileStorage.writeNormalizedData.mock.calls[0][0];
    expect(writtenData.activityLog).toHaveLength(1);
    expect(writtenData.activityLog[0]).toMatchObject({
      caseId: "case-1",
      type: "application-updated",
      payload: {
        applicationId: "application-1",
        changedFields: expect.arrayContaining([
          "applicationType",
          "retroMonths",
          "verification",
        ]),
      },
    });
    expect(writtenData.cases[0].updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
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

  it("fails to update an application that does not exist", async () => {
    // Arrange

    // Act & Assert
    await expect(
      service.updateApplication("case-1", "application-missing", {
        applicationType: "Renewal",
      }),
    ).rejects.toThrow("Application not found");
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
    expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledTimes(1);
    const writtenData = mockFileStorage.writeNormalizedData.mock.calls[0][0];
    expect(writtenData.activityLog).toHaveLength(1);
    expect(writtenData.activityLog[0]).toMatchObject({
      caseId: "case-1",
      type: "application-status-change",
      payload: {
        applicationId: "application-1",
        fromStatus: "Pending",
        toStatus: "Approved",
        effectiveDate: "2026-02-01",
        source: "user",
      },
    });
    expect(writtenData.cases[0].updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
  });

  it("reuses one transaction timestamp when appending application status history", async () => {
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

    mockFileStorage.touchCaseTimestamps.mockImplementation(
      createClockSkewTouchCaseTimestamps(TEST_SKEWED_TRANSACTION_TIMESTAMP),
    );

    await withFrozenSystemTime(TEST_TRANSACTION_TIMESTAMP, async () => {
      // Act
      await service.addStatusHistory("case-1", "application-1", {
        id: "history-2",
        status: "Approved",
        effectiveDate: "2026-04-08",
        changedAt: TEST_TRANSACTION_TIMESTAMP,
        source: "user",
      });
    });

    // Assert
    expect(mockFileStorage.touchCaseTimestamps).toHaveBeenCalledWith(
      expect.any(Array),
      ["case-1"],
      TEST_TRANSACTION_TIMESTAMP,
    );
    const writtenData = mockFileStorage.writeNormalizedData.mock.calls[0][0];
    expect(writtenData.cases[0].updatedAt).toBe(TEST_TRANSACTION_TIMESTAMP);
    expect(writtenData.activityLog[0].timestamp).toBe(TEST_TRANSACTION_TIMESTAMP);
    expect(writtenData.applications?.[0].updatedAt).toBe(TEST_TRANSACTION_TIMESTAMP);
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