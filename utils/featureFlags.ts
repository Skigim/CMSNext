/**
 * Feature flag catalogue for CMSNext.
 * Keys follow the <area>.<feature>.<subfeature> naming convention for clarity.
 */
export interface FeatureFlags {
	/** Controls visibility of the Case Priority dashboard widget. */
	"dashboard.widgets.casePriority": boolean;
	/** Controls visibility of the Alerts Cleared/Day dashboard widget. */
	"dashboard.widgets.alertsCleared": boolean;
	/** Controls visibility of the Cases Processed/Day dashboard widget. */
	"dashboard.widgets.casesProcessed": boolean;
	/** Controls visibility of the Activity Timeline dashboard widget. */
	"dashboard.widgets.activityTimeline": boolean;
	/** Controls visibility of the Cases by Status dashboard widget. */
	"dashboard.widgets.casesByStatus": boolean;
	/** Controls visibility of the Alerts by Description dashboard widget. */
	"dashboard.widgets.alertsByDescription": boolean;
	/** Controls visibility of the Avg. Alert Age dashboard widget. */
	"dashboard.widgets.avgAlertAge": boolean;
	/** Controls visibility of the Avg. Case Processing Time dashboard widget. */
	"dashboard.widgets.avgCaseProcessing": boolean;
	/** Placeholder for advanced reporting filters. */
	"reports.advancedFilters": boolean;
	/** Placeholder for case bulk actions tooling. */
	"cases.bulkActions": boolean;
}

/** All known feature flag keys. */
export type FeatureFlagKey = keyof FeatureFlags;

const FEATURE_FLAG_DEFAULTS: FeatureFlags = {
	"dashboard.widgets.casePriority": true,
	"dashboard.widgets.alertsCleared": true,
	"dashboard.widgets.casesProcessed": true,
	"dashboard.widgets.activityTimeline": true,
	"dashboard.widgets.casesByStatus": true,
	"dashboard.widgets.alertsByDescription": true,
	"dashboard.widgets.avgAlertAge": true,
	"dashboard.widgets.avgCaseProcessing": true,
	"reports.advancedFilters": false,
	"cases.bulkActions": false,
};

/** Immutable default feature flag configuration. */
export const DEFAULT_FLAGS: Readonly<FeatureFlags> = Object.freeze({
	...FEATURE_FLAG_DEFAULTS,
});

/**
 * Create a feature-flag context by merging overrides with defaults.
 * Returns a new object on every call to preserve immutability.
 */
export function createFeatureFlagContext(overrides?: Partial<FeatureFlags>): FeatureFlags {
	if (!overrides || Object.keys(overrides).length === 0) {
		return { ...DEFAULT_FLAGS };
	}

	return {
		...DEFAULT_FLAGS,
		...overrides,
	};
}

/** Determine whether a feature flag is enabled. */
export function isFeatureEnabled(flag: FeatureFlagKey, flags?: Partial<FeatureFlags>): boolean {
	if (!flags) {
		return Boolean(DEFAULT_FLAGS[flag]);
	}

	if (Object.prototype.hasOwnProperty.call(flags, flag)) {
		return Boolean(flags[flag]);
	}

	return Boolean(DEFAULT_FLAGS[flag]);
}

/** Return a list of enabled feature flags for the provided context. */
export function getEnabledFeatures(flags?: Partial<FeatureFlags>): FeatureFlagKey[] {
	const context = createFeatureFlagContext(flags);
	return (Object.entries(context) as Array<[FeatureFlagKey, boolean]>)
		.filter(([, enabled]) => enabled)
		.map(([key]) => key);
}

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
