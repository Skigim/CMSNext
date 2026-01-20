/**
 * WorkflowConfigPanel
 *
 * Settings panel for creating and managing workflows.
 * Workflows are sequences of steps that automate case processing tasks.
 *
 * @module components/settings/WorkflowConfigPanel
 */

import { useState } from "react";
import { toast } from "sonner";
import {
  Play,
  Plus,
  Trash2,
  Edit2,
  GripVertical,
  FileText,
  StickyNote,
  Bell,
  CheckSquare,
  Copy,
  ChevronDown,
  ChevronUp,
  Save,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { useWorkflows } from "@/contexts/WorkflowContext";
import { useTemplates } from "@/contexts/TemplateContext";
import type {
  Workflow,
  WorkflowStep,
  TemplateStep,
  NoteStep,
  AlertStep,
  ChecklistStep,
  CopyStep,
} from "@/types/workflow";
import { createStep, STEP_TYPE_LABELS } from "@/types/workflow";
import { validateStep } from "@/domain/workflows";

// =============================================================================
// Step Type Icons
// =============================================================================

const STEP_ICONS: Record<WorkflowStep["type"], React.ReactNode> = {
  template: <FileText className="h-4 w-4" />,
  note: <StickyNote className="h-4 w-4" />,
  alert: <Bell className="h-4 w-4" />,
  checklist: <CheckSquare className="h-4 w-4" />,
  copy: <Copy className="h-4 w-4" />,
};

// =============================================================================
// Step Editor Components
// =============================================================================

interface StepEditorProps {
  step: WorkflowStep;
  onChange: (updates: Partial<WorkflowStep>) => void;
  onDelete: () => void;
  templates: Array<{ id: string; name: string }>;
}

function TemplateStepEditor({
  step,
  onChange,
  templates,
}: Omit<StepEditorProps, "onDelete">) {
  const templateStep = step as TemplateStep;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Template</Label>
        <Select
          value={templateStep.templateId}
          onValueChange={(v) => onChange({ templateId: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Application Type Condition (optional)</Label>
        <Input
          value={templateStep.applicationTypeCondition ?? ""}
          onChange={(e) =>
            onChange({
              applicationTypeCondition: e.target.value || undefined,
            })
          }
          placeholder="e.g., FTP, MLTC"
        />
        <p className="text-xs text-muted-foreground">
          Only execute if case matches this application type
        </p>
      </div>
    </div>
  );
}

function NoteStepEditor({
  step,
  onChange,
}: Omit<StepEditorProps, "onDelete" | "templates">) {
  const noteStep = step as NoteStep;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Note Category</Label>
        <Input
          value={noteStep.category}
          onChange={(e) => onChange({ category: e.target.value })}
          placeholder="e.g., denied, approved"
        />
      </div>
      <div className="space-y-1">
        <Label>Content Source</Label>
        <Select
          value={noteStep.contentSource}
          onValueChange={(v) =>
            onChange({ contentSource: v as "previous" | "custom" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="previous">From Previous Template</SelectItem>
            <SelectItem value="custom">Custom Content</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {noteStep.contentSource === "custom" && (
        <div className="space-y-1">
          <Label>Custom Content</Label>
          <Textarea
            value={noteStep.customContent ?? ""}
            onChange={(e) => onChange({ customContent: e.target.value })}
            placeholder="Enter note content..."
            rows={3}
          />
        </div>
      )}
      <div className="space-y-1">
        <Label>Prefix (optional)</Label>
        <Input
          value={noteStep.prefix ?? ""}
          onChange={(e) => onChange({ prefix: e.target.value || undefined })}
          placeholder='e.g., "MLTC: "'
        />
      </div>
    </div>
  );
}

function AlertStepEditor({
  step,
  onChange,
}: Omit<StepEditorProps, "onDelete" | "templates">) {
  const alertStep = step as AlertStep;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Days Until Alert</Label>
        <Input
          type="number"
          min={0}
          value={alertStep.daysOffset}
          onChange={(e) =>
            onChange({ daysOffset: parseInt(e.target.value, 10) || 0 })
          }
        />
        <p className="text-xs text-muted-foreground">
          Alert will be set this many days from when the workflow runs
        </p>
      </div>
      <div className="space-y-1">
        <Label>Alert Message (optional)</Label>
        <Input
          value={alertStep.message ?? ""}
          onChange={(e) => onChange({ message: e.target.value || undefined })}
          placeholder="Follow up required"
        />
      </div>
    </div>
  );
}

function ChecklistStepEditor({
  step,
  onChange,
}: Omit<StepEditorProps, "onDelete" | "templates">) {
  const checklistStep = step as ChecklistStep;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Instructions</Label>
        <Textarea
          value={checklistStep.instructions ?? ""}
          onChange={(e) =>
            onChange({ instructions: e.target.value || undefined })
          }
          placeholder="Describe the manual task to complete..."
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          User must check this off before proceeding
        </p>
      </div>
    </div>
  );
}

function CopyStepEditor({
  step,
  onChange,
}: Omit<StepEditorProps, "onDelete" | "templates">) {
  const copyStep = step as CopyStep;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        This step will copy the content from the previous template step to the
        clipboard.
      </p>
      <div className="space-y-1">
        <Label>Source Step ID (optional)</Label>
        <Input
          value={copyStep.sourceStepId ?? ""}
          onChange={(e) =>
            onChange({ sourceStepId: e.target.value || undefined })
          }
          placeholder="Leave empty for previous template"
        />
        <p className="text-xs text-muted-foreground">
          Advanced: Specify a specific step ID to copy from
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Single Step Row
// =============================================================================

interface StepRowProps {
  step: WorkflowStep;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<WorkflowStep>) => void;
  onDelete: () => void;
  templates: Array<{ id: string; name: string }>;
}

function StepRow({
  step,
  index,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  templates,
}: StepRowProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-lg border bg-card">
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <Badge variant="outline" className="min-w-[24px] justify-center">
              {index + 1}
            </Badge>
            {STEP_ICONS[step.type]}
            <span className="flex-1 text-sm font-medium">
              {step.label || STEP_TYPE_LABELS[step.type]}
            </span>
            <Badge variant="secondary" className="text-xs">
              {step.type}
            </Badge>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator />
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <Label>Custom Label (optional)</Label>
              <Input
                value={step.label ?? ""}
                onChange={(e) =>
                  onUpdate({ label: e.target.value || undefined })
                }
                placeholder={STEP_TYPE_LABELS[step.type]}
              />
            </div>

            {/* Type-specific editor */}
            {step.type === "template" && (
              <TemplateStepEditor
                step={step}
                onChange={onUpdate}
                templates={templates}
              />
            )}
            {step.type === "note" && (
              <NoteStepEditor step={step} onChange={onUpdate} />
            )}
            {step.type === "alert" && (
              <AlertStepEditor step={step} onChange={onUpdate} />
            )}
            {step.type === "checklist" && (
              <ChecklistStepEditor step={step} onChange={onUpdate} />
            )}
            {step.type === "copy" && (
              <CopyStepEditor step={step} onChange={onUpdate} />
            )}

            <div className="flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove Step
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// =============================================================================
// Workflow Editor
// =============================================================================

interface WorkflowEditorProps {
  workflow: Workflow | null;
  onSave: (workflow: Omit<Workflow, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
  templates: Array<{ id: string; name: string }>;
}

function WorkflowEditor({
  workflow,
  onSave,
  onCancel,
  templates,
}: WorkflowEditorProps) {
  const [name, setName] = useState(workflow?.name ?? "");
  const [description, setDescription] = useState(workflow?.description ?? "");
  const [applicationTypeFilter, setApplicationTypeFilter] = useState(
    workflow?.applicationTypeFilter ?? ""
  );
  const [steps, setSteps] = useState<WorkflowStep[]>(workflow?.steps ?? []);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const handleAddStep = (type: WorkflowStep["type"]) => {
    let newStep: WorkflowStep;

    switch (type) {
      case "template":
        newStep = createStep<TemplateStep>({ type: "template", templateId: "" });
        break;
      case "note":
        newStep = createStep<NoteStep>({
          type: "note",
          category: "",
          contentSource: "previous",
        });
        break;
      case "alert":
        newStep = createStep<AlertStep>({ type: "alert", daysOffset: 30 });
        break;
      case "checklist":
        newStep = createStep<ChecklistStep>({ type: "checklist" });
        break;
      case "copy":
        newStep = createStep<CopyStep>({ type: "copy" });
        break;
    }

    setSteps([...steps, newStep]);
    setExpandedStep(newStep.id);
  };

  const handleUpdateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    setSteps(
      steps.map((s) =>
        s.id === stepId ? ({ ...s, ...updates } as WorkflowStep) : s
      )
    );
  };

  const handleDeleteStep = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId));
    if (expandedStep === stepId) {
      setExpandedStep(null);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Workflow name is required");
      return;
    }
    if (steps.length === 0) {
      toast.error("Add at least one step");
      return;
    }

    // Validate each step before saving
    for (let i = 0; i < steps.length; i++) {
      const stepErrors = validateStep(steps[i]);
      if (stepErrors.length > 0) {
        const firstError = stepErrors[0];
        toast.error(`Step ${i + 1}: ${firstError.message}`);
        // Expand the problematic step for user to fix
        setExpandedStep(steps[i].id);
        return;
      }
    }

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      applicationTypeFilter: applicationTypeFilter.trim() || undefined,
      steps,
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic info */}
      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Workflow Name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., FTP Denial Processing"
          />
        </div>
        <div className="space-y-1">
          <Label>Description (optional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this workflow does..."
            rows={2}
          />
        </div>
        <div className="space-y-1">
          <Label>Application Type Filter (optional)</Label>
          <Input
            value={applicationTypeFilter}
            onChange={(e) => setApplicationTypeFilter(e.target.value)}
            placeholder="e.g., FTP, MLTC"
          />
          <p className="text-xs text-muted-foreground">
            If set, this workflow will only appear for cases with matching
            application type
          </p>
        </div>
      </div>

      <Separator />

      {/* Steps */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base">Steps</Label>
          <Badge variant="secondary">{steps.length} steps</Badge>
        </div>

        {/* Step list */}
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2 pr-4">
            {steps.map((step, index) => (
              <StepRow
                key={step.id}
                step={step}
                index={index}
                isExpanded={expandedStep === step.id}
                onToggle={() =>
                  setExpandedStep(expandedStep === step.id ? null : step.id)
                }
                onUpdate={(updates) => handleUpdateStep(step.id, updates)}
                onDelete={() => handleDeleteStep(step.id)}
                templates={templates}
              />
            ))}
            {steps.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No steps yet. Add steps below to build your workflow.</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Add step buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddStep("template")}
          >
            <FileText className="h-4 w-4 mr-1" />
            Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddStep("checklist")}
          >
            <CheckSquare className="h-4 w-4 mr-1" />
            Checklist
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddStep("note")}
          >
            <StickyNote className="h-4 w-4 mr-1" />
            Note
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddStep("alert")}
          >
            <Bell className="h-4 w-4 mr-1" />
            Alert
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddStep("copy")}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-1" />
          Save Workflow
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Main Panel Component
// =============================================================================

