import ts from "typescript";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { createMockCaseRecord } from "@/src/test/testUtils";
import { APPLICATION_STATUS } from "@/types/application";

import {
  APPLICATION_OWNED_CASE_RECORD_FIELDS,
  CASE_OWNED_AFTER_APPLICATION_MIGRATION_FIELDS,
  createCanonicalApplication,
  createMigratedApplication,
  deriveMigratedApplicationStatus,
  normalizeRetroRequestedAt,
  pickApplicationOwnedCaseRecordFields,
} from "../migration";

function createMigratedApplicationFromCaseRecord(
  caseRecord: ReturnType<typeof createMockCaseRecord>,
) {
  return createMigratedApplication({
    applicationId: "application-1",
    initialHistoryId: "history-1",
    caseId: "case-1",
    applicantPersonId: "person-1",
    migratedAt: "2026-04-06T10:00:00.000Z",
    caseRecord,
  });
}

function getCanonicalApplicationStatusTypeDiagnostics() {
  const projectRoot = process.cwd();
  const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, "tsconfig.json");

  if (!configPath) {
    throw new Error("Unable to locate tsconfig.json for canonical application status type test.");
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

  if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
  }

  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectRoot);
  const virtualFilePath = resolve(
    projectRoot,
    "domain/applications/__tests__/canonical-application-status.typecheck.ts",
  );
  const virtualSource = [
    'import { createCanonicalApplication } from "@/domain/applications/migration";',
    'import type { CaseStatus } from "@/types/case";',
    "",
    "const application = createCanonicalApplication({",
    '  applicationId: "application-1",',
    '  initialHistoryId: "history-1",',
    '  caseId: "case-1",',
    '  applicantPersonId: "person-1",',
    '  createdAt: "2026-04-09T00:00:00.000Z",',
    "  caseRecord: {",
    '    applicationDate: "2026-04-09",',
    '    applicationType: "Renewal",',
    "    withWaiver: false,",
    '    retroRequested: "",',
    "    appValidated: false,",
    "    retroMonths: [],",
    "    agedDisabledVerified: false,",
    "    citizenshipVerified: false,",
    "    residencyVerified: false,",
    '    avsConsentDate: "",',
    '    voterFormStatus: "",',
    "    intakeCompleted: true,",
    '    status: "Active",',
    "  },",
    "});",
    "",
    "const status: CaseStatus = application.status;",
    "const historyStatus: CaseStatus = application.statusHistory[0]!.status;",
    "",
    "export { status, historyStatus };",
  ].join("\n");

  const compilerOptions = {
    ...parsedConfig.options,
    noEmit: true,
  };
  const compilerHost = ts.createCompilerHost(compilerOptions, true);
  const originalGetSourceFile = compilerHost.getSourceFile.bind(compilerHost);

  compilerHost.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (resolve(fileName) === virtualFilePath) {
      return ts.createSourceFile(fileName, virtualSource, languageVersion, true);
    }

    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };

  compilerHost.readFile = (fileName) => (
    resolve(fileName) === virtualFilePath ? virtualSource : ts.sys.readFile(fileName)
  );
  compilerHost.fileExists = (fileName) => (
    resolve(fileName) === virtualFilePath || ts.sys.fileExists(fileName)
  );

  const program = ts.createProgram([virtualFilePath], compilerOptions, compilerHost);

  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => resolve(diagnostic.file?.fileName ?? "") === virtualFilePath)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
}

describe("APPLICATION_OWNED_CASE_RECORD_FIELDS", () => {
  it("captures the legacy case-record fields that migrate into applications", () => {
    // Arrange / Act
    const ownedFields = APPLICATION_OWNED_CASE_RECORD_FIELDS;

    // Assert
    expect(ownedFields).toHaveLength(12);
    expect(ownedFields.slice(0, 4)).toEqual([
      "applicationDate",
      "applicationType",
      "withWaiver",
      "retroRequested",
    ]);
    expect(ownedFields.slice(-3)).toEqual([
      "avsConsentDate",
      "voterFormStatus",
      "intakeCompleted",
    ]);
    expect(ownedFields).toContain("retroMonths");
    expect(ownedFields).toContain("citizenshipVerified");
  });
});

