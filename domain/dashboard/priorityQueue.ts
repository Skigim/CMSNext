/**
 * @fileoverview Priority Queue Domain Logic
 * 
 * Pure functions for calculating case priority scores and reasons.
 * Used by Today's Work widget to surface cases requiring immediate attention.
 * 
 * Priority Criteria (in order of weight):
 * 1. Intake status cases (5000 points)
 * 2. AVS Day 5 alerts (500 points each)
 * 3. Verification Due / VR Due alerts (400 points each)
 * 4. Mail Rcvd on Closed alerts (400 points each)
 * 5. Other unresolved alerts (100 points each)
 * 6. Application age (30 points per day since application)
 * 7. Alert age (50 points per day since oldest alert)
 * 8. Priority flags (75 points)
 * 9. Recent modifications (50 points)
 */

import type { StoredCase } from '../../types/case';
import type { AlertWithMatch } from '../../utils/alertsData';
import { parseLocalDate } from '../../utils/dateFormatting';

// ============================================================================
// Priority Scoring Constants
// ============================================================================

/** Points for cases with Intake status */
export const SCORE_INTAKE = 5000;
/** Points per AVS Day 5 alert */
export const SCORE_AVS_DAY_5 = 500;
/** Points per Verification Due alert */
export const SCORE_VERIFICATION_DUE = 400;
/** Points per Mail Rcvd on Closed alert */
export const SCORE_MAIL_RCVD_CLOSED = 400;
/** Points per other unresolved alert */
export const SCORE_OTHER_ALERT = 100;
/** Points per day since application date */
export const SCORE_PER_DAY_SINCE_APPLICATION = 30;
/** Points per day since oldest alert date */
export const SCORE_PER_DAY_ALERT_AGE = 50;
/** Points for cases marked as priority */
export const SCORE_PRIORITY_FLAG = 75;
/** Points for cases modified in last 24 hours */
export const SCORE_RECENT_MODIFICATION = 50;

/**
 * Case with priority scoring information
 */
export interface PriorityCase {
  case: StoredCase;
  score: number;
  reason: string;
}

/**
 * Alert type classifications for priority scoring
 */
export type AlertPriorityType = 
  | 'avs-day-5'
  | 'verification-due'
  | 'mail-rcvd-closed'
  | 'other';

/**
 * Check if alert description matches AVS Day 5 pattern.
 * Matches: "Day 5 AVS", "5 Day AVS", "AVS Day 5", etc.
 */
export function isAvsDay5Alert(description: string | undefined): boolean {
  if (!description) return false;
  const upper = description.toUpperCase();
  return upper.includes('AVS') && upper.includes('5');
}

/**
 * Check if alert description matches Verification Due pattern.
 * Matches: "VERIFICATION DUE", "VR DUE"
 */
export function isVerificationDueAlert(description: string | undefined): boolean {
  if (!description) return false;
  const upper = description.toUpperCase();
  return upper.includes('VERIFICATION DUE') || upper.includes('VR DUE');
}

/**
 * Check if alert description matches Mail Rcvd on Closed pattern.
 * Matches any description containing both "mail" and "closed" (case insensitive).
 */
export function isMailRcvdClosedAlert(description: string | undefined): boolean {
  if (!description) return false;
  const upper = description.toUpperCase();
  return upper.includes('MAIL') && upper.includes('CLOSED');
}

/**
 * Classify an alert by priority type.
 */
export function classifyAlert(alert: AlertWithMatch): AlertPriorityType {
  const desc = alert.description;
  if (isAvsDay5Alert(desc)) return 'avs-day-5';
  if (isVerificationDueAlert(desc)) return 'verification-due';
  if (isMailRcvdClosedAlert(desc)) return 'mail-rcvd-closed';
  return 'other';
}

/**
 * Get score for an alert based on its type.
 */
export function getAlertScore(alert: AlertWithMatch): number {
  const type = classifyAlert(alert);
  switch (type) {
    case 'avs-day-5': return SCORE_AVS_DAY_5;
    case 'verification-due': return SCORE_VERIFICATION_DUE;
    case 'mail-rcvd-closed': return SCORE_MAIL_RCVD_CLOSED;
    case 'other': return SCORE_OTHER_ALERT;
  }
}

