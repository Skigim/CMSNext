/**
 * @fileoverview Priority Queue Domain Logic
 * 
 * Pure functions for calculating case priority scores and reasons.
 * Used by Today's Work widget to surface cases requiring immediate attention.
 * 
 * Priority Criteria:
 * 1. Unresolved alerts (highest priority)
 * 2. Recent modifications (last 24 hours)
 * 3. Priority flags
 * 4. Approaching deadlines (if deadline field exists)
 */

import type { StoredCase } from '../../types/case';
import type { AlertWithMatch } from '../../utils/alertsData';

/**
 * Case with priority scoring information
 */
export interface PriorityCase {
  case: StoredCase;
  score: number;
  reason: string;
}

/**
 * Calculate priority score for a case.
 * Higher score = higher priority.
 * 
 * Scoring formula:
 * - 100 points per unresolved alert
 * - 50 points if modified in last 24 hours
 * - 75 points if marked as priority
 * - 25 points if approaching deadline (future enhancement)
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

  // 100 points per unresolved alert
  score += caseAlerts.length * 100;

  // 50 points if modified in last 24 hours
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const updatedAt = new Date(caseData.updatedAt);
  if (updatedAt >= oneDayAgo) {
    score += 50;
  }

  // 75 points if marked as priority
  if (caseData.priority === true) {
    score += 75;
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
  // Check unresolved alerts first (highest priority)
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

  // Check recent modification
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const updatedAt = new Date(caseData.updatedAt);
  if (updatedAt >= oneDayAgo) {
    return 'Modified today';
  }

  // Fallback (should not happen if score > 0)
  return 'Needs attention';
}

/**
 * Get prioritized cases sorted by priority score.
 * Only returns cases with score > 0.
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
  // Calculate scores for all cases
  const scoredCases: PriorityCase[] = cases
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
