import type { CategoryConfig, CategoryKey } from "../../types/categoryConfig";
import { mergeCategoryConfig, sanitizeCategoryValues } from "../../types/categoryConfig";
import { createLogger } from "../logger";
import type { FileStorageService, FileData } from "./FileStorageService";

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

    const baseData: FileData = currentData ?? {
      cases: [],
      exported_at: new Date().toISOString(),
      total_cases: 0,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    };

    const updatedData: FileData = {
      ...baseData,
      categoryConfig: sanitized,
    };

    await this.fileStorage.writeFileData(updatedData);

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
   * Reset category configuration to defaults
   */
  async resetCategoryConfig(): Promise<CategoryConfig> {
    const defaults = mergeCategoryConfig();
    await this.updateCategoryConfig(defaults);

    logger.info("Category configuration reset to defaults");

    return defaults;
  }
}
