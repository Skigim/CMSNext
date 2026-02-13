/**
 * @fileoverview Tests for Priority Queue Domain Logic
 * 
 * Comprehensive unit tests for pure priority calculation functions.
 * Tests cover all scoring criteria, edge cases, and sorting behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculatePriorityScore,
  getPriorityReason,
  getPriorityCases,
  isAvsDay5Alert,
  isVerificationDueAlert,
  isMailRcvdClosedAlert,
  getAlertScore,
  getDaysSinceApplication,
  getDaysSinceOldestAlert,
  getOldestAlertDate,
  isCompletedStatus,
  getApplicationAgeMultiplier,
  getAlertAgeMultiplier,
  // Scoring constants
  SCORE_PRIORITY_FLAG,
  SCORE_RECENT_MODIFICATION,
  SCORE_PER_DAY_ALERT_AGE,
  SCORE_PER_DAY_SINCE_APPLICATION,
} from '../../../domain/dashboard/priorityQueue';
import type { StoredCase, CaseStatus } from '../../../types/case';
import type { AlertWithMatch } from '../../../utils/alertsData';

const SCORE_INTAKE = 5000;
const SCORE_AVS_DAY_5 = 500;
const SCORE_VERIFICATION_DUE = 400;
const SCORE_MAIL_RCVD_CLOSED = 400;
const SCORE_OTHER_ALERT = 100;

function classifyAlert(alert: AlertWithMatch) {
  const desc = alert.description;
  if (isAvsDay5Alert(desc)) return 'avs-day-5';
  if (isVerificationDueAlert(desc)) return 'verification-due';
  if (isMailRcvdClosedAlert(desc)) return 'mail-rcvd-closed';
  return 'other';
}

// Test data factories
// Note: We use 'as CaseStatus' for custom statuses like 'Intake' that may exist in user data
// but aren't in the strict enum. The domain logic handles this gracefully.
// Default status is 'Pending' (not 'Active') because Active is excluded from priority queue.
function createMockCase(overrides: Partial<Omit<StoredCase, 'status'> & { status?: string }> = {}): StoredCase {
  return {
    id: 'case-1',
    name: 'Test Case',
    mcn: 'MCN123',
    status: 'Pending' as CaseStatus,
    priority: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    person: {
      id: 'person-1',
      firstName: 'John',
      lastName: 'Doe',
      name: 'John Doe',
      email: '',
      phone: '',
      dateOfBirth: '',
      ssn: '',
      organizationId: null,
      livingArrangement: '',
      address: { street: '', city: '', state: '', zip: '' },
      mailingAddress: { street: '', city: '', state: '', zip: '', sameAsPhysical: true },
      authorizedRepIds: [],
      familyMembers: [],
      status: '',
      createdAt: '',
      dateAdded: '',
    },
    caseRecord: {
      id: 'case-rec-1',
      mcn: 'MCN123',
      applicationDate: '',
      caseType: '',
      personId: 'person-1',
      spouseId: '',
      status: 'Active',
      description: '',
      priority: false,
      livingArrangement: '',
      withWaiver: false,
      admissionDate: '',
      organizationId: '',
      authorizedReps: [],
      retroRequested: '',
      createdDate: '',
      updatedDate: '',
    },
    ...overrides,
  } as StoredCase;
}

function createMockAlert(overrides: Partial<AlertWithMatch> = {}): AlertWithMatch {
  // Use today's date to avoid alert age contributing to score in tests
  const today = new Date().toISOString().split('T')[0];
  return {
    id: 'alert-1',
    alertCode: 'TEST',
    alertType: 'Test Alert',
    alertDate: today,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'new',
    matchStatus: 'matched',
    matchedCaseId: 'case-1',
    ...overrides,
  };
}

describe('Alert Classification Functions', () => {
  describe('isAvsDay5Alert', () => {
    it('should return true for "Day 5 AVS"', () => {
      expect(isAvsDay5Alert('Day 5 AVS')).toBe(true);
    });

    it('should return true for "5 Day AVS"', () => {
      expect(isAvsDay5Alert('5 Day AVS')).toBe(true);
    });

    it('should return true for "AVS Day 5"', () => {
      expect(isAvsDay5Alert('AVS Day 5')).toBe(true);
    });

    it('should return true for "AVS 5 DAY" (case insensitive)', () => {
      expect(isAvsDay5Alert('avs 5 day')).toBe(true);
    });

    it('should return false for unrelated alerts', () => {
      expect(isAvsDay5Alert('VERIFICATION DUE')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isAvsDay5Alert(undefined)).toBe(false);
    });
  });

  describe('isVerificationDueAlert', () => {
    it('should return true for "VERIFICATION DUE"', () => {
      expect(isVerificationDueAlert('VERIFICATION DUE')).toBe(true);
    });

    it('should return true for "VR DUE"', () => {
      expect(isVerificationDueAlert('VR DUE')).toBe(true);
    });

    it('should return true for case variations', () => {
      expect(isVerificationDueAlert('verification due')).toBe(true);
      expect(isVerificationDueAlert('Vr Due')).toBe(true);
    });

    it('should return false for unrelated alerts', () => {
      expect(isVerificationDueAlert('Day 5 AVS')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isVerificationDueAlert(undefined)).toBe(false);
    });
  });

  describe('isMailRcvdClosedAlert', () => {
    it('should return true for "MAIL RCVD ON CLOSED"', () => {
      expect(isMailRcvdClosedAlert('MAIL RCVD ON CLOSED')).toBe(true);
    });

    it('should return true for case variations', () => {
      expect(isMailRcvdClosedAlert('mail rcvd on closed')).toBe(true);
      expect(isMailRcvdClosedAlert('Mail Rcvd On Closed')).toBe(true);
    });

    it('should return true for variations with mail and closed', () => {
      expect(isMailRcvdClosedAlert('MAIL ON CLOSED CASE')).toBe(true);
      expect(isMailRcvdClosedAlert('Closed Case - Mail Received')).toBe(true);
      expect(isMailRcvdClosedAlert('mail closed')).toBe(true);
    });

    it('should return false for unrelated alerts', () => {
      expect(isMailRcvdClosedAlert('VERIFICATION DUE')).toBe(false);
    });

    it('should return false for alerts with only mail or closed', () => {
      expect(isMailRcvdClosedAlert('MAIL RECEIVED')).toBe(false);
      expect(isMailRcvdClosedAlert('CASE CLOSED')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isMailRcvdClosedAlert(undefined)).toBe(false);
    });
  });

  describe('classifyAlert', () => {
    it('should classify AVS Day 5 alerts', () => {
      const alert = createMockAlert({ description: 'Day 5 AVS' });
      expect(classifyAlert(alert)).toBe('avs-day-5');
    });

    it('should classify Verification Due alerts', () => {
      const alert = createMockAlert({ description: 'VERIFICATION DUE' });
      expect(classifyAlert(alert)).toBe('verification-due');
    });

    it('should classify Mail Rcvd On Closed alerts', () => {
      const alert = createMockAlert({ description: 'MAIL RCVD ON CLOSED' });
      expect(classifyAlert(alert)).toBe('mail-rcvd-closed');
    });

    it('should classify other alerts as "other"', () => {
      const alert = createMockAlert({ description: 'Some Other Alert' });
      expect(classifyAlert(alert)).toBe('other');
    });
  });

  describe('getAlertScore', () => {
    it('should return SCORE_AVS_DAY_5 for AVS Day 5 alerts', () => {
      const alert = createMockAlert({ description: 'Day 5 AVS' });
      expect(getAlertScore(alert)).toBe(SCORE_AVS_DAY_5);
    });

    it('should return SCORE_VERIFICATION_DUE for Verification Due alerts', () => {
      const alert = createMockAlert({ description: 'VERIFICATION DUE' });
      expect(getAlertScore(alert)).toBe(SCORE_VERIFICATION_DUE);
    });

    it('should return SCORE_MAIL_RCVD_CLOSED for Mail Rcvd On Closed alerts', () => {
      const alert = createMockAlert({ description: 'MAIL RCVD ON CLOSED' });
      expect(getAlertScore(alert)).toBe(SCORE_MAIL_RCVD_CLOSED);
    });

    it('should return SCORE_OTHER_ALERT for other alerts', () => {
      const alert = createMockAlert({ description: 'Generic Alert' });
      expect(getAlertScore(alert)).toBe(SCORE_OTHER_ALERT);
    });
  });
});

describe('getDaysSinceApplication', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return 0 for undefined application date', () => {
    expect(getDaysSinceApplication(undefined)).toBe(0);
  });

  it('should return 0 for empty application date', () => {
    expect(getDaysSinceApplication('')).toBe(0);
  });

  it('should return 0 for invalid application date', () => {
    expect(getDaysSinceApplication('invalid-date')).toBe(0);
  });

  it('should return 0 for future application date', () => {
    expect(getDaysSinceApplication('2026-01-10')).toBe(0);
  });

  it('should return correct days for application today', () => {
    expect(getDaysSinceApplication('2026-01-05')).toBe(0);
  });

  it('should return correct days for application 5 days ago', () => {
    expect(getDaysSinceApplication('2025-12-31')).toBe(5);
  });

  it('should return correct days for application 30 days ago', () => {
    expect(getDaysSinceApplication('2025-12-06')).toBe(30);
  });

  it('should handle ISO timestamp format', () => {
    expect(getDaysSinceApplication('2025-12-31T10:00:00.000Z')).toBe(5);
  });

  it('should accept custom now parameter for testing', () => {
    const customNow = new Date('2026-01-10T12:00:00.000Z');
    expect(getDaysSinceApplication('2026-01-05', customNow)).toBe(5);
  });
});

describe('getOldestAlertDate', () => {
  it('should return undefined for empty array', () => {
    expect(getOldestAlertDate([])).toBeUndefined();
  });

  it('should return the only alert date for single alert', () => {
    const alerts = [createMockAlert({ alertDate: '2025-12-01' })];
    expect(getOldestAlertDate(alerts)).toBe('2025-12-01');
  });

  it('should return oldest date from multiple alerts', () => {
    const alerts = [
      createMockAlert({ id: 'a1', alertDate: '2025-12-15' }),
      createMockAlert({ id: 'a2', alertDate: '2025-12-01' }),
      createMockAlert({ id: 'a3', alertDate: '2025-12-10' }),
    ];
    expect(getOldestAlertDate(alerts)).toBe('2025-12-01');
  });

  it('should skip alerts with missing dates', () => {
    const alerts = [
      createMockAlert({ id: 'a1', alertDate: undefined as unknown as string }),
      createMockAlert({ id: 'a2', alertDate: '2025-12-05' }),
    ];
    expect(getOldestAlertDate(alerts)).toBe('2025-12-05');
  });

  it('should return undefined if all alerts have invalid dates', () => {
    const alerts = [
      createMockAlert({ id: 'a1', alertDate: '' }),
      createMockAlert({ id: 'a2', alertDate: 'invalid' }),
    ];
    expect(getOldestAlertDate(alerts)).toBeUndefined();
  });
});

describe('getDaysSinceOldestAlert', () => {
  it('should return 0 for empty array', () => {
    expect(getDaysSinceOldestAlert([])).toBe(0);
  });

  it('should calculate days since oldest alert', () => {
    const now = new Date('2026-01-05T12:00:00.000Z');
    const alerts = [
      createMockAlert({ id: 'a1', alertDate: '2025-12-25' }), // 11 days ago
      createMockAlert({ id: 'a2', alertDate: '2025-12-30' }), // 6 days ago
    ];
    // Should use the oldest (2025-12-25 = 11 days ago)
    expect(getDaysSinceOldestAlert(alerts, now)).toBe(11);
  });

  it('should return 0 for alerts in the future', () => {
    const now = new Date('2026-01-05T12:00:00.000Z');
    const alerts = [createMockAlert({ alertDate: '2026-01-10' })];
    expect(getDaysSinceOldestAlert(alerts, now)).toBe(0);
  });

  it('should return 0 for alerts with invalid dates', () => {
    const alerts = [createMockAlert({ alertDate: 'invalid-date' })];
    expect(getDaysSinceOldestAlert(alerts)).toBe(0);
  });
});

describe('calculatePriorityScore with alert age', () => {
  it('should add alert age points with tiered multiplier based on oldest alert only', () => {
    const now = new Date('2026-01-05T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const caseData = createMockCase({
      updatedAt: '2020-01-01T00:00:00.000Z', // Old update, no recent mod points
    });
    
    // Create alerts with different ages
    const alerts = [
      createMockAlert({ id: 'a1', alertDate: '2025-12-25', description: 'Generic' }), // 11 days old
      createMockAlert({ id: 'a2', alertDate: '2025-12-30', description: 'Generic' }), // 6 days old
    ];

    const score = calculatePriorityScore(caseData, alerts);

    // 11 days old alert = 4x multiplier (11-29 day tier)
    // Expected: 2 alerts * 100 + 11 days * 50 * 4 = 200 + 2200 = 2400
    expect(score).toBe(2 * SCORE_OTHER_ALERT + 11 * SCORE_PER_DAY_ALERT_AGE * 4);

    vi.useRealTimers();
  });

  it('should not add alert age points when alerts are from today', () => {
    const caseData = createMockCase({
      updatedAt: '2020-01-01T00:00:00.000Z',
    });
    
    // Alerts from today (default mock behavior)
    const alerts = [createMockAlert({ description: 'Generic' })];

    const score = calculatePriorityScore(caseData, alerts);

    // Expected: just alert score, no age points (0 days)
    expect(score).toBe(SCORE_OTHER_ALERT);
  });
});

describe('calculatePriorityScore', () => {
  it('should return 0 for a case with no priority factors', () => {
    // ARRANGE
    const caseData = createMockCase({
      priority: false,
      updatedAt: '2020-01-01T00:00:00.000Z', // Old update
    });
    const alerts: AlertWithMatch[] = [];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(0);
  });

  it('should add 100 points per unresolved alert (other type)', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [
      createMockAlert({ id: 'alert-1', description: 'Generic Alert' }),
      createMockAlert({ id: 'alert-2', description: 'Another Alert' }),
      createMockAlert({ id: 'alert-3', description: 'Third Alert' }),
    ];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(3 * SCORE_OTHER_ALERT);
  });

  it('should add SCORE_INTAKE points for Intake status', () => {
    // ARRANGE
    const caseData = createMockCase({
      status: 'Intake',
      updatedAt: '2020-01-01T00:00:00.000Z', // Old update to isolate intake score
    });
    const alerts: AlertWithMatch[] = [];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(SCORE_INTAKE);
  });

  it('should add SCORE_AVS_DAY_5 points for AVS Day 5 alerts', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [createMockAlert({ description: 'Day 5 AVS' })];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(SCORE_AVS_DAY_5);
  });

  it('should add SCORE_VERIFICATION_DUE points for Verification Due alerts', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [createMockAlert({ description: 'VERIFICATION DUE' })];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(SCORE_VERIFICATION_DUE);
  });

  it('should add SCORE_MAIL_RCVD_CLOSED points for Mail Rcvd On Closed alerts', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [createMockAlert({ description: 'MAIL RCVD ON CLOSED' })];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(SCORE_MAIL_RCVD_CLOSED);
  });

  it('should add SCORE_RECENT_MODIFICATION points if modified in last 24 hours', () => {
    // ARRANGE
    const now = new Date();
    const recentUpdate = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago
    const caseData = createMockCase({
      updatedAt: recentUpdate.toISOString(),
    });
    const alerts: AlertWithMatch[] = [];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(SCORE_RECENT_MODIFICATION);
  });

  it('should NOT add points if modified more than 24 hours ago', () => {
    // ARRANGE
    const now = new Date();
    const oldUpdate = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago
    const caseData = createMockCase({
      updatedAt: oldUpdate.toISOString(),
    });
    const alerts: AlertWithMatch[] = [];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(0);
  });

  it('should add 75 points if marked as priority', () => {
    // ARRANGE
    const caseData = createMockCase({
      priority: true,
    });
    const alerts: AlertWithMatch[] = [];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(SCORE_PRIORITY_FLAG);
  });

  it('should combine all priority factors correctly', () => {
    // ARRANGE
    const now = new Date();
    const recentUpdate = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours ago
    const caseData = createMockCase({
      status: 'Intake',
      priority: true,
      updatedAt: recentUpdate.toISOString(),
    });
    const alerts = [
      createMockAlert({ id: 'alert-1', description: 'Day 5 AVS' }),
      createMockAlert({ id: 'alert-2', description: 'Generic Alert' }),
    ];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    const expectedScore = SCORE_INTAKE + SCORE_AVS_DAY_5 + SCORE_OTHER_ALERT + SCORE_PRIORITY_FLAG + SCORE_RECENT_MODIFICATION;
    expect(score).toBe(expectedScore);
  });

  it('should handle mixed alert types correctly', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [
      createMockAlert({ description: 'Day 5 AVS' }),
      createMockAlert({ description: 'VERIFICATION DUE' }),
      createMockAlert({ description: 'MAIL RCVD ON CLOSED' }),
      createMockAlert({ description: 'Generic' }),
    ];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    const expectedScore = SCORE_AVS_DAY_5 + SCORE_VERIFICATION_DUE + SCORE_MAIL_RCVD_CLOSED + SCORE_OTHER_ALERT;
    expect(score).toBe(expectedScore);
  });
});

describe('getPriorityReason', () => {
  it('should return Intake reason for cases with Intake status', () => {
    // ARRANGE
    const caseData = createMockCase({ status: 'Intake' });
    const alerts: AlertWithMatch[] = [];

    // ACT
    const reason = getPriorityReason(caseData, alerts);

    // ASSERT
    expect(reason).toBe('Intake - needs processing');
  });

  it('should return AVS Day 5 reason for AVS alerts', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [createMockAlert({ description: 'Day 5 AVS' })];

    // ACT
    const reason = getPriorityReason(caseData, alerts);

    // ASSERT
    expect(reason).toBe('AVS Day 5 alert');
  });

  it('should return plural AVS reason for multiple AVS alerts', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [
      createMockAlert({ id: '1', description: 'Day 5 AVS' }),
      createMockAlert({ id: '2', description: '5 Day AVS' }),
    ];

    // ACT
    const reason = getPriorityReason(caseData, alerts);

    // ASSERT
    expect(reason).toBe('2 AVS Day 5 alerts');
  });

  it('should return Verification Due reason', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [createMockAlert({ description: 'VERIFICATION DUE' })];

    // ACT
    const reason = getPriorityReason(caseData, alerts);

    // ASSERT
    expect(reason).toBe('Verification due');
  });

  it('should return Mail received reason', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [createMockAlert({ description: 'MAIL RCVD ON CLOSED' })];

    // ACT
    const reason = getPriorityReason(caseData, alerts);

    // ASSERT
    expect(reason).toBe('Mail received on closed case');
  });

  it('should return alert count reason for cases with other unresolved alerts', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [
      createMockAlert({ id: 'alert-1', description: 'Generic' }),
      createMockAlert({ id: 'alert-2', description: 'Another' }),
      createMockAlert({ id: 'alert-3', description: 'Third' }),
    ];

    // ACT
    const reason = getPriorityReason(caseData, alerts);

    // ASSERT
    expect(reason).toBe('3 unresolved alerts');
  });

  it('should return singular alert reason for one other alert', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [createMockAlert({ description: 'Generic Alert' })];

    // ACT
    const reason = getPriorityReason(caseData, alerts);

    // ASSERT
    expect(reason).toBe('1 unresolved alert');
  });

  it('should return priority reason if no alerts but marked priority', () => {
    // ARRANGE
    const caseData = createMockCase({
      priority: true,
    });
    const alerts: AlertWithMatch[] = [];

    // ACT
    const reason = getPriorityReason(caseData, alerts);

    // ASSERT
    expect(reason).toBe('Marked as priority');
  });

  it('should return modified today reason if updated recently', () => {
    // ARRANGE
    const now = new Date();
    const recentUpdate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
    const caseData = createMockCase({
      updatedAt: recentUpdate.toISOString(),
    });
    const alerts: AlertWithMatch[] = [];

    // ACT
    const reason = getPriorityReason(caseData, alerts);

    // ASSERT
    expect(reason).toBe('Modified today');
  });

  it('should prioritize Intake over alert reasons', () => {
    // ARRANGE
    const now = new Date();
    const recentUpdate = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
    const caseData = createMockCase({
      status: 'Intake',
      priority: true,
      updatedAt: recentUpdate.toISOString(),
    });
    const alerts = [createMockAlert({ description: 'Day 5 AVS' })];

    // ACT
    const reason = getPriorityReason(caseData, alerts);

    // ASSERT
    expect(reason).toBe('Intake - needs processing'); // Intake takes precedence
  });

  it('should prioritize AVS alert reason over other reasons', () => {
    // ARRANGE
    const now = new Date();
    const recentUpdate = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
    const caseData = createMockCase({
      priority: true,
      updatedAt: recentUpdate.toISOString(),
    });
    const alerts = [createMockAlert({ description: 'Day 5 AVS' })];

    // ACT
    const reason = getPriorityReason(caseData, alerts);

    // ASSERT
    expect(reason).toBe('AVS Day 5 alert'); // AVS takes precedence
  });

  it('should return fallback reason if no priority factors', () => {
    // ARRANGE
    const caseData = createMockCase({
      priority: false,
      updatedAt: '2020-01-01T00:00:00.000Z',
    });
    const alerts: AlertWithMatch[] = [];

    // ACT
    const reason = getPriorityReason(caseData, alerts);

    // ASSERT
    expect(reason).toBe('Needs attention');
  });
});

describe('getPriorityCases', () => {
  it('should return empty array when no cases exist', () => {
    // ARRANGE
    const cases: StoredCase[] = [];
    const alertsIndex = { alertsByCaseId: new Map() };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toEqual([]);
  });

  it('should return empty array when all cases have score 0', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', updatedAt: '2020-01-01T00:00:00.000Z' }),
      createMockCase({ id: 'case-2', updatedAt: '2020-01-01T00:00:00.000Z' }),
    ];
    const alertsIndex = { alertsByCaseId: new Map() };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toEqual([]);
  });

  it('should filter out cases with score 0', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', priority: true }), // Score: 75
      createMockCase({ id: 'case-2', updatedAt: '2020-01-01T00:00:00.000Z' }), // Score: 0
    ];
    const alertsIndex = { alertsByCaseId: new Map() };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].case.id).toBe('case-1');
  });

  it('should sort cases by score descending', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', priority: true }), // Score: 75
      createMockCase({ id: 'case-2', priority: false }), // Score: 0 + alerts
      createMockCase({ id: 'case-3', priority: false }), // Score: 0
    ];
    const alertsIndex = {
      alertsByCaseId: new Map([
        ['case-2', [
          createMockAlert({ status: 'new', description: 'Generic' }), 
          createMockAlert({ status: 'new', description: 'Another' })
        ]],
      ]),
    };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(2);
    expect(result[0].case.id).toBe('case-2'); // Score: 2 * SCORE_OTHER_ALERT
    expect(result[0].score).toBe(2 * SCORE_OTHER_ALERT);
    expect(result[1].case.id).toBe('case-1'); // Score: SCORE_PRIORITY_FLAG
    expect(result[1].score).toBe(SCORE_PRIORITY_FLAG);
  });

  it('should limit results to specified number', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', priority: true }),
      createMockCase({ id: 'case-2', priority: true }),
      createMockCase({ id: 'case-3', priority: true }),
      createMockCase({ id: 'case-4', priority: true }),
      createMockCase({ id: 'case-5', priority: true }),
    ];
    const alertsIndex = { alertsByCaseId: new Map() };

    // ACT
    const result = getPriorityCases(cases, alertsIndex, 3);

    // ASSERT
    expect(result).toHaveLength(3);
  });

  it('should filter out resolved alerts when calculating scores', () => {
    // ARRANGE
    const cases = [createMockCase({ id: 'case-1' })];
    const alertsIndex = {
      alertsByCaseId: new Map([
        [
          'case-1',
          [
            createMockAlert({ id: 'alert-1', status: 'resolved', description: 'Generic' }),
            createMockAlert({ id: 'alert-2', status: 'new', description: 'Generic' }),
          ],
        ],
      ]),
    };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(SCORE_OTHER_ALERT); // Only 1 unresolved alert counted
    expect(result[0].reason).toBe('1 unresolved alert');
  });

  it('should filter out alerts with resolvedAt timestamp', () => {
    // ARRANGE
    const cases = [createMockCase({ id: 'case-1' })];
    const alertsIndex = {
      alertsByCaseId: new Map([
        [
          'case-1',
          [
            createMockAlert({ id: 'alert-1', resolvedAt: '2024-01-15T00:00:00.000Z', description: 'Generic' }),
            createMockAlert({ id: 'alert-2', description: 'Generic' }),
          ],
        ],
      ]),
    };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(SCORE_OTHER_ALERT); // Only 1 unresolved alert
  });

  it('should sort by updatedAt when scores are equal', () => {
    // ARRANGE
    const cases = [
      createMockCase({
        id: 'case-1',
        priority: true,
        updatedAt: '2024-01-01T00:00:00.000Z',
      }),
      createMockCase({
        id: 'case-2',
        priority: true,
        updatedAt: '2024-01-15T00:00:00.000Z', // More recent
      }),
      createMockCase({
        id: 'case-3',
        priority: true,
        updatedAt: '2024-01-10T00:00:00.000Z',
      }),
    ];
    const alertsIndex = { alertsByCaseId: new Map() };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(3);
    expect(result[0].case.id).toBe('case-2'); // Most recent
    expect(result[1].case.id).toBe('case-3');
    expect(result[2].case.id).toBe('case-1'); // Oldest
  });

  it('should include correct reason for each priority case', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', priority: true }),
      createMockCase({ id: 'case-2' }),
    ];
    const alertsIndex = {
      alertsByCaseId: new Map([['case-2', [
        createMockAlert({ description: 'Generic' }), 
        createMockAlert({ description: 'Another' })
      ]]]),
    };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(2);
    expect(result[0].reason).toBe('2 unresolved alerts'); // case-2
    expect(result[1].reason).toBe('Marked as priority'); // case-1
  });

  it('should prioritize Intake cases highest', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', status: 'Intake' }),
      createMockCase({ id: 'case-2', priority: true }),
      createMockCase({ id: 'case-3' }),
    ];
    const alertsIndex = {
      alertsByCaseId: new Map([['case-3', [
        createMockAlert({ description: 'Day 5 AVS' }),
      ]]]),
    };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(3);
    expect(result[0].case.id).toBe('case-1'); // Intake: SCORE_INTAKE
    expect(result[0].score).toBe(SCORE_INTAKE);
    expect(result[1].case.id).toBe('case-3'); // AVS alert: SCORE_AVS_DAY_5
    expect(result[1].score).toBe(SCORE_AVS_DAY_5);
    expect(result[2].case.id).toBe('case-2'); // Priority: SCORE_PRIORITY_FLAG
    expect(result[2].score).toBe(SCORE_PRIORITY_FLAG);
  });

  it('should handle cases with no alerts in the map', () => {
    // ARRANGE
    const cases = [createMockCase({ id: 'case-1', priority: true })];
    const alertsIndex = { alertsByCaseId: new Map() };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(SCORE_PRIORITY_FLAG);
    expect(result[0].reason).toBe('Marked as priority');
  });

  it('should exclude cases with Denied status when marked completed in config', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', status: 'Denied', priority: true }),
      createMockCase({ id: 'case-2', status: 'Pending', priority: true }),
    ];
    const alertsIndex = { alertsByCaseId: new Map() };
    const config = {
      caseStatuses: [
        { name: 'Denied', colorSlot: 'red' as const, countsAsCompleted: true },
        { name: 'Pending', colorSlot: 'amber' as const },
      ],
    };

    // ACT
    const result = getPriorityCases(cases, alertsIndex, 10, config);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].case.id).toBe('case-2');
  });

  it('should exclude cases with Closed status when marked completed in config', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', status: 'Closed', priority: true }),
      createMockCase({ id: 'case-2', status: 'Intake', priority: true }),
    ];
    const alertsIndex = { alertsByCaseId: new Map() };
    const config = {
      caseStatuses: [
        { name: 'Closed', colorSlot: 'slate' as const, countsAsCompleted: true },
        { name: 'Intake', colorSlot: 'blue' as const },
      ],
    };

    // ACT
    const result = getPriorityCases(cases, alertsIndex, 10, config);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].case.id).toBe('case-2');
  });

  it('should exclude cases with Active status when marked completed in config', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', status: 'Active', priority: true }),
      createMockCase({ id: 'case-2', priority: true }),
    ];
    const alertsIndex = { alertsByCaseId: new Map() };
    const config = {
      caseStatuses: [
        { name: 'Active', colorSlot: 'green' as const, countsAsCompleted: true },
      ],
    };

    // ACT
    const result = getPriorityCases(cases, alertsIndex, 10, config);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].case.id).toBe('case-2');
  });

  it('should exclude cases with Approved status when marked completed in config', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', status: 'Approved', priority: true }),
      createMockCase({ id: 'case-2', priority: true }),
    ];
    const alertsIndex = { alertsByCaseId: new Map() };
    const config = {
      caseStatuses: [
        { name: 'Approved', colorSlot: 'green' as const, countsAsCompleted: true },
      ],
    };

    // ACT
    const result = getPriorityCases(cases, alertsIndex, 10, config);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].case.id).toBe('case-2');
  });

  it('should exclude cases with Spenddown status when marked completed in config', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', status: 'Spenddown', priority: true }),
      createMockCase({ id: 'case-2', priority: true }),
    ];
    const alertsIndex = { alertsByCaseId: new Map() };
    const config = {
      caseStatuses: [
        { name: 'Spenddown', colorSlot: 'purple' as const, countsAsCompleted: true },
      ],
    };

    // ACT
    const result = getPriorityCases(cases, alertsIndex, 10, config);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].case.id).toBe('case-2');
  });

  it('should exclude all completed statuses in mixed list when marked in config', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-denied', status: 'Denied', priority: true }),
      createMockCase({ id: 'case-closed', status: 'Closed', priority: true }),
      createMockCase({ id: 'case-active', status: 'Active', priority: true }),
      createMockCase({ id: 'case-approved', status: 'Approved', priority: true }),
      createMockCase({ id: 'case-spenddown', status: 'Spenddown', priority: true }),
      createMockCase({ id: 'case-intake', status: 'Intake', priority: true }), // Should be included
      createMockCase({ id: 'case-pending', status: 'Pending', priority: true }), // Should be included
    ];
    const alertsIndex = { alertsByCaseId: new Map() };
    const config = {
      caseStatuses: [
        { name: 'Denied', colorSlot: 'red' as const, countsAsCompleted: true },
        { name: 'Closed', colorSlot: 'slate' as const, countsAsCompleted: true },
        { name: 'Active', colorSlot: 'green' as const, countsAsCompleted: true },
        { name: 'Approved', colorSlot: 'green' as const, countsAsCompleted: true },
        { name: 'Spenddown', colorSlot: 'purple' as const, countsAsCompleted: true },
        { name: 'Intake', colorSlot: 'blue' as const },
        { name: 'Pending', colorSlot: 'amber' as const },
      ],
    };

    // ACT
    const result = getPriorityCases(cases, alertsIndex, 10, config);

    // ASSERT
    expect(result).toHaveLength(2);
    const includedIds = result.map(pc => pc.case.id);
    expect(includedIds).toContain('case-intake');
    expect(includedIds).toContain('case-pending');
    expect(includedIds).not.toContain('case-denied');
    expect(includedIds).not.toContain('case-closed');
    expect(includedIds).not.toContain('case-active');
    expect(includedIds).not.toContain('case-approved');
    expect(includedIds).not.toContain('case-spenddown');
  });
});

describe('getApplicationAgeMultiplier', () => {
  it('should return 1x for 0-10 days', () => {
    expect(getApplicationAgeMultiplier(0)).toBe(1);
    expect(getApplicationAgeMultiplier(5)).toBe(1);
    expect(getApplicationAgeMultiplier(10)).toBe(1);
  });

  it('should return 2x for 11-29 days', () => {
    expect(getApplicationAgeMultiplier(11)).toBe(2);
    expect(getApplicationAgeMultiplier(20)).toBe(2);
    expect(getApplicationAgeMultiplier(29)).toBe(2);
  });

  it('should return 4x for 30-44 days', () => {
    expect(getApplicationAgeMultiplier(30)).toBe(4);
    expect(getApplicationAgeMultiplier(37)).toBe(4);
    expect(getApplicationAgeMultiplier(44)).toBe(4);
  });

  it('should return 8x for 45+ days', () => {
    expect(getApplicationAgeMultiplier(45)).toBe(8);
    expect(getApplicationAgeMultiplier(52)).toBe(8);
    expect(getApplicationAgeMultiplier(59)).toBe(8);
    expect(getApplicationAgeMultiplier(60)).toBe(8);
    expect(getApplicationAgeMultiplier(90)).toBe(8);
    expect(getApplicationAgeMultiplier(365)).toBe(8);
  });
});

describe('getAlertAgeMultiplier', () => {
  it('should return 1x for 0-4 days', () => {
    expect(getAlertAgeMultiplier(0)).toBe(1);
    expect(getAlertAgeMultiplier(2)).toBe(1);
    expect(getAlertAgeMultiplier(4)).toBe(1);
  });

  it('should return 2x for 5-10 days', () => {
    expect(getAlertAgeMultiplier(5)).toBe(2);
    expect(getAlertAgeMultiplier(7)).toBe(2);
    expect(getAlertAgeMultiplier(10)).toBe(2);
  });

  it('should return 4x for 11-29 days', () => {
    expect(getAlertAgeMultiplier(11)).toBe(4);
    expect(getAlertAgeMultiplier(20)).toBe(4);
    expect(getAlertAgeMultiplier(29)).toBe(4);
  });

  it('should return 8x for 30+ days', () => {
    expect(getAlertAgeMultiplier(30)).toBe(8);
    expect(getAlertAgeMultiplier(45)).toBe(8);
    expect(getAlertAgeMultiplier(60)).toBe(8);
    expect(getAlertAgeMultiplier(90)).toBe(8);
    expect(getAlertAgeMultiplier(365)).toBe(8);
  });
});

describe('calculatePriorityScore with tiered age multipliers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should apply application age multiplier correctly', () => {
    // 35 days old application = 4x multiplier
    const caseData = createMockCase({
      updatedAt: '2020-01-01T00:00:00.000Z', // No recent mod points
      caseRecord: {
        id: 'record-1',
        mcn: 'MCN123',
        applicationDate: '2025-12-11', // 35 days before Jan 15
        caseType: 'Type A',
        personId: 'person-1',
        spouseId: '',
        status: 'Pending' as import('@/types/case').CaseStatus,
        description: '',
        priority: false,
        livingArrangement: '',
        withWaiver: false,
        admissionDate: '',
        organizationId: '',
        authorizedReps: [],
        retroRequested: '',
        createdDate: '2025-12-11',
        updatedDate: '2025-12-11',
      },
    });

    const score = calculatePriorityScore(caseData, []);

    // 35 days * 30 base * 4x multiplier = 4200
    expect(score).toBe(35 * SCORE_PER_DAY_SINCE_APPLICATION * 4);
  });

  it('should compound application age and alert age multipliers', () => {
    // 15 days old application = 2x multiplier
    // 7 days old alert = 2x multiplier
    const caseData = createMockCase({
      updatedAt: '2020-01-01T00:00:00.000Z',
      caseRecord: {
        id: 'record-1',
        mcn: 'MCN123',
        applicationDate: '2025-12-31', // 15 days before Jan 15
        caseType: 'Type A',
        personId: 'person-1',
        spouseId: '',
        status: 'Pending' as import('@/types/case').CaseStatus,
        description: '',
        priority: false,
        livingArrangement: '',
        withWaiver: false,
        admissionDate: '',
        organizationId: '',
        authorizedReps: [],
        retroRequested: '',
        createdDate: '2025-12-31',
        updatedDate: '2025-12-31',
      },
    });

    const alerts = [
      createMockAlert({ alertDate: '2026-01-08', description: 'Generic' }), // 7 days old
    ];

    const score = calculatePriorityScore(caseData, alerts);

    // Alert type: 100
    // App age: 15 days * 30 * 2x = 900
    // Alert age: 7 days * 50 * 2x = 700
    // Total: 1700
    expect(score).toBe(
      SCORE_OTHER_ALERT +
      15 * SCORE_PER_DAY_SINCE_APPLICATION * 2 +
      7 * SCORE_PER_DAY_ALERT_AGE * 2
    );
  });

  it('should dramatically increase score for very old cases', () => {
    // 65 days old application = 8x multiplier
    // 65 days old alert = 8x multiplier
    const caseData = createMockCase({
      updatedAt: '2020-01-01T00:00:00.000Z',
      caseRecord: {
        id: 'record-1',
        mcn: 'MCN123',
        applicationDate: '2025-11-11', // 65 days before Jan 15
        caseType: 'Type A',
        personId: 'person-1',
        spouseId: '',
        status: 'Pending' as import('@/types/case').CaseStatus,
        description: '',
        priority: false,
        livingArrangement: '',
        withWaiver: false,
        admissionDate: '',
        organizationId: '',
        authorizedReps: [],
        retroRequested: '',
        createdDate: '2025-11-11',
        updatedDate: '2025-11-11',
      },
    });

    const alerts = [
      createMockAlert({ alertDate: '2025-11-11', description: 'Generic' }), // 65 days old
    ];

    const score = calculatePriorityScore(caseData, alerts);

    // Alert type: 100
    // App age: 65 days * 30 * 8x = 15,600
    // Alert age: 65 days * 50 * 8x = 26,000
    // Total: 41,700
    expect(score).toBe(
      SCORE_OTHER_ALERT +
      65 * SCORE_PER_DAY_SINCE_APPLICATION * 8 +
      65 * SCORE_PER_DAY_ALERT_AGE * 8
    );
  });

  it('should skip application age multiplier for completed/terminal statuses', () => {
    // 35 days old application with Approved status = 0 points (completed cases excluded)
    const caseData = createMockCase({
      status: 'Approved',
      updatedAt: '2020-01-01T00:00:00.000Z',
      caseRecord: {
        id: 'record-1',
        mcn: 'MCN123',
        applicationDate: '2025-12-11', // 35 days before Jan 15
        caseType: 'Type A',
        personId: 'person-1',
        spouseId: '',
        status: 'Approved' as import('@/types/case').CaseStatus,
        description: '',
        priority: false,
        livingArrangement: '',
        withWaiver: false,
        admissionDate: '',
        organizationId: '',
        authorizedReps: [],
        retroRequested: '',
        createdDate: '2025-12-11',
        updatedDate: '2025-12-11',
      },
    });

    const config = {
      caseStatuses: [
        { name: 'Approved', colorSlot: 'green' as const, countsAsCompleted: true },
      ],
    };

    const score = calculatePriorityScore(caseData, [], config);

    // Completed cases get 0 points for application age
    expect(score).toBe(0);
  });

  it('should apply alert age multiplier even for completed statuses', () => {
    // Completed case but still has alerts that escalate
    const caseData = createMockCase({
      status: 'Closed',
      updatedAt: '2020-01-01T00:00:00.000Z',
      caseRecord: {
        id: 'record-1',
        mcn: 'MCN123',
        applicationDate: '2025-12-11', // 35 days before Jan 15
        caseType: 'Type A',
        personId: 'person-1',
        spouseId: '',
        status: 'Closed' as import('@/types/case').CaseStatus,
        description: '',
        priority: false,
        livingArrangement: '',
        withWaiver: false,
        admissionDate: '',
        organizationId: '',
        authorizedReps: [],
        retroRequested: '',
        createdDate: '2025-12-11',
        updatedDate: '2025-12-11',
      },
    });

    const alerts = [
      createMockAlert({ alertDate: '2025-12-11', description: 'Generic' }), // 35 days old = 8x
    ];

    const config = {
      caseStatuses: [
        { name: 'Closed', colorSlot: 'slate' as const, countsAsCompleted: true },
      ],
    };

    const score = calculatePriorityScore(caseData, alerts, config);

    // Alert type: 100
    // App age: 0 (completed cases get no application age points)
    // Alert age: 35 days * 50 * 8x = 14,000
    // Total: 14,100
    expect(score).toBe(
      SCORE_OTHER_ALERT +
      35 * SCORE_PER_DAY_ALERT_AGE * 8
    );
  });

  it('should use countsAsCompleted flag from config to skip age scaling', () => {
    // Custom status "In Review" with countsAsCompleted=true
    const config = {
      caseStatuses: [
        { name: 'In Review', colorSlot: 'blue' as const, countsAsCompleted: true },
        { name: 'Pending', colorSlot: 'amber' as const, countsAsCompleted: false },
      ],
    };

    const caseData = createMockCase({
      status: 'In Review' as import('@/types/case').CaseStatus,
      updatedAt: '2020-01-01T00:00:00.000Z',
      caseRecord: {
        id: 'record-1',
        mcn: 'MCN123',
        applicationDate: '2025-12-11', // 35 days before Jan 15
        caseType: 'Type A',
        personId: 'person-1',
        spouseId: '',
        status: 'In Review' as import('@/types/case').CaseStatus,
        description: '',
        priority: false,
        livingArrangement: '',
        withWaiver: false,
        admissionDate: '',
        organizationId: '',
        authorizedReps: [],
        retroRequested: '',
        createdDate: '2025-12-11',
        updatedDate: '2025-12-11',
      },
    });

    const score = calculatePriorityScore(caseData, [], config);

    // Completed cases (countsAsCompleted=true) get 0 points for application age
    expect(score).toBe(0);
  });

  it('should apply age scaling when countsAsCompleted is false in config', () => {
    const config = {
      caseStatuses: [
        { name: 'Processing', colorSlot: 'blue' as const, countsAsCompleted: false },
      ],
    };

    const caseData = createMockCase({
      status: 'Processing' as import('@/types/case').CaseStatus,
      updatedAt: '2020-01-01T00:00:00.000Z',
      caseRecord: {
        id: 'record-1',
        mcn: 'MCN123',
        applicationDate: '2025-12-11', // 35 days before Jan 15
        caseType: 'Type A',
        personId: 'person-1',
        spouseId: '',
        status: 'Processing' as import('@/types/case').CaseStatus,
        description: '',
        priority: false,
        livingArrangement: '',
        withWaiver: false,
        admissionDate: '',
        organizationId: '',
        authorizedReps: [],
        retroRequested: '',
        createdDate: '2025-12-11',
        updatedDate: '2025-12-11',
      },
    });

    const score = calculatePriorityScore(caseData, [], config);

    // 35 days * 30 base * 4x multiplier (30-44 day tier) = 4200
    expect(score).toBe(35 * SCORE_PER_DAY_SINCE_APPLICATION * 4);
  });
});

describe('isCompletedStatus', () => {
  it('should return true when countsAsCompleted is true in config', () => {
    const statuses = [
      { name: 'Done', colorSlot: 'green' as const, countsAsCompleted: true },
      { name: 'Active', colorSlot: 'blue' as const, countsAsCompleted: false },
    ];
    
    expect(isCompletedStatus('Done', statuses)).toBe(true);
    expect(isCompletedStatus('done', statuses)).toBe(true); // case insensitive
    expect(isCompletedStatus('DONE', statuses)).toBe(true);
  });

  it('should return false when countsAsCompleted is false in config', () => {
    const statuses = [
      { name: 'Active', colorSlot: 'blue' as const, countsAsCompleted: false },
    ];
    
    expect(isCompletedStatus('Active', statuses)).toBe(false);
  });

  it('should return false when status not found in config', () => {
    const statuses = [
      { name: 'Active', colorSlot: 'blue' as const, countsAsCompleted: true },
    ];
    
    expect(isCompletedStatus('Unknown', statuses)).toBe(false);
  });

  it('should return false when no config provided (no fallback)', () => {
    // Without config, we cannot determine completed status
    expect(isCompletedStatus('Approved')).toBe(false);
    expect(isCompletedStatus('Denied')).toBe(false);
    expect(isCompletedStatus('Closed')).toBe(false);
    expect(isCompletedStatus('Pending')).toBe(false);
    expect(isCompletedStatus('Intake')).toBe(false);
  });

  it('should return false for undefined status', () => {
    expect(isCompletedStatus(undefined)).toBe(false);
    expect(isCompletedStatus(undefined, [])).toBe(false);
  });
});
