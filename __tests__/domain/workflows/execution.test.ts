/**
 * @fileoverview Tests for Workflow Execution Functions
 *
 * Tests the pure functions for workflow step execution and state management.
 * Covers step preparation, state transitions, queries, labels, and conditions.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  prepareTemplateStepResult,
  prepareNoteContent,
  prepareAlertData,
  advanceWorkflowState,
  completeCurrentStep,
  skipCurrentStep,
  markStepError,
  markChecklistComplete,
  isWorkflowComplete,
  canProceedToNext,
  getCurrentStep,
  getPreviousTemplateResult,
  getCompletedSteps,
  getRemainingSteps,
  getStepLabel,
  getStepDescription,
  getStepIcon,
  shouldExecuteStep,
  evaluateApplicationTypeCondition,
} from "@/domain/workflows/execution";
import type {
  Workflow,
  WorkflowStep,
  WorkflowExecutionState,
  TemplateStep,
  NoteStep,
  AlertStep,
  ChecklistStep,
  CopyStep,
} from "@/types/workflow";
import { createExecutionState } from "@/types/workflow";

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestWorkflow(steps: WorkflowStep[]): Workflow {
  return {
    id: "test-workflow-1",
    name: "Test Workflow",
    description: "A test workflow",
    steps,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
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
    instructions: "Complete manual task",
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
// Step Execution Preparation
// ============================================================================

describe("prepareTemplateStepResult", () => {
  it("should return rendered content unchanged", () => {
    const step = createTemplateStep();
    const renderedContent = "This is the rendered template content";
    
    const result = prepareTemplateStepResult(step, renderedContent);
    
    expect(result).toBe(renderedContent);
  });

  it("should handle empty content", () => {
    const step = createTemplateStep();
    
    const result = prepareTemplateStepResult(step, "");
    
    expect(result).toBe("");
  });
});

describe("prepareNoteContent", () => {
  it("should use previous content when contentSource is previous", () => {
    const step = createNoteStep({ contentSource: "previous" });
    const previousContent = "Previous template result";
    
    const result = prepareNoteContent(step, previousContent);
    
    expect(result).toBe("Previous template result");
  });

  it("should use custom content when contentSource is custom", () => {
    const step = createNoteStep({
      contentSource: "custom",
      customContent: "My custom note content",
    });
    
    const result = prepareNoteContent(step, "Previous content ignored");
    
    expect(result).toBe("My custom note content");
  });

  it("should apply prefix when configured", () => {
    const step = createNoteStep({
      contentSource: "previous",
      prefix: "MLTC: ",
    });
    const previousContent = "Case was denied";
    
    const result = prepareNoteContent(step, previousContent);
    
    expect(result).toBe("MLTC: Case was denied");
  });

  it("should apply prefix to custom content", () => {
    const step = createNoteStep({
      contentSource: "custom",
      customContent: "Note body",
      prefix: "FTP: ",
    });
    
    const result = prepareNoteContent(step);
    
    expect(result).toBe("FTP: Note body");
  });

  it("should return empty string when no previous content and source is previous", () => {
    const step = createNoteStep({ contentSource: "previous" });
    
    const result = prepareNoteContent(step, undefined);
    
    expect(result).toBe("");
  });

  it("should apply prefix to empty content", () => {
    const step = createNoteStep({
      contentSource: "previous",
      prefix: "PREFIX: ",
    });
    
    const result = prepareNoteContent(step, undefined);
    
    expect(result).toBe("PREFIX: ");
  });
});

describe("prepareAlertData", () => {
  it("should calculate due date based on days offset", () => {
    const step = createAlertStep({ daysOffset: 30 });
    const before = new Date();
    
    const result = prepareAlertData(step, "case-123");
    
    const after = new Date();
    // Due date should be approximately 30 days from now
    const expectedMin = new Date(before);
    expectedMin.setDate(expectedMin.getDate() + 30);
    const expectedMax = new Date(after);
    expectedMax.setDate(expectedMax.getDate() + 30);
    
    expect(result.dueDate.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime() - 1000);
    expect(result.dueDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime() + 1000);
  });

  it("should use custom message when provided", () => {
    const step = createAlertStep({ daysOffset: 7, message: "Check MLTC status" });
    
    const result = prepareAlertData(step, "case-123");
    
    expect(result.message).toBe("Check MLTC status");
  });

  it("should use default message when not provided", () => {
    const step = createAlertStep({ daysOffset: 7 });
    
    const result = prepareAlertData(step, "case-123");
    
    expect(result.message).toBe("Follow up required");
  });

  it("should handle zero days offset", () => {
    const step = createAlertStep({ daysOffset: 0 });
    const now = new Date();
    
    const result = prepareAlertData(step, "case-123");
    
    // Due date should be today
    expect(result.dueDate.toDateString()).toBe(now.toDateString());
  });
});

// ============================================================================
// State Management
// ============================================================================

describe("advanceWorkflowState", () => {
  let workflow: Workflow;
  let initialState: WorkflowExecutionState;

  beforeEach(() => {
    workflow = createTestWorkflow([
      createTemplateStep(),
      createNoteStep(),
      createAlertStep(),
    ]);
    initialState = createExecutionState(workflow, "case-123");
    // Set first step to active
    initialState.stepStates[0].status = "active";
    initialState.status = "running";
  });

  it("should advance to next step", () => {
    const result = advanceWorkflowState(initialState);
    
    expect(result.currentStepIndex).toBe(1);
    expect(result.stepStates[1].status).toBe("active");
    expect(result.status).toBe("running");
  });

  it("should mark workflow complete when advancing past last step", () => {
    // Set to last step
    const state: WorkflowExecutionState = {
      ...initialState,
      currentStepIndex: 2,
    };
    
    const result = advanceWorkflowState(state);
    
    expect(result.status).toBe("completed");
    expect(result.completedAt).toBeDefined();
    expect(result.currentStepIndex).toBe(3);
  });

  it("should not mutate original state", () => {
    const originalIndex = initialState.currentStepIndex;
    
    advanceWorkflowState(initialState);
    
    expect(initialState.currentStepIndex).toBe(originalIndex);
  });
});

describe("completeCurrentStep", () => {
  let workflow: Workflow;
  let state: WorkflowExecutionState;

  beforeEach(() => {
    workflow = createTestWorkflow([createTemplateStep(), createNoteStep()]);
    state = createExecutionState(workflow, "case-123");
    state.stepStates[0].status = "active";
  });

  it("should mark current step as completed", () => {
    const result = completeCurrentStep(state);
    
    expect(result.stepStates[0].status).toBe("completed");
  });

  it("should store result when provided", () => {
    const result = completeCurrentStep(state, "Template output");
    
    expect(result.stepStates[0].result).toBe("Template output");
  });

  it("should not modify other steps", () => {
    const result = completeCurrentStep(state, "Result");
    
    expect(result.stepStates[1].status).toBe("pending");
  });

  it("should not mutate original state", () => {
    completeCurrentStep(state, "Result");
    
    expect(state.stepStates[0].status).toBe("active");
  });
});

describe("skipCurrentStep", () => {
  let workflow: Workflow;
  let state: WorkflowExecutionState;

  beforeEach(() => {
    workflow = createTestWorkflow([createTemplateStep(), createNoteStep()]);
    state = createExecutionState(workflow, "case-123");
    state.stepStates[0].status = "active";
  });

  it("should mark current step as skipped", () => {
    const result = skipCurrentStep(state);
    
    expect(result.stepStates[0].status).toBe("skipped");
  });

  it("should not mutate original state", () => {
    skipCurrentStep(state);
    
    expect(state.stepStates[0].status).toBe("active");
  });
});

describe("markStepError", () => {
  let workflow: Workflow;
  let state: WorkflowExecutionState;

  beforeEach(() => {
    workflow = createTestWorkflow([createTemplateStep()]);
    state = createExecutionState(workflow, "case-123");
    state.stepStates[0].status = "active";
    state.status = "running";
  });

  it("should mark current step as error", () => {
    const result = markStepError(state, "Template not found");
    
    expect(result.stepStates[0].status).toBe("error");
    expect(result.stepStates[0].error).toBe("Template not found");
  });

  it("should mark workflow status as error", () => {
    const result = markStepError(state, "Error message");
    
    expect(result.status).toBe("error");
  });
});

describe("markChecklistComplete", () => {
  let workflow: Workflow;
  let state: WorkflowExecutionState;

  beforeEach(() => {
    workflow = createTestWorkflow([createChecklistStep()]);
    state = createExecutionState(workflow, "case-123");
    state.stepStates[0].status = "active";
  });

  it("should mark checklist as checked", () => {
    const result = markChecklistComplete(state, true);
    
    expect(result.stepStates[0].checked).toBe(true);
  });

  it("should mark checklist as unchecked", () => {
    // First mark as checked
    const checked = markChecklistComplete(state, true);
    // Then uncheck
    const result = markChecklistComplete(checked, false);
    
    expect(result.stepStates[0].checked).toBe(false);
  });
});

// ============================================================================
// State Queries
// ============================================================================

describe("isWorkflowComplete", () => {
  let workflow: Workflow;

  beforeEach(() => {
    workflow = createTestWorkflow([createTemplateStep(), createNoteStep()]);
  });

  it("should return true when status is completed", () => {
    const state = createExecutionState(workflow, "case-123");
    state.status = "completed";
    
    expect(isWorkflowComplete(state)).toBe(true);
  });

  it("should return true when current index is past all steps", () => {
    const state = createExecutionState(workflow, "case-123");
    state.currentStepIndex = 2;
    
    expect(isWorkflowComplete(state)).toBe(true);
  });

  it("should return false when still running", () => {
    const state = createExecutionState(workflow, "case-123");
    state.status = "running";
    state.currentStepIndex = 0;
    
    expect(isWorkflowComplete(state)).toBe(false);
  });
});

describe("canProceedToNext", () => {
  it("should return false for completed workflow", () => {
    const workflow = createTestWorkflow([createTemplateStep()]);
    const state = createExecutionState(workflow, "case-123");
    state.status = "completed";
    
    expect(canProceedToNext(state)).toBe(false);
  });

  it("should return true for completed step", () => {
    const workflow = createTestWorkflow([createTemplateStep(), createNoteStep()]);
    const state = createExecutionState(workflow, "case-123");
    state.stepStates[0].status = "completed";
    
    expect(canProceedToNext(state)).toBe(true);
  });

  it("should return false for pending step", () => {
    const workflow = createTestWorkflow([createTemplateStep()]);
    const state = createExecutionState(workflow, "case-123");
    state.stepStates[0].status = "pending";
    
    expect(canProceedToNext(state)).toBe(false);
  });

  it("should require checked=true for checklist steps", () => {
    const workflow = createTestWorkflow([createChecklistStep()]);
    const state = createExecutionState(workflow, "case-123");
    state.stepStates[0].status = "active";
    
    expect(canProceedToNext(state)).toBe(false);
    
    state.stepStates[0].checked = true;
    expect(canProceedToNext(state)).toBe(true);
  });
});

describe("getCurrentStep", () => {
  it("should return current step", () => {
    const templateStep = createTemplateStep();
    const workflow = createTestWorkflow([templateStep, createNoteStep()]);
    const state = createExecutionState(workflow, "case-123");
    
    const result = getCurrentStep(state);
    
    expect(result).toEqual(templateStep);
  });

  it("should return null when past all steps", () => {
    const workflow = createTestWorkflow([createTemplateStep()]);
    const state = createExecutionState(workflow, "case-123");
    state.currentStepIndex = 1;
    
    const result = getCurrentStep(state);
    
    expect(result).toBeNull();
  });
});

describe("getPreviousTemplateResult", () => {
  it("should return result from previous template step", () => {
    const workflow = createTestWorkflow([
      createTemplateStep({ id: "t1" }),
      createNoteStep(),
    ]);
    const state = createExecutionState(workflow, "case-123");
    state.stepStates[0].status = "completed";
    state.stepStates[0].result = "Template output";
    state.currentStepIndex = 1;
    
    const result = getPreviousTemplateResult(state);
    
    expect(result).toBe("Template output");
  });

  it("should skip non-template steps", () => {
    const workflow = createTestWorkflow([
      createTemplateStep({ id: "t1" }),
      createChecklistStep(),
      createNoteStep(),
    ]);
    const state = createExecutionState(workflow, "case-123");
    state.stepStates[0].status = "completed";
    state.stepStates[0].result = "Template output";
    state.stepStates[1].status = "completed";
    state.currentStepIndex = 2;
    
    const result = getPreviousTemplateResult(state);
    
    expect(result).toBe("Template output");
  });

  it("should return undefined if no previous template", () => {
    const workflow = createTestWorkflow([createNoteStep()]);
    const state = createExecutionState(workflow, "case-123");
    
    const result = getPreviousTemplateResult(state);
    
    expect(result).toBeUndefined();
  });

  it("should skip incomplete template steps", () => {
    const workflow = createTestWorkflow([
      createTemplateStep({ id: "t1" }),
      createTemplateStep({ id: "t2" }),
      createNoteStep(),
    ]);
    const state = createExecutionState(workflow, "case-123");
    state.stepStates[0].status = "completed";
    state.stepStates[0].result = "First template";
    state.stepStates[1].status = "skipped"; // Not completed
    state.currentStepIndex = 2;
    
    const result = getPreviousTemplateResult(state);
    
    expect(result).toBe("First template");
  });

  it("should respect beforeIndex parameter", () => {
    const workflow = createTestWorkflow([
      createTemplateStep({ id: "t1" }),
      createTemplateStep({ id: "t2" }),
      createNoteStep(),
    ]);
    const state = createExecutionState(workflow, "case-123");
    state.stepStates[0].status = "completed";
    state.stepStates[0].result = "First template";
    state.stepStates[1].status = "completed";
    state.stepStates[1].result = "Second template";
    state.currentStepIndex = 2;
    
    // Get result before index 1 (should find t1)
    const result = getPreviousTemplateResult(state, 1);
    
    expect(result).toBe("First template");
  });
});

describe("getCompletedSteps", () => {
  it("should return completed and skipped steps", () => {
    const workflow = createTestWorkflow([
      createTemplateStep(),
      createNoteStep(),
      createChecklistStep(),
    ]);
    const state = createExecutionState(workflow, "case-123");
    state.stepStates[0].status = "completed";
    state.stepStates[1].status = "skipped";
    state.stepStates[2].status = "pending";
    
    const result = getCompletedSteps(state);
    
    expect(result).toHaveLength(2);
  });

  it("should return empty array when no steps completed", () => {
    const workflow = createTestWorkflow([createTemplateStep()]);
    const state = createExecutionState(workflow, "case-123");
    
    const result = getCompletedSteps(state);
    
    expect(result).toHaveLength(0);
  });
});

describe("getRemainingSteps", () => {
  it("should return pending steps", () => {
    const workflow = createTestWorkflow([
      createTemplateStep(),
      createNoteStep(),
      createChecklistStep(),
    ]);
    const state = createExecutionState(workflow, "case-123");
    state.stepStates[0].status = "completed";
    state.stepStates[1].status = "active";
    
    const result = getRemainingSteps(state);
    
    expect(result).toHaveLength(1);
    expect(result[0].step.type).toBe("checklist");
  });
});

// ============================================================================
// Labels and Display
// ============================================================================

describe("getStepLabel", () => {
  it("should return custom label when set", () => {
    const step = createTemplateStep({ label: "My Custom Label" });
    
    expect(getStepLabel(step)).toBe("My Custom Label");
  });

  it("should return default label for template step", () => {
    const step = createTemplateStep();
    
    expect(getStepLabel(step)).toBe("Generate Template");
  });

  it("should return default label for note step", () => {
    const step = createNoteStep();
    
    expect(getStepLabel(step)).toBe("Create Note");
  });

  it("should return default label for alert step", () => {
    const step = createAlertStep();
    
    expect(getStepLabel(step)).toBe("Set Alert");
  });

  it("should return default label for checklist step", () => {
    const step = createChecklistStep();
    
    expect(getStepLabel(step)).toBe("Checklist Item");
  });

  it("should return default label for copy step", () => {
    const step = createCopyStep();
    
    expect(getStepLabel(step)).toBe("Copy to Clipboard");
  });
});

describe("getStepDescription", () => {
  it("should describe template step", () => {
    const step = createTemplateStep({ templateId: "denial-letter" });
    
    expect(getStepDescription(step)).toBe("Generate template: denial-letter");
  });

  it("should describe note step with category", () => {
    const step = createNoteStep({ category: "approved" });
    
    expect(getStepDescription(step)).toBe("Create approved note");
  });

  it("should describe alert step with days", () => {
    const step = createAlertStep({ daysOffset: 14 });
    
    expect(getStepDescription(step)).toBe("Set alert for 14 days");
  });

  it("should describe checklist step with instructions", () => {
    const step = createChecklistStep({ instructions: "Send email to client" });
    
    expect(getStepDescription(step)).toBe("Send email to client");
  });

  it("should describe checklist step without instructions", () => {
    const step = createChecklistStep({ instructions: undefined });
    
    expect(getStepDescription(step)).toBe("Manual task");
  });

  it("should describe copy step", () => {
    const step = createCopyStep();
    
    expect(getStepDescription(step)).toBe("Copy content to clipboard");
  });
});

describe("getStepIcon", () => {
  it("should return FileText for template", () => {
    expect(getStepIcon(createTemplateStep())).toBe("FileText");
  });

  it("should return StickyNote for note", () => {
    expect(getStepIcon(createNoteStep())).toBe("StickyNote");
  });

  it("should return Bell for alert", () => {
    expect(getStepIcon(createAlertStep())).toBe("Bell");
  });

  it("should return CheckSquare for checklist", () => {
    expect(getStepIcon(createChecklistStep())).toBe("CheckSquare");
  });

  it("should return Copy for copy", () => {
    expect(getStepIcon(createCopyStep())).toBe("Copy");
  });
});

// ============================================================================
// Condition Evaluation
// ============================================================================

describe("shouldExecuteStep", () => {
  it("should always execute non-template steps", () => {
    expect(shouldExecuteStep(createNoteStep(), "FTP")).toBe(true);
    expect(shouldExecuteStep(createAlertStep(), "FTP")).toBe(true);
    expect(shouldExecuteStep(createChecklistStep(), "FTP")).toBe(true);
    expect(shouldExecuteStep(createCopyStep(), "FTP")).toBe(true);
  });

  it("should execute template step without condition", () => {
    const step = createTemplateStep();
    
    expect(shouldExecuteStep(step, "FTP")).toBe(true);
    expect(shouldExecuteStep(step, undefined)).toBe(true);
  });

  it("should execute template step when condition matches", () => {
    const step = createTemplateStep({ applicationTypeCondition: "FTP" });
    
    expect(shouldExecuteStep(step, "FTP")).toBe(true);
  });

  it("should skip template step when condition does not match", () => {
    const step = createTemplateStep({ applicationTypeCondition: "FTP" });
    
    expect(shouldExecuteStep(step, "MLTC")).toBe(false);
  });

  it("should skip template step when no application type and condition set", () => {
    const step = createTemplateStep({ applicationTypeCondition: "FTP" });
    
    expect(shouldExecuteStep(step, undefined)).toBe(false);
  });
});

describe("evaluateApplicationTypeCondition", () => {
  it("should return true when no condition", () => {
    expect(evaluateApplicationTypeCondition(undefined, "FTP")).toBe(true);
    expect(evaluateApplicationTypeCondition(undefined, undefined)).toBe(true);
  });

  it("should return false when condition set but no application type", () => {
    expect(evaluateApplicationTypeCondition("FTP", undefined)).toBe(false);
  });

  it("should match case-insensitively", () => {
    expect(evaluateApplicationTypeCondition("FTP", "ftp")).toBe(true);
    expect(evaluateApplicationTypeCondition("ftp", "FTP")).toBe(true);
    expect(evaluateApplicationTypeCondition("Ftp", "fTp")).toBe(true);
  });

  it("should return false for non-matching values", () => {
    expect(evaluateApplicationTypeCondition("FTP", "MLTC")).toBe(false);
    expect(evaluateApplicationTypeCondition("abc", "def")).toBe(false);
  });
});
