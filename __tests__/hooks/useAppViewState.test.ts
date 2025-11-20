import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAppViewState } from '@/hooks/useAppViewState';
import { DEFAULT_FLAGS } from '@/utils/featureFlags';

describe('useAppViewState', () => {
  it('exposes feature flags with defaults', () => {
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
