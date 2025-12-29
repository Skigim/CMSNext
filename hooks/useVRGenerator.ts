import { useState, useCallback, useMemo, useEffect } from "react";

/**
 * Hook for managing VR (Verification Report) generation workflow
 * 
 * Orchestrates:
 * - VR script selection from category config
 * - Financial item selection with multi-select
 * - VR template rendering from selected items
 * - Generated text preview with copy-to-clipboard
 * 
 * **Workflow:**
 * 1. Select VR script (template type)
 * 2. Select financial items (resources/income/expenses)
 * 3. Preview rendered text in preview area
 * 4. Copy to clipboard or save
 * 
 * **Item Selection:**
 * - Shows all financial items grouped by type
 * - Select/deselect individual items
 * - Bulk select/deselect all
 * - Count of selected items for UI feedback
 * 
 * **Script Selection:**
 * - Choose from vrScripts array (from category config)
 * - Each script has different template/format
 * - Selected script ID tracked separately
 * - Script details provided for preview (name, description)
 * 
 * **VR Generation:**
 * - Uses renderMultipleVRs() utility to generate text
 * - Takes selected script + selected items
 * - Produces formatted verification report text
 * - Updates renderedText state for display
 * 
 * **Copy to Clipboard:**
 * - Uses modern Clipboard API (navigator.clipboard)
 * - Returns boolean: true=success, false=failed
 * - Handles browser compatibility
 * 
 * **Usage Example:**
 * ```typescript
 * const vr = useVRGenerator({\n *   storedCase: currentCase,\n *   financialItems: allItems,\n *   vrScripts: categoryConfig.vrScripts\n * });\n * 
 * // Open modal
 * vr.openModal();\n * 
 * // User selects script
 * vr.setSelectedScriptId(\"template-1\");\n * 
 * // User selects items
 * vr.selectAll();\n * vr.toggleItem(\"item-3\"); // Deselect one
 * \n * // Generate and copy
 * vr.setRenderedText(generatedText);\n * const copied = await vr.copyToClipboard();\n * if (copied) {\n *   toast.success(\"Copied to clipboard\");\n * }\n * ```
 * 
 * **Modal State:**
 * - isOpen: Boolean for modal visibility
 * - openModal/closeModal: Toggle visibility
 * - Modal closes on copy or manual dismiss
 * 
 * @param {UseVRGeneratorParams} params
 *   - `storedCase`: Current case (for VR generation context)
 *   - `financialItems`: All available financial items to render
 *   - `vrScripts`: Available VR script templates from config
 * 
 * @returns {UseVRGeneratorReturn} VR generation interface
 */
import type { StoredCase, FinancialItem, StoredFinancialItem } from "@/types/case";
import type { VRScript } from "@/types/vr";
import { renderMultipleVRs } from "@/utils/vrGenerator";

interface SelectedItem {
  item: FinancialItem;
  type: "resources" | "income" | "expenses";
  selected: boolean;
}

interface UseVRGeneratorParams {
  storedCase: StoredCase | null;
  financialItems: StoredFinancialItem[];
  vrScripts: VRScript[];
}

interface UseVRGeneratorReturn {
  // Modal state
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  
  // Script selection
  selectedScriptId: string | null;
  setSelectedScriptId: (id: string | null) => void;
  selectedScript: VRScript | null;
  
  // Item selection
  selectableItems: SelectedItem[];
  toggleItem: (itemId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectedCount: number;
  
  // Rendered output
  renderedText: string;
  setRenderedText: (text: string) => void;
  
  // Actions
  copyToClipboard: () => Promise<boolean>;
}

export function useVRGenerator({
  storedCase,
  financialItems,
  vrScripts,
}: UseVRGeneratorParams): UseVRGeneratorReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [renderedText, setRenderedText] = useState("");

  // Build list of all financial items from the provided array
  const allItems = useMemo<SelectedItem[]>(() => {
    return financialItems.map((item) => ({
      item,
      type: item.category,
      selected: false,
    }));
  }, [financialItems]);

  // Items with selection state
  const selectableItems = useMemo<SelectedItem[]>(() => {
    return allItems.map(item => ({
      ...item,
      selected: selectedItemIds.has(item.item.id),
    }));
  }, [allItems, selectedItemIds]);

  // Currently selected script
  const selectedScript = useMemo(() => {
    if (!selectedScriptId) return null;
    return vrScripts.find(s => s.id === selectedScriptId) ?? null;
  }, [selectedScriptId, vrScripts]);

  // Count of selected items
  const selectedCount = useMemo(() => {
    return selectableItems.filter(i => i.selected).length;
  }, [selectableItems]);

  // Open modal and initialize with no items selected
  const openModal = useCallback(() => {
    setSelectedItemIds(new Set());
    setSelectedScriptId(vrScripts[0]?.id ?? null);
    setRenderedText("");
    setIsOpen(true);
  }, [vrScripts]);

  // Close modal and reset state
  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSelectedScriptId(null);
    setSelectedItemIds(new Set());
    setRenderedText("");
  }, []);

  // Toggle a single item's selection
  const toggleItem = useCallback((itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // Select all items
  const selectAll = useCallback(() => {
    const allIds = new Set(allItems.map(i => i.item.id));
    setSelectedItemIds(allIds);
  }, [allItems]);

  // Deselect all items
  const deselectAll = useCallback(() => {
    setSelectedItemIds(new Set());
  }, []);

  // Regenerate VR text when script or selection changes
  const regenerateText = useCallback(() => {
    if (!selectedScript || !storedCase) {
      setRenderedText("");
      return;
    }

    const selectedItems = selectableItems
      .filter(i => i.selected)
      .map(({ item, type }) => ({ item, type }));

    if (selectedItems.length === 0) {
      setRenderedText("");
      return;
    }

    // Cast StoredCase to the expected type for renderMultipleVRs
    // The function only needs person and caseRecord fields which StoredCase has
    const text = renderMultipleVRs(
      selectedScript, 
      selectedItems, 
      storedCase as unknown as Parameters<typeof renderMultipleVRs>[2]
    );
    setRenderedText(text);
  }, [selectedScript, selectableItems, storedCase]);

  // Update script selection
  const handleSetSelectedScriptId = useCallback((id: string | null) => {
    setSelectedScriptId(id);
  }, []);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (): Promise<boolean> => {
    if (!renderedText) return false;
    
    try {
      await navigator.clipboard.writeText(renderedText);
      return true;
    } catch {
      return false;
    }
  }, [renderedText]);

  // Auto-regenerate when selection or script changes
  useEffect(() => {
    if (isOpen && selectedScript && storedCase) {
      regenerateText();
    }
  }, [isOpen, selectedScript, selectedItemIds, storedCase, regenerateText]);

  return {
    isOpen,
    openModal,
    closeModal,
    selectedScriptId,
    setSelectedScriptId: handleSetSelectedScriptId,
    selectedScript,
    selectableItems,
    toggleItem,
    selectAll,
    deselectAll,
    selectedCount,
    renderedText,
    setRenderedText,
    copyToClipboard,
  };
}

export default useVRGenerator;