/**
 * Calculate days since application date.
 * Returns 0 if application date is missing, invalid, or in the future.
 * 
 * @param applicationDate - Application date string (yyyy-MM-dd or ISO timestamp)
 * @param now - Current date (for testing, defaults to now)
 * @returns Number of days since application (0 or positive)
 */
export function getDaysSinceApplication(
  applicationDate: string | undefined,
  now: Date = new Date()
): number {
  if (!applicationDate) return 0;
  
  const appDate = parseLocalDate(applicationDate);
  if (!appDate) return 0;
  
  // Calculate difference in days
  const diffMs = now.getTime() - appDate.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  
  // Return 0 if application is in the future
  return Math.max(0, diffDays);
}

/**
 * Get the oldest alert date from a list of alerts.
 * Returns undefined if no alerts or all alerts have invalid dates.
 * 
 * @param alerts - Array of alerts to check
 * @returns The oldest alert date string, or undefined
 */
export function getOldestAlertDate(
  alerts: AlertWithMatch[]
): string | undefined {
  if (!alerts || alerts.length === 0) return undefined;
  
  let oldestDate: Date | null = null;
  let oldestDateStr: string | undefined;
  
  for (const alert of alerts) {
    const alertDate = alert.alertDate;
    if (!alertDate) continue;
    
    const parsed = parseLocalDate(alertDate);
    if (!parsed) continue;
    
    if (!oldestDate || parsed.getTime() < oldestDate.getTime()) {
      oldestDate = parsed;
      oldestDateStr = alertDate;
    }
  }
  
  return oldestDateStr;
}

/**
 * Calculate days since the oldest alert.
 * Only considers the oldest alert to avoid inflating scores for cases with many alerts.
 * Returns 0 if no alerts or all alerts have invalid dates.
 * 
 * @param alerts - Array of alerts to check
 * @param now - Current date (for testing, defaults to now)
 * @returns Number of days since oldest alert (0 or positive)
 */
export function getDaysSinceOldestAlert(
  alerts: AlertWithMatch[],
  now: Date = new Date()
): number {
  const oldestDate = getOldestAlertDate(alerts);
  if (!oldestDate) return 0;
  
  const parsed = parseLocalDate(oldestDate);
  if (!parsed) return 0;
  
  const diffMs = now.getTime() - parsed.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  
  return Math.max(0, diffDays);
}

/**
 * Calculate priority score for a case.
 * Higher score = higher priority.
 * 
 * Scoring formula:
 * - 5000 points if case status is "Intake"
 * - 500 points per AVS Day 5 alert
 * - 400 points per Verification Due / VR Due alert
 * - 400 points per Mail Rcvd on Closed alert
 * - 100 points per other unresolved alert
 * - 30 points per day since application date
 * - 50 points per day since oldest alert (uses only oldest to avoid inflating multi-alert cases)
 * - 75 points if marked as priority
 * - 50 points if modified in last 24 hours
 * 
 * @param caseData - The case to score
 * @param caseAlerts - Alerts associated with this case (unresolved only)
 * @returns Priority score (0 or higher)
 */
export function calculatePriorityScore(
  caseData: StoredCase,
  caseAlerts: AlertWithMatch[]
): number {
  let score = 0;

  // Intake status
  if (caseData.status?.toLowerCase() === 'intake') {
    score += SCORE_INTAKE;
  }

  // Score each alert based on type
  for (const alert of caseAlerts) {
    score += getAlertScore(alert);
  }

  // Points per day since application date
  const daysSinceApp = getDaysSinceApplication(caseData.caseRecord?.applicationDate);
  score += daysSinceApp * SCORE_PER_DAY_SINCE_APPLICATION;

  // Points per day since oldest alert (use only oldest to avoid inflating multi-alert cases)
  const daysSinceAlert = getDaysSinceOldestAlert(caseAlerts);
  score += daysSinceAlert * SCORE_PER_DAY_ALERT_AGE;

  // Priority flag
  if (caseData.priority === true) {
    score += SCORE_PRIORITY_FLAG;
  }

  // Recent modification (within 24 hours)
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const updatedAt = new Date(caseData.updatedAt);
  if (updatedAt >= oneDayAgo) {
    score += SCORE_RECENT_MODIFICATION;
  }

  return score;
}

/**
 * Get human-readable reason for why a case is prioritized.
 * Returns the most important reason (highest priority criterion met).
 * 
 * @param caseData - The case to analyze
 * @param caseAlerts - Alerts associated with this case (unresolved only)
 * @returns Human-readable priority reason
 */
