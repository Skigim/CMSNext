import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useDataManagerSafe } from "../contexts/DataManagerContext";
import type { StoredCase, FinancialItem, StoredFinancialItem } from "../types/case";
import {
  parseAVSInput,
  parseAVSInputAsync,
  avsAccountToFinancialItem,
  findMatchingFinancialItem,
  type ParsedAVSAccount,
  type MatchConfidence,
} from "@/domain/avs";
import { createLogger } from "@/utils/logger";
import { extractErrorMessage } from "@/utils/errorUtils";

const logger = createLogger("useAVSImportFlow");

/**
 * Parsed AVS account with selection state and match info
 */
export interface AVSAccountWithMeta extends ParsedAVSAccount {
  /** Whether this account is selected for import */
  selected: boolean;
  /** ID of existing item if this would update (undefined = new) */
  existingItemId?: string;
  /** How confident the match is (undefined = no match / new item) */
  matchConfidence?: MatchConfidence;
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
  error: null | string;
  /** Error when fetching existing items for duplicate detection failed; null = no error */
  fetchError: null | string;
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
 * Hook for managing AVS (Automated Verification System) account import flow
 * 
 * Coordinates the complete workflow for importing pre-verified financial accounts:
 * Parse raw AVS text → Preview parsed accounts → Select for import → Bulk import as resources
 * 
 * Supports duplicate detection and update-or-create semantics (if an imported account
 * matches an existing resource, it updates; otherwise creates new).
 * 
 * @example
 * ```typescript
 * const { importState, openImportModal, importAccounts, toggleAccountSelection } = useAVSImportFlow({
 *   selectedCase: case1,
 *   setError: setErrorState
 * });
 * 
 * // User clicks import button
 * openImportModal();
 * 
 * // User pastes AVS data
 * await handleInputChange("Checking\n12345\nSavings\n67890\n...");
 * // importState.parsedAccounts now has [ { bankName, accountType, selected: true }, ... ]
 * 
 * // User reviews and deselects accounts they don't want
 * toggleAccountSelection(2); // Skip the 3rd account
 * 
 * // User imports selected accounts
 * await importAccounts();
 * // Creates or updates resources in selectedCase, shows success/warning toast
 * ```
 * 
 * @returns {UseAVSImportFlowResult} Import state and operations:
 * - `importState`: Modal visibility, parsed accounts with selection, progress
 * - `openImportModal/closeImportModal`: Modal lifecycle
 * - `handleInputChange`: Parse raw AVS text and detect duplicates
 * - `toggleAccountSelection(index)`: Toggle account selection by index
 * - `toggleAllAccounts()`: Toggle all-select/deselect
 * - `importAccounts()`: Bulk import selected accounts (create or update)
 * - `canImport`: Computed boolean - true if case + dataManager + selected accounts exist
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
    fetchError: null,
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
      fetchError: null,
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
      fetchError: null,
    }));
  }, []);

  const handleInputChange = useCallback(async (input: string) => {
    // Large input threshold (100KB) - use async chunked parsing for performance
    const LARGE_INPUT_THRESHOLD = 100 * 1024;
    const isLargeInput = input.length > LARGE_INPUT_THRESHOLD;
    
    if (isLargeInput) {
      // Set a temporary processing state for large inputs
      setImportState(prev => ({
        ...prev,
        rawInput: input,
        isImporting: true, // Reuse as "processing" indicator
      }));
    }

    // Use chunked async parser for large inputs to avoid blocking the main thread
    const parsed = isLargeInput
      ? await parseAVSInputAsync(input)
      : parseAVSInput(input);
    
    // Fetch existing resources to detect duplicates
    let existingResources: StoredFinancialItem[] = [];
    let fetchError: null | string = null;
    
    if (selectedCase && dataManager) {
      try {
        const allItems = await dataManager.getFinancialItemsForCase(selectedCase.id);
        existingResources = allItems.filter(item => item.category === 'resources');
        fetchError = null; // Explicitly set to null on success
      } catch (e) {
        const errorMsg = extractErrorMessage(e);
        logger.error('Failed to fetch existing items for duplicate detection', {
          error: errorMsg,
        });
        fetchError = 'Duplicate detection error - cannot verify existing accounts. Import halted to prevent duplicates.';
        toast.error('Import Unavailable', {
          description: 'Could not load existing accounts to check for duplicates. Please try again.',
          duration: 5000,
        });
      }
    }
    
    // Mark each parsed account with selection state and match status
    const accountsWithMeta: AVSAccountWithMeta[] = parsed.map(account => {
      const itemData = avsAccountToFinancialItem(account);
      const matchResult = findMatchingFinancialItem(
        itemData,
        existingResources,
        account.bankName,
      );
      return {
        ...account,
        selected: true, // Selected by default
        existingItemId: matchResult?.item.id,
        matchConfidence: matchResult?.confidence,
      };
    });
    
    setImportState(prev => ({
      ...prev,
      rawInput: input,
      parsedAccounts: accountsWithMeta,
      isImporting: false,
      error: null,
      fetchError,
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
          logger.error("Failed to import account", {
            account: account.bankName,
            accountType: account.accountType,
            error: extractErrorMessage(itemError),
          });
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
      logger.error("AVS import failed", {
        error: extractErrorMessage(error),
      });
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
    !importState.isImporting &&
    importState.fetchError === null;

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
