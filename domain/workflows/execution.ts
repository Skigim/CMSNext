/**
 * Workflow Execution Logic
 *
 * Pure functions for workflow step execution and state management.
 * These functions prepare data and manage state - actual I/O is handled by services.
 *
 * @module domain/workflows/execution
 */

import type {
  WorkflowStep,
  WorkflowExecutionState,
  StepExecutionState,
  TemplateStep,
  NoteStep,
  AlertStep,
} from "@/types/workflow";
import {
  isTemplateStep,
  isChecklistStep,
  STEP_TYPE_LABELS,
  STEP_TYPE_ICONS,
} from "@/types/workflow";

// =============================================================================
// Step Execution Preparation
// =============================================================================

/**
 * Prepare the result for a template step.
 * The actual rendering is done by the template service - this just provides context.
 *
 * @param _step - The template step definition (unused, kept for API consistency)
 * @param renderedContent - Content already rendered by template service
 * @returns The step result to store
 */
export function prepareTemplateStepResult(
  _step: TemplateStep,
  renderedContent: string
): string {
  return renderedContent;
}

/**
 * Prepare note content based on step configuration.
 *
 * @param step - The note step definition
 * @param previousContent - Content from previous template step
 * @returns The note content to create
 */
export function prepareNoteContent(
  step: NoteStep,
  previousContent?: string
): string {
  let content: string;

  if (step.contentSource === "custom" && step.customContent) {
    content = step.customContent;
  } else {
    content = previousContent ?? "";
  }

  // Apply prefix if configured
  if (step.prefix) {
    content = step.prefix + content;
  }

  return content;
}

/**
 * Prepare alert data based on step configuration.
 *
 * @param step - The alert step definition
 * @param _caseId - The case to create alert for (kept for API consistency)
 * @returns Alert creation parameters
 */
export function prepareAlertData(
  step: AlertStep,
  _caseId: string
): { dueDate: Date; message: string } {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + step.daysOffset);

  return {
    dueDate,
    message: step.message ?? `Follow up required`,
  };
}

// =============================================================================
// State Management
// =============================================================================

/**
 * Advance workflow state to the next step.
 *
 * @param state - Current execution state
 * @returns Updated execution state
 */
export function advanceWorkflowState(
  state: WorkflowExecutionState
): WorkflowExecutionState {
  const nextIndex = state.currentStepIndex + 1;

  if (nextIndex >= state.stepStates.length) {
    // Workflow complete
    return {
      ...state,
      currentStepIndex: nextIndex,
      status: "completed",
      completedAt: new Date().toISOString(),
    };
  }

  // Update next step to active
  const stepStates = [...state.stepStates];
  stepStates[nextIndex] = {
    ...stepStates[nextIndex],
    status: "active",
  };

  return {
    ...state,
    currentStepIndex: nextIndex,
    stepStates,
    status: "running",
  };
}

/**
 * Mark the current step as completed.
 *
 * @param state - Current execution state
 * @param result - Optional result content (for template steps)
 * @returns Updated execution state
 */
export function completeCurrentStep(
  state: WorkflowExecutionState,
  result?: string
): WorkflowExecutionState {
  const stepStates = [...state.stepStates];
  stepStates[state.currentStepIndex] = {
    ...stepStates[state.currentStepIndex],
    status: "completed",
    result,
  };

  return {
    ...state,
    stepStates,
  };
}

/**
 * Skip the current step (e.g., condition not met).
 *
 * @param state - Current execution state
 * @returns Updated execution state
 */
export function skipCurrentStep(
  state: WorkflowExecutionState
): WorkflowExecutionState {
  const stepStates = [...state.stepStates];
  stepStates[state.currentStepIndex] = {
    ...stepStates[state.currentStepIndex],
    status: "skipped",
  };

  return {
    ...state,
    stepStates,
  };
}

/**
 * Mark the current step as having an error.
 *
 * @param state - Current execution state
 * @param error - Error message
 * @returns Updated execution state
 */
export function markStepError(
  state: WorkflowExecutionState,
  error: string
): WorkflowExecutionState {
  const stepStates = [...state.stepStates];
  stepStates[state.currentStepIndex] = {
    ...stepStates[state.currentStepIndex],
    status: "error",
    error,
  };

  return {
    ...state,
    stepStates,
    status: "error",
  };
}

/**
 * Mark a checklist step as checked/unchecked.
 *
 * @param state - Current execution state
 * @param checked - Whether the checklist is checked
 * @returns Updated execution state
 */
