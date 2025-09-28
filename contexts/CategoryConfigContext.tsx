import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CategoryConfig,
  CategoryKey,
  mergeCategoryConfig,
  sanitizeCategoryValues,
} from "@/types/categoryConfig";
import { useDataManagerSafe } from "./DataManagerContext";

type UpdateHandler = (key: CategoryKey, values: string[]) => Promise<void>;

type CategoryConfigContextValue = {
  config: CategoryConfig;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateCategory: UpdateHandler;
  resetToDefaults: () => Promise<void>;
  setConfigFromFile: (config?: Partial<CategoryConfig> | null) => void;
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

  const loadConfig = useCallback(async () => {
    if (!dataManager) {
      return;
    }

    setLoading(true);
    try {
      const result = await dataManager.getCategoryConfig();
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
  }, [dataManager, loadConfig]);

  const updateCategory = useCallback<UpdateHandler>(
    async (key, values) => {
      if (!dataManager) {
        toast.error("Data manager is not available yet.");
        return;
      }

      const sanitizedValues = sanitizeCategoryValues(values);
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
      setConfig(mergeCategoryConfig(defaults));
      setError(null);
      toast.success("Defaults restored", { id: toastId });
    } catch (err) {
      console.error("Failed to reset category configuration", err);
      toast.error("Failed to restore defaults", { id: toastId });
    }
  }, [dataManager]);

  const setConfigFromFile = useCallback((incoming?: Partial<CategoryConfig> | null) => {
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
