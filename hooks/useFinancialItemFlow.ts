import { useCallback, useRef, useEffect, useState } from "react";
import { useFinancialService } from "@/contexts/FinancialServiceContext";
import { useApplicationState } from "@/application/hooks/useApplicationState";
import { FinancialCategory, type FinancialItemCreateInput, type FinancialItemSnapshot } from "@/domain/financials/entities/FinancialItem";
import type { CaseDisplay } from "../types/case";

export type ItemFormState = {
  isOpen: boolean;
  category?: FinancialCategory;
  item?: FinancialItemSnapshot;
  caseId?: string;
};

interface UseFinancialItemFlowParams {
  selectedCase: CaseDisplay | null;
}

interface UseFinancialItemFlowResult {
  itemForm: ItemFormState;
  items: FinancialItemSnapshot[];
  loading: boolean;
  error: string | null;
  openItemForm: (category: FinancialCategory) => void;
  closeItemForm: () => void;
  handleDeleteItem: (category: FinancialCategory, itemId: string) => Promise<void>;
  handleBatchUpdateItem: (
    category: FinancialCategory,
    itemId: string,
    updatedItem: Partial<FinancialItemSnapshot>,
  ) => Promise<void>;
  handleCreateItem: (
    category: FinancialCategory,
    itemData: Omit<FinancialItemCreateInput, 'id' | 'caseId' | 'category' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;
}

/**
 * Hook for financial item management operations.
 * 
 * Thin wrapper around FinancialManagementService.
 * Uses useRef pattern for callback stability (prevents infinite loops).
 * 
 * Pattern: Service Layer + useRef for stable callbacks
 */
export function useFinancialItemFlow({
  selectedCase,
}: UseFinancialItemFlowParams): UseFinancialItemFlowResult {
  const service = useFinancialService();
  const serviceRef = useRef(service);
  const [itemForm, setItemForm] = useState<ItemFormState>({ isOpen: false });

  // Update ref when service changes
  useEffect(() => {
    serviceRef.current = service;
  }, [service]);

  // Reactive state from ApplicationState
  const allItems = useApplicationState(state =>
    selectedCase ? state.getFinancialItemsByCaseId(selectedCase.id) : []
  );
  const loading = useApplicationState(state => state.getFinancialItemsLoading());
  const error = useApplicationState(state => state.getFinancialItemsError());

  // Convert domain entities to snapshots for UI
  const items = allItems.map(item => item.toJSON());

  const openItemForm = useCallback(
    (category: FinancialCategory) => {
      if (!selectedCase) {
        return;
      }
      setItemForm({
        isOpen: true,
        category,
        caseId: selectedCase.id,
      });
    },
    [selectedCase],
  );

  const closeItemForm = useCallback(() => {
    setItemForm({ isOpen: false });
  }, []);

  const handleDeleteItem = useCallback(
    async (_category: FinancialCategory, itemId: string) => {
      if (!selectedCase) {
        return;
      }

      await serviceRef.current.deleteItemWithFeedback(itemId);
    },
    [selectedCase],
  );

  const handleBatchUpdateItem = useCallback(
    async (
      _category: FinancialCategory,
      itemId: string,
      updatedItem: Partial<FinancialItemSnapshot>,
    ) => {
      if (!selectedCase) {
        return;
      }

      await serviceRef.current.updateItemWithFeedback(itemId, updatedItem);
    },
    [selectedCase],
  );

  const handleCreateItem = useCallback(
    async (
      category: FinancialCategory,
      itemData: Omit<FinancialItemCreateInput, 'id' | 'caseId' | 'category' | 'createdAt' | 'updatedAt'>,
    ) => {
      if (!selectedCase) {
        return;
      }

      const createInput: FinancialItemCreateInput = {
        ...itemData,
        caseId: selectedCase.id,
        category,
      };

      await serviceRef.current.createItemWithFeedback(createInput);
    },
    [selectedCase],
  );

  return {
    itemForm,
    items,
    loading,
    error,
    openItemForm,
    closeItemForm,
    handleDeleteItem,
    handleBatchUpdateItem,
    handleCreateItem,
  };
}