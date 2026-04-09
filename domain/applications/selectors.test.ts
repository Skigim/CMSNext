import { describe, expect, it } from "vitest";

import {
  createMockApplication,
  createMockCaseRecord,
} from "@/src/test/testUtils";
import {
  pickApplicationOwnedCaseRecordFields,
  selectOldestNonTerminalApplication,
} from "@/domain/applications";

describe("selectOldestNonTerminalApplication", () => {
  it("selects the oldest non-terminal application by application date", () => {
    // Arrange
    const completionStatuses = new Set(["approved", "denied"]);
    const applications = [
      createMockApplication({
        id: "application-approved",
        applicationDate: "2026-01-01",
        status: "Approved",
      }),
      createMockApplication({
        id: "application-open-oldest",
        applicationDate: "2026-02-01",
        status: "Pending",
      }),
      createMockApplication({
        id: "application-open-newer",
        applicationDate: "2026-03-01",
        status: "Pending",
      }),
    ];

    // Act
    const result = selectOldestNonTerminalApplication(
      applications,
      completionStatuses,
    );

    // Assert
    expect(result?.id).toBe("application-open-oldest");
  });

  it("uses createdAt then id as deterministic fallbacks when application dates tie", () => {
    // Arrange
    const completionStatuses = new Set(["approved", "denied"]);
    const applications = [
      createMockApplication({
        id: "application-a-created-later",
        applicationDate: "2026-02-01",
        createdAt: "2026-02-03T00:00:00.000Z",
        status: "Pending",
      }),
      createMockApplication({
        id: "application-z-created-earlier",
        applicationDate: "2026-02-01",
        createdAt: "2026-02-02T00:00:00.000Z",
        status: "Pending",
      }),
      createMockApplication({
        id: "application-y-created-earlier",
        applicationDate: "2026-02-01",
        createdAt: "2026-02-02T00:00:00.000Z",
        status: "Pending",
      }),
    ];

    // Act
    const result = selectOldestNonTerminalApplication(
      applications,
      completionStatuses,
    );

    // Assert
    expect(result?.id).toBe("application-y-created-earlier");
  });

  it("prefers a valid application date over blank or invalid application dates", () => {
    // Arrange
    const completionStatuses = new Set(["approved", "denied"]);
    const applications = [
      createMockApplication({
        id: "application-blank-date",
        applicationDate: "",
        createdAt: "2026-02-01T00:00:00.000Z",
        status: "Pending",
      }),
      createMockApplication({
        id: "application-invalid-date",
        applicationDate: "not-a-date",
        createdAt: "2026-01-01T00:00:00.000Z",
        status: "Pending",
      }),
      createMockApplication({
        id: "application-valid-date",
        applicationDate: "2026-03-01",
        createdAt: "2026-04-01T00:00:00.000Z",
        status: "Pending",
      }),
    ];

    // Act
    const result = selectOldestNonTerminalApplication(
      applications,
      completionStatuses,
    );

    // Assert
    expect(result?.id).toBe("application-valid-date");
  });

  it("falls back to createdAt then id when application dates are blank or invalid", () => {
    // Arrange
    const completionStatuses = new Set(["approved", "denied"]);
    const applications = [
      createMockApplication({
        id: "application-a-created-later",
        applicationDate: "",
        createdAt: "2026-02-03T00:00:00.000Z",
        status: "Pending",
      }),
      createMockApplication({
        id: "application-z-created-earlier",
        applicationDate: "not-a-date",
        createdAt: "2026-02-02T00:00:00.000Z",
        status: "Pending",
      }),
      createMockApplication({
        id: "application-y-created-earlier",
        applicationDate: "",
        createdAt: "2026-02-02T00:00:00.000Z",
        status: "Pending",
      }),
    ];

    // Act
    const result = selectOldestNonTerminalApplication(
      applications,
      completionStatuses,
    );

    // Assert
    expect(result?.id).toBe("application-y-created-earlier");
  });

  it("returns null when every application is terminal", () => {
    // Arrange
    const completionStatuses = new Set(["approved", "denied"]);
    const applications = [
      createMockApplication({
        id: "application-approved",
        applicationDate: "2026-01-01",
        status: "Approved",
      }),
      createMockApplication({
        id: "application-denied",
        applicationDate: "2026-02-01",
        status: "Denied",
      }),
    ];

    // Act
    const result = selectOldestNonTerminalApplication(
      applications,
      completionStatuses,
    );

    // Assert
    expect(result).toBeNull();
  });
});

describe("pickApplicationOwnedCaseRecordFields", () => {
  it("excludes workflow review and AVS-processing fields from the canonical snapshot", () => {
    // Arrange
    const caseRecord = createMockCaseRecord({
      applicationDate: "2026-02-01",
      applicationType: "Renewal",
      withWaiver: true,
      retroRequested: "2026-02-03",
      retroMonths: ["2026-01", "2025-12"],
      appValidated: true,
      agedDisabledVerified: true,
      citizenshipVerified: true,
      residencyVerified: true,
      avsSubmitted: true,
      avsSubmitDate: "2026-02-04",
      interfacesReviewed: true,
      reviewVRs: true,
      reviewPriorBudgets: true,
      reviewPriorNarr: true,
      avsConsentDate: "2026-02-05",
      voterFormStatus: "requested",
      intakeCompleted: false,
      notes: [],
      financials: { resources: [], income: [], expenses: [] },
    });

    // Act
    const result = pickApplicationOwnedCaseRecordFields(caseRecord);

    // Assert
    expect(result).toEqual({
      applicationDate: "2026-02-01",
      applicationType: "Renewal",
      hasWaiver: true,
      retroRequested: "2026-02-03",
      appValidated: true,
      retroMonths: ["2026-01", "2025-12"],
      agedDisabledVerified: true,
      citizenshipVerified: true,
      residencyVerified: true,
      avsConsentDate: "2026-02-05",
      voterFormStatus: "requested",
      intakeCompleted: false,
    });
  });
});