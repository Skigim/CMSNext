import type { CaseRecord } from "@/types/case";
import {
  APPLICATION_STATUS,
  type Application,
  type ApplicationOwnedLegacyCaseRecordField,
  type ApplicationOwnedCaseRecordSnapshot,
  type ApplicationStatusHistory,
  type CaseOwnedAfterApplicationMigrationField,
  type MigratedApplicationStatusDecision,
} from "@/types/application";

export const APPLICATION_OWNED_CASE_RECORD_FIELDS = [
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
] as const satisfies readonly ApplicationOwnedLegacyCaseRecordField[];

export const CASE_OWNED_AFTER_APPLICATION_MIGRATION_FIELDS = [
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
] as const satisfies readonly CaseOwnedAfterApplicationMigrationField[];

export interface CreateMigratedApplicationInput {
  applicationId: string;
  initialHistoryId: string;
  caseId: string;
  applicantPersonId: string;
  migratedAt: string;
  caseRecord: CaseRecord;
}

export function deriveMigratedApplicationStatus(
  caseRecord: Pick<CaseRecord, "status">,
): MigratedApplicationStatusDecision {
  return {
    status: APPLICATION_STATUS.Pending,
    legacyCaseStatus: caseRecord.status,
    notes:
      "Migrated from legacy case-embedded application fields; v2.1 case status did not distinguish received, withdrawn, approved, or denied application outcomes.",
  };
}

export function normalizeRetroRequestedAt(
  retroRequested: string | null | undefined,
): string | null {
  const normalized = retroRequested?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function pickApplicationOwnedCaseRecordFields(
  caseRecord: CaseRecord,
): ApplicationOwnedCaseRecordSnapshot {
  return {
    applicationDate: caseRecord.applicationDate,
    applicationType: caseRecord.applicationType ?? "",
    hasWaiver: caseRecord.withWaiver,
    retroRequested: caseRecord.retroRequested,
    appValidated: caseRecord.appValidated ?? false,
    retroMonths: caseRecord.retroMonths ? [...caseRecord.retroMonths] : [],
    agedDisabledVerified: caseRecord.agedDisabledVerified ?? false,
    citizenshipVerified: caseRecord.citizenshipVerified ?? false,
    residencyVerified: caseRecord.residencyVerified ?? false,
    avsSubmitted: caseRecord.avsSubmitted ?? false,
    avsSubmitDate: caseRecord.avsSubmitDate ?? "",
    interfacesReviewed: caseRecord.interfacesReviewed ?? false,
    reviewVRs: caseRecord.reviewVRs ?? false,
    reviewPriorBudgets: caseRecord.reviewPriorBudgets ?? false,
    reviewPriorNarr: caseRecord.reviewPriorNarr ?? false,
    avsConsentDate: caseRecord.avsConsentDate ?? "",
    voterFormStatus: caseRecord.voterFormStatus ?? "",
    intakeCompleted: caseRecord.intakeCompleted,
  };
}

export function createMigratedApplicationStatusHistory(
  initialHistoryId: string,
  caseRecord: Pick<CaseRecord, "applicationDate" | "status">,
  migratedAt: string,
): ApplicationStatusHistory[] {
  const statusDecision = deriveMigratedApplicationStatus(caseRecord);

  return [
    {
      id: initialHistoryId,
      status: statusDecision.status,
      effectiveDate: caseRecord.applicationDate,
      changedAt: migratedAt,
      source: "migration",
      notes: statusDecision.notes,
    },
  ];
}

export function createMigratedApplication(
  input: CreateMigratedApplicationInput,
): Application {
  if (input.caseId !== input.caseRecord.id) {
    throw new Error(
      `Cannot create migrated application: caseId "${input.caseId}" does not match caseRecord.id "${input.caseRecord.id}".`,
    );
  }

  const applicationFields = pickApplicationOwnedCaseRecordFields(input.caseRecord);
  const statusHistory = createMigratedApplicationStatusHistory(
    input.initialHistoryId,
    {
      applicationDate: input.caseRecord.applicationDate,
      status: input.caseRecord.status,
    },
    input.migratedAt,
  );

  return {
    id: input.applicationId,
    caseId: input.caseId,
    applicantPersonId: input.applicantPersonId,
    applicationDate: applicationFields.applicationDate,
    applicationType: applicationFields.applicationType,
    status: statusHistory[0].status,
    statusHistory,
    hasWaiver: applicationFields.hasWaiver,
    retroRequestedAt: normalizeRetroRequestedAt(
      applicationFields.retroRequested,
    ),
    retroMonths: [...applicationFields.retroMonths],
    verification: {
      isAppValidated: applicationFields.appValidated,
      isAgedDisabledVerified: applicationFields.agedDisabledVerified,
      isCitizenshipVerified: applicationFields.citizenshipVerified,
      isResidencyVerified: applicationFields.residencyVerified,
      isAvsSubmitted: applicationFields.avsSubmitted,
      avsSubmitDate: applicationFields.avsSubmitDate,
      hasInterfacesReviewed: applicationFields.interfacesReviewed,
      reviewVRs: applicationFields.reviewVRs,
      reviewPriorBudgets: applicationFields.reviewPriorBudgets,
      reviewPriorNarr: applicationFields.reviewPriorNarr,
      avsConsentDate: applicationFields.avsConsentDate,
      voterFormStatus: applicationFields.voterFormStatus,
      isIntakeCompleted: applicationFields.intakeCompleted,
    },
    createdAt: input.migratedAt,
    updatedAt: input.migratedAt,
  };
}