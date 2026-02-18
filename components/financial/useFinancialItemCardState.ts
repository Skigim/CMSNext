import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CaseCategory, FinancialItem } from "../../types/case";
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
  onUpdate?: (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => void | Promise<void>;
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
}: UseFinancialItemCardStateParams): UseFinancialItemCardStateResult {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [formData, setFormData] = useState<FinancialItem>(item);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessVisible, setSaveSuccessVisible] = useState(false);
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
    () => Boolean(normalizedItem.safeId && currentEntry),
    [normalizedItem.safeId, currentEntry],
  );

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

  const handleCancelClick = useCallback(() => {
    setConfirmingDelete(false);
    setIsEditing(false);
    setFormData(item);
  }, [item]);

  const handleCardClick = useCallback(() => {
    const canEdit = Boolean(onUpdate);

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
  }, [handleCancelClick, isEditing, item, onUpdate]);

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
        await Promise.resolve(onUpdate(itemType, normalizedItem.safeId, formData));
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
        // No entry exists for current period - user needs to open edit modal to create one
        console.warn("[FinancialItemCard] Cannot update status - no history entry for current period. Open edit modal to manage history.");
        return;
      }
      
      if (!normalizedItem.safeId) {
        console.warn("[FinancialItemCard] Cannot update status - missing item ID");
        return;
      }
      
      setIsSaving(true);
      try {
        const updatedItem: FinancialItem = {
          ...item,
          amountHistory: item.amountHistory?.map(entry =>
            entry.id === currentEntry.id
              ? {
                  ...entry,
                  verificationStatus: newStatus,
                  // Clear verification source if not verified
                  verificationSource: newStatus === "Verified" 
                    ? entry.verificationSource ?? "" 
                    : undefined,
                }
              : entry
          ) || []
        };

        if (onUpdate) await Promise.resolve(onUpdate(itemType, normalizedItem.safeId, updatedItem));
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
    [currentEntry, itemType, normalizedItem.safeId, onUpdate, item],
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
