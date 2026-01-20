/**
 * @fileoverview Tests for WorkflowService
 *
 * Tests the stateless service for workflow CRUD operations.
 * Covers read, write, step operations, and error handling.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { WorkflowService } from "@/utils/services/WorkflowService";
import type { FileStorageService, NormalizedFileData } from "@/utils/services/FileStorageService";
import type { Workflow, WorkflowStep, TemplateStep, NoteStep } from "@/types/workflow";

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockWorkflow(overrides: Partial<Workflow> = {}): Workflow {
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

function createMockFileData(workflows: Workflow[] = []): NormalizedFileData {
  return {
    version: "2.0",
    cases: [],
    financials: [],
    notes: [],
    alerts: [],
    exported_at: new Date().toISOString(),
    total_cases: 0,
    categoryConfig: {
      caseTypes: [],
      applicationTypes: [],
      caseStatuses: [],
      alertTypes: [],
      livingArrangements: [],
      noteCategories: [],
      verificationStatuses: [],
      summaryTemplate: {
        sectionOrder: [],
        defaultSections: {
          notes: true,
          caseInfo: true,
          personInfo: true,
          relationships: true,
          resources: true,
          income: true,
          expenses: true,
          avsTracking: true,
        },
        sectionTemplates: {},
      },
    },
    activityLog: [],
    workflows,
  };
}

function createMockFileStorage(): {
  fileStorage: FileStorageService;
  readFileData: Mock;
  writeNormalizedData: Mock;
} {
  const readFileData = vi.fn();
  const writeNormalizedData = vi.fn();
  
  return {
    fileStorage: {
      readFileData,
      writeNormalizedData,
    } as unknown as FileStorageService,
    readFileData,
    writeNormalizedData,
  };
}

// ============================================================================
// Read Operations
// ============================================================================

describe("WorkflowService", () => {
  let service: WorkflowService;
  let mockStorage: ReturnType<typeof createMockFileStorage>;

  beforeEach(() => {
    mockStorage = createMockFileStorage();
    service = new WorkflowService({ fileStorage: mockStorage.fileStorage });
  });

  describe("getAllWorkflows", () => {
    it("should return empty array when no workflows exist", async () => {
      mockStorage.readFileData.mockResolvedValue(createMockFileData());

      const result = await service.getAllWorkflows();

      expect(result).toEqual([]);
    });

    it("should return all workflows", async () => {
      const workflows = [
        createMockWorkflow({ id: "w1", name: "Workflow 1" }),
        createMockWorkflow({ id: "w2", name: "Workflow 2" }),
      ];
      mockStorage.readFileData.mockResolvedValue(createMockFileData(workflows));

      const result = await service.getAllWorkflows();

      expect(result).toHaveLength(2);
    });

    it("should sort workflows by sortOrder", async () => {
      const workflows = [
        createMockWorkflow({ id: "w1", name: "A", sortOrder: 2 }),
        createMockWorkflow({ id: "w2", name: "B", sortOrder: 1 }),
        createMockWorkflow({ id: "w3", name: "C", sortOrder: 0 }),
      ];
      mockStorage.readFileData.mockResolvedValue(createMockFileData(workflows));

      const result = await service.getAllWorkflows();

      expect(result[0].id).toBe("w3");
      expect(result[1].id).toBe("w2");
      expect(result[2].id).toBe("w1");
    });

    it("should sort by name when sortOrder is undefined", async () => {
      const workflows = [
        createMockWorkflow({ id: "w1", name: "Zebra" }),
        createMockWorkflow({ id: "w2", name: "Alpha" }),
      ];
      mockStorage.readFileData.mockResolvedValue(createMockFileData(workflows));

      const result = await service.getAllWorkflows();

      expect(result[0].name).toBe("Alpha");
      expect(result[1].name).toBe("Zebra");
    });

    it("should handle null file data gracefully", async () => {
      mockStorage.readFileData.mockResolvedValue(null);

      const result = await service.getAllWorkflows();

      expect(result).toEqual([]);
    });
  });

  describe("getWorkflowById", () => {
    it("should return workflow when found", async () => {
      const workflow = createMockWorkflow({ id: "target-id" });
      mockStorage.readFileData.mockResolvedValue(createMockFileData([workflow]));

      const result = await service.getWorkflowById("target-id");

      expect(result).toEqual(workflow);
    });

    it("should return null when not found", async () => {
      mockStorage.readFileData.mockResolvedValue(createMockFileData([]));

      const result = await service.getWorkflowById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getWorkflowsForApplicationType", () => {
    it("should return all workflows when no filter specified", async () => {
      const workflows = [
        createMockWorkflow({ id: "w1", applicationTypeFilter: undefined }),
        createMockWorkflow({ id: "w2", applicationTypeFilter: "FTP" }),
      ];
      mockStorage.readFileData.mockResolvedValue(createMockFileData(workflows));

      const result = await service.getWorkflowsForApplicationType(undefined);

      // Only w1 should be returned (no filter)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("w1");
    });

    it("should filter by application type", async () => {
      const workflows = [
        createMockWorkflow({ id: "w1", applicationTypeFilter: "FTP" }),
        createMockWorkflow({ id: "w2", applicationTypeFilter: "MLTC" }),
        createMockWorkflow({ id: "w3", applicationTypeFilter: undefined }),
      ];
      mockStorage.readFileData.mockResolvedValue(createMockFileData(workflows));

      const result = await service.getWorkflowsForApplicationType("FTP");

      expect(result).toHaveLength(2);
      expect(result.map((w) => w.id).sort()).toEqual(["w1", "w3"]);
    });
  });

  // ============================================================================
  // Write Operations
  // ============================================================================

  describe("addWorkflow", () => {
    it("should create workflow with generated ID and timestamps", async () => {
      mockStorage.readFileData.mockResolvedValue(createMockFileData([]));
      mockStorage.writeNormalizedData.mockResolvedValue(undefined);

      const result = await service.addWorkflow({
        name: "New Workflow",
        steps: [],
      });

      expect(result.id).toBeTruthy();
      expect(result.name).toBe("New Workflow");
      expect(result.createdAt).toBeTruthy();
      expect(result.updatedAt).toBeTruthy();
    });

    it("should append to existing workflows", async () => {
      const existing = createMockWorkflow({ id: "existing" });
      mockStorage.readFileData.mockResolvedValue(createMockFileData([existing]));
      mockStorage.writeNormalizedData.mockResolvedValue(undefined);

      await service.addWorkflow({ name: "New", steps: [] });

      const writtenData = mockStorage.writeNormalizedData.mock.calls[0][0];
      expect(writtenData.workflows).toHaveLength(2);
    });

    it("should throw when no file data available", async () => {
      mockStorage.readFileData.mockResolvedValue(null);

      await expect(
        service.addWorkflow({ name: "Test", steps: [] })
      ).rejects.toThrow("No file data available");
    });
  });

  describe("updateWorkflow", () => {
    it("should update workflow and set updatedAt", async () => {
      const workflow = createMockWorkflow({ id: "w1", name: "Old Name" });
      mockStorage.readFileData.mockResolvedValue(createMockFileData([workflow]));
      mockStorage.writeNormalizedData.mockResolvedValue(undefined);

      const result = await service.updateWorkflow("w1", { name: "New Name" });

      expect(result?.name).toBe("New Name");
      expect(result?.updatedAt).not.toBe(workflow.updatedAt);
    });

    it("should return null when workflow not found", async () => {
      mockStorage.readFileData.mockResolvedValue(createMockFileData([]));

      const result = await service.updateWorkflow("nonexistent", { name: "Test" });

      expect(result).toBeNull();
    });

    it("should throw when no file data available", async () => {
      mockStorage.readFileData.mockResolvedValue(null);

      await expect(
        service.updateWorkflow("w1", { name: "Test" })
      ).rejects.toThrow("No file data available");
    });
  });

  describe("deleteWorkflow", () => {
    it("should delete workflow by ID", async () => {
      const workflows = [
        createMockWorkflow({ id: "w1" }),
        createMockWorkflow({ id: "w2" }),
      ];
      mockStorage.readFileData.mockResolvedValue(createMockFileData(workflows));
      mockStorage.writeNormalizedData.mockResolvedValue(undefined);

      const result = await service.deleteWorkflow("w1");

      expect(result).toBe(true);
      const writtenData = mockStorage.writeNormalizedData.mock.calls[0][0];
      expect(writtenData.workflows).toHaveLength(1);
      expect(writtenData.workflows[0].id).toBe("w2");
    });

    it("should return false when workflow not found", async () => {
      mockStorage.readFileData.mockResolvedValue(createMockFileData([]));

      const result = await service.deleteWorkflow("nonexistent");

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Step Operations
  // ============================================================================

  describe("addStep", () => {
    it("should add step to end by default", async () => {
      const workflow = createMockWorkflow({
        id: "w1",
        steps: [{ id: "s1", type: "template", templateId: "t1" } as TemplateStep],
      });
      mockStorage.readFileData.mockResolvedValue(createMockFileData([workflow]));
      mockStorage.writeNormalizedData.mockResolvedValue(undefined);

      const newStep: NoteStep = { id: "s2", type: "note", category: "denied", contentSource: "previous" };
      await service.addStep("w1", newStep);

      const writtenData = mockStorage.writeNormalizedData.mock.calls[0][0];
      const updatedWorkflow = writtenData.workflows[0];
      expect(updatedWorkflow.steps).toHaveLength(2);
      expect(updatedWorkflow.steps[1].id).toBe("s2");
    });

    it("should insert step at specified index", async () => {
      const workflow = createMockWorkflow({
        id: "w1",
        steps: [
          { id: "s1", type: "template", templateId: "t1" } as TemplateStep,
          { id: "s3", type: "template", templateId: "t3" } as TemplateStep,
        ],
      });
      mockStorage.readFileData.mockResolvedValue(createMockFileData([workflow]));
      mockStorage.writeNormalizedData.mockResolvedValue(undefined);

      const newStep: TemplateStep = { id: "s2", type: "template", templateId: "t2" };
      await service.addStep("w1", newStep, 1);

      const writtenData = mockStorage.writeNormalizedData.mock.calls[0][0];
      const steps = writtenData.workflows[0].steps;
      expect(steps[0].id).toBe("s1");
      expect(steps[1].id).toBe("s2");
      expect(steps[2].id).toBe("s3");
    });

    it("should return null when workflow not found", async () => {
      mockStorage.readFileData.mockResolvedValue(createMockFileData([]));

      const result = await service.addStep("nonexistent", { id: "s1", type: "copy" } as WorkflowStep);

      expect(result).toBeNull();
    });
  });

  describe("updateStep", () => {
    it("should update step within workflow", async () => {
      const workflow = createMockWorkflow({
        id: "w1",
        steps: [{ id: "s1", type: "template", templateId: "old-template" } as TemplateStep],
      });
      mockStorage.readFileData.mockResolvedValue(createMockFileData([workflow]));
      mockStorage.writeNormalizedData.mockResolvedValue(undefined);

      await service.updateStep("w1", "s1", { templateId: "new-template" });

      const writtenData = mockStorage.writeNormalizedData.mock.calls[0][0];
      const step = writtenData.workflows[0].steps[0] as TemplateStep;
      expect(step.templateId).toBe("new-template");
    });

    it("should return null when step not found", async () => {
      const workflow = createMockWorkflow({ id: "w1", steps: [] });
      mockStorage.readFileData.mockResolvedValue(createMockFileData([workflow]));

      const result = await service.updateStep("w1", "nonexistent", {});

      expect(result).toBeNull();
    });
  });

  describe("removeStep", () => {
    it("should remove step from workflow", async () => {
      const workflow = createMockWorkflow({
        id: "w1",
        steps: [
          { id: "s1", type: "template", templateId: "t1" } as TemplateStep,
          { id: "s2", type: "template", templateId: "t2" } as TemplateStep,
        ],
      });
      mockStorage.readFileData.mockResolvedValue(createMockFileData([workflow]));
      mockStorage.writeNormalizedData.mockResolvedValue(undefined);

      await service.removeStep("w1", "s1");

      const writtenData = mockStorage.writeNormalizedData.mock.calls[0][0];
      expect(writtenData.workflows[0].steps).toHaveLength(1);
      expect(writtenData.workflows[0].steps[0].id).toBe("s2");
    });
  });

  describe("reorderSteps", () => {
    it("should reorder steps according to provided IDs", async () => {
      const workflow = createMockWorkflow({
        id: "w1",
        steps: [
          { id: "s1", type: "template", templateId: "t1" } as TemplateStep,
          { id: "s2", type: "template", templateId: "t2" } as TemplateStep,
          { id: "s3", type: "template", templateId: "t3" } as TemplateStep,
        ],
      });
      mockStorage.readFileData.mockResolvedValue(createMockFileData([workflow]));
      mockStorage.writeNormalizedData.mockResolvedValue(undefined);

      await service.reorderSteps("w1", ["s3", "s1", "s2"]);

      const writtenData = mockStorage.writeNormalizedData.mock.calls[0][0];
      const steps = writtenData.workflows[0].steps;
      expect(steps[0].id).toBe("s3");
      expect(steps[1].id).toBe("s1");
      expect(steps[2].id).toBe("s2");
    });

    it("should throw error when step IDs are missing", async () => {
      const workflow = createMockWorkflow({
        id: "w1",
        steps: [
          { id: "s1", type: "template", templateId: "t1" } as TemplateStep,
          { id: "s2", type: "template", templateId: "t2" } as TemplateStep,
        ],
      });
      mockStorage.readFileData.mockResolvedValue(createMockFileData([workflow]));

      await expect(
        service.reorderSteps("w1", ["s1"]) // Missing s2
      ).rejects.toThrow("missing step IDs would be deleted");
    });

    it("should throw error when unknown step IDs provided", async () => {
      const workflow = createMockWorkflow({
        id: "w1",
        steps: [{ id: "s1", type: "template", templateId: "t1" } as TemplateStep],
      });
      mockStorage.readFileData.mockResolvedValue(createMockFileData([workflow]));

      await expect(
        service.reorderSteps("w1", ["s1", "unknown-id"])
      ).rejects.toThrow("unknown step IDs provided");
    });

    it("should return null when workflow not found", async () => {
      mockStorage.readFileData.mockResolvedValue(createMockFileData([]));

      const result = await service.reorderSteps("nonexistent", ["s1"]);

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  describe("setAllWorkflows", () => {
    it("should replace all workflows", async () => {
      const existing = [createMockWorkflow({ id: "old" })];
      mockStorage.readFileData.mockResolvedValue(createMockFileData(existing));
      mockStorage.writeNormalizedData.mockResolvedValue(undefined);

      const newWorkflows = [
        createMockWorkflow({ id: "new1" }),
        createMockWorkflow({ id: "new2" }),
      ];
      await service.setAllWorkflows(newWorkflows);

      const writtenData = mockStorage.writeNormalizedData.mock.calls[0][0];
      expect(writtenData.workflows).toHaveLength(2);
      expect(writtenData.workflows[0].id).toBe("new1");
    });

    it("should throw when no file data available", async () => {
      mockStorage.readFileData.mockResolvedValue(null);

      await expect(service.setAllWorkflows([])).rejects.toThrow(
        "No file data available"
      );
    });
  });

  describe("reorderWorkflows", () => {
    it("should update sortOrder based on position", async () => {
      const workflows = [
        createMockWorkflow({ id: "w1", sortOrder: 0 }),
        createMockWorkflow({ id: "w2", sortOrder: 1 }),
      ];
      mockStorage.readFileData.mockResolvedValue(createMockFileData(workflows));
      mockStorage.writeNormalizedData.mockResolvedValue(undefined);

      await service.reorderWorkflows(["w2", "w1"]);

      const writtenData = mockStorage.writeNormalizedData.mock.calls[0][0];
      const w1 = writtenData.workflows.find((w: Workflow) => w.id === "w1");
      const w2 = writtenData.workflows.find((w: Workflow) => w.id === "w2");
      expect(w2.sortOrder).toBe(0);
      expect(w1.sortOrder).toBe(1);
    });

    it("should return true on success", async () => {
      mockStorage.readFileData.mockResolvedValue(createMockFileData([]));
      mockStorage.writeNormalizedData.mockResolvedValue(undefined);

      const result = await service.reorderWorkflows([]);

      expect(result).toBe(true);
    });
  });
});
