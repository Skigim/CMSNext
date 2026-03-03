/**
 * @fileoverview Position Assignments Import Hook
 *
 * Orchestrates the flow for importing an N-FOCUS position assignments XML export:
 * File picker → Parse → Compare against stored cases → Preview → Apply changes
 *
 * On import, two actions can be taken:
 * 1. Cases on the assignment list whose status differs from the XML → status updated
 * 2. Cases NOT on the assignment list → flagged for archival review
 *
 * @module hooks/usePositionAssignmentsImport
 */

import { useCallback, useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { toast } from "sonner";
import { useDataManagerSafe } from "@/contexts/DataManagerContext";
import type { CaseStatus, StoredCase } from "@/types/case";
import type { CategoryConfig, StatusConfig } from "@/types/categoryConfig";
import { autoAssignColorSlot, type ColorSlot } from "@/types/colorSlots";
import {
  parsePositionAssignments,
  compareAssignments,
  type AssignmentsSummary,
  type CaseStatusUpdate,
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
  /** Matched cases whose status in the XML differs from their current status */
  matchedWithStatusChange: CaseStatusUpdate[];
  /** Summary statistics from the comparison */
  summary: AssignmentsSummary | null;
  /** Parse result statistics */
  parseResult: PositionParseResult | null;
  /** IDs of cases selected for archival flagging */
  selectedCaseIds: Set<string>;
  /** IDs of matched cases selected for status updates */
  selectedStatusUpdateIds: Set<string>;
  /** The source filename for display */
  sourceFileName: string | null;
  /** Status filter — only cases with these statuses are shown in the archival section */
  statusFilter: Set<string>;
}

interface UsePositionAssignmentsImportParams {
  /** All stored cases for comparison */
  cases: StoredCase[];
  /** Current category config — used to check/add statuses on import */
  categoryConfig: CategoryConfig;
  /** Called after successful changes to refresh case data */
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
  /** Confirm and apply status updates and/or archival flags */
  confirmFlagForArchival: () => Promise<void>;
  /** Toggle selection of a single archival candidate */
  toggleCaseSelection: (caseId: string) => void;
  /** Toggle all visible archival candidates (respects status filter) */
  toggleAllCases: () => void;
  /** Toggle a status in the archival section status filter */
  toggleStatusFilter: (status: string) => void;
  /** Toggle selection of a single status-update candidate */
  toggleStatusUpdateSelection: (caseId: string) => void;
  /** Toggle all status-update candidates */
  toggleAllStatusUpdates: () => void;
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
  matchedWithStatusChange: [],
  summary: null,
  parseResult: null,
  selectedCaseIds: new Set(),
  selectedStatusUpdateIds: new Set(),
  sourceFileName: null,
  statusFilter: new Set(),
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing position assignments import.
 *
 * Handles two complementary actions from one XML import:
 * - Status updates: matched cases whose XML status differs from their stored status
 * - Archival flagging: unmatched cases (not on the assignment list)
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
 *   toggleStatusUpdateSelection,
 *   toggleAllStatusUpdates,
 *   canConfirm,
 * } = usePositionAssignmentsImport({ cases, categoryConfig, onCasesUpdated: refreshCases });
 * ```
 */
export function usePositionAssignmentsImport({
  cases,
  categoryConfig,
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
        const xmlText = await file.text();

        if (!xmlText.trim()) {
          toast.info("Empty file", {
            description: `${file.name} contains no data.`,
          });
          setImportState(INITIAL_STATE);
          return;
        }

        // Parse the position assignments file
        const parseResult = parsePositionAssignments(xmlText);

        if (parseResult.entries.length === 0) {
          toast.error("No valid entries found", {
            description: `${file.name} didn't contain any recognizable position assignments. Check the file format.`,
          });
          setImportState(INITIAL_STATE);
          return;
        }

        // Compare against stored cases
        const { unmatchedCases, matchedWithStatusChange, summary } = compareAssignments(
          cases,
          parseResult.entries
        );

        if (unmatchedCases.length === 0 && matchedWithStatusChange.length === 0) {
          toast.success("All cases accounted for", {
            description: `All ${summary.matched} active cases were found on the assignment list with matching statuses. No changes needed.`,
          });
          setImportState(INITIAL_STATE);
          return;
        }

        // Open preview with all candidates pre-selected
        const selectedIds = new Set(unmatchedCases.map(c => c.id));
        const selectedStatusUpdateIds = new Set(matchedWithStatusChange.map(u => u.case.id));
        const uniqueStatuses = new Set(unmatchedCases.map(c => c.status));

        setImportState({
          phase: "preview",
          isOpen: true,
          unmatchedCases,
          matchedWithStatusChange,
          summary,
          parseResult,
          selectedCaseIds: selectedIds,
          selectedStatusUpdateIds,
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

  // ---- Toggle individual archival case selection ----
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

  // ---- Toggle status filter (archival section) ----
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

  // ---- Toggle all visible archival cases (respects status filter) ----
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

  // ---- Toggle individual status-update selection ----
  const toggleStatusUpdateSelection = useCallback((caseId: string) => {
    setImportState(prev => {
      const next = new Set(prev.selectedStatusUpdateIds);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return { ...prev, selectedStatusUpdateIds: next };
    });
  }, []);

  // ---- Toggle all status-update candidates ----
  const toggleAllStatusUpdates = useCallback(() => {
    setImportState(prev => {
      const allSelected =
        prev.matchedWithStatusChange.length > 0 &&
        prev.matchedWithStatusChange.every(u => prev.selectedStatusUpdateIds.has(u.case.id));
      const next = allSelected
        ? new Set<string>()
        : new Set(prev.matchedWithStatusChange.map(u => u.case.id));
      return { ...prev, selectedStatusUpdateIds: next };
    });
  }, []);

  // ---- Confirm: apply status updates and/or flag for archival ----
  const confirmFlagForArchival = useCallback(async () => {
    if (
      !dataManager ||
      (importState.selectedCaseIds.size === 0 && importState.selectedStatusUpdateIds.size === 0)
    ) {
      return;
    }

    setImportState(prev => ({ ...prev, phase: "applying" }));

    try {
      let statusUpdatedCount = 0;
      let archivalMarkedCount = 0;

      // ---- 1. Apply status updates ----
      const selectedUpdates = importState.matchedWithStatusChange.filter(u =>
        importState.selectedStatusUpdateIds.has(u.case.id)
      );

      if (selectedUpdates.length > 0) {
        // Ensure every imported status exists in categoryConfig.caseStatuses
        const existingNames = new Set(
          categoryConfig.caseStatuses.map(s => s.name.toLowerCase())
        );
        const usedSlots = new Set<ColorSlot>(categoryConfig.caseStatuses.map(s => s.colorSlot));
        const newStatuses: StatusConfig[] = [];

        for (const update of selectedUpdates) {
          if (!existingNames.has(update.importedStatus.toLowerCase())) {
            existingNames.add(update.importedStatus.toLowerCase());
            const colorSlot = autoAssignColorSlot(update.importedStatus, usedSlots);
            usedSlots.add(colorSlot);
            newStatuses.push({ name: update.importedStatus, colorSlot });
          }
        }

        if (newStatuses.length > 0) {
          await dataManager.updateCaseStatuses([
            ...categoryConfig.caseStatuses,
            ...newStatuses,
          ]);
        }

        // Group by imported status and bulk-update each group
        const statusGroups = new Map<string, string[]>();
        for (const update of selectedUpdates) {
          const ids = statusGroups.get(update.importedStatus) ?? [];
          ids.push(update.case.id);
          statusGroups.set(update.importedStatus, ids);
        }

        for (const [status, caseIds] of statusGroups) {
          await dataManager.updateCasesStatus(caseIds, status as CaseStatus);
        }

        statusUpdatedCount = selectedUpdates.length;
      }

      // ---- 2. Flag unmatched cases for archival ----
      if (importState.selectedCaseIds.size > 0) {
        const archivalResult = await dataManager.markCasesForArchivalByIds(
          Array.from(importState.selectedCaseIds)
        );
        archivalMarkedCount = archivalResult.markedCount;
      }

      onCasesUpdated?.();

      // Build a combined toast message
      const parts: string[] = [];
      if (statusUpdatedCount > 0) {
        parts.push(
          `${statusUpdatedCount} case${statusUpdatedCount === 1 ? "" : "s"} updated to imported status`
        );
      }
      if (archivalMarkedCount > 0) {
        parts.push(
          `${archivalMarkedCount} case${archivalMarkedCount === 1 ? "" : "s"} flagged for archival review`
        );
      }

      toast.success("Import applied", {
        description: parts.join("; ") + ".",
      });

      setImportState(INITIAL_STATE);
    } catch (error) {
      logger.error("Failed to apply position assignments import", {
        error: extractErrorMessage(error),
      });
      toast.error("Failed to apply changes", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
      setImportState(prev => ({ ...prev, phase: "preview" }));
    }
  }, [
    dataManager,
    categoryConfig,
    importState.selectedCaseIds,
    importState.selectedStatusUpdateIds,
    importState.matchedWithStatusChange,
    onCasesUpdated,
  ]);

  // ---- Derived state ----
  const availableStatuses = useMemo(() => {
    const statuses = new Set(importState.unmatchedCases.map(c => c.status));
    return Array.from(statuses).sort((a, b) => a.localeCompare(b));
  }, [importState.unmatchedCases]);

  const filteredUnmatchedCases = useMemo(
    () => importState.unmatchedCases.filter(c => importState.statusFilter.has(c.status)),
    [importState.unmatchedCases, importState.statusFilter]
  );

  const canConfirm =
    importState.phase === "preview" &&
    (importState.selectedCaseIds.size > 0 || importState.selectedStatusUpdateIds.size > 0);

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
    toggleStatusUpdateSelection,
    toggleAllStatusUpdates,
    availableStatuses,
    filteredUnmatchedCases,
    canConfirm,
  };
}
