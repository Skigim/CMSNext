/**
 * WorkflowDropdown
 *
 * A dropdown menu for selecting and running workflows on a case.
 * Filters workflows by application type if configured.
 *
 * @module components/case/WorkflowDropdown
 */

import { useState } from "react";
import { Play, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { WorkflowRunnerModal } from "@/components/modals/WorkflowRunnerModal";
import { useWorkflows } from "@/contexts/WorkflowContext";
import type { StoredCase } from "@/types/case";
import type { Workflow, WorkflowExecutionState } from "@/types/workflow";
import { createExecutionState } from "@/types/workflow";
import { cn, interactiveHoverClasses } from "@/components/ui/utils";

interface WorkflowDropdownProps {
  caseData: StoredCase;
  className?: string;
}

/**
 * Filter workflows based on application type matching.
 * If workflow has applicationTypeFilter, only show if case matches.
 */
function getApplicableWorkflows(
  workflows: Workflow[],
  caseData: StoredCase
): Workflow[] {
  const appType = caseData.caseRecord?.applicationType;

  return workflows.filter((workflow) => {
    if (!workflow.applicationTypeFilter) {
      return true; // No filter = applies to all cases
    }
    return appType?.toLowerCase() === workflow.applicationTypeFilter.toLowerCase();
  });
}

export function WorkflowDropdown({ caseData, className }: WorkflowDropdownProps) {
  const { workflows, loading } = useWorkflows();
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [executionState, setExecutionState] = useState<WorkflowExecutionState | null>(
    null
  );
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  const applicableWorkflows = getApplicableWorkflows(workflows, caseData);

  const handleSelectWorkflow = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setExecutionState(createExecutionState(workflow, caseData.id));
    setRunnerOpen(true);
  };

  const handleCloseRunner = () => {
    setRunnerOpen(false);
    setSelectedWorkflow(null);
    setExecutionState(null);
  };

  // Don't render if no workflows available
  if (loading || applicableWorkflows.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(interactiveHoverClasses, className)}
          >
            <Play className="w-4 h-4 mr-2" />
            Workflows
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {applicableWorkflows.map((workflow, index) => (
            <div key={workflow.id}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={() => handleSelectWorkflow(workflow)}
                className="flex flex-col items-start gap-1 py-2"
              >
                <div className="flex items-center gap-2 w-full">
                  <Play className="w-4 h-4 text-primary" />
                  <span className="font-medium">{workflow.name}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {workflow.steps.length} steps
                  </Badge>
                </div>
                {workflow.description && (
                  <span className="text-xs text-muted-foreground pl-6 line-clamp-2">
                    {workflow.description}
                  </span>
                )}
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Workflow Runner Modal */}
      {selectedWorkflow && executionState && (
        <WorkflowRunnerModal
          isOpen={runnerOpen}
          onClose={handleCloseRunner}
          caseData={caseData}
          executionState={executionState}
          onExecutionStateChange={setExecutionState}
        />
      )}
    </>
  );
}
