/**
 * @fileoverview Position Assignments Import Hook
 *
 * Orchestrates the flow for importing an N-FOCUS position assignments CSV:
 * File picker → Parse → Compare against stored cases → Preview → Bulk flag for archival
 *
 * Combines patterns from `useAlertsCsvImport` (file picker via hidden input)
 * and `useAVSImportFlow` (preview + selection state machine).
 *
 * @module hooks/usePositionAssignmentsImport
 */

import { useCallback, useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { toast } from "sonner";
import { useDataManagerSafe } from "@/contexts/DataManagerContext";
import type { StoredCase } from "@/types/case";
import {
  parsePositionAssignments,
  compareAssignments,
  type AssignmentsSummary,
  type PositionParseResult,
} from "@/domain/positions";
import { createLogger } from "@/utils/logger";
import { extractErrorMessage } from "@/utils/errorUtils";

const logger = createLogger("usePositionAssignmentsImport");

// ============================================================================
// Types
// ============================================================================

/**
 * State for the position assignments import flow.
 */
export interface PositionAssignmentsImportState {
  /** Current phase of the import flow */
  phase: "idle" | "parsing" | "preview" | "applying";
  /** Whether the preview modal is open */
  isOpen: boolean;
  /** Cases not found on the assignment list */
  unmatchedCases: StoredCase[];
  /** Summary statistics from the comparison */
  summary: AssignmentsSummary | null;
  /** Parse result statistics */
  parseResult: PositionParseResult | null;
  /** IDs of cases selected for archival flagging */
  selectedCaseIds: Set<string>;
  /** The source filename for display */
  sourceFileName: string | null;
  /** Status filter — only cases with these statuses are shown */
  statusFilter: Set<string>;
}

interface UsePositionAssignmentsImportParams {
  /** All stored cases for comparison */
  cases: StoredCase[];
  /** Called after successful flagging to refresh case data */
  onCasesUpdated?: () => void;
}

interface UsePositionAssignmentsImportReturn {
  /** Current import state */
  importState: PositionAssignmentsImportState;
  /** Ref for the hidden file input element */
  fileInputRef: RefObject<HTMLInputElement>;
  /** Trigger the file picker dialog */
  handleButtonClick: () => void;
  /** Handle file selection from the input element */
  handleFileSelected: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  /** Close the preview modal and reset state */
  closePreview: () => void;
  /** Confirm and apply archival flags to selected cases */
  confirmFlagForArchival: () => Promise<void>;
  /** Toggle selection of a single case */
  toggleCaseSelection: (caseId: string) => void;
  /** Toggle all visible cases selection (respects status filter) */
  toggleAllCases: () => void;
  /** Toggle a status in the status filter */
  toggleStatusFilter: (status: string) => void;
  /** Unique statuses present in unmatched cases */
  availableStatuses: string[];
  /** Unmatched cases after applying status filter */
  filteredUnmatchedCases: StoredCase[];
  /** Whether the confirm action is possible */
  canConfirm: boolean;
}

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_STATE: PositionAssignmentsImportState = {
  phase: "idle",
  isOpen: false,
  unmatchedCases: [],
  summary: null,
  parseResult: null,
  selectedCaseIds: new Set(),
  sourceFileName: null,
  statusFilter: new Set(),
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing position assignments import and archival flagging flow.
 *
 * @example
 * ```typescript
 * const {
 *   importState,
 *   fileInputRef,
 *   handleButtonClick,
 *   handleFileSelected,
 *   closePreview,
 *   confirmFlagForArchival,
 *   toggleCaseSelection,
 *   toggleAllCases,
 *   canConfirm,
 * } = usePositionAssignmentsImport({ cases, onCasesUpdated: refreshCases });
 *
 * // Render hidden file input
 * <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelected} hidden />
 *
 * // Render trigger button
 * <Button onClick={handleButtonClick}>Import Position Assignments</Button>
 *
 * // Render review modal
 * <PositionAssignmentsReviewModal
 *   importState={importState}
 *   onClose={closePreview}
 *   onConfirm={confirmFlagForArchival}
 *   onToggleCase={toggleCaseSelection}
 *   onToggleAll={toggleAllCases}
 *   canConfirm={canConfirm}
 * />
 * ```
 */
export function usePositionAssignmentsImport({
  cases,
  onCasesUpdated,
}: UsePositionAssignmentsImportParams): UsePositionAssignmentsImportReturn {
  const dataManager = useDataManagerSafe();
  const [importState, setImportState] = useState<PositionAssignmentsImportState>(INITIAL_STATE);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- File picker trigger ----
  const handleButtonClick = useCallback(() => {
    if (!dataManager) {
      toast.error("Connect a storage folder before importing.");
      return;
    }
    fileInputRef.current?.click();
  }, [dataManager]);

  // ---- File selected: parse + compare ----
  const handleFileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const file = input.files?.[0];

      if (!file) return;

      if (!dataManager) {
        toast.error("Data manager is not available. Connect storage and try again.");
        input.value = "";
        return;
      }

      setImportState(prev => ({
        ...prev,
        phase: "parsing",
        sourceFileName: file.name,
      }));

      try {
        const csvText = await file.text();

        if (!csvText.trim()) {
          toast.info("Empty file", {
            description: `${file.name} contains no data.`,
          });
          setImportState(INITIAL_STATE);
          return;
        }

        // Parse the position assignments file
        const parseResult = parsePositionAssignments(csvText);

        if (parseResult.entries.length === 0) {
          toast.error("No valid entries found", {
            description: `${file.name} didn't contain any recognizable position assignments. Check the file format.`,
          });
          setImportState(INITIAL_STATE);
          return;
        }

        // Compare against stored cases
        const { unmatchedCases, summary } = compareAssignments(cases, parseResult.entries);

        if (unmatchedCases.length === 0) {
          toast.success("All cases accounted for", {
            description: `All ${summary.matched} active cases were found on the assignment list. No archival flagging needed.`,
          });
          setImportState(INITIAL_STATE);
          return;
        }

        // Open preview with all unmatched cases pre-selected
        const selectedIds = new Set(unmatchedCases.map(c => c.id));
        const uniqueStatuses = new Set(unmatchedCases.map(c => c.status));

        setImportState({
          phase: "preview",
          isOpen: true,
          unmatchedCases,
          summary,
          parseResult,
          selectedCaseIds: selectedIds,
          sourceFileName: file.name,
          statusFilter: uniqueStatuses,
        });
      } catch (error) {
        logger.error("Failed to parse position assignments", {
          error: extractErrorMessage(error),
        });
        toast.error("Failed to parse file", {
          description: error instanceof Error ? error.message : "Please verify the file format and try again.",
        });
        setImportState(INITIAL_STATE);
      } finally {
        input.value = "";
      }
    },
    [dataManager, cases]
  );

  // ---- Close preview ----
  const closePreview = useCallback(() => {
    setImportState(INITIAL_STATE);
  }, []);

  // ---- Toggle individual case selection ----
  const toggleCaseSelection = useCallback((caseId: string) => {
    setImportState(prev => {
      const next = new Set(prev.selectedCaseIds);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return { ...prev, selectedCaseIds: next };
    });
  }, []);

  // ---- Toggle status filter ----
  const toggleStatusFilter = useCallback((status: string) => {
    setImportState(prev => {
      const nextFilter = new Set(prev.statusFilter);
      if (nextFilter.has(status)) {
        // Don't allow deselecting the last filter
        if (nextFilter.size > 1) nextFilter.delete(status);
        else return prev;
      } else {
        nextFilter.add(status);
      }
      // Recompute selection to only include cases visible under new filter
      const nextSelected = new Set<string>();
      for (const c of prev.unmatchedCases) {
        if (nextFilter.has(c.status) && prev.selectedCaseIds.has(c.id)) {
          nextSelected.add(c.id);
        }
      }
      return { ...prev, statusFilter: nextFilter, selectedCaseIds: nextSelected };
    });
  }, []);

  // ---- Toggle all visible cases (respects status filter) ----
  const toggleAllCases = useCallback(() => {
    setImportState(prev => {
      const visibleCases = prev.unmatchedCases.filter(c => prev.statusFilter.has(c.status));
      const allVisibleSelected = visibleCases.length > 0 && visibleCases.every(c => prev.selectedCaseIds.has(c.id));
      const next = new Set(prev.selectedCaseIds);
      if (allVisibleSelected) {
        for (const c of visibleCases) next.delete(c.id);
      } else {
        for (const c of visibleCases) next.add(c.id);
      }
      return { ...prev, selectedCaseIds: next };
    });
  }, []);

  // ---- Confirm: flag selected cases for archival ----
  const confirmFlagForArchival = useCallback(async () => {
    if (!dataManager || importState.selectedCaseIds.size === 0) return;

    setImportState(prev => ({ ...prev, phase: "applying" }));

    try {
      const caseIds = Array.from(importState.selectedCaseIds);
      const result = await dataManager.markCasesForArchivalByIds(caseIds);

      onCasesUpdated?.();

      toast.success("Cases flagged for archival", {
        description: `${result.markedCount} case${result.markedCount === 1 ? "" : "s"} moved to the archival review queue.`,
      });

      setImportState(INITIAL_STATE);
    } catch (error) {
      logger.error("Failed to flag cases for archival", {
        error: extractErrorMessage(error),
      });
      toast.error("Failed to flag cases", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
      setImportState(prev => ({ ...prev, phase: "preview" }));
    }
  }, [dataManager, importState.selectedCaseIds, onCasesUpdated]);

  // ---- Derived state ----
  const availableStatuses = useMemo(() => {
    const statuses = new Set(importState.unmatchedCases.map(c => c.status));
    return Array.from(statuses).sort();
  }, [importState.unmatchedCases]);

  const filteredUnmatchedCases = useMemo(
    () => importState.unmatchedCases.filter(c => importState.statusFilter.has(c.status)),
    [importState.unmatchedCases, importState.statusFilter]
  );

  const canConfirm =
    importState.phase === "preview" && importState.selectedCaseIds.size > 0;

  return {
    importState,
    fileInputRef,
    handleButtonClick,
    handleFileSelected,
    closePreview,
    confirmFlagForArchival,
    toggleCaseSelection,
    toggleAllCases,
    toggleStatusFilter,
    availableStatuses,
    filteredUnmatchedCases,
    canConfirm,
  };
}
