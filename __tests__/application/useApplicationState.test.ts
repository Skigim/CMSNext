import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import ApplicationState from '@/application/ApplicationState';
import { useApplicationState, useCase, useCases } from '@/application/hooks/useApplicationState';
import { Case, CaseStatus, type CaseSnapshot } from '@/domain/cases/entities/Case';

function createTestCase(id: string, overrides: Partial<CaseSnapshot> = {}): Case {
  const base: CaseSnapshot = {
    id,
    mcn: `MCN-${id}`,
    name: `Case ${id}`,
    status: CaseStatus.Active,
    personId: `PER-${id}`,
    createdAt: new Date('2025-01-01').toISOString(),
    updatedAt: new Date('2025-01-02').toISOString(),
    metadata: {},
  };

  return Case.rehydrate({ ...base, ...overrides });
}

describe('useApplicationState', () => {
  beforeEach(() => {
    ApplicationState.resetInstance();
  });

  afterEach(() => {
    ApplicationState.resetInstance();
  });

  it('reflects selected slices of application state', () => {
    const appState = ApplicationState.getInstance();
    const { result } = renderHook(() => useApplicationState(state => state.getCases()));

    expect(result.current).toEqual([]);

    act(() => {
      appState.addCase(createTestCase('CASE-001'));
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.id).toBe('CASE-001');
  });

  it('updates convenience hooks when data changes', () => {
    const appState = ApplicationState.getInstance();

    const casesHook = renderHook(() => useCases());
    const caseHook = renderHook(({ id }) => useCase(id), { initialProps: { id: 'CASE-002' } });

    expect(casesHook.result.current).toEqual([]);
    expect(caseHook.result.current).toBeNull();

    act(() => {
      appState.addCase(createTestCase('CASE-002'));
    });

  expect(casesHook.result.current.map(item => item.id)).toEqual(['CASE-002']);
  expect(caseHook.result.current?.name).toBe('Case CASE-002');

    act(() => {
      appState.updateCase('CASE-002', { name: 'Updated Case' });
    });

    expect(caseHook.result.current?.name).toBe('Updated Case');
  });
});
