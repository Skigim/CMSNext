import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AmountHistoryEntry, CaseCategory, FinancialItem } from "../../types/case";
import { getNormalizedFormData, getNormalizedItem } from "../../utils/dataNormalization";
import { getDisplayAmount } from "@/domain/common";
import {
  getAmountInfoForMonth,
  getVerificationStatusInfo,
  shouldShowVerificationSource,
  validateFinancialItem,
} from "@/domain/financials";
import { useSelectedMonth } from "../../contexts/SelectedMonthContext";

export type VerificationStatus = string;

export type NormalizedFinancialItem = ReturnType<typeof getNormalizedItem>;
export type NormalizedFinancialFormData = ReturnType<typeof getNormalizedFormData>;
export type VerificationBadgeInfo = ReturnType<typeof getVerificationStatusInfo>;

interface UseFinancialItemCardStateParams {
  item: FinancialItem;
  itemType: CaseCategory;
  onDelete: (category: CaseCategory, itemId: string) => void;
  onUpdate?: (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => void;
  onAddHistoryEntry?: (
    category: CaseCategory,
    itemId: string,
    entry: Omit<AmountHistoryEntry, "id" | "createdAt">
  ) => Promise<FinancialItem>;
  onUpdateHistoryEntry?: (
    category: CaseCategory,
    itemId: string,
    entryId: string,
    updates: Partial<Omit<AmountHistoryEntry, "id" | "createdAt">>
  ) => Promise<FinancialItem>;
  onDeleteHistoryEntry?: (
    category: CaseCategory,
    itemId: string,
    entryId: string
  ) => Promise<FinancialItem>;
  isSkeleton?: boolean;
  initialIsEditing?: boolean;
}

/** Form validation errors keyed by field name */
export type FormErrors = Record<string, string>;

export interface UseFinancialItemCardStateResult {
  isEditing: boolean;
  confirmingDelete: boolean;
  isSaving: boolean;
  saveSuccessVisible: boolean;
  formErrors: FormErrors;
  normalizedItem: NormalizedFinancialItem;
  normalizedFormData: NormalizedFinancialFormData;
  displayAmount: string;
  /** True if displaying a past entry's amount (no entry covers selected month) */
  isAmountFallback: boolean;
  /** True if falling back to item.amount (no history entries exist) */
  isLegacyFallback: boolean;
  verificationStatus: VerificationBadgeInfo;
  showVerificationSourceField: boolean;
  canUpdateStatus: boolean;
  // History modal
  isHistoryModalOpen: boolean;
  hasAmountHistory: boolean;
  handleOpenHistoryModal: () => void;
  handleCloseHistoryModal: () => void;
  handleAddHistoryEntry: (entry: Omit<AmountHistoryEntry, "id" | "createdAt">) => Promise<void>;
  handleUpdateHistoryEntry: (
    entryId: string,
    updates: Partial<Omit<AmountHistoryEntry, "id" | "createdAt">>
  ) => Promise<void>;
  handleDeleteHistoryEntry: (entryId: string) => Promise<void>;
  // Card actions
  handleCardClick: () => void;
  handleCancelClick: () => void;
  handleSaveClick: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleDeleteClick: () => void;
  handleDeleteConfirm: () => void;
  handleFieldChange: (field: string, value: string | number) => void;
  handleStatusChange: (newStatus: VerificationStatus) => Promise<void>;
}

export function useFinancialItemCardState({
  item,
  itemType,
  onDelete,
  onUpdate,
  onAddHistoryEntry,
  onUpdateHistoryEntry,
  onDeleteHistoryEntry,
  isSkeleton = false,
  initialIsEditing = false,
}: UseFinancialItemCardStateParams): UseFinancialItemCardStateResult {
  const [isEditing, setIsEditing] = useState(initialIsEditing);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [formData, setFormData] = useState<FinancialItem>(item);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessVisible, setSaveSuccessVisible] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get the selected month for displaying the correct amount
  const { selectedMonth } = useSelectedMonth();

  const normalizedItem = useMemo(() => getNormalizedItem(item), [item]);
  const normalizedFormData = useMemo(() => getNormalizedFormData(formData), [formData]);
  
  // Use getAmountInfoForMonth to derive the display amount and fallback status based on selected month
  const amountInfo = useMemo(
    () => getAmountInfoForMonth(item, selectedMonth),
    [item, selectedMonth]
  );
  
  const displayAmount = useMemo(
    () => getDisplayAmount(amountInfo.amount, normalizedItem.frequency, itemType),
    [amountInfo.amount, normalizedItem.frequency, itemType],
  );
  
