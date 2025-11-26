import type { CategoryConfig, CategoryKey, StatusConfig } from "../../types/categoryConfig";
import { mergeCategoryConfig, sanitizeCategoryValues, sanitizeStatusConfigs } from "../../types/categoryConfig";
import { createLogger } from "../logger";
import type { FileStorageService, NormalizedFileData } from "./FileStorageService";

const logger = createLogger("CategoryConfigService");

// ============================================================================
// Type Definitions
// ============================================================================

interface CategoryConfigServiceConfig {
  fileStorage: FileStorageService;
}

// ============================================================================
// CategoryConfigService
// ============================================================================

/**
 * CategoryConfigService
 * 
 * Handles all category configuration operations.
 * Manages user-defined category values (case types, statuses, etc.).
 * 
 * Works with normalized v2.0 data format.
 * 
 * Responsibilities:
 * - Retrieve category configuration
 * - Update full category configuration
 * - Update individual category values
 * - Reset configuration to defaults
 * 
 * Note: Category configuration defines available options for dropdowns
 * and categorization throughout the application.
 */
export class CategoryConfigService {
  private fileStorage: FileStorageService;

  constructor(config: CategoryConfigServiceConfig) {
    this.fileStorage = config.fileStorage;
  }

  /**
   * Get current category configuration
   * Returns merged configuration with defaults
   */
  async getCategoryConfig(): Promise<CategoryConfig> {
    const data = await this.fileStorage.readFileData();
    return data ? mergeCategoryConfig(data.categoryConfig) : mergeCategoryConfig();
  }

  /**
   * Update full category configuration
   * Sanitizes input and merges with defaults
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
   * Update values for a single category key
   * Validates that at least one option is provided
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
   * Update case statuses with full StatusConfig (name + color)
   * Validates that at least one status is provided
   */
  async updateCaseStatuses(statuses: StatusConfig[]): Promise<CategoryConfig> {
    const sanitized = sanitizeStatusConfigs(statuses);
    if (sanitized.length === 0) {
      throw new Error("At least one status is required");
    }

    const currentConfig = await this.getCategoryConfig();
    const nextConfig: CategoryConfig = {
      ...currentConfig,
      caseStatuses: sanitized,
    };

    logger.info("Case statuses updated with colors", {
      statusCount: sanitized.length,
    });

    return this.updateCategoryConfig(nextConfig);
  }

  /**
   * Reset category configuration to defaults
   */
  async resetCategoryConfig(): Promise<CategoryConfig> {
    const defaults = mergeCategoryConfig();
    await this.updateCategoryConfig(defaults);

    logger.info("Category configuration reset to defaults");

    return defaults;
  }
}
