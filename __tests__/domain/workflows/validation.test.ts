/**
 * @fileoverview Tests for Workflow Validation Functions
 *
 * Tests the pure functions for validating workflow and step configurations.
 * Covers workflow validation, step validation, and error formatting.
 */

import { describe, it, expect } from "vitest";
import {
  validateWorkflow,
  validateStep,
  getValidationErrors,
} from "@/domain/workflows/validation";
import type {
  Workflow,
  TemplateStep,
  NoteStep,
  AlertStep,
  ChecklistStep,
  CopyStep,
} from "@/types/workflow";

// ============================================================================
// Test Fixtures
// ============================================================================

function createValidWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "workflow-1",
    name: "Test Workflow",
    description: "A test workflow",
    steps: [
      {
        id: "step-1",
        type: "template",
        templateId: "template-1",
      } as TemplateStep,
    ],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createTemplateStep(overrides: Partial<TemplateStep> = {}): TemplateStep {
  return {
    id: "step-template-1",
    type: "template",
    templateId: "template-1",
    ...overrides,
  };
}

function createNoteStep(overrides: Partial<NoteStep> = {}): NoteStep {
  return {
    id: "step-note-1",
    type: "note",
    category: "denied",
    contentSource: "previous",
    ...overrides,
  };
}

function createAlertStep(overrides: Partial<AlertStep> = {}): AlertStep {
  return {
    id: "step-alert-1",
    type: "alert",
    daysOffset: 30,
    ...overrides,
  };
}

function createChecklistStep(overrides: Partial<ChecklistStep> = {}): ChecklistStep {
  return {
    id: "step-checklist-1",
    type: "checklist",
    ...overrides,
  };
}

function createCopyStep(overrides: Partial<CopyStep> = {}): CopyStep {
  return {
    id: "step-copy-1",
    type: "copy",
    ...overrides,
  };
}

// ============================================================================
// validateWorkflow
// ============================================================================

describe("validateWorkflow", () => {
  describe("name validation", () => {
    it("should pass with valid name", () => {
      const workflow = createValidWorkflow({ name: "My Workflow" });
      
      const errors = validateWorkflow(workflow);
      
      expect(errors.find((e) => e.path === "name")).toBeUndefined();
    });

    it("should fail with empty name", () => {
      const workflow = createValidWorkflow({ name: "" });
      
      const errors = validateWorkflow(workflow);
      
      expect(errors).toContainEqual({
        path: "name",
        message: "Workflow name is required",
      });
    });

    it("should fail with whitespace-only name", () => {
      const workflow = createValidWorkflow({ name: "   " });
      
      const errors = validateWorkflow(workflow);
      
      expect(errors).toContainEqual({
        path: "name",
        message: "Workflow name is required",
      });
    });
  });

  describe("steps validation", () => {
    it("should pass with at least one step", () => {
      const workflow = createValidWorkflow();
      
      const errors = validateWorkflow(workflow);
      
      expect(errors.find((e) => e.path === "steps")).toBeUndefined();
    });

    it("should fail with empty steps array", () => {
      const workflow = createValidWorkflow({ steps: [] });
      
      const errors = validateWorkflow(workflow);
      
      expect(errors).toContainEqual({
        path: "steps",
        message: "Workflow must have at least one step",
      });
    });

    it("should validate each step and prefix path", () => {
      const workflow = createValidWorkflow({
        steps: [
          createTemplateStep({ templateId: "" }), // Invalid
          createTemplateStep({ templateId: "valid" }), // Valid
        ],
      });
      
      const errors = validateWorkflow(workflow);
      
      expect(errors).toContainEqual({
        path: "steps[0].templateId",
        message: "Template selection is required",
      });
      expect(errors.find((e) => e.path.startsWith("steps[1]"))).toBeUndefined();
    });
  });

  describe("valid workflow", () => {
    it("should return empty errors array for valid workflow", () => {
      const workflow = createValidWorkflow();
      
      const errors = validateWorkflow(workflow);
      
      expect(errors).toHaveLength(0);
    });

    it("should validate workflow with multiple valid steps", () => {
      const workflow = createValidWorkflow({
        steps: [
          createTemplateStep(),
          createNoteStep(),
          createAlertStep(),
          createChecklistStep(),
          createCopyStep(),
        ],
      });
      
      const errors = validateWorkflow(workflow);
      
      expect(errors).toHaveLength(0);
    });
  });
});

// ============================================================================
// validateStep
// ============================================================================