  const hasAmountHistory = useMemo(
    () => Boolean(item.amountHistory && item.amountHistory.length > 0),
    [item.amountHistory]
  );

  // Get the current entry for the selected month to extract entry-level verification
  const currentEntry = amountInfo.entry;
  
  // Verification is ONLY stored at entry level - no fallback to item level
  // For legacy items with no history entries, show default "Needs VR"
  const verificationStatus = useMemo(
    () => {
      // Use entry-level verification if available, otherwise default status
      const effectiveStatus = currentEntry?.verificationStatus ?? "Needs VR";
      const effectiveSource = currentEntry?.verificationSource ?? undefined;
      return getVerificationStatusInfo(effectiveStatus, effectiveSource);
    },
    [currentEntry],
  );
  const showVerificationSourceField = useMemo(
    () => shouldShowVerificationSource(currentEntry?.verificationStatus ?? "Needs VR", currentEntry?.verificationStatus ?? "Needs VR"),
    [currentEntry?.verificationStatus],
  );
  // Can only update status if there's a current entry to update
  const canUpdateStatus = useMemo(
    () => Boolean(onUpdateHistoryEntry && normalizedItem.safeId && currentEntry),
    [onUpdateHistoryEntry, normalizedItem.safeId, currentEntry],
  );

  useEffect(() => {
    setIsEditing(initialIsEditing);
  }, [initialIsEditing]);

  useEffect(() => {
    if (!isEditing) {
      setFormData(item);
    }
  }, [item, isEditing]);

  // Sync amountHistory even while editing to prevent history modal changes from being overwritten
  // when the form saves. Other fields (description, amount, etc.) should NOT sync while editing
  // to preserve user's in-progress edits.
  useEffect(() => {
    if (isEditing) {
      setFormData(prev => {
        // Only update if the history actually changed (by reference)
        if (prev.amountHistory !== item.amountHistory) {
          return {
            ...prev,
            amountHistory: item.amountHistory,
          };
        }
        return prev;
      });
    }
  }, [item.amountHistory, isEditing]);

  useEffect(() => () => {
    if (saveSuccessTimerRef.current) {
      clearTimeout(saveSuccessTimerRef.current);
    }
  }, []);

