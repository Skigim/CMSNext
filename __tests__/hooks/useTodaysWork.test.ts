/**
 * @fileoverview Tests for useTodaysWork Hook
 * 
 * Tests React hook integration with domain logic.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTodaysWork } from '../../hooks/useTodaysWork';
import type { StoredCase } from '../../types/case';
import type { AlertsIndex, AlertWithMatch } from '../../utils/alertsData';

// Test data factories
// Note: Default status is 'Pending' because 'Active' is excluded from priority queue
function createMockCase(overrides: Partial<StoredCase> = {}): StoredCase {
  return {
    id: 'case-1',
    name: 'Test Case',
    mcn: 'MCN123',
    status: 'Pending',
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
      status: 'Pending',
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

function createMockAlertsIndex(overrides: Partial<AlertsIndex> = {}): AlertsIndex {
  return {
    alerts: [],
    summary: {
      total: 0,
      matched: 0,
      unmatched: 0,
      missingMcn: 0,
    },
    alertsByCaseId: new Map(),
    unmatched: [],
    missingMcn: [],
    ...overrides,
  };
}

describe('useTodaysWork', () => {
  it('should return empty array when no cases exist', () => {
    // ARRANGE
    const cases: StoredCase[] = [];
    const alertsIndex = createMockAlertsIndex();

    // ACT
    const { result } = renderHook(() => useTodaysWork(cases, alertsIndex));

    // ASSERT
    expect(result.current).toEqual([]);
  });

  it('should return empty array when all cases have zero priority', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', updatedAt: '2020-01-01T00:00:00.000Z' }),
      createMockCase({ id: 'case-2', updatedAt: '2020-01-01T00:00:00.000Z' }),
    ];
    const alertsIndex = createMockAlertsIndex();

    // ACT
    const { result } = renderHook(() => useTodaysWork(cases, alertsIndex));

    // ASSERT
    expect(result.current).toEqual([]);
  });

  it('should return priority cases sorted by score', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', priority: true }), // Score: 75
      createMockCase({ id: 'case-2' }), // Score: 200 (2 alerts)
    ];
    const alertsIndex = createMockAlertsIndex({
      alertsByCaseId: new Map([
        [
          'case-2',
          [createMockAlert({ id: 'alert-1' }), createMockAlert({ id: 'alert-2' })],
        ],
      ]),
    });

    // ACT
    const { result } = renderHook(() => useTodaysWork(cases, alertsIndex));

    // ASSERT
    expect(result.current).toHaveLength(2);
    expect(result.current[0].case.id).toBe('case-2'); // Higher score
    expect(result.current[0].score).toBe(200);
    expect(result.current[1].case.id).toBe('case-1');
    expect(result.current[1].score).toBe(75);
  });

  it('should respect limit parameter', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', priority: true }),
      createMockCase({ id: 'case-2', priority: true }),
      createMockCase({ id: 'case-3', priority: true }),
      createMockCase({ id: 'case-4', priority: true }),
    ];
    const alertsIndex = createMockAlertsIndex();

    // ACT
    const { result } = renderHook(() => useTodaysWork(cases, alertsIndex, 2));

    // ASSERT
    expect(result.current).toHaveLength(2);
  });

  it('should memoize results based on inputs', () => {
    // ARRANGE
    const cases = [createMockCase({ id: 'case-1', priority: true })];
    const alertsIndex = createMockAlertsIndex();

    // ACT
    const { result, rerender } = renderHook(() => useTodaysWork(cases, alertsIndex));
    const firstResult = result.current;

    // Rerender with same inputs
    rerender();

    // ASSERT
    expect(result.current).toBe(firstResult); // Same reference (memoized)
  });

  it('should recalculate when cases change', () => {
    // ARRANGE
    const initialCases = [createMockCase({ id: 'case-1', priority: true })];
    const alertsIndex = createMockAlertsIndex();

    // ACT
    const { result, rerender } = renderHook(
      ({ cases, alerts }) => useTodaysWork(cases, alerts),
      { initialProps: { cases: initialCases, alerts: alertsIndex } }
    );
    const firstResult = result.current;

    // Update cases
    const newCases = [
      createMockCase({ id: 'case-1', priority: true }),
      createMockCase({ id: 'case-2', priority: true }),
    ];
    rerender({ cases: newCases, alerts: alertsIndex });

    // ASSERT
    expect(result.current).not.toBe(firstResult); // Different reference
    expect(result.current).toHaveLength(2);
  });

  it('should recalculate when alerts change', () => {
    // ARRANGE
    const cases = [createMockCase({ id: 'case-1' })];
    const initialAlertsIndex = createMockAlertsIndex();

    // ACT
    const { result, rerender } = renderHook(
      ({ cases, alerts }) => useTodaysWork(cases, alerts),
      { initialProps: { cases, alerts: initialAlertsIndex } }
    );
    const firstResult = result.current;

    // Update alerts
    const newAlertsIndex = createMockAlertsIndex({
      alertsByCaseId: new Map([['case-1', [createMockAlert()]]]),
    });
    rerender({ cases, alerts: newAlertsIndex });

    // ASSERT
    expect(result.current).not.toBe(firstResult); // Different reference
    expect(result.current).toHaveLength(1);
    expect(result.current[0].score).toBe(100);
  });

  it('should include priority reason for each case', () => {
    // ARRANGE
    const cases = [
      createMockCase({ id: 'case-1', priority: true }),
      createMockCase({ id: 'case-2' }),
    ];
    const alertsIndex = createMockAlertsIndex({
      alertsByCaseId: new Map([['case-2', [createMockAlert()]]]),
    });

    // ACT
    const { result } = renderHook(() => useTodaysWork(cases, alertsIndex));

    // ASSERT
    expect(result.current[0].reason).toBe('1 unresolved alert');
    expect(result.current[1].reason).toBe('Marked as priority');
  });

  it('should default limit to 10', () => {
    // ARRANGE
    const cases = Array.from({ length: 15 }, (_, i) =>
      createMockCase({ id: `case-${i}`, priority: true })
    );
    const alertsIndex = createMockAlertsIndex();

    // ACT
    const { result } = renderHook(() => useTodaysWork(cases, alertsIndex));

    // ASSERT
    expect(result.current).toHaveLength(10);
  });
});
