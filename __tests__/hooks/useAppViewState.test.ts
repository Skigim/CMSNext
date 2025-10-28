import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import ApplicationState from '@/application/ApplicationState';
import { useAppViewState } from '@/hooks/useAppViewState';
import { DEFAULT_FLAGS } from '@/utils/featureFlags';

describe('useAppViewState', () => {
  beforeEach(() => {
    ApplicationState.resetInstance();
  });

  afterEach(() => {
    ApplicationState.resetInstance();
  });

  it('exposes feature flags from ApplicationState', () => {
    const { result } = renderHook(() => useAppViewState());

    expect(result.current.featureFlags).toEqual(DEFAULT_FLAGS);
    expect(result.current.isFeatureEnabled('dashboard.widgets.casePriority')).toBe(true);
  });

  it('updates feature flags via setter', () => {
    const { result } = renderHook(() => useAppViewState());

    act(() => {
      result.current.setFeatureFlags({ 'dashboard.widgets.casePriority': false });
    });

    expect(result.current.isFeatureEnabled('dashboard.widgets.casePriority')).toBe(false);
    expect(result.current.featureFlags['dashboard.widgets.casePriority']).toBe(false);
    expect(result.current.featureFlags['dashboard.widgets.alertsCleared']).toBe(true);
  });
});
