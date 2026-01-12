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
  type SummaryTemplateConfig,
} from "@/types/categoryConfig";
import { useDataManagerSafe } from "./DataManagerContext";
import { useFileStorageDataChange } from "./FileStorageContext";
import { LegacyFormatError } from "@/utils/services/FileStorageService";
import { createLogger } from "@/utils/logger";

const logger = createLogger("CategoryConfigContext");

/**
 * Handler type for category updates.
 * Accepts category key and values (string array, StatusConfig array, or SummaryTemplateConfig)
 * @typedef {Function} UpdateHandler
 */
type UpdateHandler = (key: CategoryKey, values: string[] | StatusConfig[] | AlertTypeConfig[] | SummaryTemplateConfig) => Promise<void>;

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
    } catch (err) {
      // LegacyFormatError is expected when opening old data files - handle gracefully
      if (err instanceof LegacyFormatError) {
        logger.warn("Legacy format detected in category config", { message: err.message });
        setError(err.message);
      } else {
        console.error("Failed to load category configuration", err);
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

    loadConfig().catch(err => {
      console.error("Unexpected error loading category configuration", err);
    });
  }, [dataManager, loadConfig, dataChangeCount]);

  const updateCategory = useCallback<UpdateHandler>(
    async (key, values) => {
      if (!dataManager) {
        toast.error("Data manager is not available yet.");
        return;
      }

      // Handle caseStatuses specially since it uses StatusConfig[]
      if (key === 'caseStatuses') {
        const inputValues = values as (string | StatusConfig)[];
        
        // Check if we have StatusConfig objects (with colorSlot)
        const hasColorInfo = inputValues.length > 0 && 
          typeof inputValues[0] === 'object' && 
          'colorSlot' in inputValues[0];
        
        if (hasColorInfo) {
          // New format with colors - use updateCaseStatuses
          const statusConfigs = inputValues as StatusConfig[];
          if (statusConfigs.length === 0) {
            toast.error("Please provide at least one status.");
            return;
          }

          const toastId = toast.loading("Saving statuses...");
          try {
            const updated = await dataManager.updateCaseStatuses(statusConfigs);
            setConfig(mergeCategoryConfig(updated));
            setError(null);
            toast.success("Statuses updated", { id: toastId });
          } catch (err) {
            console.error("Failed to update statuses", err);
            toast.error("Failed to update statuses", { id: toastId });
          }
          return;
        }
        
        // Legacy string[] format - normalize and save as strings
        // Colors will be auto-assigned on next load
        const stringValues: string[] = inputValues.map(v => 
          typeof v === 'string' ? v : v.name
        );
        const sanitizedValues = sanitizeCategoryValues(stringValues);
        if (sanitizedValues.length === 0) {
          toast.error("Please provide at least one option.");
          return;
        }

        const toastId = toast.loading("Saving options...");
        try {
          const updated = await dataManager.updateCategoryValues(key, sanitizedValues);
          setConfig(mergeCategoryConfig(updated));
          setError(null);
          toast.success("Options updated", { id: toastId });
        } catch (err) {
          console.error("Failed to update statuses", err);
          toast.error("Failed to update options", { id: toastId });
        }
        return;
      }

      // Handle alertTypes specially since it uses AlertTypeConfig[]
      if (key === 'alertTypes') {
        const inputValues = values as (string | AlertTypeConfig)[];
        
        // Check if we have AlertTypeConfig objects (with colorSlot)
        const hasColorInfo = inputValues.length > 0 && 
          typeof inputValues[0] === 'object' && 
          'colorSlot' in inputValues[0];
        
        if (hasColorInfo) {
          // New format with colors - use updateAlertTypes
          const alertTypeConfigs = inputValues as AlertTypeConfig[];

          const toastId = toast.loading("Saving alert types...");
          try {
            const updated = await dataManager.updateAlertTypes(alertTypeConfigs);
            setConfig(mergeCategoryConfig(updated));
            setError(null);
            toast.success("Alert types updated", { id: toastId });
          } catch (err) {
            console.error("Failed to update alert types", err);
            toast.error("Failed to update alert types", { id: toastId });
          }
          return;
        }
        
        // Legacy string[] format - normalize and save as strings
        // Colors will be auto-assigned on next load
        const stringValues: string[] = inputValues.map(v => 
          typeof v === 'string' ? v : v.name
        );
        const sanitizedValues = sanitizeCategoryValues(stringValues);

        const toastId = toast.loading("Saving options...");
        try {
          const updated = await dataManager.updateCategoryValues(key, sanitizedValues);
          setConfig(mergeCategoryConfig(updated));
          setError(null);
          toast.success("Options updated", { id: toastId });
        } catch (err) {
          console.error("Failed to update alert types", err);
          toast.error("Failed to update options", { id: toastId });
        }
        return;
      }

      // Handle summaryTemplate specially since it uses SummaryTemplateConfig
      if (key === 'summaryTemplate') {
        const template = values as SummaryTemplateConfig;

        const toastId = toast.loading("Saving summary template...");
        try {
          const updated = await dataManager.updateSummaryTemplate(template);
          setConfig(mergeCategoryConfig(updated));
          setError(null);
          toast.success("Summary template updated", { id: toastId });
        } catch (err) {
          console.error("Failed to update summary template", err);
          toast.error("Failed to update summary template", { id: toastId });
        }
        return;
      }

      // Handle other categories (string[] format)
      const sanitizedValues = sanitizeCategoryValues(values as string[]);
      if (sanitizedValues.length === 0) {
        toast.error("Please provide at least one option.");
        return;
      }

      const toastId = toast.loading("Saving options...");
      try {
        const updated = await dataManager.updateCategoryValues(key, sanitizedValues);
        // mergeCategoryConfig handles migration from legacy format
        setConfig(mergeCategoryConfig(updated));
        setError(null);
        toast.success("Options updated", { id: toastId });
      } catch (err) {
        console.error("Failed to update category", err);
        toast.error("Failed to update options", { id: toastId });
      }
    },
    [dataManager],
  );

  const resetToDefaults = useCallback(async () => {
    if (!dataManager) {
      toast.error("Data manager is not available yet.");
      return;
    }

    const toastId = toast.loading("Restoring defaults...");
    try {
      const defaults = await dataManager.resetCategoryConfig();
      // mergeCategoryConfig handles migration from legacy format
      setConfig(mergeCategoryConfig(defaults));
      setError(null);
      toast.success("Defaults restored", { id: toastId });
    } catch (err) {
      console.error("Failed to reset category configuration", err);
      toast.error("Failed to restore defaults", { id: toastId });
    }
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
