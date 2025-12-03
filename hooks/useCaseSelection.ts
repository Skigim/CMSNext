import { useCallback, useMemo, useState } from "react";

export interface UseCaseSelectionReturn {
  /** Set of currently selected case IDs */
  selectedIds: Set<string>;
  /** Number of selected cases */
  selectedCount: number;
  /** Whether all visible cases are selected */
  isAllSelected: boolean;
  /** Whether some but not all visible cases are selected */
  isPartiallySelected: boolean;
  /** Toggle selection for a single case */
  toggleSelection: (caseId: string) => void;
  /** Select all provided case IDs */
  selectAll: (caseIds: string[]) => void;
  /** Deselect all provided case IDs (or all if none specified) */
  deselectAll: (caseIds?: string[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Check if a specific case is selected */
  isSelected: (caseId: string) => boolean;
}

/**
 * Hook for managing case list multi-selection state.
 * 
 * @param visibleCaseIds - Array of case IDs currently visible in the list (after filtering)
 * @returns Selection state and handlers
 */
export function useCaseSelection(visibleCaseIds: string[]): UseCaseSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const visibleSet = useMemo(() => new Set(visibleCaseIds), [visibleCaseIds]);

  // Count only visible selected items
  const selectedCount = useMemo(() => {
    let count = 0;
    selectedIds.forEach(id => {
      if (visibleSet.has(id)) count++;
    });
    return count;
  }, [selectedIds, visibleSet]);

  const isAllSelected = useMemo(
    () => visibleCaseIds.length > 0 && selectedCount === visibleCaseIds.length,
    [visibleCaseIds.length, selectedCount]
  );

  const isPartiallySelected = useMemo(
    () => selectedCount > 0 && selectedCount < visibleCaseIds.length,
    [selectedCount, visibleCaseIds.length]
  );

  const toggleSelection = useCallback((caseId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((caseIds: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      caseIds.forEach(id => next.add(id));
      return next;
    });
  }, []);

  const deselectAll = useCallback((caseIds?: string[]) => {
    if (!caseIds) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      caseIds.forEach(id => next.delete(id));
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (caseId: string) => selectedIds.has(caseId),
    [selectedIds]
  );

  return {
    selectedIds,
    selectedCount,
    isAllSelected,
    isPartiallySelected,
    toggleSelection,
    selectAll,
    deselectAll,
    clearSelection,
    isSelected,
  };
}
