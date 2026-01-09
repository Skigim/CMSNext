/**
 * Alert Domain Module - Core Types and Interfaces
 *
 * Type definitions for alert matching and workflow management.
 *
 * @module domain/alerts/types
 */

import type {
  AlertRecord,
  AlertWorkflowStatus,
  CaseDisplay,
  CaseStatus,
} from "@/types/case";

export type AlertMatchStatus = "matched" | "unmatched" | "missing-mcn";

/**
 * Minimal case interface for alert matching
 * Compatible with both CaseDisplay and StoredCase
 */
export interface CaseForAlertMatching {
  id: string;
  name: string;
  mcn: string;
  status: CaseStatus;
  caseRecord?: {
    mcn?: string;
  };
}

export interface AlertWithMatch extends AlertRecord {
  matchStatus: AlertMatchStatus;
  matchedCaseId?: string;
  matchedCaseName?: string;
  matchedCaseStatus?: CaseDisplay["status"];
}

export interface AlertsSummary {
  total: number;
  matched: number;
  unmatched: number;
  missingMcn: number;
  latestUpdated?: string | null;
}

export interface AlertsIndex {
  alerts: AlertWithMatch[];
  summary: AlertsSummary;
  alertsByCaseId: Map<string, AlertWithMatch[]>;
  unmatched: AlertWithMatch[];
  missingMcn: AlertWithMatch[];
}

export const workflowPriorityOrder: AlertWorkflowStatus[] = [
  "new",
  "in-progress",
  "acknowledged",
  "snoozed",
  "resolved",
];
