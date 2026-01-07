import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Template, TemplateCategory } from "@/types/template";
import { useDataManagerSafe } from "./DataManagerContext";
import { useFileStorageDataChange } from "./FileStorageContext";
import { createLogger } from "@/utils/logger";

const logger = createLogger("TemplateContext");

/**
 * Migrates legacy vrScripts from CategoryConfig to the new templates array.
 * Only migrates scripts that don't already exist (by ID to be precise).
 * 
 * @returns Number of templates migrated
 */
async function migrateVRScriptsIfNeeded(
  dataManager: NonNullable<ReturnType<typeof useDataManagerSafe>>
): Promise<number> {
  try {
    const categoryConfig = await dataManager.getCategoryConfig();
    const existingTemplates = await dataManager.getAllTemplates();
    
    const vrScripts = categoryConfig.vrScripts ?? [];
    if (vrScripts.length === 0) {
      return 0;
    }
    
    // Check which scripts need migration (by ID to avoid duplicates)
    const existingIds = new Set(existingTemplates.map(t => t.id));
    const existingNames = new Set(existingTemplates.map(t => t.name));
    const scriptsToMigrate = vrScripts.filter(s => !existingIds.has(s.id) && !existingNames.has(s.name));
    
    if (scriptsToMigrate.length === 0) {
      return 0;
    }
    
    logger.info(`Migrating ${scriptsToMigrate.length} VR scripts to new template system`);
    
    // Migrate each script
    for (const script of scriptsToMigrate) {
      await dataManager.addTemplate({
        name: script.name,
        category: 'vr',
        template: script.template,
      });
    }
    
    logger.info(`Successfully migrated ${scriptsToMigrate.length} VR scripts`);
    return scriptsToMigrate.length;
  } catch (err) {
    logger.error("Failed to migrate VR scripts", { error: err });
    return 0;
  }
}

/**
 * Template context value - provides access to unified template management.
 * 
 * Manages CRUD operations for all template types: VR, Summary, Narrative.
 * 
 * @interface TemplateContextValue
 */
type TemplateContextValue = {
  /** All templates from storage */
  templates: Template[];
  /** Whether templates are currently loading */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Reload templates from DataManager */
  refresh: () => Promise<void>;
  /** Get templates filtered by category */
  getTemplatesByCategory: (category: TemplateCategory) => Template[];
  /** Get a single template by ID */
  getTemplateById: (id: string) => Template | undefined;
  /** Add a new template */
  addTemplate: (template: Omit<Template, "id" | "createdAt" | "updatedAt">) => Promise<Template | null>;
  /** Update an existing template */
  updateTemplate: (id: string, updates: Partial<Omit<Template, "id" | "createdAt" | "updatedAt">>) => Promise<Template | null>;
  /** Delete a template */
  deleteTemplate: (id: string) => Promise<boolean>;
};

const noopAsync = async () => {
  /* no-op */
};

const defaultContextValue: TemplateContextValue = {
  templates: [],
  loading: false,
  error: null,
  refresh: noopAsync,
  getTemplatesByCategory: () => [],
  getTemplateById: () => undefined,
  addTemplate: async () => null,
  updateTemplate: async () => null,
  deleteTemplate: async () => false,
};

const TemplateContext = createContext<TemplateContextValue>(defaultContextValue);

// Export context for test utilities - allows direct context injection in tests
export { TemplateContext };

/**
 * TemplateProvider - Manages all template types with unified storage.
 * 
 * Provides template data and CRUD operations for VR, Summary, and Narrative templates.
 * Automatically reloads when file data changes.
 * 
 * ## Template Categories
 * 
 * - **vr**: VR verification request scripts
 * - **summary**: Case summary section templates  
 * - **narrative**: Case narrative templates
 * 
 * ## Placeholder System
 * 
 * All templates use unified `{fieldName}` placeholder syntax:
 * - Simple: `{caseNumber}`, `{memberName}`, `{currentDate}`
 * - With date offset: `{currentDate+30}` for 30 days in future
 * 
 * ## Setup
 * 
 * ```typescript
 * function App() {
 *   return (
 *     <FileStorageProvider>
 *       <DataManagerProvider>
 *         <TemplateProvider>
 *           <YourApp />
 *         </TemplateProvider>
 *       </DataManagerProvider>
 *     </FileStorageProvider>
 *   );
 * }
 * ```
 * 
 * ## Usage
 * 
 * ```typescript
 * function TemplateEditor() {
 *   const { templates, getTemplatesByCategory, updateTemplate } = useTemplates();
 *   
 *   const vrTemplates = getTemplatesByCategory('vr');
 *   
 *   const handleUpdate = async (id, content) => {
 *     await updateTemplate(id, { content });
 *   };
 * }
 * ```
 * 
 * @component
 * @param {Object} props - Provider props
 * @param {ReactNode} props.children - Child components
 * @returns {ReactNode} Provider wrapping children
 * 
 * @see {@link useTemplates} to access templates
 * @see {@link Template} for template structure
 */
