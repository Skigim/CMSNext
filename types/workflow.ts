/**
 * Workflow System Types
 * 
 * Defines the data structures for user-configurable workflows
 * that automate multi-step case processing tasks.
 * 
 * @module types/workflow
 */

// =============================================================================
// Step Types
// =============================================================================

/**
 * Base step interface with common properties.
 */
interface BaseStep {
  /** Unique identifier for this step */
  id: string;
  /** Optional custom label override */
  label?: string;
}

/**
 * Generate content from a template.
 * Result is stored for use by subsequent steps.
 */
export interface TemplateStep extends BaseStep {
  type: "template";
  /** ID of the template to render */
  templateId: string;
  /** 
   * Optional condition: only execute if case.applicationType matches.
   * If not set, step always executes.
   */
  applicationTypeCondition?: string;
}

/**
 * Create a note on the current case.
 */
export interface NoteStep extends BaseStep {
  type: "note";
  /** Note category (e.g., "denied", "approved") */
  category: string;
  /** Where to get the note content */
  contentSource: "previous" | "custom";
  /** Custom content if contentSource is "custom" */
  customContent?: string;
  /** Prefix to add before content (e.g., "MLTC: ") */
  prefix?: string;
}

/**
 * Create an alert/reminder for the current case.
 */
export interface AlertStep extends BaseStep {
  type: "alert";
  /** Days from now to set the alert */
  daysOffset: number;
  /** Alert message/description */
  message?: string;
}

/**
 * Manual checklist item for external actions.
 * User must check off before proceeding.
 */
export interface ChecklistStep extends BaseStep {
  type: "checklist";
  /** Instructions for the manual task */
  instructions?: string;
}

/**
 * Copy content to clipboard.
 * Uses the result from the previous template step.
 */
export interface CopyStep extends BaseStep {
  type: "copy";
  /** Optional: specific step ID to copy from (defaults to previous template) */
  sourceStepId?: string;
}

/**
 * Union type of all workflow step variants.
 */
export type WorkflowStep =
  | TemplateStep
  | NoteStep
  | AlertStep
  | ChecklistStep
  | CopyStep;

/**
 * Type guard helpers for step types.
 */
export const isTemplateStep = (step: WorkflowStep): step is TemplateStep =>
  step.type === "template";
export const isNoteStep = (step: WorkflowStep): step is NoteStep =>
  step.type === "note";
export const isAlertStep = (step: WorkflowStep): step is AlertStep =>
  step.type === "alert";
export const isChecklistStep = (step: WorkflowStep): step is ChecklistStep =>
  step.type === "checklist";
export const isCopyStep = (step: WorkflowStep): step is CopyStep =>
  step.type === "copy";

// =============================================================================
// Workflow Interface
// =============================================================================

/**
 * A workflow is a sequence of steps that automate case processing.
 */
export interface Workflow {
  /** Unique identifier (UUID) */
  id: string;
  /** Display name for the workflow */
  name: string;
  /** Optional description */
  description?: string;
  /** 
   * If set, workflow is only available for cases with matching applicationType.
   * If not set, workflow is available for all cases.
   */
  applicationTypeFilter?: string;
  /** Ordered list of steps to execute */
  steps: WorkflowStep[];
  /** Sort order for display in menus */
  sortOrder?: number;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last modified */
  updatedAt: string;
}

// =============================================================================
// Execution State
// =============================================================================

/**
 * Status of a step during workflow execution.
 */
export type StepStatus = "pending" | "active" | "completed" | "skipped" | "error";

/**
 * Runtime state for a step being executed.
 */
export interface StepExecutionState {
  /** The step definition */
  step: WorkflowStep;
  /** Current status */
  status: StepStatus;
  /** Generated content (for template steps) */
  result?: string;
  /** Error message if status is "error" */
  error?: string;
  /** Whether checklist item is checked (for checklist steps) */
  checked?: boolean;
}

/**
 * Runtime state for workflow execution.
 */
export interface WorkflowExecutionState {
  /** The workflow being executed */
  workflow: Workflow;
  /** Case ID the workflow is running against */
  caseId: string;
  /** Current step index (0-based) */
  currentStepIndex: number;
  /** State for each step */
  stepStates: StepExecutionState[];
  /** Overall status */
  status: "idle" | "running" | "completed" | "cancelled" | "error";
  /** Timestamp when execution started */
  startedAt?: string;
  /** Timestamp when execution completed */
  completedAt?: string;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new empty workflow.
 */
export function createWorkflow(
  name: string,
  description?: string
): Workflow {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    description,
    steps: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a new workflow step with generated ID.
 */
export function createStep<T extends WorkflowStep>(
  stepData: Omit<T, "id">
): T {
  return {
    ...stepData,
    id: crypto.randomUUID(),
  } as T;
}

/**
 * Create initial execution state for a workflow.
 */
export function createExecutionState(
  workflow: Workflow,
  caseId: string
): WorkflowExecutionState {
  return {
    workflow,
    caseId,
    currentStepIndex: 0,
    stepStates: workflow.steps.map((step) => ({
      step,
      status: "pending",
    })),
    status: "idle",
  };
}

// =============================================================================
// Step Type Metadata (for UI)
// =============================================================================

/**
 * Human-readable labels for step types.
 */
export const STEP_TYPE_LABELS: Record<WorkflowStep["type"], string> = {
  template: "Generate Template",
  note: "Create Note",
  alert: "Set Alert",
  checklist: "Checklist Item",
  copy: "Copy to Clipboard",
};

/**
 * Icons for step types (Lucide icon names).
 */
export const STEP_TYPE_ICONS: Record<WorkflowStep["type"], string> = {
  template: "FileText",
  note: "StickyNote",
  alert: "Bell",
  checklist: "CheckSquare",
  copy: "Copy",
};
