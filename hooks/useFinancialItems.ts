import { useState, useCallback, useEffect } from 'react';
import { FinancialItem, NewFinancialItemData, CaseCategory, StoredFinancialItem } from '@/types/case';
import { useDataManagerSafe } from '@/contexts/DataManagerContext';
import { useFileStorageDataChange } from '@/contexts/FileStorageContext';
import { toast } from 'sonner';
import { withToast } from '@/utils/withToast';

/**
 * Hook for managing financial items (resources, income, expenses)
 * Provides CRUD operations and modal state management for financial items
 */

interface UseFinancialItemsReturn {
  // Data
  items: StoredFinancialItem[];
  groupedItems: {
    resources: StoredFinancialItem[];
    income: StoredFinancialItem[];
    expenses: StoredFinancialItem[];
  };
  refreshItems: () => Promise<void>;

  // Modal state
  financialModalOpen: boolean;
  editingFinancialItem: FinancialItem | null;
  financialCategory: CaseCategory | null;
  
  // Modal actions
  openFinancialModal: (category: CaseCategory, caseId: string, item?: FinancialItem) => void;
  closeFinancialModal: () => void;
  
  // CRUD operations
  createFinancialItem: (caseId: string, category: CaseCategory, data: NewFinancialItemData) => Promise<StoredFinancialItem | null>;
  updateFinancialItem: (caseId: string, category: CaseCategory, itemId: string, data: Partial<NewFinancialItemData>) => Promise<StoredFinancialItem | null>;
  deleteFinancialItem: (caseId: string, category: CaseCategory, itemId: string) => Promise<boolean>;
  
  // State
  isLoading: boolean;
  error: string | null;
}

export function useFinancialItems(caseId?: string): UseFinancialItemsReturn {
  const dataManager = useDataManagerSafe();
  const dataChangeCount = useFileStorageDataChange();
  
  const [items, setItems] = useState<StoredFinancialItem[]>([]);
  const [groupedItems, setGroupedItems] = useState<{
    resources: StoredFinancialItem[];
    income: StoredFinancialItem[];
    expenses: StoredFinancialItem[];
  }>({
    resources: [],
    income: [],
    expenses: []
  });

  const [financialModalOpen, setFinancialModalOpen] = useState(false);
  const [editingFinancialItem, setEditingFinancialItem] = useState<FinancialItem | null>(null);
  const [financialCategory, setFinancialCategory] = useState<CaseCategory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshItems = useCallback(async () => {
    if (!caseId || !dataManager) {
      setItems([]);
      setGroupedItems({ resources: [], income: [], expenses: [] });
      return;
    }

    try {
      const [allItems, grouped] = await Promise.all([
        dataManager.getFinancialItemsForCase(caseId),
        dataManager.getFinancialItemsForCaseGrouped(caseId)
      ]);
      setItems(allItems);
      setGroupedItems(grouped);
    } catch (err) {
      console.error('Failed to fetch financial items:', err);
      // Don't set error state here to avoid UI flashing, just log it
    }
  }, [caseId, dataManager]);

  // Initial fetch and refresh on data change
  useEffect(() => {
    refreshItems();
  }, [refreshItems, dataChangeCount]);

  const openFinancialModal = useCallback((category: CaseCategory, _caseId: string, item?: FinancialItem) => {
    setFinancialCategory(category);
    setEditingFinancialItem(item || null);
    setFinancialModalOpen(true);
    setError(null);
  }, []);

  const closeFinancialModal = useCallback(() => {
    setFinancialModalOpen(false);
    setEditingFinancialItem(null);
    setFinancialCategory(null);
    setError(null);
  }, []);

  const createFinancialItem = useCallback(async (
    targetCaseId: string,
    category: CaseCategory,
    data: NewFinancialItemData
  ): Promise<StoredFinancialItem | null> => {
    if (!dataManager) {
      const errorMsg = 'Data storage is not available';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }

    try {
      const newItem = await withToast(
        () => dataManager.addItem(targetCaseId, category, data),
        {
          loading: `Adding ${category} item...`,
          success: `${category} item added successfully`,
          error: `Failed to add ${category} item`,
          setError,
          setLoading: setIsLoading,
        }
      );
      
      // Refresh items if we're viewing the same case
      if (newItem && caseId === targetCaseId) {
        await refreshItems();
      }
      
      return newItem;
    } catch {
      return null;
    }
  }, [dataManager, caseId, refreshItems, setError]);

  const updateFinancialItem = useCallback(async (
    targetCaseId: string,
    category: CaseCategory,
    itemId: string,
    data: Partial<NewFinancialItemData>
  ): Promise<StoredFinancialItem | null> => {
    if (!dataManager) {
      const errorMsg = 'Data storage is not available';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }

    try {
      const updatedItem = await withToast(
        () => dataManager.updateItem(targetCaseId, category, itemId, data as Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>),
        {
          loading: `Updating ${category} item...`,
          success: `${category} item updated successfully`,
          error: `Failed to update ${category} item`,
          setError,
          setLoading: setIsLoading,
        }
      );
      
      // Refresh items if we're viewing the same case
      if (updatedItem && caseId === targetCaseId) {
        await refreshItems();
      }

      return updatedItem;
    } catch {
      return null;
    }
  }, [dataManager, caseId, refreshItems, setError]);

  const deleteFinancialItem = useCallback(async (
    targetCaseId: string,
    category: CaseCategory,
    itemId: string
  ): Promise<boolean> => {
    if (!dataManager) {
      const errorMsg = 'Data storage is not available';
      setError(errorMsg);
      toast.error(errorMsg);
      return false;
    }

    try {
      await withToast(
        () => dataManager.deleteItem(targetCaseId, category, itemId),
        {
          loading: `Deleting ${category} item...`,
          success: `${category} item deleted successfully`,
          error: `Failed to delete ${category} item`,
          setError,
          setLoading: setIsLoading,
        }
      );
      
      // Refresh items if we're viewing the same case
      if (caseId === targetCaseId) {
        await refreshItems();
      }

      return true;
    } catch {
      return false;
    }
  }, [dataManager, caseId, refreshItems, setError]);

  return {
    // Data
    items,
    groupedItems,
    refreshItems,

    // Modal state
    financialModalOpen,
    editingFinancialItem,
    financialCategory,
    
    // Modal actions
    openFinancialModal,
    closeFinancialModal,
    
    // CRUD operations
    createFinancialItem,
    updateFinancialItem,
    deleteFinancialItem,
    
    // State
    isLoading,
    error
  };
}