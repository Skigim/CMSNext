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
  classifyAlert,
  getAlertScore,
  getDaysSinceApplication,
  isExcludedStatus,
  EXCLUDED_STATUSES,
} from '../../../domain/dashboard/priorityQueue';
import type { StoredCase, CaseStatus } from '../../../types/case';
import type { AlertWithMatch } from '../../../utils/alertsData';

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
  return {
    id: 'alert-1',
    alertCode: 'TEST',
    alertType: 'Test Alert',
    alertDate: '2024-01-01',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
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
    it('should return 500 for AVS Day 5 alerts', () => {
      const alert = createMockAlert({ description: 'Day 5 AVS' });
      expect(getAlertScore(alert)).toBe(500);
    });

    it('should return 400 for Verification Due alerts', () => {
      const alert = createMockAlert({ description: 'VERIFICATION DUE' });
      expect(getAlertScore(alert)).toBe(400);
    });

    it('should return 400 for Mail Rcvd On Closed alerts', () => {
      const alert = createMockAlert({ description: 'MAIL RCVD ON CLOSED' });
      expect(getAlertScore(alert)).toBe(400);
    });

    it('should return 100 for other alerts', () => {
      const alert = createMockAlert({ description: 'Generic Alert' });
      expect(getAlertScore(alert)).toBe(100);
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

describe('isExcludedStatus', () => {
  it('should return true for Denied status', () => {
    expect(isExcludedStatus('Denied')).toBe(true);
    expect(isExcludedStatus('denied')).toBe(true);
    expect(isExcludedStatus('DENIED')).toBe(true);
  });

  it('should return true for Spenddown status', () => {
    expect(isExcludedStatus('Spenddown')).toBe(true);
  });

  it('should return true for Closed status', () => {
    expect(isExcludedStatus('Closed')).toBe(true);
  });

  it('should return true for Active status', () => {
    expect(isExcludedStatus('Active')).toBe(true);
  });

  it('should return true for Approved status', () => {
    expect(isExcludedStatus('Approved')).toBe(true);
  });

  it('should return false for Intake status', () => {
    expect(isExcludedStatus('Intake')).toBe(false);
  });

  it('should return false for Pending status', () => {
    expect(isExcludedStatus('Pending')).toBe(false);
  });

  it('should return false for undefined/empty', () => {
    expect(isExcludedStatus(undefined)).toBe(false);
    expect(isExcludedStatus('')).toBe(false);
  });

  it('should include all expected statuses in EXCLUDED_STATUSES', () => {
    expect(EXCLUDED_STATUSES).toContain('denied');
    expect(EXCLUDED_STATUSES).toContain('spenddown');
    expect(EXCLUDED_STATUSES).toContain('closed');
    expect(EXCLUDED_STATUSES).toContain('active');
    expect(EXCLUDED_STATUSES).toContain('approved');
    expect(EXCLUDED_STATUSES).toHaveLength(5);
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
    expect(score).toBe(300); // 3 alerts × 100 points
  });

  it('should add 1000 points for Intake status', () => {
    // ARRANGE
    const caseData = createMockCase({
      status: 'Intake',
      updatedAt: '2020-01-01T00:00:00.000Z', // Old update to isolate intake score
    });
    const alerts: AlertWithMatch[] = [];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(1000);
  });

  it('should add 500 points for AVS Day 5 alerts', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [createMockAlert({ description: 'Day 5 AVS' })];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(500);
  });

  it('should add 400 points for Verification Due alerts', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [createMockAlert({ description: 'VERIFICATION DUE' })];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(400);
  });

  it('should add 400 points for Mail Rcvd On Closed alerts', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [createMockAlert({ description: 'MAIL RCVD ON CLOSED' })];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(400);
  });

  it('should add 50 points if modified in last 24 hours', () => {
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
    expect(score).toBe(50);
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
    expect(score).toBe(75);
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
      createMockAlert({ id: 'alert-1', description: 'Day 5 AVS' }), // 500
      createMockAlert({ id: 'alert-2', description: 'Generic Alert' }), // 100
    ];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    // 1000 (intake) + 500 (AVS) + 100 (other) + 75 (priority) + 50 (recent) = 1725
    expect(score).toBe(1725);
  });

  it('should handle mixed alert types correctly', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [
      createMockAlert({ description: 'Day 5 AVS' }), // 500
      createMockAlert({ description: 'VERIFICATION DUE' }), // 400
      createMockAlert({ description: 'MAIL RCVD ON CLOSED' }), // 400
      createMockAlert({ description: 'Generic' }), // 100
    ];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(1400); // 500 + 400 + 400 + 100
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
    expect(result[0].case.id).toBe('case-2'); // Score: 200
    expect(result[0].score).toBe(200);
    expect(result[1].case.id).toBe('case-1'); // Score: 75
    expect(result[1].score).toBe(75);
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
    expect(result[0].score).toBe(100); // Only 1 unresolved alert counted
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
    expect(result[0].score).toBe(100); // Only 1 unresolved alert
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
      createMockCase({ id: 'case-1', status: 'Intake' }), // 1000
      createMockCase({ id: 'case-2', priority: true }), // 75
      createMockCase({ id: 'case-3' }), // alerts score
    ];
    const alertsIndex = {
      alertsByCaseId: new Map([['case-3', [
        createMockAlert({ description: 'Day 5 AVS' }), // 500
      ]]]),
    };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(3);
    expect(result[0].case.id).toBe('case-1'); // Intake: 1000
    expect(result[0].score).toBe(1000);
    expect(result[1].case.id).toBe('case-3'); // AVS alert: 500
    expect(result[1].score).toBe(500);
    expect(result[2].case.id).toBe('case-2'); // Priority: 75
    expect(result[2].score).toBe(75);
  });

  it('should handle cases with no alerts in the map', () => {
    // ARRANGE
    const cases = [createMockCase({ id: 'case-1', priority: true })];
    const alertsIndex = { alertsByCaseId: new Map() };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(75);
    expect(result[0].reason).toBe('Marked as priority');
  });

  it('should exclude cases with Denied status', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', status: 'Denied', priority: true }),
      createMockCase({ id: 'case-2', status: 'Pending', priority: true }),
    ];
    const alertsIndex = { alertsByCaseId: new Map() };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].case.id).toBe('case-2');
  });

  it('should exclude cases with Closed status', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', status: 'Closed', priority: true }),
      createMockCase({ id: 'case-2', status: 'Intake' }),
    ];
    const alertsIndex = { alertsByCaseId: new Map() };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].case.id).toBe('case-2');
  });

  it('should exclude cases with Active status', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', status: 'Active', priority: true }),
      createMockCase({ id: 'case-2', priority: true }),
    ];
    const alertsIndex = { alertsByCaseId: new Map() };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].case.id).toBe('case-2');
  });

  it('should exclude cases with Approved status', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', status: 'Approved', priority: true }),
      createMockCase({ id: 'case-2', priority: true }),
    ];
    const alertsIndex = { alertsByCaseId: new Map() };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].case.id).toBe('case-2');
  });

  it('should exclude cases with Spenddown status', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', status: 'Spenddown', priority: true }),
      createMockCase({ id: 'case-2', priority: true }),
    ];
    const alertsIndex = { alertsByCaseId: new Map() };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(1);
    expect(result[0].case.id).toBe('case-2');
  });

  it('should exclude all terminal statuses in mixed list', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-denied', status: 'Denied', priority: true }),
      createMockCase({ id: 'case-closed', status: 'Closed', priority: true }),
      createMockCase({ id: 'case-active', status: 'Active', priority: true }),
      createMockCase({ id: 'case-approved', status: 'Approved', priority: true }),
      createMockCase({ id: 'case-spenddown', status: 'Spenddown', priority: true }),
      createMockCase({ id: 'case-intake', status: 'Intake' }), // Should be included
      createMockCase({ id: 'case-pending', status: 'Pending', priority: true }), // Should be included
    ];
    const alertsIndex = { alertsByCaseId: new Map() };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

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
