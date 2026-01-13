import { useState, useCallback } from 'react';
import { AmountHistoryEntry, FinancialItem, NewFinancialItemData, CaseCategory, StoredFinancialItem } from '@/types/case';
import { useDataManagerSafe } from '@/contexts/DataManagerContext';
import { useDataSync } from './useDataSync';
import { toast } from 'sonner';
import { withToast } from '@/utils/withToast';

/**
 * Return type for useFinancialItems hook.
 * @interface UseFinancialItemsReturn
 */
interface UseFinancialItemsReturn {
  // Data
  /** All financial items for active case */
  items: StoredFinancialItem[];
  /** Financial items grouped by category */
  groupedItems: {
    /** Resource-type items */
    resources: StoredFinancialItem[];
    /** Income-type items */
    income: StoredFinancialItem[];
    /** Expense-type items */
    expenses: StoredFinancialItem[];
  };
  /** Reload financial items from file */
  refreshItems: () => Promise<void>;

  // Modal state
  /** Modal open/closed state */
  financialModalOpen: boolean;
  /** Item currently being edited (null if creating) */
  editingFinancialItem: FinancialItem | null;
  /** Current category for modal */
  financialCategory: CaseCategory | null;
  
  // Modal actions
  /** Open modal for creating or editing item */
  openFinancialModal: (category: CaseCategory, caseId: string, item?: FinancialItem) => void;
  /** Close modal without saving */
  closeFinancialModal: () => void;
  
  // CRUD operations
  /** Create new financial item */
  createFinancialItem: (caseId: string, category: CaseCategory, data: NewFinancialItemData) => Promise<StoredFinancialItem | null>;
  /** Update existing financial item */
  updateFinancialItem: (caseId: string, category: CaseCategory, itemId: string, data: Partial<NewFinancialItemData>) => Promise<StoredFinancialItem | null>;
  /** Delete financial item */
  deleteFinancialItem: (caseId: string, category: CaseCategory, itemId: string) => Promise<boolean>;
  
  // Amount history operations
  /** Add entry to amount history (e.g., new payment, deposit) */
  addAmountHistoryEntry: (
    category: CaseCategory,
    itemId: string,
    entry: Omit<AmountHistoryEntry, "id" | "createdAt">
  ) => Promise<StoredFinancialItem | null>;
  /** Update existing history entry */
  updateAmountHistoryEntry: (
    category: CaseCategory,
    itemId: string,
    entryId: string,
    updates: Partial<Omit<AmountHistoryEntry, "id" | "createdAt">>
  ) => Promise<StoredFinancialItem | null>;
  /** Delete history entry */
  deleteAmountHistoryEntry: (
    category: CaseCategory,
    itemId: string,
    entryId: string
  ) => Promise<StoredFinancialItem | null>;
  
  // State
  /** Whether items are currently loading */
  isLoading: boolean;
  /** Error message if operation failed */
  error: string | null;
}

