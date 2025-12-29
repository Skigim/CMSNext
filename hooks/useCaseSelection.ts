import { useCallback, useMemo, useState } from "react";

/**
 * Return type for useCaseSelection hook.
 * @interface UseCaseSelectionReturn
 */
export interface UseCaseSelectionReturn {
  /** Set of currently selected case IDs */
  selectedIds: Set<string>;
  /** Number of selected cases (counts only visible items) */
  selectedCount: number;
  /** Whether all visible cases are selected */
  isAllSelected: boolean;
  /** Whether some but not all visible cases are selected (indeterminate state) */
  isPartiallySelected: boolean;
  /** Toggle selection for a single case */
  toggleSelection: (caseId: string) => void;
  /** Select all provided case IDs */
  selectAll: (caseIds: string[]) => void;
  /** Deselect provided case IDs (or all if none specified) */
  deselectAll: (caseIds?: string[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Check if a specific case is selected */
  isSelected: (caseId: string) => boolean;
}

/**
 * Multi-selection state management for case lists.
 * 
 * Manages checkbox selection state for case list tables/grids.
 * Automatically handles visible-count selection tracking (respects filters).
 * 
 * ## Selection Types
 * 
 * - **Single**: Click checkbox to toggle one case
 * - **All Visible**: Click table header checkbox to select/deselect all visible
 * - **Partial**: Some visible items selected (indeterminate state for header)
 * 
 * ## Visible-Only Counting
 * 
 * Selection counts only consider visible items:
 * - `selectedCount`: Number of selected items in current view
 * - `isAllSelected`: True if all visible items are selected
 * - `isPartiallySelected`: True if some visible items are selected
 * 
 * Useful when filtering cases - selection respects the filtered list.
 * 
 * ## State Structure
 * 
 * ```typescript
 * const {
 *   selectedIds,       // Set<string> of selected case IDs
 *   selectedCount,     // Number visible items selected
 *   isAllSelected,     // Header checkbox checked state
 *   isPartiallySelected, // Header checkbox indeterminate state
 *   toggleSelection,   // (caseId) => void
 *   selectAll,         // (caseIds) => void
 *   deselectAll,       // (caseIds?) => void
 *   clearSelection,    // () => void
 *   isSelected         // (caseId) => boolean
 * } = useCaseSelection(visibleCaseIds);
 * ```
 * 
 * ## Usage Example
 * 
 * ```typescript
 * function CaseTable() {
 *   const cases = useCases(); // From parent or hook
 *   const filteredCases = cases.filter(c => c.status === 'open');
 *   const visibleIds = filteredCases.map(c => c.id);
 *   
 *   const {
 *     selectedIds,
 *     isAllSelected,
 *     isPartiallySelected,
 *     toggleSelection,
 *     selectAll,
 *     deselectAll
 *   } = useCaseSelection(visibleIds);
 *   
 *   return (
 *     <table>
 *       <thead>
 *         <tr>
 *           <th>
 *             <Checkbox
 *               checked={isAllSelected}
 *               indeterminate={isPartiallySelected}
 *               onChange={(e) => {
 *                 if (e.target.checked) {
 *                   selectAll(visibleIds);
 *                 } else {
 *                   deselectAll(visibleIds);
 *                 }
 *               }}
 *             />
 *           </th>
 *           <th>Name</th>
 *         </tr>
 *       </thead>
 *       <tbody>
 *         {filteredCases.map(caseItem => (
 *           <tr key={caseItem.id}>
 *             <td>
 *               <Checkbox
 *                 checked={selectedIds.has(caseItem.id)}
 *                 onChange={() => toggleSelection(caseItem.id)}
 *               />
 *             </td>
 *             <td>{caseItem.name}</td>
 *           </tr>
 *         ))}
 *       </tbody>
 *     </table>
 *   );
 * }
 * ```
 * 
 * ## Bulk Operations
 * 
 * After selection, trigger bulk actions:
 * 
 * ```typescript
 * const handleDeleteSelected = async () => {
 *   const ids = Array.from(selectedIds);
 *   await dataManager.deleteCases(ids);
 *   clearSelection();
 *   await refreshCases();
 * };
 * 
 * const handleUpdateStatus = async (newStatus) => {
 *   const ids = Array.from(selectedIds);
 *   await dataManager.updateCasesStatus(ids, newStatus);
 *   clearSelection();
 *   await refreshCases();
 * };
 * ```
 * 
 * @hook
 * @param {string[]} visibleCaseIds - Array of case IDs currently visible (after filtering)
 * @returns {UseCaseSelectionReturn} Selection state and handlers
 * 
 * @see {@link useCaseManagement} for case operations
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
