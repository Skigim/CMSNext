/**
 * Workflow Service
 * ================
 * Stateless service for managing workflows in file storage.
 * Handles CRUD operations for user-configurable workflows that
 * automate multi-step case processing tasks.
 * 
 * @module utils/services/WorkflowService
 */

import type { Workflow, WorkflowStep } from "@/types/workflow";
import type { FileStorageService } from "./FileStorageService";
import { createLogger } from "@/utils/logger";

const logger = createLogger("WorkflowService");

/**
 * Dependencies required by WorkflowService.
 */
export interface WorkflowServiceDependencies {
  fileStorage: FileStorageService;
}

/**
 * WorkflowService handles CRUD operations for workflows.
 * 
 * Workflows are sequences of steps (templates, notes, alerts, checklists)
 * that automate repetitive case processing tasks.
 * 
 * @example
 * ```typescript
 * const workflowService = new WorkflowService({ fileStorage });
 * 
 * // Get all workflows
 * const workflows = await workflowService.getAllWorkflows();
 * 
 * // Get workflows available for a specific case
 * const filtered = await workflowService.getWorkflowsForCase(case);
 * ```
 */
export class WorkflowService {
  private readonly fileStorage: FileStorageService;

  constructor({ fileStorage }: WorkflowServiceDependencies) {
    this.fileStorage = fileStorage;
  }

  // ===========================================================================
  // Read Operations
  // ===========================================================================

  /**
   * Get all workflows from storage.
   * 
   * @returns Array of all stored workflows, sorted by sortOrder
   */
  async getAllWorkflows(): Promise<Workflow[]> {
    const data = await this.fileStorage.readFileData();
    const workflows = data?.workflows ?? [];
    logger.debug("getAllWorkflows", { count: workflows.length });
    return this.sortWorkflows(workflows);
  }

  /**
   * Get a workflow by ID.
   * 
   * @param id - Workflow ID to find
   * @returns The workflow if found, null otherwise
   */
  async getWorkflowById(id: string): Promise<Workflow | null> {
    const workflows = await this.getAllWorkflows();
    return workflows.find((w) => w.id === id) ?? null;
  }

  /**
   * Get workflows available for a specific application type.
   * 
   * Filters workflows by applicationTypeFilter. Workflows without
   * a filter are available for all cases.
   * 
   * @param applicationType - The case's application type (optional)
   * @returns Workflows that match or have no filter
   */
  async getWorkflowsForApplicationType(
    applicationType?: string
  ): Promise<Workflow[]> {
    const workflows = await this.getAllWorkflows();
    
    return workflows.filter((w) => {
      // No filter = available for all
      if (!w.applicationTypeFilter) {
        return true;
      }
      // Match application type
      return w.applicationTypeFilter === applicationType;
    });
  }

  // ===========================================================================
  // Write Operations
  // ===========================================================================

  /**
   * Add a new workflow.
   * 
   * Creates ID and timestamps automatically via createWorkflow factory.
   * 
   * @param workflowData - Workflow data without ID and timestamps
   * @returns The newly created workflow
   * @throws Error if no file data available
   */
  async addWorkflow(
    workflowData: Omit<Workflow, "id" | "createdAt" | "updatedAt">
  ): Promise<Workflow> {
    logger.info("addWorkflow started", { name: workflowData.name, stepCount: workflowData.steps.length });
    
    const data = await this.fileStorage.readFileData();
    if (!data) {
      logger.error("addWorkflow failed: no file data available");
      throw new Error("No file data available");
    }

    const now = new Date().toISOString();
    const workflows = data.workflows ?? [];
    logger.debug("addWorkflow: existing workflows", { count: workflows.length });

    const newWorkflow: Workflow = {
      ...workflowData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    const updatedWorkflows = [...workflows, newWorkflow];
    logger.debug("addWorkflow: writing data", { newCount: updatedWorkflows.length, workflowId: newWorkflow.id });
    
    await this.fileStorage.writeNormalizedData({
      ...data,
      workflows: updatedWorkflows,
    });

    logger.info("addWorkflow completed", { workflowId: newWorkflow.id, name: newWorkflow.name });
    return newWorkflow;
  }

  /**
   * Update an existing workflow.
   * 
   * @param id - Workflow ID to update
   * @param updates - Partial workflow data to merge
   * @returns The updated workflow, or null if not found
   * @throws Error if no file data available
   */
  async updateWorkflow(
    id: string,
    updates: Partial<Omit<Workflow, "id" | "createdAt" | "updatedAt">>
  ): Promise<Workflow | null> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      throw new Error("No file data available");
    }

    const workflows = data.workflows ?? [];
    const index = workflows.findIndex((w) => w.id === id);

    if (index === -1) {
      return null;
    }

    const updatedWorkflow: Workflow = {
      ...workflows[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const updated = [...workflows];
    updated[index] = updatedWorkflow;

    await this.fileStorage.writeNormalizedData({
      ...data,
      workflows: updated,
    });

    return updatedWorkflow;
  }

  /**
   * Delete a workflow by ID.
   * 
   * @param id - Workflow ID to delete
   * @returns true if deleted, false if not found
   * @throws Error if no file data available
   */
  async deleteWorkflow(id: string): Promise<boolean> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      throw new Error("No file data available");
    }

    const workflows = data.workflows ?? [];
    const originalLength = workflows.length;
    const updated = workflows.filter((w) => w.id !== id);