/**
 * WorkflowConfigPanel - Settings panel for workflow management.
 *
 * Allows users to:
 * - View existing workflows
 * - Create new workflows
 * - Edit workflow steps
 * - Delete workflows
 */
export function WorkflowConfigPanel() {
  const { workflows, loading, addWorkflow, updateWorkflow, deleteWorkflow } =
    useWorkflows();
  const { templates } = useTemplates();

  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);

  // Get VR templates for template step selection
  const vrTemplates = templates
    .filter((t) => t.category === "vr")
    .map((t) => ({ id: t.id, name: t.name }));

  const handleCreate = () => {
    setIsCreating(true);
    setEditingWorkflow(null);
  };

  const handleEdit = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setIsCreating(false);
  };

  const handleSave = async (
    workflowData: Omit<Workflow, "id" | "createdAt" | "updatedAt">
  ) => {
    if (editingWorkflow) {
      await updateWorkflow(editingWorkflow.id, workflowData);
    } else {
      await addWorkflow(workflowData);
    }
    setEditingWorkflow(null);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setEditingWorkflow(null);
    setIsCreating(false);
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteWorkflow(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const isEditing = isCreating || editingWorkflow !== null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            <CardTitle>Workflow Builder</CardTitle>
          </div>
          {!isEditing && (
            <Button onClick={handleCreate} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Workflow
            </Button>
          )}
        </div>
        <CardDescription>
          Create automated workflows to streamline repetitive case processing
          tasks. Workflows can generate templates, create notes, set alerts, and
          guide you through manual steps.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading workflows...
          </div>
        ) : isEditing ? (
          <WorkflowEditor
            workflow={editingWorkflow}
            onSave={handleSave}
            onCancel={handleCancel}
            templates={vrTemplates}
          />
        ) : workflows.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">
              No workflows created yet. Workflows help automate multi-step case
              processing.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Create Your First Workflow
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{workflow.name}</span>
                    {workflow.applicationTypeFilter && (
                      <Badge variant="outline" className="text-xs">
                        {workflow.applicationTypeFilter}
                      </Badge>
                    )}
                  </div>
                  {workflow.description && (
                    <p className="text-sm text-muted-foreground">
                      {workflow.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {workflow.steps.length} step
                    {workflow.steps.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(workflow)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(workflow)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
