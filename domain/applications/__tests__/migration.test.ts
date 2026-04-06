import { describe, expect, it } from "vitest";

import { createMockCaseRecord } from "@/src/test/testUtils";
import { APPLICATION_STATUS } from "@/types/application";

import {
  APPLICATION_OWNED_CASE_RECORD_FIELDS,
  CASE_OWNED_AFTER_APPLICATION_MIGRATION_FIELDS,
  createMigratedApplication,
  deriveMigratedApplicationStatus,
  normalizeRetroRequestedAt,
  pickApplicationOwnedCaseRecordFields,
} from "../migration";

describe("APPLICATION_OWNED_CASE_RECORD_FIELDS", () => {
  it("captures the legacy case-record fields that migrate into applications", () => {
    // Arrange / Act
    const ownedFields = APPLICATION_OWNED_CASE_RECORD_FIELDS;

    // Assert
    expect(ownedFields).toEqual([
      "applicationDate",
      "applicationType",
      "withWaiver",
      "retroRequested",
      "appValidated",
      "retroMonths",
      "agedDisabledVerified",
      "citizenshipVerified",
      "residencyVerified",
      "avsSubmitted",
      "avsSubmitDate",
      "interfacesReviewed",
      "reviewVRs",
      "reviewPriorBudgets",
      "reviewPriorNarr",
      "avsConsentDate",
      "voterFormStatus",
      "intakeCompleted",
    ]);
  });
});

describe("CASE_OWNED_AFTER_APPLICATION_MIGRATION_FIELDS", () => {
  it("retains the long-lived case fields outside the application boundary", () => {
    // Arrange / Act
    const retainedFields = CASE_OWNED_AFTER_APPLICATION_MIGRATION_FIELDS;

    // Assert
    expect(retainedFields).toEqual([
      "id",
      "mcn",
      "caseType",
      "personId",
      "spouseId",
      "status",
      "description",
      "priority",
      "livingArrangement",
      "admissionDate",
      "organizationId",
      "authorizedReps",
      "createdDate",
      "updatedDate",
      "contactMethods",
      "pregnancy",
      "maritalStatus",
    ]);
  });
});

describe("normalizeRetroRequestedAt", () => {
  it("returns null for blank legacy values and preserves populated dates", () => {
    // Arrange / Act
    const blankResult = normalizeRetroRequestedAt("   ");
    const valueResult = normalizeRetroRequestedAt("2026-03-15");

    // Assert
    expect(blankResult).toBeNull();
    expect(valueResult).toBe("2026-03-15");
  });
});

describe("deriveMigratedApplicationStatus", () => {
  it("uses a conservative pending status because legacy case data lacks application outcomes", () => {
    // Arrange
    const caseRecord = createMockCaseRecord({ status: "Closed" });

    // Act
    const result = deriveMigratedApplicationStatus(caseRecord);

    // Assert
    expect(result).toEqual({
      status: APPLICATION_STATUS.Pending,
      legacyCaseStatus: "Closed",
      notes:
        "Migrated from legacy case-embedded application fields; v2.1 case status did not distinguish received, withdrawn, approved, or denied application outcomes.",
    });
  });
});

describe("pickApplicationOwnedCaseRecordFields", () => {
  it("extracts only application-owned legacy fields and normalizes optional defaults", () => {
    // Arrange
    const caseRecord = createMockCaseRecord({
      applicationDate: "2026-02-01",
      applicationType: "Renewal",
      withWaiver: true,
      retroRequested: "2026-02-03",
      retroMonths: ["2026-01", "2025-12"],
      appValidated: true,
      avsSubmitted: true,
      avsSubmitDate: "2026-02-04",
      reviewVRs: true,
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
      withWaiver: true,
      retroRequested: "2026-02-03",
      appValidated: true,
      retroMonths: ["2026-01", "2025-12"],
      agedDisabledVerified: false,
      citizenshipVerified: false,
      residencyVerified: false,
      avsSubmitted: true,
      avsSubmitDate: "2026-02-04",
      interfacesReviewed: false,
      reviewVRs: true,
      reviewPriorBudgets: false,
      reviewPriorNarr: false,
      avsConsentDate: "",
      voterFormStatus: "",
      intakeCompleted: false,
    });
  });
});

describe("createMigratedApplication", () => {
  it("derives a normalized application record and initial migration history from a legacy case record", () => {
    // Arrange
    const caseRecord = createMockCaseRecord({
      applicationDate: "2026-02-01",
      applicationType: "New",
      withWaiver: true,
      retroRequested: "2026-02-03",
      retroMonths: ["2026-01"],
      appValidated: true,
      citizenshipVerified: true,
      residencyVerified: true,
      notes: [],
      financials: { resources: [], income: [], expenses: [] },
    });

    // Act
    const result = createMigratedApplication({
      applicationId: "application-1",
      initialHistoryId: "history-1",
      caseId: "case-1",
      applicantPersonId: "person-1",
      migratedAt: "2026-04-06T10:00:00.000Z",
      caseRecord,
    });

    // Assert
    expect(result).toEqual({
      id: "application-1",
      caseId: "case-1",
      applicantPersonId: "person-1",
      applicationDate: "2026-02-01",
      applicationType: "New",
      status: APPLICATION_STATUS.Pending,
      statusHistory: [
        {
          id: "history-1",
          status: APPLICATION_STATUS.Pending,
          effectiveDate: "2026-02-01",
          changedAt: "2026-04-06T10:00:00.000Z",
          source: "migration",
          notes:
            "Migrated from legacy case-embedded application fields; v2.1 case status did not distinguish received, withdrawn, approved, or denied application outcomes.",
        },
      ],
      withWaiver: true,
      retroRequestedAt: "2026-02-03",
      retroMonths: ["2026-01"],
      verification: {
        appValidated: true,
        agedDisabledVerified: false,
        citizenshipVerified: true,
        residencyVerified: true,
        avsSubmitted: false,
        avsSubmitDate: "",
        interfacesReviewed: false,
        reviewVRs: false,
        reviewPriorBudgets: false,
        reviewPriorNarr: false,
        avsConsentDate: "",
        voterFormStatus: "",
        intakeCompleted: true,
      },
      createdAt: "2026-04-06T10:00:00.000Z",
      updatedAt: "2026-04-06T10:00:00.000Z",
    });
  });
});