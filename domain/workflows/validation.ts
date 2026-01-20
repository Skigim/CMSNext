/**
 * Workflow Validation
 *
 * Pure functions for validating workflow and step configurations.
 *
 * @module domain/workflows/validation
 */

import type {
  Workflow,
  WorkflowStep,
  TemplateStep,
  NoteStep,
  AlertStep,
} from "@/types/workflow";
import {
  isTemplateStep,
  isNoteStep,
  isAlertStep,
} from "@/types/workflow";

/**
 * Validation error with field path.
 */
export interface ValidationError {
  /** Path to the invalid field (e.g., "steps[0].templateId") */
  path: string;
  /** Error message */
  message: string;
}

/**
 * Validate a complete workflow.
 *
 * @param workflow - Workflow to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateWorkflow(workflow: Workflow): ValidationError[] {
  const errors: ValidationError[] = [];

  // Name is required
  if (!workflow.name || workflow.name.trim().length === 0) {
    errors.push({
      path: "name",
      message: "Workflow name is required",
    });
  }

  // Must have at least one step
  if (!workflow.steps || workflow.steps.length === 0) {
    errors.push({
      path: "steps",
      message: "Workflow must have at least one step",
    });
  } else {
    // Validate each step
    workflow.steps.forEach((step, index) => {
      const stepErrors = validateStep(step);
      stepErrors.forEach((error) => {
        errors.push({
          path: `steps[${index}].${error.path}`,
          message: error.message,
        });
      });
    });
  }

  return errors;
}

/**
 * Validate a single workflow step.
 *
 * @param step - Step to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateStep(step: WorkflowStep): ValidationError[] {
  const errors: ValidationError[] = [];

  // All steps must have an ID
  if (!step.id) {
    errors.push({
      path: "id",
      message: "Step ID is required",
    });
  }

  // Type-specific validation
  if (isTemplateStep(step)) {
    errors.push(...validateTemplateStep(step));
  } else if (isNoteStep(step)) {
    errors.push(...validateNoteStep(step));
  } else if (isAlertStep(step)) {
    errors.push(...validateAlertStep(step));
  }
  // Checklist and copy steps have no required fields beyond id

  return errors;
}

/**
 * Validate template step configuration.
 */
function validateTemplateStep(step: TemplateStep): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!step.templateId || step.templateId.trim().length === 0) {
    errors.push({
      path: "templateId",
      message: "Template selection is required",
    });
  }

  return errors;
}

/**
 * Validate note step configuration.
 */
function validateNoteStep(step: NoteStep): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!step.category || step.category.trim().length === 0) {
    errors.push({
      path: "category",
      message: "Note category is required",
    });
  }

  if (step.contentSource === "custom" && !step.customContent?.trim()) {
    errors.push({
      path: "customContent",
      message: "Custom content is required when content source is 'custom'",
    });
  }

  return errors;
}

/**
 * Validate alert step configuration.
 */
function validateAlertStep(step: AlertStep): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof step.daysOffset !== "number" || step.daysOffset < 0) {
    errors.push({
      path: "daysOffset",
      message: "Days offset must be a non-negative number",
    });
  }

  return errors;
}

/**
 * Get all validation errors for a workflow, formatted for display.
 *
 * @param workflow - Workflow to validate
 * @returns Formatted error messages, or empty array if valid
 */
export function getValidationErrors(workflow: Workflow): string[] {
  const errors = validateWorkflow(workflow);
  return errors.map((e) => `${e.path}: ${e.message}`);
}
