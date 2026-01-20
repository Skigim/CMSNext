/**
 * Workflow Context
 *
 * Provides workflow data and operations throughout the application.
 * Handles CRUD for workflow definitions and execution state management.
 *
 * @module contexts/WorkflowContext
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type {
  Workflow,
  WorkflowStep,
  WorkflowExecutionState,
} from "@/types/workflow";
import { createExecutionState } from "@/types/workflow";
import { useDataManagerSafe } from "./DataManagerContext";
import { useFileStorageDataChange } from "./FileStorageContext";
import { createLogger } from "@/utils/logger";

const logger = createLogger("WorkflowContext");

// =============================================================================
// Context Types
// =============================================================================

/**
 * Workflow context value - provides access to workflow management.
 */
interface WorkflowContextValue {
  // Data
  /** All workflows from storage */
  workflows: Workflow[];
  /** Whether workflows are currently loading */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Current workflow execution state (if running) */
  executionState: WorkflowExecutionState | null;

  // Read operations
  /** Reload workflows from DataManager */
  refresh: () => Promise<void>;
  /** Get a workflow by ID */
  getWorkflowById: (id: string) => Workflow | undefined;
  /** Get workflows available for a specific application type */
  getWorkflowsForApplicationType: (applicationType?: string) => Workflow[];

  // Write operations
  /** Create a new workflow */
  addWorkflow: (
    workflow: Omit<Workflow, "id" | "createdAt" | "updatedAt">
  ) => Promise<Workflow | null>;
  /** Update an existing workflow */
  updateWorkflow: (
    id: string,
    updates: Partial<Omit<Workflow, "id" | "createdAt" | "updatedAt">>
  ) => Promise<Workflow | null>;
  /** Delete a workflow */
  deleteWorkflow: (id: string) => Promise<boolean>;
  /** Reorder workflows */
  reorderWorkflows: (workflowIds: string[]) => Promise<boolean>;

  // Step operations
  /** Add a step to a workflow */
  addStep: (
    workflowId: string,
    step: WorkflowStep,
    index?: number
  ) => Promise<Workflow | null>;
  /** Update a step in a workflow */
  updateStep: (
    workflowId: string,
    stepId: string,
    updates: Partial<WorkflowStep>
  ) => Promise<Workflow | null>;
  /** Remove a step from a workflow */
  removeStep: (workflowId: string, stepId: string) => Promise<Workflow | null>;
  /** Reorder steps within a workflow */
  reorderSteps: (
    workflowId: string,
    stepIds: string[]
  ) => Promise<Workflow | null>;

  // Execution
  /** Start executing a workflow on a case */
  startExecution: (workflowId: string, caseId: string) => void;
  /** Update execution state */
  setExecutionState: (state: WorkflowExecutionState | null) => void;
  /** Cancel current execution */
  cancelExecution: () => void;
}

// Default noop functions
const noopAsync = async () => {
  /* no-op */
};

const defaultContextValue: WorkflowContextValue = {
  workflows: [],
  loading: false,
  error: null,
  executionState: null,
  refresh: noopAsync,
  getWorkflowById: () => undefined,
  getWorkflowsForApplicationType: () => [],
  addWorkflow: async () => null,
  updateWorkflow: async () => null,
  deleteWorkflow: async () => false,
  reorderWorkflows: async () => false,
  addStep: async () => null,
  updateStep: async () => null,
  removeStep: async () => null,
  reorderSteps: async () => null,
  startExecution: () => {
    /* no-op */
  },
  setExecutionState: () => {
    /* no-op */
  },
  cancelExecution: () => {
    /* no-op */
  },
};

const WorkflowContext = createContext<WorkflowContextValue>(defaultContextValue);

// Export for testing
export { WorkflowContext };

// =============================================================================
// Provider
// =============================================================================

/**
 * WorkflowProvider - Manages workflow definitions and execution state.
 *
 * Provides CRUD operations for workflows and their steps.
 * Tracks execution state for the currently running workflow.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <FileStorageProvider>
 *       <DataManagerProvider>
 *         <WorkflowProvider>
 *           <YourApp />
 *         </WorkflowProvider>
 *       </DataManagerProvider>
 *     </FileStorageProvider>
 *   );
 * }
 * ```
 */
