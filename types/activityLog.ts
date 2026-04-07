import type { ApplicationStatus, ApplicationStatusHistorySource } from "./application";

interface CaseActivityBase {
  id: string;
  timestamp: string;
  caseId: string;
  caseName: string;
  caseMcn?: string | null;
}

export interface CaseStatusChangeActivity extends CaseActivityBase {
  type: "status-change";
  payload: {
    fromStatus?: string | null;
    toStatus: string;
  };
}

export interface CasePriorityChangeActivity extends CaseActivityBase {
  type: "priority-change";
  payload: {
    fromPriority: boolean;
    toPriority: boolean;
  };
}

export interface CaseNoteAddedActivity extends CaseActivityBase {
  type: "note-added";
  payload: {
    noteId: string;
    category: string;
    preview: string;
    content?: string;
  };
}

export interface CaseViewedActivity extends CaseActivityBase {
  type: "case-viewed";
  payload: Record<string, never>;
}

export interface CaseApplicationAddedActivity extends CaseActivityBase {
  type: "application-added";
  payload: {
    applicationId: string;
    applicationType: string;
    status: ApplicationStatus;
    applicationDate: string;
  };
}

export interface CaseApplicationUpdatedActivity extends CaseActivityBase {
  type: "application-updated";
  payload: {
    applicationId: string;
    changedFields: string[];
  };
}

export interface CaseApplicationStatusChangeActivity extends CaseActivityBase {
  type: "application-status-change";
  payload: {
    applicationId: string;
    fromStatus: ApplicationStatus;
    toStatus: ApplicationStatus;
    effectiveDate: string;
    source: ApplicationStatusHistorySource;
  };
}

export type CaseActivityEntry =
  | CaseStatusChangeActivity
  | CaseNoteAddedActivity
  | CasePriorityChangeActivity
  | CaseViewedActivity
  | CaseApplicationAddedActivity
  | CaseApplicationUpdatedActivity
  | CaseApplicationStatusChangeActivity;

export interface DailyCaseActivityBreakdown {
  caseId: string;
  caseName: string;
  caseMcn?: string | null;
  statusChanges: number;
  priorityChanges: number;
  notesAdded: number;
  applicationChanges: number;
  entries: CaseActivityEntry[];
}

export interface DailyActivityReport {
  date: string;
  totals: {
    total: number;
    statusChanges: number;
    priorityChanges: number;
    notesAdded: number;
    applicationChanges: number;
  };
  entries: CaseActivityEntry[];
  cases: DailyCaseActivityBreakdown[];
}

export type ActivityReportFormat = "json" | "csv" | "txt";

export interface CaseActivityLogState {
  activityLog: CaseActivityEntry[];
  dailyReports: DailyActivityReport[];
  todayReport: DailyActivityReport | null;
  yesterdayReport: DailyActivityReport | null;
  loading: boolean;
  error: string | null;
  refreshActivityLog: () => Promise<void>;
  getReportForDate: (date: string | Date) => DailyActivityReport;
  clearReportForDate: (date: string | Date) => Promise<number>;
}
