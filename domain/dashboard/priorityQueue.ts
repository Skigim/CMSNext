/**
 * @fileoverview Priority Queue Domain Logic
 * 
 * Pure functions for calculating case priority scores and reasons.
 * Used by Today's Work widget to surface cases requiring immediate attention.
 * 
 * Priority Criteria (in order of weight):
 * 1. Intake status cases (1000 points)
 * 2. AVS Day 5 alerts (500 points each)
 * 3. Verification Due / VR Due alerts (400 points each)
 * 4. Mail Rcvd on Closed alerts (400 points each)
 * 5. Other unresolved alerts (100 points each)
 * 6. Application age (30 points per day since application)
 * 7. Priority flags (75 points)
 * 8. Recent modifications (50 points)
 */

import type { StoredCase } from '../../types/case';
import type { AlertWithMatch } from '../../utils/alertsData';
import { parseLocalDate } from '../../utils/dateFormatting';

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
    case 'avs-day-5': return 500;
    case 'verification-due': return 400;
    case 'mail-rcvd-closed': return 400;
    case 'other': return 100;
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
 * Calculate priority score for a case.
 * Higher score = higher priority.
 * 
 * Scoring formula:
 * - 1000 points if case status is "Intake"
 * - 500 points per AVS Day 5 alert
 * - 400 points per Verification Due / VR Due alert
 * - 400 points per Mail Rcvd on Closed alert
 * - 100 points per other unresolved alert
 * - 30 points per day since application date
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

  // 1000 points for Intake status
  if (caseData.status?.toLowerCase() === 'intake') {
    score += 1000;
  }

  // Score each alert based on type
  for (const alert of caseAlerts) {
    score += getAlertScore(alert);
  }

  // 30 points per day since application date
  const daysSinceApp = getDaysSinceApplication(caseData.caseRecord?.applicationDate);
  score += daysSinceApp * 30;

  // 75 points if marked as priority
  if (caseData.priority === true) {
    score += 75;
  }

  // 50 points if modified in last 24 hours
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const updatedAt = new Date(caseData.updatedAt);
  if (updatedAt >= oneDayAgo) {
    score += 50;
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
