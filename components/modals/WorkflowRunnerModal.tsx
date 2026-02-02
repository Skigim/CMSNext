/**
 * WorkflowRunnerModal
 *
 * A step-by-step wizard modal that guides users through workflow execution.
 * Displays current step, progress, and handles step-specific interactions.
 *
 * @module components/modals/WorkflowRunnerModal
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Progress } from "../ui/progress";
import {
  FileText,
  StickyNote,
  Bell,
  CheckSquare,
  Copy,
  Check,
  ChevronRight,
  AlertCircle,
  SkipForward,
} from "lucide-react";
import type { StoredCase } from "@/types/case";
import type {
  WorkflowExecutionState,
  WorkflowStep,
  StepStatus,
} from "@/types/workflow";
import {
  isTemplateStep,
  isNoteStep,
  isAlertStep,
  isChecklistStep,
  isCopyStep,
} from "@/types/workflow";
import {
  getStepLabel,
  advanceWorkflowState,
  completeCurrentStep,
  skipCurrentStep,
  markStepError,
  markChecklistComplete,
  isWorkflowComplete,
  canProceedToNext,
  getCurrentStep,
  getPreviousTemplateResult,
  prepareNoteContent,
  prepareAlertData,
  shouldExecuteStep,
} from "@/domain/workflows";
import { renderTemplate, buildCaseLevelContext } from "@/domain/templates";
import { useTemplates } from "@/contexts/TemplateContext";
import { useDataManagerSafe } from "@/contexts/DataManagerContext";

// =============================================================================
// Step Icon Component
// =============================================================================

interface StepIconProps {
  step: WorkflowStep;
  status: StepStatus;
  className?: string;
}

function StepIcon({ step, status, className = "" }: StepIconProps) {
  const baseClass = `h-4 w-4 ${className}`;

  // Show check for completed steps
  if (status === "completed") {
    return <Check className={`${baseClass} text-green-600`} />;
  }

  // Show skip icon for skipped steps
  if (status === "skipped") {
    return <SkipForward className={`${baseClass} text-muted-foreground`} />;
  }

  // Show error icon for errored steps
  if (status === "error") {
    return <AlertCircle className={`${baseClass} text-destructive`} />;
  }

  // Show step type icon
  switch (step.type) {
    case "template":
      return <FileText className={baseClass} />;
    case "note":
      return <StickyNote className={baseClass} />;
    case "alert":
      return <Bell className={baseClass} />;
    case "checklist":
      return <CheckSquare className={baseClass} />;
    case "copy":
      return <Copy className={baseClass} />;
    default:
      return <FileText className={baseClass} />;
  }
}

// =============================================================================
// Step Status Badge
// =============================================================================

function StepStatusBadge({ status }: { status: StepStatus }) {
  const variants: Record<StepStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pending", variant: "outline" },
    active: { label: "In Progress", variant: "default" },
    completed: { label: "Done", variant: "secondary" },
    skipped: { label: "Skipped", variant: "outline" },
    error: { label: "Error", variant: "destructive" },
  };

  const { label, variant } = variants[status];

  return <Badge variant={variant}>{label}</Badge>;
}

// =============================================================================
// Step Content Renderers
// =============================================================================

interface StepContentProps {
  step: WorkflowStep;
  result?: string;
  checked?: boolean;
  onCheckChange?: (checked: boolean) => void;
  onCopy?: () => void;
}

function TemplateStepContent({ result }: { result?: string }) {
  if (!result) {
    return <p className="text-muted-foreground italic">Generating template...</p>;
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Generated Content:</Label>
      <ScrollArea className="h-48 rounded-md border bg-muted/50 p-3">
        <pre className="whitespace-pre-wrap text-sm font-mono">{result}</pre>
      </ScrollArea>
    </div>
  );
}

function NoteStepContent({ step, result }: { step: WorkflowStep; result?: string }) {
  if (!isNoteStep(step)) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Note Category:</Label>
        <Badge variant="outline">{step.category}</Badge>
      </div>
      {step.prefix && (
        <p className="text-sm text-muted-foreground">
          Prefix: <span className="font-mono">{step.prefix}</span>
        </p>
      )}
      {result && (
        <ScrollArea className="h-32 rounded-md border bg-muted/50 p-3">
          <pre className="whitespace-pre-wrap text-sm">{result}</pre>
        </ScrollArea>
      )}
    </div>
  );
}

function AlertStepContent({ step }: { step: WorkflowStep }) {
  if (!isAlertStep(step)) return null;

  const alertData = prepareAlertData(step, "");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-amber-500" />
        <span className="text-sm">
          Alert will be set for{" "}
          <strong>{step.daysOffset} days</strong> from today
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        Due: {alertData.dueDate.toLocaleDateString()}
      </p>
      {step.message && (
        <p className="text-sm">
          Message: <span className="italic">{step.message}</span>
        </p>
      )}
    </div>
  );
}

function ChecklistStepContent({
  step,
  checked,
  onCheckChange,
}: StepContentProps) {
  if (!isChecklistStep(step)) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Manual Task Required
        </p>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
          {step.instructions || "Complete this task before continuing."}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Checkbox
          id="checklist-confirm"
          checked={checked}
          onCheckedChange={(c) => onCheckChange?.(c === true)}
        />
        <Label
          htmlFor="checklist-confirm"
          className="text-sm font-medium cursor-pointer"
        >
          I have completed this task
        </Label>
      </div>
    </div>
  );
}

function CopyStepContent({ result, onCopy }: StepContentProps) {
  return (
    <div className="space-y-3">
      {result ? (
        <>
          <ScrollArea className="h-32 rounded-md border bg-muted/50 p-3">
            <pre className="whitespace-pre-wrap text-sm font-mono">{result}</pre>
          </ScrollArea>
          <Button onClick={onCopy} variant="outline" className="w-full">
            <Copy className="mr-2 h-4 w-4" />
            Copy to Clipboard
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground italic">
          No content available to copy.
        </p>
      )}
    </div>
  );
}

// =============================================================================
// Main Modal Component
// =============================================================================

interface WorkflowRunnerModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when modal should close */
  onClose: () => void;
  /** Current execution state */
  executionState: WorkflowExecutionState;
  /** Update execution state */
  onExecutionStateChange: (state: WorkflowExecutionState) => void;
  /** The case being processed */
  caseData: StoredCase;
}