export function getPriorityReason(
  caseData: StoredCase,
  caseAlerts: AlertWithMatch[]
): string {
  // Check Intake status first (highest priority)
  if (caseData.status?.toLowerCase() === 'intake') {
    return 'Intake - needs processing';
  }

  // Check for high-priority alert types
  const avsDay5Count = caseAlerts.filter(a => isAvsDay5Alert(a.description)).length;
  const verificationDueCount = caseAlerts.filter(a => isVerificationDueAlert(a.description)).length;
  const mailRcvdCount = caseAlerts.filter(a => isMailRcvdClosedAlert(a.description)).length;

  if (avsDay5Count > 0) {
    return avsDay5Count === 1 
      ? 'AVS Day 5 alert' 
      : `${avsDay5Count} AVS Day 5 alerts`;
  }

  if (verificationDueCount > 0) {
    return verificationDueCount === 1 
      ? 'Verification due' 
      : `${verificationDueCount} verification alerts`;
  }

  if (mailRcvdCount > 0) {
    return mailRcvdCount === 1 
      ? 'Mail received on closed case' 
      : `${mailRcvdCount} mail rcvd alerts`;
  }

  // Check other unresolved alerts
  if (caseAlerts.length > 0) {
    const alertCount = caseAlerts.length;
    return alertCount === 1
      ? '1 unresolved alert'
      : `${alertCount} unresolved alerts`;
  }

  // Check priority flag
  if (caseData.priority === true) {
    return 'Marked as priority';
  }

  // Check application age (significant if > 7 days)
  const daysSinceApp = getDaysSinceApplication(caseData.caseRecord?.applicationDate);
  if (daysSinceApp >= 7) {
    return `${daysSinceApp} days since application`;
  }

  // Check recent modification
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const updatedAt = new Date(caseData.updatedAt);
  if (updatedAt >= oneDayAgo) {
    return 'Modified today';
  }

  // Application age less than 7 days
  if (daysSinceApp > 0) {
    return `${daysSinceApp} day${daysSinceApp === 1 ? '' : 's'} since application`;
  }

  // Fallback (should not happen if score > 0)
  return 'Needs attention';
}

/**
 * Statuses that should be excluded from priority queue.
 * These cases are either completed or don't require active work.
 */
export const EXCLUDED_STATUSES = [
  'denied',
  'spenddown',
  'closed',
  'active',
  'approved',
] as const;

/**
 * Check if a case status should be excluded from the priority queue.
 */
export function isExcludedStatus(status: string | undefined): boolean {
  if (!status) return false;
  return EXCLUDED_STATUSES.includes(status.toLowerCase() as typeof EXCLUDED_STATUSES[number]);
}

/**
 * Get prioritized cases sorted by priority score.
 * Only returns cases with score > 0 and non-excluded statuses.
 * 
 * @param cases - All cases to analyze
 * @param alertsIndex - Alerts index with mapping by case ID
 * @param limit - Maximum number of cases to return (default: 10)
 * @returns Sorted array of priority cases (highest score first)
 */
export function getPriorityCases(
  cases: StoredCase[],
  alertsIndex: { alertsByCaseId: Map<string, AlertWithMatch[]> },
  limit: number = 10
): PriorityCase[] {
  // Calculate scores for all cases (excluding terminal statuses)
  const scoredCases: PriorityCase[] = cases
    // Filter out excluded statuses first
    .filter((caseData) => !isExcludedStatus(caseData.status))
    .map((caseData) => {
      const caseAlerts = alertsIndex.alertsByCaseId.get(caseData.id) || [];
      // Filter to only unresolved alerts
      const unresolvedAlerts = caseAlerts.filter(
        (alert) =>
          alert.status?.toLowerCase() !== 'resolved' && !alert.resolvedAt
      );

      const score = calculatePriorityScore(caseData, unresolvedAlerts);
      const reason = getPriorityReason(caseData, unresolvedAlerts);

      return {
        case: caseData,
        score,
        reason,
      };
    })
    // Only include cases with score > 0
    .filter((pc) => pc.score > 0);

  // Sort by score (highest first), then by updatedAt (most recent first)
  scoredCases.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return new Date(b.case.updatedAt).getTime() - new Date(a.case.updatedAt).getTime();
  });

  // Return top N cases
  return scoredCases.slice(0, limit);
}
