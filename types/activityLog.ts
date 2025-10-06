export type CaseActivityType = "status-change" | "note-added";

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

export interface CaseNoteAddedActivity extends CaseActivityBase {
  type: "note-added";
  payload: {
    noteId: string;
    category: string;
    preview: string;
    content?: string;
  };
}

export type CaseActivityEntry = CaseStatusChangeActivity | CaseNoteAddedActivity;

export interface DailyCaseActivityBreakdown {
  caseId: string;
  caseName: string;
  caseMcn?: string | null;
  statusChanges: number;
  notesAdded: number;
  entries: CaseActivityEntry[];
}

export interface DailyActivityReport {
  date: string;
  totals: {
    total: number;
    statusChanges: number;
    notesAdded: number;
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
