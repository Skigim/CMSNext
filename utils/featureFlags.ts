export interface RefactorFeatureFlags {
	/** Master toggle controlling the architecture refactor rollout. */
	USE_NEW_ARCHITECTURE: boolean;
	/** Enables the new cases domain implementation. */
	USE_CASES_DOMAIN: boolean;
	/** Enables the new financials domain implementation. */
	USE_FINANCIALS_DOMAIN: boolean;
	/** Enables the new notes domain implementation. */
	USE_NOTES_DOMAIN: boolean;
	/** Enables the new alerts domain implementation. */
	USE_ALERTS_DOMAIN: boolean;
	/** Enables the new activity domain implementation. */
	USE_ACTIVITY_DOMAIN: boolean;
}

/** Feature flags governing the architecture refactor rollout. */
export const REFACTOR_FLAGS: RefactorFeatureFlags = {
	/** Master toggle for switching between legacy and refactored architecture. */
	USE_NEW_ARCHITECTURE: false,
	/** Flag for enabling the cases domain rewrite. */
	USE_CASES_DOMAIN: false,
	/** Flag for enabling the financials domain rewrite. */
	USE_FINANCIALS_DOMAIN: false,
	/** Flag for enabling the notes domain rewrite. */
	USE_NOTES_DOMAIN: false,
	/** Flag for enabling the alerts domain rewrite. */
	USE_ALERTS_DOMAIN: false,
	/** Flag for enabling the activity domain rewrite. */
	USE_ACTIVITY_DOMAIN: false,
};

/**
 * Convenience helper to determine if the architecture refactor is active.
 */
export function useNewArchitecture(): boolean {
	return REFACTOR_FLAGS.USE_NEW_ARCHITECTURE;
}

/** Temporary toggle for demo alerts data while the dataset stabilizes. */
export const ENABLE_SAMPLE_ALERTS = false;