describe("CASE_OWNED_AFTER_APPLICATION_MIGRATION_FIELDS", () => {
  it("retains the long-lived case fields outside the application boundary", () => {
    // Arrange / Act
    const retainedFields = CASE_OWNED_AFTER_APPLICATION_MIGRATION_FIELDS;

    // Assert
    expect(retainedFields).toHaveLength(23);
    expect(retainedFields.slice(0, 6)).toEqual([
      "id",
      "mcn",
      "caseType",
      "personId",
      "spouseId",
      "status",
    ]);
    expect(retainedFields.slice(-4)).toEqual([
      "reviewPriorBudgets",
      "reviewPriorNarr",
      "pregnancy",
      "maritalStatus",
    ]);
    expect(retainedFields).toContain("authorizedReps");
    expect(retainedFields).toContain("contactMethods");
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

describe("createCanonicalApplication", () => {
  it("creates canonical applications using the case-status value directly without legacy application-status casts", () => {
    // ARRANGE
    const caseRecord = createMockCaseRecord({
      applicationDate: "2026-04-09",
      applicationType: "Renewal",
      withWaiver: false,
      retroRequested: "",
      appValidated: false,
      retroMonths: [],
      agedDisabledVerified: false,
      citizenshipVerified: false,
      residencyVerified: false,
      avsConsentDate: "",
      voterFormStatus: "",
      intakeCompleted: true,
      status: "Active",
      notes: [],
      financials: { resources: [], income: [], expenses: [] },
    });

    // ACT
    const application = createCanonicalApplication({
      applicationId: "application-1",
      initialHistoryId: "history-1",
      caseId: "case-1",
      applicantPersonId: "person-1",
      createdAt: "2026-04-09T00:00:00.000Z",
      caseRecord,
    });
    const diagnostics = getCanonicalApplicationStatusTypeDiagnostics();

    // ASSERT
    expect(application.status).toBe("Active");
    expect(application.statusHistory).toHaveLength(1);
    expect(application.statusHistory[0]).toMatchObject({ status: "Active" });
    expect(diagnostics).toEqual([]);
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
      hasWaiver: true,
      retroRequested: "2026-02-03",
      appValidated: true,
      retroMonths: ["2026-01", "2025-12"],
      agedDisabledVerified: false,
      citizenshipVerified: false,
      residencyVerified: false,
      avsConsentDate: "",
      voterFormStatus: "",
      intakeCompleted: false,
    });
  });

  it("clones retroMonths so mutations do not affect the source case record", () => {
    // Arrange
    const caseRecord = createMockCaseRecord({
      retroMonths: ["2026-01", "2025-12"],
      notes: [],
      financials: { resources: [], income: [], expenses: [] },
    });

    // Act
    const result = pickApplicationOwnedCaseRecordFields(caseRecord);
    result.retroMonths.push("2025-11");

    // Assert
    expect(result.retroMonths).not.toBe(caseRecord.retroMonths);
    expect(result.retroMonths).toEqual(["2026-01", "2025-12", "2025-11"]);
    expect(caseRecord.retroMonths).toEqual(["2026-01", "2025-12"]);
  });
});

describe("createMigratedApplication", () => {
  it("derives a normalized application record and initial migration history from a legacy case record", () => {
    // Arrange
    const caseRecord = createMockCaseRecord({
      id: "case-1",
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
    const result = createMigratedApplicationFromCaseRecord(caseRecord);

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
      hasWaiver: true,
      retroRequestedAt: "2026-02-03",
      retroMonths: ["2026-01"],
      verification: {
        isAppValidated: true,
        isAgedDisabledVerified: false,
        isCitizenshipVerified: true,
        isResidencyVerified: true,
        avsConsentDate: "",
        voterFormStatus: "",
        isIntakeCompleted: true,
      },
      createdAt: "2026-04-06T10:00:00.000Z",
      updatedAt: "2026-04-06T10:00:00.000Z",
    });
  });

  it("clones retroMonths so application mutations do not affect the source case record", () => {
    // Arrange
    const caseRecord = createMockCaseRecord({
      id: "case-1",
      retroMonths: ["2026-01"],
      notes: [],
      financials: { resources: [], income: [], expenses: [] },
    });

    // Act
    const result = createMigratedApplicationFromCaseRecord(caseRecord);
    result.retroMonths.push("2025-12");

    // Assert
    expect(result.retroMonths).not.toBe(caseRecord.retroMonths);
    expect(result.retroMonths).toEqual(["2026-01", "2025-12"]);
    expect(caseRecord.retroMonths).toEqual(["2026-01"]);
  });

  it("throws when the provided caseId does not match the source case record id", () => {
    // Arrange
    const caseRecord = createMockCaseRecord({
      id: "case-record-test-1",
      notes: [],
      financials: { resources: [], income: [], expenses: [] },
    });

    // Act
    const createApplication = () =>
      createMigratedApplication({
        applicationId: "application-1",
        initialHistoryId: "history-1",
        caseId: "case-1",
        applicantPersonId: "person-1",
        migratedAt: "2026-04-06T10:00:00.000Z",
        caseRecord,
      });

    // Assert
    expect(createApplication).toThrowError(
      'Cannot create migrated application: caseId "case-1" does not match caseRecord.id "case-record-test-1".',
    );
  });
});