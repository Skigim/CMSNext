import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useDataManagerSafe } from "../contexts/DataManagerContext";
import { validateFinancialItem } from "@/domain/financials";
import type { CaseCategory, StoredCase, FinancialItem } from "../types/case";
import { createLogger } from "@/utils/logger";
import { extractErrorMessage } from "@/utils/errorUtils";

const logger = createLogger("useFinancialItemFlow");

/**
 * Verify that a case still exists in the data manager.
 * @returns error message string if not found, or null on success.
 */
async function verifyCaseExists(
  dataManager: { getAllCases: () => Promise<StoredCase[]> },
  caseId: string,
): Promise<string | null> {
  try {
    const allCases = await dataManager.getAllCases();
    const found = allCases.find((c: StoredCase) => c.id === caseId);
    if (!found) {
      logger.error("Case not found in data manager", {
        requestedCaseId: caseId,
        availableCaseIds: allCases.map((c: StoredCase) => c.id),
        totalCases: allCases.length,
      });
      return `Case not found in data storage. Case ID: ${caseId}`;
    }
    return null;
  } catch (checkError) {
    logger.error("Error checking case existence", { error: extractErrorMessage(checkError) });
    return "Error verifying case data. Please try again.";
  }
}

/**
 * Classify a batch update error into a user-facing message.
 */
function classifyBatchUpdateError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("File was modified by another process")) {
      return "File was modified by another process. Your changes were not saved. Please refresh and try again.";
    }
    if (error.message.includes("Permission denied")) {
      return "Permission denied. Please check that you have write access to the data folder.";
    }
    if (
      error.message.includes("state cached in an interface object") ||
      error.message.includes("state had changed")
    ) {
      return "Data sync issue detected. Please refresh the page and try again.";
    }
  }
  return "Failed to update item. Please try again.";
}

export type ItemFormState = {
  isOpen: boolean;
  category?: CaseCategory;
  item?: FinancialItem;
  caseId?: string;
};

export interface FinancialFormData {
  id: string | null;
  description: string;
  location: string;
  accountNumber: string;
  amount: number;
  frequency: string;
  owner: string;
  verificationStatus: string;
  verificationSource: string;
  notes: string;
  dateAdded: string;
}

export interface FinancialFormErrors {
  [key: string]: string | null;
}

const createEmptyFormData = (): FinancialFormData => ({
  id: null,
  description: "",
  location: "",
  accountNumber: "",
  amount: 0,
  frequency: "monthly",
  owner: "applicant",
  verificationStatus: "Needs VR",
  verificationSource: "",
  notes: "",
  dateAdded: new Date().toISOString(),
});

const createFormDataFromItem = (item: FinancialItem): FinancialFormData => ({
  id: item.id,
  description: item.description || item.name || "",
  location: item.location || "",
  accountNumber: item.accountNumber || "",
  amount: item.amount || 0,
  frequency: item.frequency || "monthly",
  owner: item.owner || "applicant",
  verificationStatus: item.verificationStatus || "Needs VR",
  verificationSource: item.verificationSource || "",
  notes: item.notes || "",
  dateAdded: item.dateAdded || new Date().toISOString(),
});

interface UseFinancialItemFlowParams {
  selectedCase: StoredCase | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

interface UseFinancialItemFlowResult {
  // Modal state
  itemForm: ItemFormState;
  openItemForm: (category: CaseCategory, item?: FinancialItem) => void;
  closeItemForm: () => void;
  
  // Form state
  formData: FinancialFormData;
  formErrors: FinancialFormErrors;
  addAnother: boolean;
  setAddAnother: (value: boolean) => void;
  updateFormField: <K extends keyof FinancialFormData>(field: K, value: FinancialFormData[K]) => void;
  
  // Form validation
  validateForm: () => boolean;
  
  // Form submission
  handleSaveItem: () => Promise<boolean>;
  
  // Direct item operations (for batch/inline edits)
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
  