    if (updated.length === originalLength) {
      return false;
    }

    await this.fileStorage.writeNormalizedData({
      ...data,
      workflows: updated,
    });

    return true;
  }

  // ===========================================================================
  // Step Operations
  // ===========================================================================

  /**
   * Add a step to a workflow.
   * 
   * @param workflowId - Workflow to add step to
   * @param step - Step to add (must have ID already)
   * @param index - Optional position to insert at (defaults to end)
   * @returns The updated workflow, or null if workflow not found
   */
  async addStep(
    workflowId: string,
    step: WorkflowStep,
    index?: number
  ): Promise<Workflow | null> {
    const workflow = await this.getWorkflowById(workflowId);
    if (!workflow) {
      return null;
    }

    const steps = [...workflow.steps];
    if (index !== undefined && index >= 0 && index <= steps.length) {
      steps.splice(index, 0, step);
    } else {
      steps.push(step);
    }

    return this.updateWorkflow(workflowId, { steps });
  }

  /**
   * Update a step within a workflow.
   * 
   * @param workflowId - Workflow containing the step
   * @param stepId - Step ID to update
   * @param updates - Partial step data to merge
   * @returns The updated workflow, or null if not found
   */
  async updateStep(
    workflowId: string,
    stepId: string,
    updates: Partial<WorkflowStep>
  ): Promise<Workflow | null> {
    const workflow = await this.getWorkflowById(workflowId);
    if (!workflow) {
      return null;
    }

    const stepIndex = workflow.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) {
      return null;
    }

    const steps = [...workflow.steps];
    steps[stepIndex] = { ...steps[stepIndex], ...updates } as WorkflowStep;

    return this.updateWorkflow(workflowId, { steps });
  }

  /**
   * Remove a step from a workflow.
   * 
   * @param workflowId - Workflow containing the step
   * @param stepId - Step ID to remove
   * @returns The updated workflow, or null if workflow not found
   */
  async removeStep(
    workflowId: string,
    stepId: string
  ): Promise<Workflow | null> {
    const workflow = await this.getWorkflowById(workflowId);
    if (!workflow) {
      return null;
    }

    const steps = workflow.steps.filter((s) => s.id !== stepId);
    return this.updateWorkflow(workflowId, { steps });
  }

  /**
   * Reorder steps within a workflow.
   * 
   * @param workflowId - Workflow to reorder
   * @param stepIds - Step IDs in new order (must include all existing step IDs)
   * @returns The updated workflow, or null if workflow not found
   * @throws Error if stepIds array is incomplete or contains unknown IDs
   */
  async reorderSteps(
    workflowId: string,
    stepIds: string[]
  ): Promise<Workflow | null> {
    const workflow = await this.getWorkflowById(workflowId);
    if (!workflow) {
      return null;
    }

    // Create map of existing steps
    const stepMap = new Map(workflow.steps.map((s) => [s.id, s]));
    const existingIds = new Set(workflow.steps.map((s) => s.id));
    const providedIds = new Set(stepIds);

    // Validate: check for missing step IDs
    const missingIds = [...existingIds].filter((id) => !providedIds.has(id));
    if (missingIds.length > 0) {
      throw new Error(
        `Cannot reorder: missing step IDs would be deleted: ${missingIds.join(", ")}`
      );
    }

    // Validate: check for unknown step IDs
    const unknownIds = stepIds.filter((id) => !existingIds.has(id));
    if (unknownIds.length > 0) {
      throw new Error(
        `Cannot reorder: unknown step IDs provided: ${unknownIds.join(", ")}`
      );
    }
    
    // Rebuild steps array in new order
    const steps: WorkflowStep[] = [];
    for (const id of stepIds) {
      const step = stepMap.get(id);
      if (step) {
        steps.push(step);
      }
    }

    return this.updateWorkflow(workflowId, { steps });
  }

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  /**
   * Replace all workflows (used for import/bulk operations).
   * 
   * @param workflows - Complete array of workflows to save
   * @returns The saved workflows
   * @throws Error if no file data available
   */
  async setAllWorkflows(workflows: Workflow[]): Promise<Workflow[]> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      throw new Error("No file data available");
    }

    await this.fileStorage.writeNormalizedData({
      ...data,
      workflows,
    });

    return workflows;
  }

  /**
   * Reorder workflows by updating sortOrder.
   * 
   * @param workflowIds - Workflow IDs in desired order
   * @returns true if successful
   * @throws Error if no file data available
   */
  async reorderWorkflows(workflowIds: string[]): Promise<boolean> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      throw new Error("No file data available");
    }

    const workflows = data.workflows ?? [];
    const now = new Date().toISOString();
    const orderMap = new Map(workflowIds.map((id, index) => [id, index]));

    const updated = workflows.map((workflow) => {
      const newOrder = orderMap.get(workflow.id);
      if (newOrder !== undefined) {
        return {
          ...workflow,
          sortOrder: newOrder,
          updatedAt: now,
        };
      }
      return workflow;
    });

    await this.fileStorage.writeNormalizedData({
      ...data,
      workflows: updated,
    });

    return true;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Sort workflows by sortOrder, falling back to name.
   */
  private sortWorkflows(workflows: Workflow[]): Workflow[] {
    return [...workflows].sort((a, b) => {
      // Primary: sortOrder (undefined goes last)
      const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      // Secondary: name alphabetically
      return a.name.localeCompare(b.name);
    });
  }
}
