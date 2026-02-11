import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CategoryConfig,
  CategoryKey,
  mergeCategoryConfig,
  sanitizeCategoryValues,
  type StatusConfig,
  type AlertTypeConfig,
  type PartialCategoryConfigInput,
} from "@/types/categoryConfig";
import { useDataManagerSafe } from "./DataManagerContext";
import { useFileStorageDataChange } from "./FileStorageContext";
import { LegacyFormatError } from "@/utils/services/FileStorageService";
import { createLogger } from "@/utils/logger";
import { extractErrorMessage } from "@/utils/errorUtils";

import type { DataManager } from "@/utils/DataManager";

const logger = createLogger("CategoryConfigContext");

/**
 * Options for async category update operations.
 */
interface CategoryUpdateOptions<T> {
  /** Message shown in loading toast */
  loadingMessage: string;
  /** Message shown on success */
  successMessage: string;
  /** Message shown on error (also logged) */
  errorMessage: string;
  /** Callback to handle successful result */
  onSuccess: (result: T) => void;
}

/**
 * Execute an async category update operation with standardized toast feedback.
 * 
 * Handles the common pattern of:
 * 1. Show loading toast
 * 2. Execute async operation
 * 3. Call onSuccess callback
 * 4. Show success/error toast
 * 5. Log errors via logger utility
 * 
 * @param operation - Async function to execute
 * @param options - Toast messages and success handler
 * @returns Promise resolving to result or null on error
 */
async function withCategoryUpdate<T>(
  operation: () => Promise<T>,
  options: CategoryUpdateOptions<T>,
): Promise<T | null> {
  const toastId = toast.loading(options.loadingMessage);
  try {
    const result = await operation();
    options.onSuccess(result);
    toast.success(options.successMessage, { id: toastId });
    return result;
  } catch (error) {
    logger.error(options.errorMessage, { error: extractErrorMessage(error) });
    toast.error(options.errorMessage, { id: toastId });
    return null;
  }
}

/**
 * Handler type for category updates.
 * Accepts category key and values (string array, StatusConfig array, or AlertTypeConfig array)
 * @typedef {Function} UpdateHandler
 */
type UpdateHandler = (key: CategoryKey, values: string[] | StatusConfig[] | AlertTypeConfig[]) => Promise<void>;

/**
 * Category configuration context value - provides access to case/alert/VR configuration.
 * 
 * Manages loading, updating, and resetting category configurations.
 * Handles migration from legacy string[] format to new StatusConfig format.
 * 
 * @interface CategoryConfigContextValue
 */
type CategoryConfigContextValue = {
  /** Current merged category configuration */
  config: CategoryConfig;
  /** Whether configuration is currently loading */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Reload configuration from DataManager */
  refresh: () => Promise<void>;
  /** Update a specific category (statuses, priorities, alert types, etc.) */
  updateCategory: UpdateHandler;
  /** Reset all categories to default values */
  resetToDefaults: () => Promise<void>;
  /** Set configuration directly from file data (used on import) */
  setConfigFromFile: (config?: PartialCategoryConfigInput | null) => void;
};

const noopAsync = async () => {
  /* no-op */
};

const defaultContextValue: CategoryConfigContextValue = {
  config: mergeCategoryConfig(),
  loading: false,
  error: null,
  refresh: noopAsync,
  updateCategory: noopAsync as UpdateHandler,
  resetToDefaults: noopAsync,
  setConfigFromFile: () => {
    /* no-op */
  },
};

const CategoryConfigContext = createContext<CategoryConfigContextValue | null>(null);

// Export context for test utilities - allows direct context injection in tests
export { CategoryConfigContext };

type SuccessHandler = (result: PartialCategoryConfigInput) => void;

/** Check if values contain typed config objects (with colorSlot property) */
function hasTypedColorConfig(values: (string | { colorSlot?: string })[]): boolean {
  return values.length > 0 && typeof values[0] === 'object' && 'colorSlot' in values[0];
}

/** Extract string names from a mixed array of strings and config objects */
function extractNames(values: (string | { name: string })[]): string[] {
  return values.map(v => typeof v === 'string' ? v : v.name);
}

