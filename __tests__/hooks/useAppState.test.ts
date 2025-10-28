import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ApplicationState } from '@/application/ApplicationState';
import { useAppState, useAppStateSelector } from '@/hooks/useAppState';
import { Case } from '@/domain/cases/entities/Case';
import { Person } from '@/domain/cases/entities/Person';
import { DEFAULT_FLAGS } from '@/utils/featureFlags';

describe('useAppState', () => {
  beforeEach(() => {
    ApplicationState.resetForTesting();
  });

  afterEach(() => {
    ApplicationState.resetForTesting();
  });

  it('returns snapshot that updates when ApplicationState mutates', () => {
    const appState = ApplicationState.getInstance();
    const { result } = renderHook(() => useAppState());

    expect(result.current.cases.size).toBe(0);

    act(() => {
      const person = Person.create({
        firstName: 'Case',
        lastName: 'Owner',
        dateOfBirth: new Date('1990-01-01'),
      });

      const caseEntity = Case.create({
        mcn: 'MCN-001',
        name: 'Test Case',
        personId: person.id,
        person,
      });

      appState.addCase(caseEntity);
    });

    expect(result.current.cases.size).toBe(1);
  });

  it('selector hook returns derived slices and updates reactively', () => {
    const appState = ApplicationState.getInstance();
    const { result } = renderHook(() => useAppStateSelector(state => state.featureFlags));

    expect(result.current).toEqual(DEFAULT_FLAGS);

    act(() => {
      appState.setFeatureFlags({ 'dashboard.widgets.casePriority': false });
    });

    expect(result.current['dashboard.widgets.casePriority']).toBe(false);
  });
});
