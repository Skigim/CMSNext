/**
 * @fileoverview Position Assignments Review Modal
 *
 * Dialog modal for reviewing the results of an N-FOCUS position assignments
 * XML import. Presents two actionable sections:
 *
 * 1. **Status Updates** — cases found on the list whose stored status differs
 *    from the status in the XML export. Users can select which to update.
 * 2. **Archival Candidates** — cases NOT found on the list. Users can select
 *    which to flag for archival review.
 *
 * Follows the same pattern as AVSImportModal:
 * - shadcn Dialog with controlled open state
 * - Scrollable list with checkboxes
 * - Summary stats header
 * - Confirm/Cancel footer
 *
 * @module components/modals/PositionAssignmentsReviewModal
 */

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import {
  Loader2,
  Archive,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import type { PositionAssignmentsImportState } from "../../hooks/usePositionAssignmentsImport";
import type { CaseStatusUpdate } from "../../domain/positions";
import type { StoredCase } from "../../types/case";
import { cn } from "../../lib/utils";

// ============================================================================
// Types
// ============================================================================

interface PositionAssignmentsReviewModalProps {
  /** Current import state from the hook */
  importState: PositionAssignmentsImportState;
  /** Close the modal */
  onClose: () => void;
  /** Confirm applying all selected changes */
  onConfirm: () => Promise<void>;
  /** Toggle a single archival candidate */
  onToggleCase: (caseId: string) => void;
  /** Toggle all visible archival candidates */
  onToggleAll: () => void;
  /** Toggle a status in the archival status filter */
  onToggleStatus: (status: string) => void;
  /** Toggle a single status-update candidate */
  onToggleStatusUpdate: (caseId: string) => void;
  /** Toggle all status-update candidates */
  onToggleAllStatusUpdates: () => void;
  /** Whether the confirm action is possible */
  canConfirm: boolean;
  /** Unique statuses available for filtering the archival section */
  availableStatuses: string[];
  /** Unmatched cases after status filter applied */
  filteredUnmatchedCases: StoredCase[];
}

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Summary statistics bar shown at the top of the modal.
 */
function ImportSummary({
  importState,
}: {
  importState: PositionAssignmentsImportState;
}) {
  const { summary, parseResult } = importState;
  if (!summary || !parseResult) return null;

  const hasStatusUpdates = summary.statusUpdateCandidates > 0;

  return (
    <div className={cn(
      "grid gap-3 text-center",
      hasStatusUpdates ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"
    )}>
      <div className="rounded-md bg-muted p-2">
        <p className="text-lg font-bold">{summary.totalParsed}</p>
        <p className="text-xs text-muted-foreground">On Export</p>
      </div>
      <div className="rounded-md bg-muted p-2">
        <p className="text-lg font-bold text-green-600 dark:text-green-400">
          {summary.matched}
        </p>
        <p className="text-xs text-muted-foreground">Matched</p>
      </div>
      {hasStatusUpdates && (
        <div className="rounded-md bg-muted p-2">
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {summary.statusUpdateCandidates}
          </p>
          <p className="text-xs text-muted-foreground">Status Updates</p>
        </div>
      )}
      <div className="rounded-md bg-muted p-2">
        <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
          {summary.unmatched}
        </p>
        <p className="text-xs text-muted-foreground">Not on List</p>
      </div>
      <div className="rounded-md bg-muted p-2">
        <p className="text-lg font-bold text-muted-foreground">
          {summary.alreadyFlagged}
        </p>
        <p className="text-xs text-muted-foreground">Already Flagged</p>
      </div>
    </div>
  );
}

/**
 * A single status-update candidate row.
 */
function StatusUpdateRow({
  update,
  isSelected,
  onToggle,
  disabled,
}: {
  update: CaseStatusUpdate;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 transition-opacity",
        !isSelected && "opacity-50"
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        disabled={disabled}
        aria-label={`Select status update for case ${update.case.mcn}`}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{update.case.name}</p>
        <p className="text-xs text-muted-foreground">
          MCN: {update.case.mcn || update.case.caseRecord?.mcn || "—"}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge variant="outline">{update.currentStatus}</Badge>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <Badge variant="secondary" className="text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
          {update.importedStatus}
        </Badge>
      </div>
    </div>
  );
}

/**
 * Preview card for a single unmatched (archival candidate) case.
 */
function CasePreviewRow({
  caseItem,
  isSelected,
  onToggle,
  disabled,
}: {
  caseItem: StoredCase;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 transition-opacity",
        !isSelected && "opacity-50"
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        disabled={disabled}
        aria-label={`Select case ${caseItem.mcn}`}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{caseItem.name}</p>
        <p className="text-xs text-muted-foreground">
          MCN: {caseItem.mcn || caseItem.caseRecord?.mcn || "—"}
        </p>
      </div>
      <Badge variant="outline" className="shrink-0">
        {caseItem.status}
      </Badge>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Modal for reviewing and confirming position assignments import actions:
 * status updates for matched cases and archival flagging for unmatched cases.
 */
export function PositionAssignmentsReviewModal({
  importState,
  onClose,
  onConfirm,
  onToggleCase,
  onToggleAll,
  onToggleStatus,
  onToggleStatusUpdate,
  onToggleAllStatusUpdates,
  canConfirm,
  availableStatuses,
  filteredUnmatchedCases,
}: PositionAssignmentsReviewModalProps) {
  const { isOpen, selectedCaseIds, selectedStatusUpdateIds, matchedWithStatusChange, phase, sourceFileName } =
    importState;

  const isApplying = phase === "applying";

  // Archival section derived state
  const allVisibleSelected = useMemo(
    () =>
      filteredUnmatchedCases.length > 0 &&
      filteredUnmatchedCases.every(c => selectedCaseIds.has(c.id)),
    [filteredUnmatchedCases, selectedCaseIds]
  );

  const someVisibleSelected = useMemo(() => {
    const visibleSelectedCount = filteredUnmatchedCases.filter(c => selectedCaseIds.has(c.id)).length;
    return visibleSelectedCount > 0 && visibleSelectedCount < filteredUnmatchedCases.length;
  }, [filteredUnmatchedCases, selectedCaseIds]);

  const visibleSelectedCount = useMemo(
    () => filteredUnmatchedCases.filter(c => selectedCaseIds.has(c.id)).length,
    [filteredUnmatchedCases, selectedCaseIds]
  );

  // Status updates section derived state
  const allStatusUpdatesSelected = useMemo(
    () =>
      matchedWithStatusChange.length > 0 &&
      matchedWithStatusChange.every(u => selectedStatusUpdateIds.has(u.case.id)),
    [matchedWithStatusChange, selectedStatusUpdateIds]
  );

  const someStatusUpdatesSelected = useMemo(() => {
    const count = matchedWithStatusChange.filter(u => selectedStatusUpdateIds.has(u.case.id)).length;
    return count > 0 && count < matchedWithStatusChange.length;
  }, [matchedWithStatusChange, selectedStatusUpdateIds]);

  // Confirm button label
  const confirmLabel = useMemo(() => {
    const updateCount = selectedStatusUpdateIds.size;
    const archivalCount = selectedCaseIds.size;
    if (updateCount > 0 && archivalCount > 0) {
      return `Update ${updateCount} Status${updateCount === 1 ? "" : "es"} & Flag ${archivalCount} for Archival`;
    }
    if (updateCount > 0) {
      return `Update ${updateCount} Status${updateCount === 1 ? "" : "es"}`;
    }
    return `Flag ${archivalCount} Case${archivalCount === 1 ? "" : "s"} for Archival`;
  }, [selectedStatusUpdateIds, selectedCaseIds]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isApplying) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Position Assignments Review
          </DialogTitle>
          <DialogDescription>
            {sourceFileName && (
              <span className="flex items-center gap-1.5 mb-1">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {sourceFileName}
              </span>
            )}
            Review status updates for matched cases and select unmatched cases to flag for archival.
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <ImportSummary importState={importState} />

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">

          {/* ---- Status Updates Section ---- */}
          {matchedWithStatusChange.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Status Updates ({matchedWithStatusChange.length})
                </h3>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={someStatusUpdatesSelected ? "indeterminate" : allStatusUpdatesSelected}
                    onCheckedChange={onToggleAllStatusUpdates}
                    disabled={isApplying}
                    aria-label="Select all status updates"
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedStatusUpdateIds.size} of {matchedWithStatusChange.length} selected
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {matchedWithStatusChange.map((update) => (
                  <StatusUpdateRow
                    key={update.case.id}
                    update={update}
                    isSelected={selectedStatusUpdateIds.has(update.case.id)}
                    onToggle={() => onToggleStatusUpdate(update.case.id)}
                    disabled={isApplying}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ---- Archival Candidates Section ---- */}
          {importState.unmatchedCases.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Not on List — Archival Candidates ({importState.unmatchedCases.length})
              </h3>

              {/* Status Filter */}
              {availableStatuses.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium shrink-0">Status:</span>
                  {availableStatuses.map(status => {
                    const count = importState.unmatchedCases.filter(c => c.status === status).length;
                    const isActive = importState.statusFilter.has(status);
                    return (
                      <Badge
                        key={status}
                        variant={isActive ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer select-none transition-opacity",
                          !isActive && "opacity-50"
                        )}
                        onClick={() => onToggleStatus(status)}
                      >
                        {status} ({count})
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Select All */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={someVisibleSelected ? "indeterminate" : allVisibleSelected}
                    onCheckedChange={onToggleAll}
                    disabled={isApplying}
                    aria-label="Select all visible cases"
                  />
                  <span className="text-sm text-muted-foreground">
                    {visibleSelectedCount} of {filteredUnmatchedCases.length} selected
                    {filteredUnmatchedCases.length < importState.unmatchedCases.length && (
                      <span className="text-xs ml-1">({importState.unmatchedCases.length} total)</span>
                    )}
                  </span>
                </div>
                {importState.summary && importState.summary.archivedExcluded > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {importState.summary.archivedExcluded} archived excluded
                  </span>
                )}
              </div>

              {/* Case List */}
              <div className="space-y-2">
                {filteredUnmatchedCases.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                    <p className="text-sm font-medium">All cases accounted for</p>
                    <p className="text-xs text-muted-foreground">
                      Every active case was found on the assignment list.
                    </p>
                  </div>
                ) : (
                  filteredUnmatchedCases.map((caseItem) => (
                    <CasePreviewRow
                      key={caseItem.id}
                      caseItem={caseItem}
                      isSelected={selectedCaseIds.has(caseItem.id)}
                      onToggle={() => onToggleCase(caseItem.id)}
                      disabled={isApplying}
                    />
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* Info banners */}
        <div className="space-y-2">
          {matchedWithStatusChange.length > 0 && (
            <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-800 dark:text-blue-200">
              <RefreshCw className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Selected cases will have their status updated to match the imported value. New statuses will be added to your status configuration automatically.
              </span>
            </div>
          )}
          {importState.unmatchedCases.length > 0 && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Flagged cases will appear in the <strong>Archival Review</strong>{" "}
                queue where you can approve or cancel archival individually.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isApplying}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!canConfirm || isApplying}
          >
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