export function WorkflowRunnerModal({
  isOpen,
  onClose,
  executionState,
  onExecutionStateChange,
  caseData,
}: WorkflowRunnerModalProps) {
  const { getTemplateById } = useTemplates();
  const dataManager = useDataManagerSafe();
  const [isProcessing, setIsProcessing] = useState(false);

  const currentStep = getCurrentStep(executionState);
  const currentStepState = executionState.stepStates[executionState.currentStepIndex];
  const isComplete = isWorkflowComplete(executionState);
  const canProceed = canProceedToNext(executionState);

  // Calculate progress
  const progress = useMemo(() => {
    const completed = executionState.stepStates.filter(
      (s) => s.status === "completed" || s.status === "skipped"
    ).length;
    return Math.round((completed / executionState.stepStates.length) * 100);
  }, [executionState.stepStates]);

  // Build template context for rendering
  const templateContext = useMemo(() => {
    return buildCaseLevelContext(caseData);
  }, [caseData]);

  // Execute the current step
  const executeCurrentStep = useCallback(async () => {
    if (!currentStep || !dataManager) return;

    setIsProcessing(true);

    try {
      // Check if step should be skipped (condition not met)
      if (!shouldExecuteStep(currentStep, caseData.caseRecord.applicationType)) {
        const skipped = skipCurrentStep(executionState);
        const advanced = advanceWorkflowState(skipped);
        onExecutionStateChange(advanced);
        setIsProcessing(false);
        return;
      }

      let result: string | undefined;

      // Execute based on step type
      if (isTemplateStep(currentStep)) {
        // Render the template
        const template = getTemplateById(currentStep.templateId);
        if (template) {
          result = renderTemplate(template.template, templateContext);
        } else {
          // Mark step as error and halt execution
          const errorState = markStepError(
            executionState,
            `Template not found: ${currentStep.templateId}`
          );
          onExecutionStateChange(errorState);
          toast.error(`Template not found: ${currentStep.templateId}`);
          setIsProcessing(false);
          return;
        }
      } else if (isNoteStep(currentStep)) {
        // Prepare note content
        const previousContent = getPreviousTemplateResult(executionState);
        result = prepareNoteContent(currentStep, previousContent);

        // Create the note
        await dataManager.addNote(caseData.id, {
          content: result,
          category: currentStep.category,
        });
        toast.success("Note created");
      } else if (isAlertStep(currentStep)) {
        // Prepare alert data
        const alertData = prepareAlertData(currentStep, caseData.id);
        // TODO: Implement alert creation when DataManager.addAlert is available
        // Currently, AlertRecord creation is handled through CSV import.
        // To fully implement this, we need:
        // 1. Add addAlert method to DataManager and AlertsService
        // 2. Call: await dataManager.addAlert(caseData.id, alertData);
        // For now, show informational message about the pending alert
        toast.info(
          `Alert reminder: Follow up on ${alertData.dueDate.toLocaleDateString()} - ${alertData.message}`
        );
        result = alertData.message;
      } else if (isCopyStep(currentStep)) {
        // Get content to copy
        result = getPreviousTemplateResult(executionState);
      }
      // Checklist steps are handled separately (user must check)

      // Mark step as completed (except checklist)
      if (!isChecklistStep(currentStep)) {
        const completed = completeCurrentStep(executionState, result);
        onExecutionStateChange(completed);
      }
    } catch (error) {
      console.error("Step execution error:", error);
      toast.error("Step failed to execute");
    } finally {
      setIsProcessing(false);
    }
  }, [
    currentStep,
    executionState,
    onExecutionStateChange,
    getTemplateById,
    templateContext,
    dataManager,
    caseData,
  ]);

  // Auto-execute non-interactive steps when they become active
  useEffect(() => {
    if (!currentStep || currentStepState?.status !== "active") return;

    // Auto-execute template, note, alert steps
    if (
      isTemplateStep(currentStep) ||
      isNoteStep(currentStep) ||
      isAlertStep(currentStep)
    ) {
      executeCurrentStep();
    }
  }, [currentStep, currentStepState?.status, executeCurrentStep]);

  // Handle checklist checkbox change
  const handleChecklistChange = useCallback(
    (checked: boolean) => {
      const updated = markChecklistComplete(executionState, checked);
      if (checked) {
        const completed = completeCurrentStep(updated);
        onExecutionStateChange(completed);
      } else {
        onExecutionStateChange(updated);
      }
    },
    [executionState, onExecutionStateChange]
  );

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    const content = getPreviousTemplateResult(executionState);

    // Guard against missing or empty template output
    if (!content || !content.trim()) {
      toast.error(
        "No template output is available to copy yet. Complete the previous step first."
      );
      return;
    }

    await navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");

    // Mark copy step as complete
    const completed = completeCurrentStep(executionState, content);
    onExecutionStateChange(completed);
  }, [executionState, onExecutionStateChange]);

  // Advance to next step
  const handleNext = useCallback(() => {
    const advanced = advanceWorkflowState(executionState);
    onExecutionStateChange(advanced);
  }, [executionState, onExecutionStateChange]);

  // Close and reset
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isComplete ? (
              <>
                <Check className="h-5 w-5 text-green-600" />
                Workflow Complete
              </>
            ) : (
              executionState.workflow.name
            )}
          </DialogTitle>
          <DialogDescription>
            {isComplete
              ? "All steps have been completed successfully."
              : `Step ${executionState.currentStepIndex + 1} of ${executionState.stepStates.length}`}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {progress}% complete
          </p>
        </div>

        <Separator />

        {/* Step list (sidebar-style) */}
        <div className="flex-1 overflow-hidden grid grid-cols-[200px_1fr] gap-4">
          {/* Step list */}
          <ScrollArea className="h-full border-r pr-4">
            <div className="space-y-1">
              {executionState.stepStates.map((stepState, index) => (
                <div
                  key={stepState.step.id}
                  className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                    index === executionState.currentStepIndex
                      ? "bg-primary/10 font-medium"
                      : stepState.status === "completed"
                        ? "text-muted-foreground"
                        : ""
                  }`}
                >
                  <StepIcon step={stepState.step} status={stepState.status} />
                  <span className="truncate">{getStepLabel(stepState.step)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Current step content */}
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-2">
              {isComplete ? (
                <div className="text-center py-8 space-y-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">All done!</p>
                    <p className="text-sm text-muted-foreground">
                      The workflow has been completed successfully.
                    </p>
                  </div>
                </div>
              ) : currentStep ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StepIcon step={currentStep} status={currentStepState.status} />
                      <h3 className="font-medium">{getStepLabel(currentStep)}</h3>
                    </div>
                    <StepStatusBadge status={currentStepState.status} />
                  </div>

                  {/* Step-specific content */}
                  {isTemplateStep(currentStep) && (
                    <TemplateStepContent 
                      key={currentStep.id} 
                      result={currentStepState.result} 
                    />
                  )}
                  {isNoteStep(currentStep) && (
                    <NoteStepContent 
                      key={currentStep.id}
                      step={currentStep} 
                      result={currentStepState.result} 
                    />
                  )}
                  {isAlertStep(currentStep) && (
                    <AlertStepContent 
                      key={currentStep.id}
                      step={currentStep} 
                    />
                  )}
                  {isChecklistStep(currentStep) && (
                    <ChecklistStepContent
                      key={currentStep.id}
                      step={currentStep}
                      checked={!!currentStepState.checked}
                      onCheckChange={handleChecklistChange}
                    />
                  )}
                  {isCopyStep(currentStep) && (
                    <CopyStepContent
                      key={currentStep.id}
                      step={currentStep}
                      result={getPreviousTemplateResult(executionState)}
                      onCopy={handleCopy}
                    />
                  )}
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {isComplete ? "Close" : "Cancel"}
          </Button>
          {!isComplete && (
            <Button
              onClick={handleNext}
              disabled={!canProceed || isProcessing}
            >
              {isProcessing ? (
                "Processing..."
              ) : executionState.currentStepIndex ===
                executionState.stepStates.length - 1 ? (
                <>
                  Finish
                  <Check className="ml-2 h-4 w-4" />
                </>
              ) : (
                <>
                  Next Step
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
