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

type UpdateHandler = (key: CategoryKey, values: string[] | StatusConfig[] | AlertTypeConfig[]) => Promise<void>;

type CategoryConfigContextValue = {
  config: CategoryConfig;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateCategory: UpdateHandler;
  resetToDefaults: () => Promise<void>;
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
      console.error("Failed to load category configuration", err);
      setError("Unable to load category options.");
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