  const handleFieldChange = useCallback((field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleSkeletonCancel = useCallback(() => {
    if (normalizedItem.safeId) {
      onDelete(itemType, normalizedItem.safeId);
    }
  }, [itemType, normalizedItem.safeId, onDelete]);

  const handleCancelClick = useCallback(() => {
    setConfirmingDelete(false);

    if (isSkeleton) {
      handleSkeletonCancel();
      return;
    }

    setIsEditing(false);
    setFormData(item);
  }, [handleSkeletonCancel, isSkeleton, item]);

  const handleCardClick = useCallback(() => {
    const canEdit = Boolean(onUpdate) || isSkeleton;

    if (!canEdit) {
      return;
    }

    if (isEditing) {
      handleCancelClick();
      return;
    }

    setFormData(item);
    setIsEditing(true);
    setConfirmingDelete(false);
    setFormErrors({});
  }, [handleCancelClick, isEditing, isSkeleton, item, onUpdate]);

  const handleSaveClick = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!onUpdate || !normalizedItem.safeId) {
        return;
      }

      // Validate using domain function
      const validationResult = validateFinancialItem({
        description: formData.description ?? "",
        amount: formData.amount ?? 0,
        verificationStatus: formData.verificationStatus ?? "",
        verificationSource: formData.verificationSource ?? "",
      });

      if (!validationResult.isValid) {
        setFormErrors(validationResult.errors);
        return;
      }

      setFormErrors({});
      setIsEditing(false);
      setIsSaving(true);

      try {
        await onUpdate(itemType, normalizedItem.safeId, formData);
        setIsSaving(false);
        setSaveSuccessVisible(true);

        if (saveSuccessTimerRef.current) {
          clearTimeout(saveSuccessTimerRef.current);
        }

        saveSuccessTimerRef.current = setTimeout(() => {
          setSaveSuccessVisible(false);
        }, 1200);
      } catch (error) {
        console.error("[FinancialItemCard] Failed to update item:", error);
        setIsSaving(false);
        setSaveSuccessVisible(false);
        setFormData(item);
        setIsEditing(true);
      }
    },
    [formData, item, itemType, normalizedItem.safeId, onUpdate],
  );

  const handleDeleteClick = useCallback(() => {
    setConfirmingDelete(prev => !prev);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (normalizedItem.safeId) {
      onDelete(itemType, normalizedItem.safeId);
    }
    setConfirmingDelete(false);
  }, [itemType, normalizedItem.safeId, onDelete]);

  const handleStatusChange = useCallback(
    async (newStatus: VerificationStatus) => {
      // Verification is stored per-entry, not on the item
      // Update the current entry's verification status
      if (!currentEntry) {
        // No entry exists for current period - user needs to create one via history modal
        console.warn("[FinancialItemCard] Cannot update status - no history entry for current period. Open history modal to create one.");
        return;
      }
      
      if (!onUpdateHistoryEntry || !normalizedItem.safeId) {
        console.warn("[FinancialItemCard] Cannot update status - missing handler or item ID");
        return;
      }
      
      setIsSaving(true);
      try {
        const updates: Partial<Omit<AmountHistoryEntry, "id" | "createdAt">> = {
          verificationStatus: newStatus,
          // Clear verification source if not verified
          verificationSource: newStatus === "Verified" 
            ? currentEntry.verificationSource ?? "" 
            : undefined,
        };
        
        await onUpdateHistoryEntry(itemType, normalizedItem.safeId, currentEntry.id, updates);
        setIsSaving(false);
        setSaveSuccessVisible(true);

        if (saveSuccessTimerRef.current) {
          clearTimeout(saveSuccessTimerRef.current);
        }

        saveSuccessTimerRef.current = setTimeout(() => {
          setSaveSuccessVisible(false);
        }, 1200);
      } catch (error) {
        console.error("[FinancialItemCard] Failed to update entry status:", error);
        setIsSaving(false);
        setSaveSuccessVisible(false);
      }
    },
    [currentEntry, itemType, normalizedItem.safeId, onUpdateHistoryEntry],
  );

  // History modal handlers
  const handleOpenHistoryModal = useCallback(() => {
    setIsHistoryModalOpen(true);
  }, []);

  const handleCloseHistoryModal = useCallback(() => {
    setIsHistoryModalOpen(false);
  }, []);

  const handleAddHistoryEntry = useCallback(
    async (entry: Omit<AmountHistoryEntry, "id" | "createdAt">) => {
      if (!onAddHistoryEntry || !normalizedItem.safeId) {
        console.warn("[FinancialItemCard] Cannot add history entry - missing handler or item ID");
        return;
      }
      
      try {
        await onAddHistoryEntry(itemType, normalizedItem.safeId, entry);
      } catch (error) {
        console.error("[FinancialItemCard] Failed to add history entry:", error);
        throw error;
      }
    },
    [itemType, normalizedItem.safeId, onAddHistoryEntry]
  );

  const handleUpdateHistoryEntry = useCallback(
    async (
      entryId: string,
      updates: Partial<Omit<AmountHistoryEntry, "id" | "createdAt">>
    ) => {
      if (!onUpdateHistoryEntry || !normalizedItem.safeId) {
        console.warn("[FinancialItemCard] Cannot update history entry - missing handler or item ID");
        return;
      }
      
      try {
        await onUpdateHistoryEntry(itemType, normalizedItem.safeId, entryId, updates);
      } catch (error) {
        console.error("[FinancialItemCard] Failed to update history entry:", error);
        throw error;
      }
    },
    [itemType, normalizedItem.safeId, onUpdateHistoryEntry]
  );

  const handleDeleteHistoryEntry = useCallback(
    async (entryId: string) => {
      if (!onDeleteHistoryEntry || !normalizedItem.safeId) {
        console.warn("[FinancialItemCard] Cannot delete history entry - missing handler or item ID");
        return;
      }
      
      try {
        await onDeleteHistoryEntry(itemType, normalizedItem.safeId, entryId);
      } catch (error) {
        console.error("[FinancialItemCard] Failed to delete history entry:", error);
        throw error;
      }
    },
    [itemType, normalizedItem.safeId, onDeleteHistoryEntry]
  );

  return {
    isEditing,
    confirmingDelete,
    isSaving,
    saveSuccessVisible,
    formErrors,
    normalizedItem,
    normalizedFormData,
    displayAmount,
    isAmountFallback: amountInfo.isFallback,
    isLegacyFallback: amountInfo.isLegacyFallback,
    verificationStatus,
    showVerificationSourceField,
    canUpdateStatus,
    // History modal
    isHistoryModalOpen,
    hasAmountHistory,
    handleOpenHistoryModal,
    handleCloseHistoryModal,
    handleAddHistoryEntry,
    handleUpdateHistoryEntry,
    handleDeleteHistoryEntry,
    // Card actions
    handleCardClick,
    handleCancelClick,
    handleSaveClick,
    handleDeleteClick,
    handleDeleteConfirm,
    handleFieldChange,
    handleStatusChange,
  };
}