export const TemplateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dataManager = useDataManagerSafe();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const dataChangeCount = useFileStorageDataChange();
  const hasMigrated = useRef(false);

  const loadTemplates = useCallback(async () => {
    if (!dataManager) {
      return;
    }

    setLoading(true);
    try {
      // Run migration once on first load
      if (!hasMigrated.current) {
        hasMigrated.current = true;
        const migrated = await migrateVRScriptsIfNeeded(dataManager);
        if (migrated > 0) {
          toast.success(`Migrated ${migrated} VR template(s) to new system`);
        }
      }
      
      const result = await dataManager.getAllTemplates();
      setTemplates(result);
      setError(null);
    } catch (err) {
      logger.error("Failed to load templates", { error: err });
      setError("Unable to load templates.");
    } finally {
      setLoading(false);
    }
  }, [dataManager]);

  useEffect(() => {
    if (!dataManager) {
      return;
    }

    loadTemplates().catch(err => {
      logger.error("Unexpected error loading templates", { error: err });
    });
  }, [dataManager, loadTemplates, dataChangeCount]);

  const getTemplatesByCategory = useCallback(
    (category: TemplateCategory): Template[] => {
      return templates.filter(t => t.category === category);
    },
    [templates]
  );

  const getTemplateById = useCallback(
    (id: string): Template | undefined => {
      return templates.find(t => t.id === id);
    },
    [templates]
  );

  const addTemplate = useCallback(
    async (template: Omit<Template, "id" | "createdAt" | "updatedAt">): Promise<Template | null> => {
      if (!dataManager) {
        toast.error("Data manager is not available yet.");
        return null;
      }

      try {
        const newTemplate = await dataManager.addTemplate(template);
        // Local state will be updated via dataChangeCount effect
        toast.success(`Template "${template.name}" created`);
        return newTemplate;
      } catch (err) {
        logger.error("Failed to add template", { error: err });
        toast.error("Failed to create template");
        return null;
      }
    },
    [dataManager]
  );

  const updateTemplate = useCallback(
    async (
      id: string,
      updates: Partial<Omit<Template, "id" | "createdAt" | "updatedAt">>
    ): Promise<Template | null> => {
      if (!dataManager) {
        toast.error("Data manager is not available yet.");
        return null;
      }

      try {
        const updated = await dataManager.updateTemplate(id, updates);
        if (updated) {
          // Local state will be updated via dataChangeCount effect
          toast.success("Template updated");
          return updated;
        } else {
          toast.error("Template not found");
          return null;
        }
      } catch (err) {
        logger.error("Failed to update template", { error: err });
        toast.error("Failed to update template");
        return null;
      }
    },
    [dataManager]
  );

  const deleteTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      if (!dataManager) {
        toast.error("Data manager is not available yet.");
        return false;
      }

      try {
        const deleted = await dataManager.deleteTemplate(id);
        if (deleted) {
          // Local state will be updated via dataChangeCount effect
          toast.success("Template deleted");
          return true;
        } else {
          toast.error("Template not found");
          return false;
        }
      } catch (err) {
        logger.error("Failed to delete template", { error: err });
        toast.error("Failed to delete template");
        return false;
      }
    },
    [dataManager]
  );

  const value = useMemo<TemplateContextValue>(
    () => ({
      templates,
      loading,
      error,
      refresh: loadTemplates,
      getTemplatesByCategory,
      getTemplateById,
      addTemplate,
      updateTemplate,
      deleteTemplate,
    }),
    [
      templates,
      loading,
      error,
      loadTemplates,
      getTemplatesByCategory,
      getTemplateById,
      addTemplate,
      updateTemplate,
      deleteTemplate,
    ]
  );

  return <TemplateContext.Provider value={value}>{children}</TemplateContext.Provider>;
};

/**
 * Hook to access template context.
 * 
 * Provides access to all templates and CRUD operations.
 * Must be used within a TemplateProvider.
 * 
 * @throws {Error} If used outside of TemplateProvider
 * @returns {TemplateContextValue} Template context value
 * 
 * @example
 * ```typescript
 * function VRTemplateSelector() {
 *   const { getTemplatesByCategory } = useTemplates();
 *   const vrTemplates = getTemplatesByCategory('vr');
 *   
 *   return (
 *     <select>
 *       {vrTemplates.map(t => (
 *         <option key={t.id} value={t.id}>{t.name}</option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 */
export function useTemplates(): TemplateContextValue {
  const context = useContext(TemplateContext);
  if (!context) {
    throw new Error("useTemplates must be used within a TemplateProvider");
  }
  return context;
}

/**
 * Safe version of useTemplates that returns null if not in provider.
 * Useful for optional template access in components that may render outside provider.
 * 
 * @returns {TemplateContextValue | null} Template context value or null
 */
export function useTemplatesSafe(): TemplateContextValue | null {
  return useContext(TemplateContext);
}
