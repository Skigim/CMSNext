import type { CategoryConfig, CategoryKey, StatusConfig, AlertTypeConfig } from "../../types/categoryConfig";
import { mergeCategoryConfig, sanitizeCategoryValues, sanitizeStatusConfigs, sanitizeAlertTypeConfigs } from "../../types/categoryConfig";
import { createLogger } from "../logger";
import type { FileStorageService, NormalizedFileData } from "./FileStorageService";

const logger = createLogger("CategoryConfigService");

// ============================================================================
// Sort Order Utilities
// ============================================================================

/**
 * Assign sortOrder to statuses based on array position.
 * Preserves existing sortOrder if present, otherwise assigns based on index.
 */
function assignStatusSortOrder(statuses: StatusConfig[]): StatusConfig[] {
  return statuses.map((status, index) => ({
    ...status,
    sortOrder: status.sortOrder ?? index,
  }));
}

/**
 * Sort statuses by sortOrder (ascending), with undefined sortOrder last.
 */
function sortStatusesBySortOrder(statuses: StatusConfig[]): StatusConfig[] {
  return [...statuses].sort((a, b) => {
    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
}

/**
 * Assign sortOrder to alert types based on array position.
 * Preserves existing sortOrder if present, otherwise assigns based on index.
 */
function assignAlertTypeSortOrder(alertTypes: AlertTypeConfig[]): AlertTypeConfig[] {
  return alertTypes.map((alertType, index) => ({
    ...alertType,
    sortOrder: alertType.sortOrder ?? index,
  }));
}

/**
 * Sort alert types by sortOrder (ascending), with undefined sortOrder last.
 */
function sortAlertTypesBySortOrder(alertTypes: AlertTypeConfig[]): AlertTypeConfig[] {
  return [...alertTypes].sort((a, b) => {
    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Configuration for CategoryConfigService initialization.
 * @interface CategoryConfigServiceConfig
 */
interface CategoryConfigServiceConfig {
  /** File storage service for reading/writing category configuration */
  fileStorage: FileStorageService;
}

// ============================================================================
// CategoryConfigService
// ============================================================================

/**
 * CategoryConfigService - Category and status configuration management
 * 
 * This service manages user-defined category values that control dropdown options
 * and categorization throughout the application. It handles case statuses with
 * color assignments, alert types, VR scripts, and general category values.
 * 
 * ## Architecture
 * 
 * ```
 * CategoryConfigService
 *     ↓
 * FileStorageService (read/write operations)
 *     ↓
 * AutosaveFileService (file I/O)
 * ```
 * 
 * ## Data Format
 * 
 * Category configuration is stored as part of NormalizedFileData:
 * 
 * ```typescript
 * {
 *   caseStatuses: StatusConfig[],      // { name, colorSlot }
 *   alertTypes: AlertTypeConfig[],     // { name, colorSlot }
 *   caseTypes: string[],
 *   livingArrangements: string[],
 *   contactMethods: string[]
 * }
 * ```
 * 
 * ## Core Responsibilities
 * 
 * ### Configuration Retrieval
 * - Get current category configuration
 * - Merge with defaults for missing values
 * - Always return complete configuration
 * 
 * ### Full Updates
 * - Update entire category configuration
 * - Sanitize and validate all values
 * - Merge with defaults
 * 
 * ### Partial Updates
 * - Update individual category keys
 * - Update case statuses with color assignments
 * - Update alert types with color assignments
 * - Update VR script templates
 * 
 * ### Reset Operations
 * - Reset to factory defaults
 * - Clear user customizations
 * 
 * ## Validation & Sanitization
 * 
 * All updates go through sanitization:
 * - Empty strings removed
 * - Duplicate values eliminated
 * - At least one option required (except alert types and VR scripts)
 * - Color slot assignments validated
 * 
 * ## Color Slot System
 * 
 * Case statuses and alert types can be assigned color slots for visual
 * differentiation in the UI:
 * - blue, green, red, amber, purple, slate, teal, rose, orange, cyan
 * 
 * ## Pattern: Read → Modify → Write
 * 
 * All operations follow the stateless pattern:
 * 1. Read current configuration
 * 2. Sanitize and validate changes
 * 3. Merge with defaults
 * 4. Write updated configuration
 * 5. Return updated config
 * 
 * @class CategoryConfigService
 * @see {@link FileStorageService} for underlying storage operations
 * @see {@link mergeCategoryConfig} for default values and merging
 */
export class CategoryConfigService {
  /** File storage service for data persistence */
  private fileStorage: FileStorageService;

  /**
   * Create a new CategoryConfigService instance.
   * 
   * @param {CategoryConfigServiceConfig} config - Configuration object
   * @param {FileStorageService} config.fileStorage - File storage service instance
   */
  constructor(config: CategoryConfigServiceConfig) {
    this.fileStorage = config.fileStorage;
  }

  /**
   * Get current category configuration.
   * 
   * Returns configuration merged with defaults to ensure all required
   * fields are present. If no configuration exists, returns defaults.
   * Statuses and alert types are sorted by sortOrder for consistent ordering.
   * 
   * @returns {Promise<CategoryConfig>} Complete category configuration
   * 
   * @example
   * const config = await categoryConfigService.getCategoryConfig();
   * console.log(`Available statuses: ${config.caseStatuses.length}`);
   * console.log(`Case types: ${config.caseTypes.join(', ')}`);
   */
  async getCategoryConfig(): Promise<CategoryConfig> {
    const data = await this.fileStorage.readFileData();
    const config = data ? mergeCategoryConfig(data.categoryConfig) : mergeCategoryConfig();
    
    // Sort by sortOrder for consistent ordering
    return {
      ...config,
      caseStatuses: sortStatusesBySortOrder(config.caseStatuses),
      alertTypes: sortAlertTypesBySortOrder(config.alertTypes),
    };
  }

  /**
   * Update full category configuration.
   * 
   * This method:
   * 1. Sanitizes input configuration
   * 2. Merges with defaults
   * 3. Creates base data structure if none exists
   * 4. Updates configuration in storage
   * 5. Logs the update
   * 6. Returns sanitized configuration
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * @param {CategoryConfig} categoryConfig - The new category configuration
   * @returns {Promise<CategoryConfig>} The updated and sanitized configuration
   * 
   * @example
   * const updated = await categoryConfigService.updateCategoryConfig({
   *   caseStatuses: [
   *     { name: "Active", colorSlot: "blue" },
   *     { name: "Pending", colorSlot: "amber" }
   *   ],
   *   caseTypes: ["Medical Assistance", "SNAP", "TANF"],
   *   livingArrangements: ["Nursing Home", "Assisted Living"]
   * });
   */
  async updateCategoryConfig(categoryConfig: CategoryConfig): Promise<CategoryConfig> {
    const sanitized = mergeCategoryConfig(categoryConfig);
    const currentData = await this.fileStorage.readFileData();

    const baseData: NormalizedFileData = currentData ?? {
      version: "2.0",
      cases: [],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: new Date().toISOString(),
      total_cases: 0,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    };

    const updatedData: NormalizedFileData = {
      ...baseData,
      categoryConfig: sanitized,
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    logger.info("Category configuration updated", {
      categories: Object.keys(sanitized),
    });

    return sanitized;
  }

  /**
   * Update values for a single category key.
   * 
   * This method updates one specific category (e.g., caseTypes, livingArrangements)
   * while preserving all other configuration values.
   * 
   * **Validation:** At least one value is required (empty arrays are rejected).
   * 
   * @param {CategoryKey} key - The category key to update
   * @param {string[]} values - The new values for the category
   * @returns {Promise<CategoryConfig>} The updated complete configuration
   * @throws {Error} If no values provided (empty array)
   * 
   * @example
   * const updated = await categoryConfigService.updateCategoryValues(
   *   'caseTypes',
   *   ['Medical Assistance', 'SNAP', 'TANF', 'Medicaid']
   * );
   * // Only caseTypes updated, other config preserved
   */
  async updateCategoryValues(key: CategoryKey, values: string[]): Promise<CategoryConfig> {
    const sanitizedValues = sanitizeCategoryValues(values);
    if (sanitizedValues.length === 0) {
      throw new Error("At least one option is required");
    }

    const currentConfig = await this.getCategoryConfig();
    const nextConfig: CategoryConfig = {
      ...currentConfig,
      [key]: sanitizedValues,
    };

    logger.info("Category values updated", {
      key,
      valueCount: sanitizedValues.length,
    });

    return this.updateCategoryConfig(nextConfig);
  }

  /**
   * Update case statuses with color slot assignments.
   * 
   * This method updates the available case statuses and their associated
   * color slots for visual differentiation in the UI.
   * 
   * **Validation:** At least one status is required (empty arrays are rejected).
   * 
   * @param {StatusConfig[]} statuses - Array of status configurations with names and color slots
   * @returns {Promise<CategoryConfig>} The updated complete configuration
   * @throws {Error} If no statuses provided (empty array)
   * 
   * @example
   * const updated = await categoryConfigService.updateCaseStatuses([
   *   { name: "Active", colorSlot: "blue" },
   *   { name: "Pending", colorSlot: "amber" },
   *   { name: "Approved", colorSlot: "green" },
   *   { name: "Denied", colorSlot: "red" }
   * ]);
   */
  async updateCaseStatuses(statuses: StatusConfig[]): Promise<CategoryConfig> {
    const sanitized = sanitizeStatusConfigs(statuses);
    if (sanitized.length === 0) {
      throw new Error("At least one status is required");
    }

    // Assign sortOrder based on array position
    const withSortOrder = assignStatusSortOrder(sanitized);

    const currentConfig = await this.getCategoryConfig();
    const nextConfig: CategoryConfig = {
      ...currentConfig,
      caseStatuses: withSortOrder,
    };

    logger.info("Case statuses updated with colors and sort order", {
      statusCount: withSortOrder.length,
    });

    return this.updateCategoryConfig(nextConfig);
  }

  /**
   * Update alert types with color slot assignments.
   * 
   * This method updates the available alert types and their associated
   * color slots for visual differentiation in the UI.
   * 
   * **Note:** Unlike statuses, alert types can be empty (no alerts may
   * have been imported yet).
   * 
   * @param {AlertTypeConfig[]} alertTypes - Array of alert type configurations with names and color slots
   * @returns {Promise<CategoryConfig>} The updated complete configuration
   * 
   * @example
   * const updated = await categoryConfigService.updateAlertTypes([
   *   { name: "Income Mismatch", colorSlot: "amber" },
   *   { name: "Missing Documentation", colorSlot: "red" },
   *   { name: "Review Required", colorSlot: "blue" }
   * ]);
   */
  async updateAlertTypes(alertTypes: AlertTypeConfig[]): Promise<CategoryConfig> {
    const sanitized = sanitizeAlertTypeConfigs(alertTypes);

    // Assign sortOrder based on array position
    const withSortOrder = assignAlertTypeSortOrder(sanitized);

    const currentConfig = await this.getCategoryConfig();
    const nextConfig: CategoryConfig = {
      ...currentConfig,
      alertTypes: withSortOrder,
    };

    logger.info("Alert types updated with colors and sort order", {
      alertTypeCount: withSortOrder.length,
    });

    return this.updateCategoryConfig(nextConfig);
  }

  /**
   * Update case summary template configuration.
   * 
   * Configures the default section order and visibility for case summaries.
   * This affects the "Generate Case Summary" feature.
   * 
   * @param {SummaryTemplateConfig} template - Summary template configuration
   * @returns {Promise<CategoryConfig>} Updated configuration
   * 
   * @example
   * const updated = await categoryConfigService.updateSummaryTemplate({
   *   sectionOrder: ['notes', 'caseInfo', 'personInfo', 'resources'],
   *   defaultSections: {
   *     notes: true,
   *     caseInfo: true,
   *     personInfo: true,
   *     relationships: false,
   *     resources: true,
   *     income: false,
   *     expenses: false,
   *     avsTracking: false,
   *   }
   * });
   */
  async updateSummaryTemplate(template: import('@/types/categoryConfig').SummaryTemplateConfig): Promise<CategoryConfig> {
    const currentConfig = await this.getCategoryConfig();
    const nextConfig: CategoryConfig = {
      ...currentConfig,
      summaryTemplate: template,
    };

    logger.info("Summary template updated", {
      sectionCount: template.sectionOrder.length,
    });

    return this.updateCategoryConfig(nextConfig);
  }

  /**
   * Reset category configuration to factory defaults.
   * 
   * This method clears all user customizations and restores the default
   * configuration values for all categories, statuses, and scripts.
   * 
   * **Warning:** This operation cannot be undone. All customizations
   * will be lost.
   * 
   * @returns {Promise<CategoryConfig>} The default configuration
   * 
   * @example
   * const defaults = await categoryConfigService.resetCategoryConfig();
   * console.log('Configuration reset to defaults');
   * console.log(`Default statuses: ${defaults.caseStatuses.length}`);
   */
  async resetCategoryConfig(): Promise<CategoryConfig> {
    const defaults = mergeCategoryConfig();
    await this.updateCategoryConfig(defaults);

    logger.info("Category configuration reset to defaults");

    return defaults;
  }
}
