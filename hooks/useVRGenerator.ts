import { useState, useCallback, useMemo, useEffect } from "react";

/**
 * Hook for managing VR (Verification Report) generation workflow
 * 
 * Orchestrates:
 * - Template selection from template context
 * - Financial item selection with multi-select
 * - Template rendering from selected items
 * - Generated text preview with copy-to-clipboard
 * 
 * **Workflow:**
 * 1. Select VR template
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
 * **Template Selection:**
 * - Choose from VR templates (from TemplateContext)
 * - Each template has different format
 * - Selected template ID tracked separately
 * - Template details provided for preview (name, description)
 * 
 * **VR Generation:**
 * - Uses renderMultipleVRs() utility to generate text
 * - Takes selected template + selected items
 * - Produces formatted verification report text
 * - Updates renderedText state for display
 * 
 * **Copy to Clipboard:**
 * - Uses modern Clipboard API (navigator.clipboard)
 * - Returns boolean: true=success, false=failed
 * - Handles browser compatibility
 * 
 * **Modal State:**
 * - isOpen: Boolean for modal visibility
 * - openModal/closeModal: Toggle visibility
 * - Modal closes on copy or manual dismiss
 * 
 * @param {UseVRGeneratorParams} params
 *   - `storedCase`: Current case (for VR generation context)
 *   - `financialItems`: All available financial items to render
 *   - `vrTemplates`: Available VR templates from TemplateContext
 * 
 * @returns {UseVRGeneratorReturn} VR generation interface
 */
import type { StoredCase, FinancialItem, StoredFinancialItem } from "@/types/case";
import type { Template } from "@/types/template";
import { renderMultipleVRs } from "@/utils/vrGenerator";

interface SelectedItem {
  item: FinancialItem;
  type: "resources" | "income" | "expenses";
  selected: boolean;
}

interface UseVRGeneratorParams {
  storedCase: StoredCase | null;
  financialItems: StoredFinancialItem[];
  vrTemplates: Template[];
}

interface UseVRGeneratorReturn {
  // Modal state
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  
  // Template selection
  selectedTemplateId: string | null;
  setSelectedTemplateId: (id: string | null) => void;
  selectedTemplate: Template | null;
  
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
  vrTemplates,
}: UseVRGeneratorParams): UseVRGeneratorReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
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

  // Currently selected template
  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return vrTemplates.find(t => t.id === selectedTemplateId) ?? null;
  }, [selectedTemplateId, vrTemplates]);

  // Count of selected items
  const selectedCount = useMemo(() => {
    return selectableItems.filter(i => i.selected).length;
  }, [selectableItems]);

  // Open modal and initialize with no items selected
  const openModal = useCallback(() => {
    setSelectedItemIds(new Set());
    setSelectedTemplateId(vrTemplates[0]?.id ?? null);
    setRenderedText("");
    setIsOpen(true);
  }, [vrTemplates]);

  // Close modal and reset state
  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSelectedTemplateId(null);
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

  // Regenerate VR text when template or selection changes
  const regenerateText = useCallback(() => {
    if (!selectedTemplate || !storedCase) {
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
      selectedTemplate, 
      selectedItems, 
      storedCase as unknown as Parameters<typeof renderMultipleVRs>[2]
    );
    setRenderedText(text);
  }, [selectedTemplate, selectableItems, storedCase]);

  // Update template selection
  const handleSetSelectedTemplateId = useCallback((id: string | null) => {
    setSelectedTemplateId(id);
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

  // Auto-regenerate when selection or template changes
  useEffect(() => {
    if (isOpen && selectedTemplate && storedCase) {
      regenerateText();
    }
  }, [isOpen, selectedTemplate, selectedItemIds, storedCase, regenerateText]);

  return {
    isOpen,
    openModal,
    closeModal,
    selectedTemplateId,
    setSelectedTemplateId: handleSetSelectedTemplateId,
    selectedTemplate,
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

