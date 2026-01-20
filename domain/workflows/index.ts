/**
 * Workflow Domain Module - Step Execution Logic
 *
 * Pure functions for workflow step execution and state management.
 * No I/O, no side effects - actual data operations are performed by services.
 *
 * This module provides:
 * - Step execution result builders
 * - Workflow state transitions
 * - Step label generation
 * - Condition evaluation
 *
 * @module domain/workflows
 */

export {
  // Step execution
  prepareTemplateStepResult,
  prepareNoteContent,
  prepareAlertData,
  
  // State management
  advanceWorkflowState,
  completeCurrentStep,
  skipCurrentStep,
  markStepError,
  markChecklistComplete,
  isWorkflowComplete,
  canProceedToNext,
  
  // Labels and display
  getStepLabel,
  getStepDescription,
  getStepIcon,
  
  // Condition evaluation
  shouldExecuteStep,
  evaluateApplicationTypeCondition,
  
  // State queries
  getCurrentStep,
  getPreviousTemplateResult,
  getCompletedSteps,
  getRemainingSteps,
} from "./execution";

export {
  // Validation
  validateWorkflow,
  validateStep,
  getValidationErrors,
} from "./validation";
