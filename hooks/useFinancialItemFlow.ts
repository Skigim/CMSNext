import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useDataManagerSafe } from "../contexts/DataManagerContext";
import type { CaseCategory, StoredCase, FinancialItem } from "../types/case";

export type ItemFormState = {
  isOpen: boolean;
  category?: CaseCategory;
  item?: FinancialItem;
  caseId?: string;
};

interface UseFinancialItemFlowParams {
  selectedCase: StoredCase | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

interface UseFinancialItemFlowResult {
  itemForm: ItemFormState;
  openItemForm: (category: CaseCategory) => void;
  closeItemForm: () => void;
  handleDeleteItem: (category: CaseCategory, itemId: string) => Promise<void>;
  handleBatchUpdateItem: (
    category: CaseCategory,
    itemId: string,
    updatedItem: Partial<FinancialItem>,
  ) => Promise<void>;
  handleCreateItem: (
    category: CaseCategory,
    itemData: Omit<FinancialItem, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
}

export function useFinancialItemFlow({
  selectedCase,
  setError,
}: UseFinancialItemFlowParams): UseFinancialItemFlowResult {
  const dataManager = useDataManagerSafe();
  const [itemForm, setItemForm] = useState<ItemFormState>({ isOpen: false });

  const ensureCaseAndManager = useCallback(() => {
    if (!selectedCase) return false;

    if (!dataManager) {
        const errorMsg = "Data storage is not available. Please check your connection.";
        setError(errorMsg);
        toast.error(errorMsg);
        return false;
    }
    return true;
  }, [dataManager, selectedCase, setError]);

  const openItemForm = useCallback(
    (category: CaseCategory) => {
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
    async (category: CaseCategory, itemId: string) => {
      if (!ensureCaseAndManager() || !selectedCase || !dataManager) {
        return;
      }

      try {
        setError(null);

        await dataManager.deleteItem(selectedCase.id, category, itemId);
        // Don't update cases state as items are separate

        toast.success(`${category.charAt(0).toUpperCase() + category.slice(1)} item deleted successfully`);
      } catch (err) {
        console.error("Failed to delete item:", err);
        const errorMsg = "Failed to delete item. Please try again.";
        setError(errorMsg);
        toast.error(errorMsg);
      }
    },
    [dataManager, ensureCaseAndManager, selectedCase, setError],
  );

  const handleBatchUpdateItem = useCallback(
    async (category: CaseCategory, itemId: string, updatedItem: Partial<FinancialItem>) => {
      if (!ensureCaseAndManager() || !selectedCase || !dataManager) {
        return;
      }

      try {
        setError(null);

        await dataManager.updateItem(selectedCase.id, category, itemId, updatedItem);
        // Don't update cases state as items are separate

        toast.success("Item updated successfully", { duration: 2000 });
      } catch (err) {
        console.error("Failed to update item:", err);

        let errorMsg = "Failed to update item. Please try again.";
        if (err instanceof Error) {
          if (err.message.includes("File was modified by another process")) {
            errorMsg = "File was modified by another process. Your changes were not saved. Please refresh and try again.";
          } else if (err.message.includes("Permission denied")) {
            errorMsg = "Permission denied. Please check that you have write access to the data folder.";
          } else if (
            err.message.includes("state cached in an interface object") ||
            err.message.includes("state had changed")
          ) {
            errorMsg = "Data sync issue detected. Please refresh the page and try again.";
          }
        }

        setError(errorMsg);
        toast.error(errorMsg, { duration: 5000 });
        throw err;
      }
    },
    [dataManager, ensureCaseAndManager, selectedCase, setError],
  );

  const handleCreateItem = useCallback(
    async (category: CaseCategory, itemData: Omit<FinancialItem, "id" | "createdAt" | "updatedAt">) => {
      if (!ensureCaseAndManager() || !selectedCase || !dataManager) {
        return;
      }

      try {
        setError(null);

        await dataManager.addItem(selectedCase.id, category, itemData);
        // Don't update cases state as items are separate

        toast.success("Item created successfully", { duration: 2000 });
      } catch (err) {
        console.error("Failed to create item:", err);
        const errorMsg = "Failed to create item. Please try again.";
        setError(errorMsg);
        toast.error(errorMsg);
        throw err;
      }
    },
    [dataManager, ensureCaseAndManager, selectedCase, setError],
  );

  return {
    itemForm,
    openItemForm,
    closeItemForm,
    handleDeleteItem,
    handleBatchUpdateItem,
    handleCreateItem,
  };
}