/**
 * Financial items management hook.
 * 
 * Provides complete CRUD operations for financial items (resources, income, expenses)
 * and their amount history. Handles modal state for item editor UI.
 * 
 * ## Categories
 * 
 * - **resources**: Available funds/assets (e.g., savings, property)
 * - **income**: Money received (e.g., salary, grants)
 * - **expenses**: Money spent (e.g., rent, utilities)
 * 
 * ## Amount History
 * 
 * Each financial item tracks an amount history with timestamped entries.
 * Supports recording changes over time (e.g., payment installments, deposits).
 * 
 * ## Architecture
 * 
 * ```
 * useFinancialItems (state + modal mgmt)
 *     ↓
 * useDataManagerSafe (safe context access)
 *     ↓
 * DataManager (persistence layer)
 * ```
 * 
 * ## Modal Management
 * 
 * Handles both create and edit workflows:
 * - `openFinancialModal(category, caseId)` - New item
 * - `openFinancialModal(category, caseId, item)` - Edit item
 * - `closeFinancialModal()` - Close without saving
 * 
 * ## CRUD Operations
 * 
 * ### Create/Update
 * - `createFinancialItem()` - New item
 * - `updateFinancialItem()` - Update item properties
 * 
 * ### Delete
 * - `deleteFinancialItem()` - Remove item and history
 * 
 * ### Amount History
 * - `addAmountHistoryEntry()` - Record new amount
 * - `updateAmountHistoryEntry()` - Change recorded amount
 * - `deleteAmountHistoryEntry()` - Remove history entry
 * 
 * ## Usage Example
 * 
 * ```typescript
 * function FinancialPanel({ caseId }: { caseId: string }) {
 *   const {
 *     groupedItems,
 *     financialModalOpen,
 *     openFinancialModal,
 *     closeFinancialModal,
 *     createFinancialItem,
 *     deleteFinancialItem
 *   } = useFinancialItems(caseId);
 *   
 *   const handleAddIncome = async (data: NewFinancialItemData) => {
 *     await createFinancialItem(caseId, 'income', data);
 *     closeFinancialModal();
 *   };
 *   
 *   return (
 *     <>
 *       <div>
 *         {groupedItems.income.map(item => (
 *           <FinancialItem key={item.id} item={item} />
 *         ))}
 *       </div>
 *       {financialModalOpen && (
 *         <FinancialModal onSave={handleAddIncome} onClose={closeFinancialModal} />
 *       )}
 *     </>
 *   );
 * }
 * ```
 * 
 * ## Grouping
 * 
 * Items are automatically grouped by category for easier UI rendering:
 * 
 * ```typescript
 * const { groupedItems } = useFinancialItems(caseId);
 * // groupedItems.resources: StoredFinancialItem[]
 * // groupedItems.income: StoredFinancialItem[]
 * // groupedItems.expenses: StoredFinancialItem[]
 * ```
 * 
 * @hook
 * @param {string} [caseId] - Optional case ID to auto-load items for
 * @returns {UseFinancialItemsReturn} Financial items state and operations
 * 
 * @see {@link useDataManagerSafe} for safe DataManager access
 * @see {@link DataManager} for underlying persistence
 */
export function useFinancialItems(caseId?: string): UseFinancialItemsReturn {
  const dataManager = useDataManagerSafe();
  
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

  // Sync with file storage data changes
  useDataSync({ onRefresh: refreshItems });

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

  // Amount History Entry operations
  const addAmountHistoryEntry = useCallback(async (
    category: CaseCategory,
    itemId: string,
    entry: Omit<AmountHistoryEntry, "id" | "createdAt">
  ): Promise<StoredFinancialItem | null> => {
    if (!dataManager || !caseId) {
      const errorMsg = 'Data storage is not available';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }

    try {
      const updatedItem = await withToast(
        () => dataManager.addAmountHistoryEntry(caseId, category, itemId, entry),
        {
          loading: 'Adding history entry...',
          success: 'History entry added',
          error: 'Failed to add history entry',
          setError,
          setLoading: setIsLoading,
        }
      );
      
      if (updatedItem) {
        await refreshItems();
      }
      
      return updatedItem;
    } catch {
      return null;
    }
  }, [dataManager, caseId, refreshItems, setError]);

  const updateAmountHistoryEntry = useCallback(async (
    category: CaseCategory,
    itemId: string,
    entryId: string,
    updates: Partial<Omit<AmountHistoryEntry, "id" | "createdAt">>
  ): Promise<StoredFinancialItem | null> => {
    if (!dataManager || !caseId) {
      const errorMsg = 'Data storage is not available';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }

    try {
      const updatedItem = await withToast(
        () => dataManager.updateAmountHistoryEntry(caseId, category, itemId, entryId, updates),
        {
          loading: 'Updating history entry...',
          success: 'History entry updated',
          error: 'Failed to update history entry',
          setError,
          setLoading: setIsLoading,
        }
      );
      
      if (updatedItem) {
        await refreshItems();
      }
      
      return updatedItem;
    } catch {
      return null;
    }
  }, [dataManager, caseId, refreshItems, setError]);

  const deleteAmountHistoryEntry = useCallback(async (
    category: CaseCategory,
    itemId: string,
    entryId: string
  ): Promise<StoredFinancialItem | null> => {
    if (!dataManager || !caseId) {
      const errorMsg = 'Data storage is not available';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }

    try {
      const updatedItem = await withToast(
        () => dataManager.deleteAmountHistoryEntry(caseId, category, itemId, entryId),
        {
          loading: 'Deleting history entry...',
          success: 'History entry deleted',
          error: 'Failed to delete history entry',
          setError,
          setLoading: setIsLoading,
        }
      );
      
      if (updatedItem) {
        await refreshItems();
      }
      
      return updatedItem;
    } catch {
      return null;
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
    
    // Amount history operations
    addAmountHistoryEntry,
    updateAmountHistoryEntry,
    deleteAmountHistoryEntry,
    
    // State
    isLoading,
    error
  };
}