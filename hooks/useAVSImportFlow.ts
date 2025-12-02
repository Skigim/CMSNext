import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useDataManagerSafe } from "../contexts/DataManagerContext";
import type { StoredCase, FinancialItem } from "../types/case";
import {
  parseAVSInput,
  avsAccountToFinancialItem,
  type ParsedAVSAccount,
} from "../utils/avsParser";

export interface AVSImportState {
  /** Whether the import modal is open */
  isOpen: boolean;
  /** Raw input text */
  rawInput: string;
  /** Parsed accounts from the input */
  parsedAccounts: ParsedAVSAccount[];
  /** Whether import is in progress */
  isImporting: boolean;
  /** Number of successfully imported items */
  importedCount: number;
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
  /** Whether import is possible (has accounts and case) */
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
    error: null,
  });

  const openImportModal = useCallback(() => {
    setImportState(prev => ({
      ...prev,
      isOpen: true,
      rawInput: "",
      parsedAccounts: [],
      importedCount: 0,
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

  const handleInputChange = useCallback((input: string) => {
    const parsedAccounts = parseAVSInput(input);
    setImportState(prev => ({
      ...prev,
      rawInput: input,
      parsedAccounts,
      error: null,
    }));
  }, []);

  const clearInput = useCallback(() => {
    setImportState(prev => ({
      ...prev,
      rawInput: "",
      parsedAccounts: [],
      error: null,
    }));
  }, []);

  const toggleAccountSelection = useCallback((index: number) => {
    // For future use - could add a "selected" array to importState
    // to allow selective import
    console.log("Toggle account selection:", index);
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

    if (importState.parsedAccounts.length === 0) {
      const errorMsg = "No accounts to import. Please paste AVS data first.";
      setImportState(prev => ({ ...prev, error: errorMsg }));
      toast.error(errorMsg);
      return;
    }

    setImportState(prev => ({ ...prev, isImporting: true, error: null }));

    const toastId = toast.loading(
      `Importing ${importState.parsedAccounts.length} account(s)...`
    );

    let successCount = 0;
    const errors: string[] = [];

    try {
      // Import each account sequentially to avoid race conditions
      for (const account of importState.parsedAccounts) {
        try {
          const itemData = avsAccountToFinancialItem(account);
          await dataManager.addItem(
            selectedCase.id,
            "resources",
            itemData as Omit<FinancialItem, "id" | "createdAt" | "updatedAt">
          );
          successCount++;
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
        importedCount: successCount,
      }));

      if (errors.length > 0) {
        toast.warning(
          `Imported ${successCount} of ${importState.parsedAccounts.length} accounts. ${errors.length} failed.`,
          { id: toastId, duration: 5000 }
        );
      } else {
        toast.success(
          `Successfully imported ${successCount} resource(s) from AVS`,
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
    importState.parsedAccounts.length > 0 &&
    !importState.isImporting;

  return {
    importState,
    openImportModal,
    closeImportModal,
    handleInputChange,
    clearInput,
    importAccounts,
    toggleAccountSelection,
    canImport,
  };
}
