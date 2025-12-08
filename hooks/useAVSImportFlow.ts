import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useDataManagerSafe } from "../contexts/DataManagerContext";
import type { StoredCase, FinancialItem, StoredFinancialItem } from "../types/case";
import {
  parseAVSInput,
  avsAccountToFinancialItem,
  findMatchingFinancialItem,
  type ParsedAVSAccount,
} from "../utils/avsParser";

/**
 * Parsed AVS account with selection state and match info
 */
export interface AVSAccountWithMeta extends ParsedAVSAccount {
  /** Whether this account is selected for import */
  selected: boolean;
  /** ID of existing item if this would update (undefined = new) */
  existingItemId?: string;
}

export interface AVSImportState {
  /** Whether the import modal is open */
  isOpen: boolean;
  /** Raw input text */
  rawInput: string;
  /** Parsed accounts with selection and match metadata */
  parsedAccounts: AVSAccountWithMeta[];
  /** Whether import is in progress */
  isImporting: boolean;
  /** Number of newly created items */
  importedCount: number;
  /** Number of updated existing items */
  updatedCount: number;
  /** Any error that occurred during import */
  error: string | null;
}

interface UseAVSImportFlowParams {
  /** Currently selected case */
  selectedCase: StoredCase | null;
  /** Error setter for parent component */
  setError?: React.Dispatch<React.SetStateAction<string | null>>;
}

interface UseAVSImportFlowResult {
  /** Current import state */
  importState: AVSImportState;
  /** Open the import modal */
  openImportModal: () => void;
  /** Close the import modal and reset state */
  closeImportModal: () => void;
  /** Update the raw input and parse accounts */
  handleInputChange: (input: string) => void;
  /** Clear the input and parsed accounts */
  clearInput: () => void;
  /** Import all parsed accounts as financial resources */
  importAccounts: () => Promise<void>;
  /** Toggle selection of a specific account for import */
  toggleAccountSelection: (index: number) => void;
  /** Toggle all accounts selection */
  toggleAllAccounts: () => void;
  /** Whether import is possible (has selected accounts and case) */
  canImport: boolean;
}

/**
 * Hook for managing AVS account import flow
 * 
 * Provides state management and operations for:
 * - Pasting and parsing AVS account data
 * - Previewing parsed accounts before import
 * - Bulk importing accounts as verified financial resources
 */