/** Handle caseStatuses category updates (StatusConfig[] or legacy string[]) */
async function handleCaseStatusesUpdate(
  dataManager: DataManager,
  inputValues: (string | StatusConfig)[],
  handleSuccess: SuccessHandler,
): Promise<void> {
  if (hasTypedColorConfig(inputValues)) {
    const statusConfigs = inputValues as StatusConfig[];
    if (statusConfigs.length === 0) {
      toast.error("Please provide at least one status.");
      return;
    }
    await withCategoryUpdate(
      () => dataManager.updateCaseStatuses(statusConfigs),
      {
        loadingMessage: "Saving statuses...",
        successMessage: "Statuses updated",
        errorMessage: "Failed to update statuses",
        onSuccess: handleSuccess,
      },
    );
    return;
  }

  // Legacy string[] format - colors auto-assigned on next load
  const sanitizedValues = sanitizeCategoryValues(extractNames(inputValues));
  if (sanitizedValues.length === 0) {
    toast.error("Please provide at least one option.");
    return;
  }
  await withCategoryUpdate(
    () => dataManager.updateCategoryValues('caseStatuses', sanitizedValues),
    {
      loadingMessage: "Saving options...",
      successMessage: "Options updated",
      errorMessage: "Failed to update statuses",
      onSuccess: handleSuccess,
    },
  );
}

/** Handle alertTypes category updates (AlertTypeConfig[] or legacy string[]) */
async function handleAlertTypesUpdate(
  dataManager: DataManager,
  key: CategoryKey,
  inputValues: (string | AlertTypeConfig)[],
  handleSuccess: SuccessHandler,
): Promise<void> {
  if (hasTypedColorConfig(inputValues)) {
    const alertTypeConfigs = inputValues as AlertTypeConfig[];
    await withCategoryUpdate(
      () => dataManager.updateAlertTypes(alertTypeConfigs),
      {
        loadingMessage: "Saving alert types...",
        successMessage: "Alert types updated",
        errorMessage: "Failed to update alert types",
        onSuccess: handleSuccess,
      },
    );
    return;
  }

  // Legacy string[] format - colors auto-assigned on next load
  const sanitizedValues = sanitizeCategoryValues(extractNames(inputValues));
  await withCategoryUpdate(
    () => dataManager.updateCategoryValues(key, sanitizedValues),
    {
      loadingMessage: "Saving options...",
      successMessage: "Options updated",
      errorMessage: "Failed to update alert types",
      onSuccess: handleSuccess,
    },
  );
}

/**
 * CategoryConfigProvider - Manages case statuses, priorities, alert types, and VR scripts.
 * 
 * Provides configuration data for categorical elements in the application.
 * Handles loading, updating, and resetting category configurations.
 * Automatically reloads when file data changes.
 * 
 * ## Supported Categories
 * 
 * - **caseStatuses**: Case workflow states (e.g., Open, In Progress, Closed)
 *   - Supports color customization via StatusConfig
 * - **casePriorities**: Case priority levels (e.g., High, Medium, Low)
 * - **alertTypes**: Alert classifications for alerts
 *   - Supports color customization via AlertTypeConfig
 * 
 * ## Format Migration
 * 
 * Automatically handles migration from legacy string[] format to new StatusConfig format:
 * ```
 * Legacy: ["Open", "In Progress", "Closed"]
 * New:    [{ name: "Open", colorSlot: "blue" }, ...]
 * ```
 * 
 * ## Setup
 * 
 * ```typescript
 * function App() {
 *   return (
 *     <FileStorageProvider>
 *       <DataManagerProvider>
 *         <CategoryConfigProvider>
 *           <YourApp />
 *         </CategoryConfigProvider>
 *       </DataManagerProvider>
 *     </FileStorageProvider>
 *   );
 * }
 * ```
 * 
 * ## Usage
 * 
 * ```typescript
 * function StatusSelector() {
 *   const { config, updateCategory } = useCategoryConfig();
 *   
 *   const statuses = config.caseStatuses;
 *   
 *   const handleAddStatus = async (statusName) => {
 *     await updateCategory('caseStatuses', [
 *       ...statuses,
 *       { name: statusName, colorSlot: 'blue' }
 *     ]);
 *   };
 * }
 * ```
 * 
 * @component
 * @param {Object} props - Provider props
 * @param {ReactNode} props.children - Child components
 * @returns {ReactNode} Provider wrapping children
 * 
 * @see {@link useCategoryConfig} to access configuration
 * @see {@link CategoryConfig} for configuration structure
 */