describe("validateStep", () => {
  describe("common validation", () => {
    it("should fail when step ID is missing", () => {
      const step = createTemplateStep({ id: "" });
      
      const errors = validateStep(step);
      
      expect(errors).toContainEqual({
        path: "id",
        message: "Step ID is required",
      });
    });

    it("should pass with valid step ID", () => {
      const step = createTemplateStep({ id: "valid-id" });
      
      const errors = validateStep(step);
      
      expect(errors.find((e) => e.path === "id")).toBeUndefined();
    });
  });

  describe("template step validation", () => {
    it("should fail with empty templateId", () => {
      const step = createTemplateStep({ templateId: "" });
      
      const errors = validateStep(step);
      
      expect(errors).toContainEqual({
        path: "templateId",
        message: "Template selection is required",
      });
    });

    it("should fail with whitespace-only templateId", () => {
      const step = createTemplateStep({ templateId: "   " });
      
      const errors = validateStep(step);
      
      expect(errors).toContainEqual({
        path: "templateId",
        message: "Template selection is required",
      });
    });

    it("should pass with valid templateId", () => {
      const step = createTemplateStep({ templateId: "my-template" });
      
      const errors = validateStep(step);
      
      expect(errors.find((e) => e.path === "templateId")).toBeUndefined();
    });
  });

  describe("note step validation", () => {
    it("should fail with empty category", () => {
      const step = createNoteStep({ category: "" });
      
      const errors = validateStep(step);
      
      expect(errors).toContainEqual({
        path: "category",
        message: "Note category is required",
      });
    });

    it("should fail with whitespace-only category", () => {
      const step = createNoteStep({ category: "   " });
      
      const errors = validateStep(step);
      
      expect(errors).toContainEqual({
        path: "category",
        message: "Note category is required",
      });
    });

    it("should fail when contentSource is custom but customContent is empty", () => {
      const step = createNoteStep({
        contentSource: "custom",
        customContent: "",
      });
      
      const errors = validateStep(step);
      
      expect(errors).toContainEqual({
        path: "customContent",
        message: "Custom content is required when content source is 'custom'",
      });
    });

    it("should fail when contentSource is custom but customContent is whitespace", () => {
      const step = createNoteStep({
        contentSource: "custom",
        customContent: "   ",
      });
      
      const errors = validateStep(step);
      
      expect(errors).toContainEqual({
        path: "customContent",
        message: "Custom content is required when content source is 'custom'",
      });
    });

    it("should pass when contentSource is custom with valid content", () => {
      const step = createNoteStep({
        contentSource: "custom",
        customContent: "My custom note content",
      });
      
      const errors = validateStep(step);
      
      expect(errors.find((e) => e.path === "customContent")).toBeUndefined();
    });

    it("should pass when contentSource is previous (no customContent required)", () => {
      const step = createNoteStep({
        contentSource: "previous",
        customContent: undefined,
      });
      
      const errors = validateStep(step);
      
      expect(errors.find((e) => e.path === "customContent")).toBeUndefined();
    });

    it("should pass with valid note step", () => {
      const step = createNoteStep();
      
      const errors = validateStep(step);
      
      expect(errors).toHaveLength(0);
    });
  });

  describe("alert step validation", () => {
    it("should fail with negative daysOffset", () => {
      const step = createAlertStep({ daysOffset: -1 });
      
      const errors = validateStep(step);
      
      expect(errors).toContainEqual({
        path: "daysOffset",
        message: "Days offset must be a non-negative number",
      });
    });

    it("should fail with non-number daysOffset", () => {
      const step = createAlertStep({ daysOffset: "30" as unknown as number });
      
      const errors = validateStep(step);
      
      expect(errors).toContainEqual({
        path: "daysOffset",
        message: "Days offset must be a non-negative number",
      });
    });

    it("should pass with zero daysOffset", () => {
      const step = createAlertStep({ daysOffset: 0 });
      
      const errors = validateStep(step);
      
      expect(errors.find((e) => e.path === "daysOffset")).toBeUndefined();
    });

    it("should pass with positive daysOffset", () => {
      const step = createAlertStep({ daysOffset: 30 });
      
      const errors = validateStep(step);
      
      expect(errors).toHaveLength(0);
    });
  });

  describe("checklist step validation", () => {
    it("should pass with minimal checklist step", () => {
      const step = createChecklistStep();
      
      const errors = validateStep(step);
      
      expect(errors).toHaveLength(0);
    });

    it("should pass with instructions", () => {
      const step = createChecklistStep({ instructions: "Do something manually" });
      
      const errors = validateStep(step);
      
      expect(errors).toHaveLength(0);
    });
  });

  describe("copy step validation", () => {
    it("should pass with minimal copy step", () => {
      const step = createCopyStep();
      
      const errors = validateStep(step);
      
      expect(errors).toHaveLength(0);
    });

    it("should pass with sourceStepId", () => {
      const step = createCopyStep({ sourceStepId: "step-1" });
      
      const errors = validateStep(step);
      
      expect(errors).toHaveLength(0);
    });
  });
});

// ============================================================================
// getValidationErrors
// ============================================================================

describe("getValidationErrors", () => {
  it("should return empty array for valid workflow", () => {
    const workflow = createValidWorkflow();
    
    const errors = getValidationErrors(workflow);
    
    expect(errors).toHaveLength(0);
  });

  it("should return formatted error strings", () => {
    const workflow = createValidWorkflow({
      name: "",
      steps: [],
    });
    
    const errors = getValidationErrors(workflow);
    
    expect(errors).toContain("name: Workflow name is required");
    expect(errors).toContain("steps: Workflow must have at least one step");
  });

  it("should format nested step errors correctly", () => {
    const workflow = createValidWorkflow({
      steps: [
        createTemplateStep({ templateId: "" }),
      ],
    });
    
    const errors = getValidationErrors(workflow);
    
    expect(errors).toContain("steps[0].templateId: Template selection is required");
  });

  it("should return all errors from workflow", () => {
    const workflow = createValidWorkflow({
      name: "",
      steps: [
        createTemplateStep({ id: "", templateId: "" }),
        createNoteStep({ category: "" }),
      ],
    });
    
    const errors = getValidationErrors(workflow);
    
    expect(errors.length).toBeGreaterThanOrEqual(4);
    expect(errors).toContain("name: Workflow name is required");
    expect(errors).toContain("steps[0].id: Step ID is required");
    expect(errors).toContain("steps[0].templateId: Template selection is required");
    expect(errors).toContain("steps[1].category: Note category is required");
  });
});
