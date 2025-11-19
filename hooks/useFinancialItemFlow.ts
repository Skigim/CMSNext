import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useDataManagerSafe } from "../contexts/DataManagerContext";
import { getRefactorFlags } from "@/utils/featureFlags";
import { useFinancialManagement } from "./useFinancialManagement";
import type { CaseCategory, CaseDisplay, FinancialItem } from "../types/case";

export type ItemFormState = {
  isOpen: boolean;
  category?: CaseCategory;
  item?: FinancialItem;
  caseId?: string;
};

interface UseFinancialItemFlowParams {
  selectedCase: CaseDisplay | null;
  setCases: React.Dispatch<React.SetStateAction<CaseDisplay[]>>;
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
  setCases,
  setError,
}: UseFinancialItemFlowParams): UseFinancialItemFlowResult {
  const dataManager = useDataManagerSafe();
  const financialManagement = useFinancialManagement();
  const [itemForm, setItemForm] = useState<ItemFormState>({ isOpen: false });

  const ensureCaseAndManager = useCallback(() => {
    if (!selectedCase) return false;
    
    if (getRefactorFlags().USE_FINANCIALS_DOMAIN) {
        if (!financialManagement) {
            const errorMsg = "Financial management service is not available.";
            setError(errorMsg);
            toast.error(errorMsg);
            return false;
        }
        return true;
    }

    if (!dataManager) {
        const errorMsg = "Data storage is not available. Please check your connection.";
        setError(errorMsg);
        toast.error(errorMsg);
        return false;
    }
    return true;
  }, [dataManager, financialManagement, selectedCase, setError]);

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
      if (!ensureCaseAndManager() || !selectedCase) {
        return;
      }

      try {
        setError(null);
        
        if (getRefactorFlags().USE_FINANCIALS_DOMAIN && financialManagement) {
            await financialManagement.deleteItem(itemId);
            
            setCases(prevCases =>
              prevCases.map(c => {
                  if (c.id === selectedCase.id) {
                      const financials = { ...c.caseRecord.financials };
                      if (financials[category]) {
                          financials[category] = financials[category].filter(i => i.id !== itemId);
                      }
                      return {
                          ...c,
                          caseRecord: { ...c.caseRecord, financials },
                          updatedAt: new Date().toISOString()
                      };
                  }
                  return c;
              })
            );
            toast.success(`${category.charAt(0).toUpperCase() + category.slice(1)} item deleted successfully`);
            return;
        }

        if (!dataManager) return;

        const updatedCase = await dataManager.deleteItem(selectedCase.id, category, itemId);
        setCases(prevCases =>
          prevCases.map(c => (c.id === selectedCase.id ? updatedCase : c)),
        );

        toast.success(`${category.charAt(0).toUpperCase() + category.slice(1)} item deleted successfully`);
      } catch (err) {
        console.error("Failed to delete item:", err);
        const errorMsg = "Failed to delete item. Please try again.";
        setError(errorMsg);
        toast.error(errorMsg);
      }
    },
    [dataManager, financialManagement, ensureCaseAndManager, selectedCase, setCases, setError],
  );

  const handleBatchUpdateItem = useCallback(
    async (category: CaseCategory, itemId: string, updatedItem: Partial<FinancialItem>) => {
      if (!ensureCaseAndManager() || !selectedCase) {
        return;
      }

      try {
        setError(null);
        
        if (getRefactorFlags().USE_FINANCIALS_DOMAIN && financialManagement) {
            const result = await financialManagement.updateItem(itemId, updatedItem);
            const resultSnapshot = result.toJSON();
            
            setCases(prevCases =>
              prevCases.map(c => {
                  if (c.id === selectedCase.id) {
                      const financials = { ...c.caseRecord.financials };
                      if (financials[category]) {
                          financials[category] = financials[category].map(i => 
                              i.id === itemId ? { ...i, ...resultSnapshot } as any : i
                          );
                      }
                      return {
                          ...c,
                          caseRecord: { ...c.caseRecord, financials },
                          updatedAt: new Date().toISOString()
                      };
                  }
                  return c;
              })
            );
            toast.success("Item updated successfully", { duration: 2000 });
            return;
        }

        if (!dataManager) return;

        const updatedCase = await dataManager.updateItem(selectedCase.id, category, itemId, updatedItem);

        setCases(prevCases =>
          prevCases.map(c => (c.id === selectedCase.id ? updatedCase : c)),
        );

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
    [dataManager, financialManagement, ensureCaseAndManager, selectedCase, setCases, setError],
  );

  const handleCreateItem = useCallback(
    async (category: CaseCategory, itemData: Omit<FinancialItem, "id" | "createdAt" | "updatedAt">) => {
      if (!ensureCaseAndManager() || !selectedCase) {
        return;
      }

      try {
        setError(null);
        
        if (getRefactorFlags().USE_FINANCIALS_DOMAIN && financialManagement) {
            const newItem = await financialManagement.createItem(selectedCase.id, category, itemData);
            const newItemSnapshot = newItem.toJSON();
            
            setCases(prevCases =>
              prevCases.map(c => {
                  if (c.id === selectedCase.id) {
                      const financials = { ...c.caseRecord.financials };
                      if (!financials[category]) financials[category] = [];
                      financials[category] = [...financials[category], newItemSnapshot as any];
                      
                      return {
                          ...c,
                          caseRecord: { ...c.caseRecord, financials },
                          updatedAt: new Date().toISOString()
                      };
                  }
                  return c;
              })
            );
            toast.success("Item created successfully", { duration: 2000 });
            return;
        }

        if (!dataManager) return;

        const updatedCase = await dataManager.addItem(selectedCase.id, category, itemData);
        setCases(prevCases =>
          prevCases.map(c => (c.id === selectedCase.id ? updatedCase : c)),
        );

        toast.success("Item created successfully", { duration: 2000 });
      } catch (err) {
        console.error("Failed to create item:", err);
        const errorMsg = "Failed to create item. Please try again.";
        setError(errorMsg);
        toast.error(errorMsg);
        throw err;
      }
    },
    [dataManager, financialManagement, ensureCaseAndManager, selectedCase, setCases, setError],
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