export const WorkflowProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const dataManager = useDataManagerSafe();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionState, setExecutionState] =
    useState<WorkflowExecutionState | null>(null);
  const dataChangeCount = useFileStorageDataChange();

  // ===========================================================================
  // Load workflows
  // ===========================================================================

  const loadWorkflows = useCallback(async () => {
    if (!dataManager) {
      logger.debug("loadWorkflows: dataManager not available");
      return;
    }

    logger.debug("loadWorkflows: starting");
    setLoading(true);
    try {
      const result = await dataManager.getAllWorkflows();
      logger.info("loadWorkflows: loaded", { count: result.length });
      setWorkflows(result);
      setError(null);
    } catch (err) {
      logger.error("Failed to load workflows", { error: err });
      setError("Unable to load workflows.");
    } finally {
      setLoading(false);
    }
  }, [dataManager]);

  // Reload on dataManager availability and file changes
  useEffect(() => {
    if (!dataManager) {
      return;
    }

    loadWorkflows().catch((err) => {
      logger.error("Unexpected error loading workflows", { error: err });
    });
  }, [dataManager, loadWorkflows, dataChangeCount]);

  // ===========================================================================
  // Read operations
  // ===========================================================================

  const getWorkflowById = useCallback(
    (id: string): Workflow | undefined => {
      return workflows.find((w) => w.id === id);
    },
    [workflows]
  );

  const getWorkflowsForApplicationType = useCallback(
    (applicationType?: string): Workflow[] => {
      return workflows.filter((w) => {
        if (!w.applicationTypeFilter) {
          return true;
        }
        return w.applicationTypeFilter === applicationType;
      });
    },
    [workflows]
  );

  // ===========================================================================
  // Write operations
  // ===========================================================================

  const addWorkflow = useCallback(
    async (
      workflow: Omit<Workflow, "id" | "createdAt" | "updatedAt">
    ): Promise<Workflow | null> => {
      if (!dataManager) {
        logger.error("addWorkflow: dataManager not available");
        toast.error("Data manager is not available yet.");
        return null;
      }

      logger.info("addWorkflow: starting", { name: workflow.name });
      try {
        const newWorkflow = await dataManager.addWorkflow(workflow);
        logger.info("addWorkflow: created", { id: newWorkflow.id, name: newWorkflow.name });
        toast.success(`Workflow "${workflow.name}" created`);
        // Explicitly refresh to ensure UI updates
        logger.debug("addWorkflow: refreshing list");
        await loadWorkflows();
        logger.debug("addWorkflow: refresh complete");
        return newWorkflow;
      } catch (err) {
        logger.error("Failed to add workflow", { error: err });
        toast.error("Failed to create workflow");
        return null;
      }
    },
    [dataManager, loadWorkflows]
  );

  const updateWorkflow = useCallback(
    async (
      id: string,
      updates: Partial<Omit<Workflow, "id" | "createdAt" | "updatedAt">>
    ): Promise<Workflow | null> => {
      if (!dataManager) {
        toast.error("Data manager is not available yet.");
        return null;
      }

      try {
        const updated = await dataManager.updateWorkflow(id, updates);
        if (updated) {
          toast.success("Workflow updated");
          // Explicitly refresh to ensure UI updates
          await loadWorkflows();
          return updated;
        } else {
          toast.error("Workflow not found");
          return null;
        }
      } catch (err) {
        logger.error("Failed to update workflow", { error: err });
        toast.error("Failed to update workflow");
        return null;
      }
    },
    [dataManager, loadWorkflows]
  );

  const deleteWorkflow = useCallback(
    async (id: string): Promise<boolean> => {
      if (!dataManager) {
        toast.error("Data manager is not available yet.");
        return false;
      }

      try {
        const deleted = await dataManager.deleteWorkflow(id);
        if (deleted) {
          toast.success("Workflow deleted");
          // Explicitly refresh to ensure UI updates
          await loadWorkflows();
          return true;
        } else {
          toast.error("Workflow not found");
          return false;
        }
      } catch (err) {
        logger.error("Failed to delete workflow", { error: err });
        toast.error("Failed to delete workflow");
        return false;
      }
    },
    [dataManager, loadWorkflows]
  );

  const reorderWorkflows = useCallback(
    async (workflowIds: string[]): Promise<boolean> => {
      if (!dataManager) {
        toast.error("Data manager is not available yet.");
        return false;
      }

      try {
        await dataManager.reorderWorkflows(workflowIds);
        return true;
      } catch (err) {
        logger.error("Failed to reorder workflows", { error: err });
        toast.error("Failed to reorder workflows");
        return false;
      }
    },
    [dataManager]
  );

  // ===========================================================================
  // Step operations
  // ===========================================================================

  const addStep = useCallback(
    async (
      workflowId: string,
      step: WorkflowStep,
      index?: number
    ): Promise<Workflow | null> => {
      if (!dataManager) {
        toast.error("Data manager is not available yet.");
        return null;
      }

      try {
        const updated = await dataManager.addWorkflowStep(
          workflowId,
          step,
          index
        );
        if (updated) {
          toast.success("Step added");
          return updated;
        } else {
          toast.error("Workflow not found");
          return null;
        }
      } catch (err) {
        logger.error("Failed to add step", { error: err });
        toast.error("Failed to add step");
        return null;
      }
    },
    [dataManager]
  );

  const updateStep = useCallback(
    async (
      workflowId: string,
      stepId: string,
      updates: Partial<WorkflowStep>
    ): Promise<Workflow | null> => {
      if (!dataManager) {
        toast.error("Data manager is not available yet.");
        return null;
      }

      try {
        const updated = await dataManager.updateWorkflowStep(
          workflowId,
          stepId,
          updates
        );
        if (updated) {
          return updated;
        } else {
          toast.error("Step not found");
          return null;
        }
      } catch (err) {
        logger.error("Failed to update step", { error: err });
        toast.error("Failed to update step");
        return null;
      }
    },
    [dataManager]
  );

  const removeStep = useCallback(
    async (workflowId: string, stepId: string): Promise<Workflow | null> => {
      if (!dataManager) {
        toast.error("Data manager is not available yet.");
        return null;
      }

      try {
        const updated = await dataManager.removeWorkflowStep(
          workflowId,
          stepId
        );
        if (updated) {
          toast.success("Step removed");
          return updated;
        } else {
          toast.error("Workflow not found");
          return null;
        }
      } catch (err) {
        logger.error("Failed to remove step", { error: err });
        toast.error("Failed to remove step");
        return null;
      }
    },
    [dataManager]
  );

  const reorderSteps = useCallback(
    async (
      workflowId: string,
      stepIds: string[]
    ): Promise<Workflow | null> => {
      if (!dataManager) {
        toast.error("Data manager is not available yet.");
        return null;
      }

      try {
        const updated = await dataManager.reorderWorkflowSteps(
          workflowId,
          stepIds
        );
        return updated;
      } catch (err) {
        logger.error("Failed to reorder steps", { error: err });
        toast.error("Failed to reorder steps");
        return null;
      }
    },
    [dataManager]
  );

  // ===========================================================================
  // Execution
  // ===========================================================================

  const startExecution = useCallback(
    (workflowId: string, caseId: string) => {
      const workflow = workflows.find((w) => w.id === workflowId);
      if (!workflow) {
        toast.error("Workflow not found");
        return;
      }

      const baseState = createExecutionState(workflow, caseId);
      const state: WorkflowExecutionState = {
        ...baseState,
        status: "running",
        startedAt: new Date().toISOString(),
        // Mark first step as active (immutably)
        stepStates:
          baseState.stepStates.length > 0
            ? [
                { ...baseState.stepStates[0], status: "active" },
                ...baseState.stepStates.slice(1),
              ]
            : [],
      };

      setExecutionState(state);
      logger.info("Started workflow execution", {
        workflowId,
        caseId,
        stepCount: workflow.steps.length,
      });
    },
    [workflows]
  );

  const cancelExecution = useCallback(() => {
    if (executionState) {
      logger.info("Cancelled workflow execution", {
        workflowId: executionState.workflow.id,
        caseId: executionState.caseId,
      });
    }
    setExecutionState(null);
  }, [executionState]);

  // ===========================================================================
  // Context value
  // ===========================================================================

  const value = useMemo<WorkflowContextValue>(
    () => ({
      workflows,
      loading,
      error,
      executionState,
      refresh: loadWorkflows,
      getWorkflowById,
      getWorkflowsForApplicationType,
      addWorkflow,
      updateWorkflow,
      deleteWorkflow,
      reorderWorkflows,
      addStep,
      updateStep,
      removeStep,
      reorderSteps,
      startExecution,
      setExecutionState,
      cancelExecution,
    }),
    [
      workflows,
      loading,
      error,
      executionState,
      loadWorkflows,
      getWorkflowById,
      getWorkflowsForApplicationType,
      addWorkflow,
      updateWorkflow,
      deleteWorkflow,
      reorderWorkflows,
      addStep,
      updateStep,
      removeStep,
      reorderSteps,
      startExecution,
      cancelExecution,
    ]
  );

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
};

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access workflow context.
 *
 * @throws Error if used outside WorkflowProvider
 *
 * @example
 * ```tsx
 * function WorkflowList() {
 *   const { workflows, loading, addWorkflow } = useWorkflows();
 *
 *   if (loading) return <Spinner />;
 *
 *   return (
 *     <ul>
 *       {workflows.map(w => (
 *         <li key={w.id}>{w.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useWorkflows(): WorkflowContextValue {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflows must be used within a WorkflowProvider");
  }
  return context;
}

/**
 * Hook to access workflow context safely (returns null if not in provider).
 * Useful for optional integration scenarios.
 */
export function useWorkflowsSafe(): WorkflowContextValue | null {
  return useContext(WorkflowContext) ?? null;
}