export function useAVSImportFlow({
  selectedCase,
  setError,
}: UseAVSImportFlowParams): UseAVSImportFlowResult {
  const dataManager = useDataManagerSafe();

  const [importState, setImportState] = useState<AVSImportState>({
    isOpen: false,
    rawInput: "",
    parsedAccounts: [],
    isImporting: false,
    importedCount: 0,
    updatedCount: 0,
    error: null,
  });

  const openImportModal = useCallback(() => {
    setImportState(prev => ({
      ...prev,
      isOpen: true,
      rawInput: "",
      parsedAccounts: [],
      importedCount: 0,
      updatedCount: 0,
      error: null,
    }));
  }, []);

  const closeImportModal = useCallback(() => {
    setImportState(prev => ({
      ...prev,
      isOpen: false,
      rawInput: "",
      parsedAccounts: [],
      isImporting: false,
      error: null,
    }));
  }, []);

  const handleInputChange = useCallback(async (input: string) => {
    const parsed = parseAVSInput(input);
    
    // Fetch existing resources to detect duplicates
    let existingResources: StoredFinancialItem[] = [];
    if (selectedCase && dataManager) {
      try {
        const allItems = await dataManager.getFinancialItemsForCase(selectedCase.id);
        existingResources = allItems.filter(item => item.category === 'resources');
      } catch (e) {
        console.error('Failed to fetch existing items for duplicate detection:', e);
      }
    }
    
    // Mark each parsed account with selection state and match status
    const accountsWithMeta: AVSAccountWithMeta[] = parsed.map(account => {
      const itemData = avsAccountToFinancialItem(account);
      const match = findMatchingFinancialItem(itemData, existingResources);
      return {
        ...account,
        selected: true, // Selected by default
        existingItemId: match?.id,
      };
    });
    
    setImportState(prev => ({
      ...prev,
      rawInput: input,
      parsedAccounts: accountsWithMeta,
      error: null,
    }));
  }, [selectedCase, dataManager]);

  const clearInput = useCallback(() => {
    setImportState(prev => ({
      ...prev,
      rawInput: "",
      parsedAccounts: [],
      error: null,
    }));
  }, []);

  const toggleAccountSelection = useCallback((index: number) => {
    setImportState(prev => ({
      ...prev,
      parsedAccounts: prev.parsedAccounts.map((account, i) =>
        i === index ? { ...account, selected: !account.selected } : account
      ),
    }));
  }, []);

  const toggleAllAccounts = useCallback(() => {
    setImportState(prev => {
      const allSelected = prev.parsedAccounts.every(a => a.selected);
      return {
        ...prev,
        parsedAccounts: prev.parsedAccounts.map(account => ({
          ...account,
          selected: !allSelected,
        })),
      };
    });
  }, []);

  const importAccounts = useCallback(async () => {
    if (!selectedCase) {
      const errorMsg = "No case selected. Please select a case first.";
      setImportState(prev => ({ ...prev, error: errorMsg }));
      toast.error(errorMsg);
      return;
    }

    if (!dataManager) {
      const errorMsg = "Data storage is not available. Please check your connection.";
      setImportState(prev => ({ ...prev, error: errorMsg }));
      setError?.(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Only import selected accounts
    const selectedAccounts = importState.parsedAccounts.filter(a => a.selected);

    if (selectedAccounts.length === 0) {
      const errorMsg = "No accounts selected for import.";
      setImportState(prev => ({ ...prev, error: errorMsg }));
      toast.error(errorMsg);
      return;
    }

    setImportState(prev => ({ ...prev, isImporting: true, error: null }));

    const toastId = toast.loading(
      `Importing ${selectedAccounts.length} account(s)...`
    );

    let newCount = 0;
    let updateCount = 0;
    const errors: string[] = [];

    try {
      // Import each account sequentially to avoid race conditions
      for (const account of selectedAccounts) {
        try {
          const itemData = avsAccountToFinancialItem(account);
          
          if (account.existingItemId) {
            // Update existing item
            await dataManager.updateItem(
              selectedCase.id,
              "resources",
              account.existingItemId,
              itemData as Partial<FinancialItem>
            );
            updateCount++;
          } else {
            // Add new item
            await dataManager.addItem(
              selectedCase.id,
              "resources",
              itemData as Omit<FinancialItem, "id" | "createdAt" | "updatedAt">
            );
            newCount++;
          }
        } catch (itemError) {
          console.error("Failed to import account:", account, itemError);
          const description = account.accountType !== "N/A"
            ? `${account.accountType} at ${account.bankName}`
            : account.bankName;
          errors.push(description);
        }
      }

      setImportState(prev => ({
        ...prev,
        isImporting: false,
        importedCount: newCount,
        updatedCount: updateCount,
      }));

      // Build success message
      const messageParts: string[] = [];
      if (newCount > 0) messageParts.push(`${newCount} new`);
      if (updateCount > 0) messageParts.push(`${updateCount} updated`);

      if (errors.length > 0) {
        toast.warning(
          `Imported ${messageParts.join(', ')}. ${errors.length} failed.`,
          { id: toastId, duration: 5000 }
        );
      } else {
        toast.success(
          `Successfully imported: ${messageParts.join(', ')}`,
          { id: toastId, duration: 3000 }
        );
        // Close modal on full success after a brief delay
        setTimeout(() => {
          closeImportModal();
        }, 1000);
      }
    } catch (error) {
      console.error("AVS import failed:", error);
      const errorMsg = "Failed to import accounts. Please try again.";
      setImportState(prev => ({
        ...prev,
        isImporting: false,
        error: errorMsg,
      }));
      setError?.(errorMsg);
      toast.error(errorMsg, { id: toastId });
    }
  }, [selectedCase, dataManager, importState.parsedAccounts, setError, closeImportModal]);

  const canImport =
    !!selectedCase &&
    !!dataManager &&
    importState.parsedAccounts.some(a => a.selected) &&
    !importState.isImporting;

  return {
    importState,
    openImportModal,
    closeImportModal,
    handleInputChange,
    clearInput,
    importAccounts,
    toggleAccountSelection,
    toggleAllAccounts,
    canImport,
  };
}