  // Computed properties
  isEditing: boolean;
}

/**
 * Hook for managing financial item (resource/income/expense/debt) CRUD and modal lifecycle
 * 
 * Orchestrates the complete financial item edit workflow:
 * Open form → Load or create blank → Validate → Save or Delete → Auto-close or reset
 * 
 * **Form State Architecture:**
 * - `itemForm.isOpen`: Modal visibility
 * - `itemForm.category`: Current category (resources|income|expenses|debts)
 * - `itemForm.item`: Item being edited (undefined = create mode)
 * - `formData`: FinancialFormData object with description, amount, verification status, etc.
 * - `formErrors`: Field-level error messages keyed by field name
 * - `addAnother`: Checkbox state (create mode only) - resets form instead of closing
 * 
 * **Form Validation:**
 * - description: Required, non-empty
 * - amount: Number, non-negative
 * - verificationStatus="Verified": Requires verificationSource
 * 
 * **Create vs Edit:**
 * - Create: itemForm.item is undefined, formData initialized empty, "Add Another" checkbox shown
 * - Edit: itemForm.item populated, formData loaded from item, form title reflects "Edit"
 * 
 * **CRUD Operations:**
 * - `handleSaveItem()`: Validates → delegates to dataManager.addItem or updateItem
 * - `handleDeleteItem(category, id)`: Removes item from category
 * - `handleBatchUpdateItem(category, id, partial)`: Partial update for inline edits
 * - `handleCreateItem(category, data)`: Direct creation bypassing form validation
 * 
 * **Usage Example:**
 * ```typescript
 * const flow = useFinancialItemFlow({
 *   selectedCase: caseData,
 *   setError: setErrorMsg
 * });
 * 
 * // Open create form for resources
 * flow.openItemForm("resources");
 * 
 * // User fills form
 * flow.updateFormField("description", "Savings Account");
 * flow.updateFormField("amount", 50000);
 * 
 * // Validate and save
 * const success = await flow.handleSaveItem();
 * if (success) flow.closeItemForm();
 * 
 * // Or open existing item for edit
 * flow.openItemForm("resources", existingResourceItem);
 * ```
 * 
 * **Modal State:**
 * - When `itemForm.isOpen` changes, form resets (loads item or blanks out)
 * - When `itemForm.item` changes, form data syncs automatically via useEffect
 * - Closing modal clears form errors and "add another" state
 * 
 * @param {UseFinancialItemFlowParams} params
 *   - `selectedCase`: Current case context (null = operations disabled)
 *   - `setError`: Parent error state setter for error messaging
 * 
 * @returns {UseFinancialItemFlowResult} Form and operation handlers
 */
export function useFinancialItemFlow({
  selectedCase,
  setError,
}: UseFinancialItemFlowParams): UseFinancialItemFlowResult {
  const dataManager = useDataManagerSafe();
  const [itemForm, setItemForm] = useState<ItemFormState>({ isOpen: false });
  const [formData, setFormData] = useState<FinancialFormData>(createEmptyFormData);
  const [formErrors, setFormErrors] = useState<FinancialFormErrors>({});
  const [addAnother, setAddAnother] = useState(false);

  const isEditing = !!itemForm.item;

  const openItemForm = useCallback(
    (category: CaseCategory, item?: FinancialItem) => {
      if (!selectedCase) {
        return;
      }
      // Initialize form state when opening (avoids setState in useEffect)
      setFormData(item ? createFormDataFromItem(item) : createEmptyFormData());
      setFormErrors({});
      setAddAnother(false);
      setItemForm({
        isOpen: true,
        category,
        caseId: selectedCase.id,
        item,
      });
    },
    [selectedCase],
  );

  const closeItemForm = useCallback(() => {
    setItemForm({ isOpen: false });
  }, []);

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

  const updateFormField = useCallback(<K extends keyof FinancialFormData>(
    field: K,
    value: FinancialFormData[K],
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  }, [formErrors]);

  const validateForm = useCallback((): boolean => {
    // Delegate to domain layer for pure validation logic
    const validationResult = validateFinancialItem({
      description: formData.description,
      amount: formData.amount,
      verificationStatus: formData.verificationStatus,
      verificationSource: formData.verificationSource,
    });

    // Convert domain errors to hook state format
    const newErrors: FinancialFormErrors = {};
    for (const [field, message] of Object.entries(validationResult.errors)) {
      newErrors[field] = message;
    }

    setFormErrors(newErrors);
    return validationResult.isValid;
  }, [formData.description, formData.amount, formData.verificationStatus, formData.verificationSource]);

  const handleSaveItem = useCallback(async (): Promise<boolean> => {
    if (!validateForm()) return false;

    if (!dataManager) {
      setFormErrors({ general: "Data storage is not available. Please check your connection." });
      return false;
    }

    if (!selectedCase || !itemForm.category) {
      setFormErrors({ general: "No case or category selected." });
      return false;
    }

    // Verify case exists in data manager before proceeding
    if (isEditing && formData.id) {
      const verifyError = await verifyCaseExists(dataManager, selectedCase.id);
      if (verifyError) {
        setFormErrors({ general: verifyError });
        return false;
      }
    }

    const itemData = {
      description: formData.description,
      name: formData.description, // For backward compatibility
      location: formData.location,
      accountNumber: formData.accountNumber,
      amount: parseFloat(formData.amount.toString()) || 0,
      frequency: formData.frequency,
      owner: formData.owner,
      verificationStatus: formData.verificationStatus as "Needs VR" | "VR Pending" | "AVS Pending" | "Verified",
      verificationSource: formData.verificationSource,
      notes: formData.notes,
      dateAdded: formData.dateAdded,
    };

    try {
      const categoryLabel = itemForm.category.charAt(0).toUpperCase() + itemForm.category.slice(1);

      if (isEditing && formData.id) {
        await dataManager.updateItem(selectedCase.id, itemForm.category, formData.id, itemData);
        toast.success(`${categoryLabel} item updated successfully`);
      } else {
        await dataManager.addItem(selectedCase.id, itemForm.category, itemData);
        toast.success(`${categoryLabel} item added successfully`);
      }

      if (addAnother && !isEditing) {
        // Reset form for another item
        setFormData(createEmptyFormData());
        setFormErrors({});
        toast.info("Ready to add another item");
        return true; // Success but keep modal open
      }

      closeItemForm();
      return true;
    } catch (error) {
      logger.error("Failed to save financial item", { error: extractErrorMessage(error) });
      const errorMsg = `Failed to ${isEditing ? "update" : "save"} item. Please try again.`;
      setFormErrors({ general: errorMsg });
      toast.error(errorMsg);
      return false;
    }
  }, [
    validateForm,
    dataManager,
    selectedCase,
    itemForm.category,
    isEditing,
    formData,
    addAnother,
    closeItemForm,
  ]);

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
      } catch (error) {
        logger.error("Failed to delete item", { error: extractErrorMessage(error) });
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
      } catch (error) {
        logger.error("Failed to update item", { error: extractErrorMessage(error) });
        const errorMsg = classifyBatchUpdateError(error);

        setError(errorMsg);
        toast.error(errorMsg, { duration: 5000 });
        throw error;
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
      } catch (error) {
        logger.error("Failed to create item", { error: extractErrorMessage(error) });
        const errorMsg = "Failed to create item. Please try again.";
        setError(errorMsg);
        toast.error(errorMsg);
        throw error;
      }
    },
    [dataManager, ensureCaseAndManager, selectedCase, setError],
  );

  return {
    // Modal state
    itemForm,
    openItemForm,
    closeItemForm,
    
    // Form state
    formData,
    formErrors,
    addAnother,
    setAddAnother,
    updateFormField,
    
    // Form validation
    validateForm,
    
    // Form submission
    handleSaveItem,
    
    // Direct item operations
    handleDeleteItem,
    handleBatchUpdateItem,
    handleCreateItem,
    
    // Computed
    isEditing,
  };
}