export const CategoryConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dataManager = useDataManagerSafe();
  const [config, setConfig] = useState<CategoryConfig>(() => mergeCategoryConfig());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const dataChangeCount = useFileStorageDataChange();

  const loadConfig = useCallback(async () => {
    if (!dataManager) {
      return;
    }

    setLoading(true);
    try {
      const result = await dataManager.getCategoryConfig();
      // mergeCategoryConfig handles migration from legacy string[] format
      setConfig(mergeCategoryConfig(result));
      setError(null);
    } catch (error) {
      // LegacyFormatError is expected when opening old data files - handle gracefully
      if (error instanceof LegacyFormatError) {
        logger.warn("Legacy format detected in category config", { message: error.message });
        setError(error.message);
      } else {
        logger.error("Failed to load category configuration", { error: extractErrorMessage(error) });
        setError("Unable to load category options.");
      }
    } finally {
      setLoading(false);
    }
  }, [dataManager]);

  useEffect(() => {
    if (!dataManager) {
      return;
    }

    loadConfig().catch(error => {
      logger.error("Unexpected error loading category configuration", { error: extractErrorMessage(error) });
    });
  }, [dataManager, loadConfig, dataChangeCount]);

  const updateCategory = useCallback<UpdateHandler>(
    async (key, values) => {
      if (!dataManager) {
        toast.error("Data manager is not available yet.");
        return;
      }

      // Common success handler for all category updates
      const handleSuccess = (updated: PartialCategoryConfigInput) => {
        setConfig(mergeCategoryConfig(updated));
        setError(null);
      };

      // Handle caseStatuses specially since it uses StatusConfig[]
      if (key === 'caseStatuses') {
        await handleCaseStatusesUpdate(dataManager, values as (string | StatusConfig)[], handleSuccess);
        return;
      }

      // Handle alertTypes specially since it uses AlertTypeConfig[]
      if (key === 'alertTypes') {
        await handleAlertTypesUpdate(dataManager, key, values as (string | AlertTypeConfig)[], handleSuccess);
        return;
      }

      // Handle other categories (string[] format)
      const sanitizedValues = sanitizeCategoryValues(values as string[]);
      if (sanitizedValues.length === 0) {
        toast.error("Please provide at least one option.");
        return;
      }

      await withCategoryUpdate(
        () => dataManager.updateCategoryValues(key, sanitizedValues),
        {
          loadingMessage: "Saving options...",
          successMessage: "Options updated",
          errorMessage: "Failed to update category",
          onSuccess: handleSuccess,
        },
      );
    },
    [dataManager],
  );

  const resetToDefaults = useCallback(async () => {
    if (!dataManager) {
      toast.error("Data manager is not available yet.");
      return;
    }

    await withCategoryUpdate(
      () => dataManager.resetCategoryConfig(),
      {
        loadingMessage: "Restoring defaults...",
        successMessage: "Defaults restored",
        errorMessage: "Failed to restore defaults",
        onSuccess: (defaults) => {
          setConfig(mergeCategoryConfig(defaults));
          setError(null);
        },
      },
    );
  }, [dataManager]);

  const setConfigFromFile = useCallback((incoming?: PartialCategoryConfigInput | null) => {
    // mergeCategoryConfig handles migration from legacy string[] format
    const merged = mergeCategoryConfig(incoming);
    setConfig(merged);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    await loadConfig();
  }, [loadConfig]);

  const value = useMemo<CategoryConfigContextValue>(
    () => ({
      config,
      loading,
      error,
      refresh,
      updateCategory,
      resetToDefaults,
      setConfigFromFile,
    }),
    [config, error, loading, refresh, resetToDefaults, setConfigFromFile, updateCategory],
  );

  return <CategoryConfigContext.Provider value={value}>{children}</CategoryConfigContext.Provider>;
};

/**
 * Hook to access category configuration context.
 * 
 * Provides access to case statuses, priorities, alert types, and VR script configuration.
 * Falls back to default configuration if used outside provider (with warning in dev).
 * 
 * ## Example
 * 
 * ```typescript
 * function CaseStatusForm() {
 *   const { config, loading, error, updateCategory } = useCategoryConfig();
 *   
 *   if (loading) return <Spinner />;
 *   if (error) return <Error message={error} />;
 *   
 *   const statuses = config.caseStatuses;
 *   
 *   const handleAddStatus = async (newStatus: StatusConfig) => {
 *     await updateCategory('caseStatuses', [
 *       ...statuses,
 *       newStatus
 *     ]);
 *   };
 * }
 * ```
 * 
 * ## Available Categories
 * 
 * - `caseStatuses`: Array of StatusConfig with color slots
 * - `casePriorities`: Array of priority strings
 * - `alertTypes`: Array of AlertTypeConfig with color slots
 * 
 * ## Fallback Behavior
 * 
 * If used outside CategoryConfigProvider, returns default configuration.
 * Logs warning in development mode.
 * 
 * @hook
 * @returns {CategoryConfigContextValue} Configuration state and update methods
 * 
 * @see {@link updateCategory} for category update patterns
 * @see {@link CategoryConfig} for full configuration structure
 */
export const useCategoryConfig = (): CategoryConfigContextValue => {
  const context = useContext(CategoryConfigContext);

  if (!context) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "useCategoryConfig was called outside of CategoryConfigProvider. Falling back to default configuration.",
      );
    }
    return defaultContextValue;
  }

  return context;
};
