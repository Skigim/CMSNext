import { useState, useCallback } from 'react';
import { FinancialItem, NewFinancialItemData, CaseCategory } from '@/types/case';
import { useDataManagerSafe } from '@/contexts/DataManagerContext';
import { toast } from 'sonner';

/**
 * Hook for managing financial items (resources, income, expenses)
 * Provides CRUD operations and modal state management for financial items
 */

interface UseFinancialItemsReturn {
  // Modal state
  financialModalOpen: boolean;
  editingFinancialItem: FinancialItem | null;
  financialCategory: CaseCategory | null;
  
  // Modal actions
  openFinancialModal: (category: CaseCategory, caseId: string, item?: FinancialItem) => void;
  closeFinancialModal: () => void;
  
  // CRUD operations
  createFinancialItem: (caseId: string, category: CaseCategory, data: NewFinancialItemData) => Promise<FinancialItem | null>;
  updateFinancialItem: (caseId: string, category: CaseCategory, itemId: string, data: Partial<NewFinancialItemData>) => Promise<FinancialItem | null>;
  deleteFinancialItem: (caseId: string, category: CaseCategory, itemId: string) => Promise<boolean>;
  
  // State
  isLoading: boolean;
  error: string | null;
}

export function useFinancialItems(): UseFinancialItemsReturn {
  const dataManager = useDataManagerSafe();
  
  const [financialModalOpen, setFinancialModalOpen] = useState(false);
  const [editingFinancialItem, setEditingFinancialItem] = useState<FinancialItem | null>(null);
  const [financialCategory, setFinancialCategory] = useState<CaseCategory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    caseId: string,
    category: CaseCategory,
    data: NewFinancialItemData
  ): Promise<FinancialItem | null> => {
    if (!dataManager) {
      const errorMsg = 'Data storage is not available';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }

    setIsLoading(true);
    setError(null);
    
    const toastId = toast.loading(`Adding ${category} item...`);
    
    try {
      const updatedCase = await dataManager.addItem(caseId, category, data);
      const newItem = updatedCase.caseRecord.financials[category].slice(-1)[0]; // Get last added item
      toast.success(`${category} item added successfully`, { id: toastId });
      return newItem;
    } catch (err) {
      const errorMsg = `Failed to add ${category} item`;
      console.error(errorMsg, err);
      setError(errorMsg);
      toast.error(errorMsg, { id: toastId });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [dataManager]);

  const updateFinancialItem = useCallback(async (
    caseId: string,
    category: CaseCategory,
    itemId: string,
    data: Partial<NewFinancialItemData>
  ): Promise<FinancialItem | null> => {
    if (!dataManager) {
      const errorMsg = 'Data storage is not available';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }

    setIsLoading(true);
    setError(null);
    
    const toastId = toast.loading(`Updating ${category} item...`);
    
    try {
      // Cast to required type since we're doing a partial update
      const updatedCase = await dataManager.updateItem(caseId, category, itemId, data as Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>);
      const updatedItem = updatedCase.caseRecord.financials[category].find(item => item.id === itemId);
      toast.success(`${category} item updated successfully`, { id: toastId });
      return updatedItem || null;
    } catch (err) {
      const errorMsg = `Failed to update ${category} item`;
      console.error(errorMsg, err);
      setError(errorMsg);
      toast.error(errorMsg, { id: toastId });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [dataManager]);

  const deleteFinancialItem = useCallback(async (
    caseId: string,
    category: CaseCategory,
    itemId: string
  ): Promise<boolean> => {
    if (!dataManager) {
      const errorMsg = 'Data storage is not available';
      setError(errorMsg);
      toast.error(errorMsg);
      return false;
    }

    setIsLoading(true);
    setError(null);
    
    const toastId = toast.loading(`Deleting ${category} item...`);
    
    try {
      await dataManager.deleteItem(caseId, category, itemId);
      toast.success(`${category} item deleted successfully`, { id: toastId });
      return true;
    } catch (err) {
      const errorMsg = `Failed to delete ${category} item`;
      console.error(errorMsg, err);
      setError(errorMsg);
      toast.error(errorMsg, { id: toastId });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [dataManager]);

  return {
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