export function markChecklistComplete(
  state: WorkflowExecutionState,
  checked: boolean
): WorkflowExecutionState {
  const stepStates = [...state.stepStates];
  stepStates[state.currentStepIndex] = {
    ...stepStates[state.currentStepIndex],
    checked,
  };

  return {
    ...state,
    stepStates,
  };
}

// =============================================================================
// State Queries
// =============================================================================

/**
 * Check if workflow is complete.
 */
export function isWorkflowComplete(state: WorkflowExecutionState): boolean {
  return (
    state.status === "completed" ||
    state.currentStepIndex >= state.stepStates.length
  );
}

/**
 * Check if workflow can proceed to next step.
 * Checklist steps require checked=true.
 */
export function canProceedToNext(state: WorkflowExecutionState): boolean {
  if (isWorkflowComplete(state)) {
    return false;
  }

  const currentStepState = state.stepStates[state.currentStepIndex];
  const step = currentStepState.step;

  // Checklist requires explicit check
  if (isChecklistStep(step)) {
    return currentStepState.checked === true;
  }

  // Other completed steps can proceed
  return currentStepState.status === "completed";
}

/**
 * Get the current step being executed.
 */
export function getCurrentStep(
  state: WorkflowExecutionState
): WorkflowStep | null {
  if (state.currentStepIndex >= state.stepStates.length) {
    return null;
  }
  return state.stepStates[state.currentStepIndex].step;
}

/**
 * Get the result from the most recent template step.
 * Used by copy and note steps that reference previous content.
 */
export function getPreviousTemplateResult(
  state: WorkflowExecutionState,
  beforeIndex?: number
): string | undefined {
  const endIndex = beforeIndex ?? state.currentStepIndex;

  // Search backwards for last completed template step
  for (let i = endIndex - 1; i >= 0; i--) {
    const stepState = state.stepStates[i];
    if (
      isTemplateStep(stepState.step) &&
      stepState.status === "completed" &&
      stepState.result
    ) {
      return stepState.result;
    }
  }

  return undefined;
}

/**
 * Get list of completed steps.
 */
export function getCompletedSteps(
  state: WorkflowExecutionState
): StepExecutionState[] {
  return state.stepStates.filter(
    (s) => s.status === "completed" || s.status === "skipped"
  );
}

/**
 * Get list of remaining steps (not yet started).
 */
export function getRemainingSteps(
  state: WorkflowExecutionState
): StepExecutionState[] {
  return state.stepStates.filter((s) => s.status === "pending");
}

// =============================================================================
// Labels and Display
// =============================================================================

/**
 * Get display label for a step.
 * Uses custom label if set, otherwise generates from step type and config.
 */
export function getStepLabel(step: WorkflowStep): string {
  if (step.label) {
    return step.label;
  }

  return STEP_TYPE_LABELS[step.type];
}

/**
 * Get description for a step based on its configuration.
 */
export function getStepDescription(step: WorkflowStep): string {
  switch (step.type) {
    case "template":
      return `Generate template: ${step.templateId}`;
    case "note":
      return `Create ${step.category} note`;
    case "alert":
      return `Set alert for ${step.daysOffset} days`;
    case "checklist":
      return step.instructions ?? "Manual task";
    case "copy":
      return "Copy content to clipboard";
    default:
      return "";
  }
}

/**
 * Get icon name for a step type (Lucide icon names).
 */
export function getStepIcon(step: WorkflowStep): string {
  return STEP_TYPE_ICONS[step.type];
}

// =============================================================================
// Condition Evaluation
// =============================================================================

/**
 * Check if a step should be executed based on conditions.
 *
 * @param step - The step to evaluate
 * @param applicationType - The case's application type
 * @returns true if step should execute
 */
export function shouldExecuteStep(
  step: WorkflowStep,
  applicationType?: string
): boolean {
  // Only template steps have conditions currently
  if (isTemplateStep(step)) {
    return evaluateApplicationTypeCondition(
      step.applicationTypeCondition,
      applicationType
    );
  }

  return true;
}

/**
 * Evaluate application type condition.
 *
 * @param condition - Required application type (undefined = no condition)
 * @param applicationType - Case's actual application type
 * @returns true if condition is met
 */
export function evaluateApplicationTypeCondition(
  condition: string | undefined,
  applicationType: string | undefined
): boolean {
  // No condition = always execute
  if (!condition) {
    return true;
  }

  // Condition set but no application type = skip
  if (!applicationType) {
    return false;
  }

  // Normalize case type
  const normalizedCaseType = applicationType.trim().toLowerCase();
  
  // Support comma-separated list of types in condition
  // e.g. "MLTC, FTP" -> ["mltc", "ftp"]
  const allowedTypes = condition
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  
  return allowedTypes.includes(normalizedCaseType);
}
