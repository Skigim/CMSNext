/**
 * VR Generator Hook
 * 
 * Manages the VR generation modal state and rendering logic.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
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
