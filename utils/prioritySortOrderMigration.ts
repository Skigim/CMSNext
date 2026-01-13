/**
 * Priority Sort Order Migration
 * =============================
 *
 * Migrates existing CategoryConfig data to include sortOrder and priorityEnabled
 * fields for the new dynamic priority weight calculation system.
 *
 * TODO: Remove this migration utility after next release once all users have
 * had their data migrated.
 *
 * @module utils/prioritySortOrderMigration
 */

import type {
  CategoryConfig,
  StatusConfig,
  AlertTypeConfig,
} from "@/types/categoryConfig";

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Check if a status config needs migration (missing sortOrder or priorityEnabled).
 */
function statusNeedsMigration(status: StatusConfig): boolean {
  return status.sortOrder === undefined;
}

/**
 * Check if an alert type config needs migration (missing sortOrder).
 */
function alertTypeNeedsMigration(alertType: AlertTypeConfig): boolean {
  return alertType.sortOrder === undefined;
}

/**
 * Migrate a single status config, assigning sortOrder and priorityEnabled.
 *
 * For backward compatibility, "Intake" status is marked as priorityEnabled=true
 * to preserve existing priority queue behavior.
 */
function migrateStatusConfig(
  status: StatusConfig,
  index: number
): StatusConfig {
  const needsPriorityEnabled = status.priorityEnabled === undefined;
  const isIntake = status.name.toLowerCase() === "intake";

  return {
    ...status,
    sortOrder: status.sortOrder ?? index,
    // Default priorityEnabled to true for Intake, false for others
    priorityEnabled: needsPriorityEnabled
      ? isIntake
      : (status.priorityEnabled ?? false),
  };
}

/**
 * Migrate a single alert type config, assigning sortOrder.
 */
function migrateAlertTypeConfig(
  alertType: AlertTypeConfig,
  index: number
): AlertTypeConfig {
  return {
    ...alertType,
    sortOrder: alertType.sortOrder ?? index,
  };
}

/**
 * Check if the category config needs migration.
 */
export function categoryConfigNeedsMigration(config: CategoryConfig): boolean {
  const statusesNeedMigration = config.caseStatuses.some(statusNeedsMigration);
  const alertTypesNeedMigration = config.alertTypes.some(alertTypeNeedsMigration);

  return statusesNeedMigration || alertTypesNeedMigration;
}

/**
 * Migrate category config to include sortOrder and priorityEnabled fields.
 *
 * This function:
 * 1. Assigns sortOrder based on array index for both statuses and alert types
 * 2. Sets priorityEnabled=true for "Intake" status (backward compatibility)
 * 3. Returns a new config object (does not mutate input)
 *
 * @param config - The category config to migrate
 * @returns Migrated category config with sortOrder and priorityEnabled fields
 *
 * @example
 * ```typescript
 * if (categoryConfigNeedsMigration(config)) {
 *   const migratedConfig = migrateCategoryConfigPriority(config);
 *   await categoryConfigService.updateCategoryConfig(migratedConfig);
 * }
 * ```
 */
export function migrateCategoryConfigPriority(
  config: CategoryConfig
): CategoryConfig {
  const migratedStatuses = config.caseStatuses.map(migrateStatusConfig);
  const migratedAlertTypes = config.alertTypes.map(migrateAlertTypeConfig);

  return {
    ...config,
    caseStatuses: migratedStatuses,
    alertTypes: migratedAlertTypes,
  };
}

/**
 * Run migration on file data and return updated data if changes were made.
 *
 * This is a convenience function for use in data loading pipelines.
 *
 * @param categoryConfig - The category config from file data
 * @returns Object with migrated config and flag indicating if migration occurred
 */
export function runPrioritySortOrderMigration(
  categoryConfig: CategoryConfig
): { config: CategoryConfig; migrated: boolean } {
  if (!categoryConfigNeedsMigration(categoryConfig)) {
    return { config: categoryConfig, migrated: false };
  }

  const migratedConfig = migrateCategoryConfigPriority(categoryConfig);
  return { config: migratedConfig, migrated: true };
}
