/**
 * @fileoverview Tests for Priority Queue Domain Logic
 * 
 * Comprehensive unit tests for pure priority calculation functions.
 * Tests cover all scoring criteria, edge cases, and sorting behavior.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePriorityScore,
  getPriorityReason,
  getPriorityCases,
} from '../../../domain/dashboard/priorityQueue';
import type { StoredCase } from '../../../types/case';
import type { AlertWithMatch } from '../../../utils/alertsData';

// Test data factories
function createMockCase(overrides: Partial<StoredCase> = {}): StoredCase {
  return {
    id: 'case-1',
    name: 'Test Case',
    mcn: 'MCN123',
    status: 'Active',
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
  };
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

  it('should add 100 points per unresolved alert', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [
      createMockAlert({ id: 'alert-1' }),
      createMockAlert({ id: 'alert-2' }),
      createMockAlert({ id: 'alert-3' }),
    ];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(300); // 3 alerts × 100 points
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
      priority: true,
      updatedAt: recentUpdate.toISOString(),
    });
    const alerts = [
      createMockAlert({ id: 'alert-1' }),
      createMockAlert({ id: 'alert-2' }),
    ];

    // ACT
    const score = calculatePriorityScore(caseData, alerts);

    // ASSERT
    expect(score).toBe(325); // (2 × 100) + 50 + 75
  });
});

describe('getPriorityReason', () => {
  it('should return alert count reason for cases with unresolved alerts', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [
      createMockAlert({ id: 'alert-1' }),
      createMockAlert({ id: 'alert-2' }),
      createMockAlert({ id: 'alert-3' }),
    ];

    // ACT
    const reason = getPriorityReason(caseData, alerts);

    // ASSERT
    expect(reason).toBe('3 unresolved alerts');
  });

  it('should return singular alert reason for one alert', () => {
    // ARRANGE
    const caseData = createMockCase();
    const alerts = [createMockAlert()];

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

  it('should prioritize alert reason over other reasons', () => {
    // ARRANGE
    const now = new Date();
    const recentUpdate = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
    const caseData = createMockCase({
      priority: true,
      updatedAt: recentUpdate.toISOString(),
    });
    const alerts = [createMockAlert()];

    // ACT
    const reason = getPriorityReason(caseData, alerts);

    // ASSERT
    expect(reason).toBe('1 unresolved alert'); // Alerts take precedence
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
      createMockCase({ id: 'case-2', priority: false }), // Score: 0
      createMockCase({ id: 'case-3', priority: false }), // Score: 0
    ];
    const alertsIndex = {
      alertsByCaseId: new Map([
        ['case-2', [createMockAlert({ status: 'new' }), createMockAlert({ status: 'new' })]],
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
            createMockAlert({ id: 'alert-1', status: 'resolved' }),
            createMockAlert({ id: 'alert-2', status: 'new' }),
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
            createMockAlert({ id: 'alert-1', resolvedAt: '2024-01-15T00:00:00.000Z' }),
            createMockAlert({ id: 'alert-2' }),
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
      alertsByCaseId: new Map([['case-2', [createMockAlert(), createMockAlert()]]]),
    };

    // ACT
    const result = getPriorityCases(cases, alertsIndex);

    // ASSERT
    expect(result).toHaveLength(2);
    expect(result[0].reason).toBe('2 unresolved alerts'); // case-2
    expect(result[1].reason).toBe('Marked as priority'); // case-1
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
});
