import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_FLAGS,
  createFeatureFlagContext,
  getEnabledFeatures,
  getRefactorFlags,
  isFeatureEnabled,
  setRefactorFlags,
  useNewArchitecture,
  type FeatureFlags,
} from '@/utils/featureFlags';

const resetRefactorFlags = (): void => {
  setRefactorFlags({
    USE_NEW_ARCHITECTURE: false,
    USE_CASES_DOMAIN: false,
    USE_FINANCIALS_DOMAIN: false,
    USE_NOTES_DOMAIN: false,
    USE_ALERTS_DOMAIN: false,
    USE_ACTIVITY_DOMAIN: false,
  });
};

describe('featureFlags', () => {
  afterEach(() => {
    resetRefactorFlags();
  });

  it('exposes immutable default configuration', () => {
    expect(DEFAULT_FLAGS['dashboard.widgets.casePriority']).toBe(true);
    expect(DEFAULT_FLAGS['reports.advancedFilters']).toBe(false);
    expect(Object.isFrozen(DEFAULT_FLAGS)).toBe(true);
  });

  it('creates feature flag context with overrides applied immutably', () => {
    const overrides: Partial<FeatureFlags> = {
      'dashboard.widgets.casePriority': false,
      'reports.advancedFilters': true,
    };

    const context = createFeatureFlagContext(overrides);

    expect(context['dashboard.widgets.casePriority']).toBe(false);
    expect(context['reports.advancedFilters']).toBe(true);
    expect(context).not.toBe(DEFAULT_FLAGS);

    // Re-running should produce a fresh object
    const secondContext = createFeatureFlagContext(overrides);
    expect(secondContext).not.toBe(context);
  });

  it('evaluates feature enablement using defaults and overrides', () => {
    expect(isFeatureEnabled('dashboard.widgets.casesProcessed')).toBe(true);
    expect(isFeatureEnabled('reports.advancedFilters')).toBe(false);

    const overrides: Partial<FeatureFlags> = { 'reports.advancedFilters': true };
    expect(isFeatureEnabled('reports.advancedFilters', overrides)).toBe(true);
  });

  it('returns a list of enabled flags for a given context', () => {
    const overrides: Partial<FeatureFlags> = {
      'dashboard.widgets.avgAlertAge': false,
      'cases.bulkActions': true,
    };

    const enabled = getEnabledFeatures(overrides);

    expect(enabled).toContain('dashboard.widgets.casePriority');
    expect(enabled).not.toContain('dashboard.widgets.avgAlertAge');
    expect(enabled).toContain('cases.bulkActions');
  });

  it('keeps refactor feature toggles defaulted to disabled', () => {
    const flags = getRefactorFlags();
    expect(flags).toMatchObject({
      USE_NEW_ARCHITECTURE: false,
      USE_CASES_DOMAIN: false,
      USE_FINANCIALS_DOMAIN: false,
      USE_NOTES_DOMAIN: false,
      USE_ALERTS_DOMAIN: false,
      USE_ACTIVITY_DOMAIN: false,
    });
  });

  it('reflects refactor master toggle via helper', () => {
    expect(useNewArchitecture()).toBe(false);
    setRefactorFlags({ USE_NEW_ARCHITECTURE: true });
    expect(useNewArchitecture()).toBe(true);
  });
});
