import { CASE_STATUS, type CaseStatus, type CaseRecord, type VoterFormStatus } from "@/types/case";

export const APPLICATION_STATUS = {
  Active: CASE_STATUS.Active,
  Pending: CASE_STATUS.Pending,
  Closed: CASE_STATUS.Closed,
  Archived: CASE_STATUS.Archived,
} as const;

export type ApplicationStatus = CaseStatus;

export type ApplicationStatusHistorySource = "migration" | "user";

export interface ApplicationStatusHistory {
  id: string;
  status: ApplicationStatus;
  effectiveDate: string;
  changedAt: string;
  source: ApplicationStatusHistorySource;
  notes?: string;
}

export interface ApplicationVerificationSnapshot {
  isAppValidated: boolean;
  isAgedDisabledVerified: boolean;
  isCitizenshipVerified: boolean;
  isResidencyVerified: boolean;
  avsConsentDate: string;
  voterFormStatus: VoterFormStatus;
  isIntakeCompleted: boolean;
}

export interface ApplicationOwnedCaseRecordSnapshot {
  applicationDate: string;
  applicationType: string;
  hasWaiver: boolean;
  retroRequested: string;
  appValidated: boolean;
  retroMonths: string[];
  agedDisabledVerified: boolean;
  citizenshipVerified: boolean;
  residencyVerified: boolean;
  avsConsentDate: string;
  voterFormStatus: VoterFormStatus;
  intakeCompleted: boolean;
}

export interface Application {
  id: string;
  caseId: string;
  applicantPersonId: string;
  applicationDate: string;
  applicationType: string;
  status: ApplicationStatus;
  statusHistory: ApplicationStatusHistory[];
  hasWaiver: boolean;
  retroRequestedAt: string | null;
  retroMonths: string[];
  verification: ApplicationVerificationSnapshot;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationOwnedLegacyCaseRecordField =
  | "applicationDate"
  | "applicationType"
  | "withWaiver"
  | "retroRequested"
  | "appValidated"
  | "retroMonths"
  | "agedDisabledVerified"
  | "citizenshipVerified"
  | "residencyVerified"
  | "avsConsentDate"
  | "voterFormStatus"
  | "intakeCompleted";

export type CaseOwnedAfterApplicationMigrationField = Exclude<
  keyof CaseRecord,
  ApplicationOwnedLegacyCaseRecordField | "financials" | "notes"
>;

export interface MigratedApplicationStatusDecision {
  status: ApplicationStatus;
  notes: string;
  legacyCaseStatus: CaseStatus;
}