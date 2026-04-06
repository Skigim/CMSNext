import type { CaseStatus, CaseRecord, VoterFormStatus } from "@/types/case";

export const APPLICATION_STATUS = {
  Received: "Received",
  Pending: "Pending",
  Withdrawn: "Withdrawn",
  Approved: "Approved",
  Denied: "Denied",
} as const;

export type ApplicationStatus =
  (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];

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
  isAvsSubmitted: boolean;
  avsSubmitDate: string;
  hasInterfacesReviewed: boolean;
  reviewVRs: boolean;
  reviewPriorBudgets: boolean;
  reviewPriorNarr: boolean;
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
  avsSubmitted: boolean;
  avsSubmitDate: string;
  interfacesReviewed: boolean;
  reviewVRs: boolean;
  reviewPriorBudgets: boolean;
  reviewPriorNarr: boolean;
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
  | "avsSubmitted"
  | "avsSubmitDate"
  | "interfacesReviewed"
  | "reviewVRs"
  | "reviewPriorBudgets"
  | "reviewPriorNarr"
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