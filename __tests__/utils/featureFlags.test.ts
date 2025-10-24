import { afterEach, describe, expect, it } from 'vitest';
import { REFACTOR_FLAGS, useNewArchitecture } from '@/utils/featureFlags';

const resetFlags = (): void => {
  REFACTOR_FLAGS.USE_NEW_ARCHITECTURE = false;
  REFACTOR_FLAGS.USE_CASES_DOMAIN = false;
  REFACTOR_FLAGS.USE_FINANCIALS_DOMAIN = false;
  REFACTOR_FLAGS.USE_NOTES_DOMAIN = false;
  REFACTOR_FLAGS.USE_ALERTS_DOMAIN = false;
  REFACTOR_FLAGS.USE_ACTIVITY_DOMAIN = false;
};

describe('featureFlags', () => {
  afterEach(() => {
    resetFlags();
  });

  it('defaults all refactor flags to disabled', () => {
    expect(REFACTOR_FLAGS).toMatchObject({
      USE_NEW_ARCHITECTURE: false,
      USE_CASES_DOMAIN: false,
      USE_FINANCIALS_DOMAIN: false,
      USE_NOTES_DOMAIN: false,
      USE_ALERTS_DOMAIN: false,
      USE_ACTIVITY_DOMAIN: false,
    });
  });

  it('reflects master toggle status through helper', () => {
    expect(useNewArchitecture()).toBe(false);

    REFACTOR_FLAGS.USE_NEW_ARCHITECTURE = true;

    expect(useNewArchitecture()).toBe(true);
  });

  it('allows enabling individual domain flags independently', () => {
    REFACTOR_FLAGS.USE_CASES_DOMAIN = true;
    REFACTOR_FLAGS.USE_FINANCIALS_DOMAIN = true;

    expect(REFACTOR_FLAGS.USE_CASES_DOMAIN).toBe(true);
    expect(REFACTOR_FLAGS.USE_FINANCIALS_DOMAIN).toBe(true);
    expect(REFACTOR_FLAGS.USE_NOTES_DOMAIN).toBe(false);
  });
});
