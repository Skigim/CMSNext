import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CaseCategory, FinancialItem } from "../../types/case";
import { getNormalizedFormData, getNormalizedItem } from "../../utils/dataNormalization";
import { getDisplayAmount } from "../../utils/financialFormatters";
import {
  getVerificationStatusInfo,
  shouldShowVerificationSource,
  updateVerificationStatus,
} from "../../utils/verificationStatus";

export type VerificationStatus = "Needs VR" | "VR Pending" | "AVS Pending" | "Verified";

export type NormalizedFinancialItem = ReturnType<typeof getNormalizedItem>;
export type NormalizedFinancialFormData = ReturnType<typeof getNormalizedFormData>;
export type VerificationBadgeInfo = ReturnType<typeof getVerificationStatusInfo>;

interface UseFinancialItemCardStateParams {
  item: FinancialItem;
  itemType: CaseCategory;
  onDelete: (category: CaseCategory, itemId: string) => void;
  onUpdate?: (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => void;
  isSkeleton?: boolean;
  initialIsEditing?: boolean;
}

export interface UseFinancialItemCardStateResult {
  isEditing: boolean;
  confirmingDelete: boolean;
  isSaving: boolean;
  saveSuccessVisible: boolean;
  normalizedItem: NormalizedFinancialItem;
  normalizedFormData: NormalizedFinancialFormData;
  displayAmount: string;
  verificationStatus: VerificationBadgeInfo;
  showVerificationSourceField: boolean;
  canUpdateStatus: boolean;
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
  isSkeleton = false,
  initialIsEditing = false,
}: UseFinancialItemCardStateParams): UseFinancialItemCardStateResult {
  const [isEditing, setIsEditing] = useState(initialIsEditing);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [formData, setFormData] = useState<FinancialItem>(item);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessVisible, setSaveSuccessVisible] = useState(false);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedItem = useMemo(() => getNormalizedItem(item), [item]);
  const normalizedFormData = useMemo(() => getNormalizedFormData(formData), [formData]);
  const displayAmount = useMemo(
    () => getDisplayAmount(normalizedItem.amount, normalizedItem.frequency, itemType),
    [normalizedItem.amount, normalizedItem.frequency, itemType],
  );
  const verificationStatus = useMemo(
    () => getVerificationStatusInfo(normalizedItem.verificationStatus, normalizedItem.verificationSource),
    [normalizedItem.verificationStatus, normalizedItem.verificationSource],
  );
  const showVerificationSourceField = useMemo(
    () => shouldShowVerificationSource(item.verificationStatus, formData.verificationStatus),
    [formData.verificationStatus, item.verificationStatus],
  );
  const canUpdateStatus = useMemo(
    () => Boolean(onUpdate && normalizedItem.safeId),
    [onUpdate, normalizedItem.safeId],
  );

  useEffect(() => {
    setIsEditing(initialIsEditing);
  }, [initialIsEditing]);

  useEffect(() => {
    if (!isEditing) {
      setFormData(item);
    }
  }, [item, isEditing]);

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

  const handleCardClick = useCallback(() => {
    if (isEditing) {
      return;
    }

    if (onUpdate) {
      setFormData(item);
      setIsEditing(true);
      setConfirmingDelete(false);
    }
  }, [isEditing, item, onUpdate]);

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

  const handleSaveClick = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!onUpdate || !normalizedItem.safeId) {
        return;
      }

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
      if (!onUpdate || !normalizedItem.safeId) {
        return;
      }

      try {
        const updatedItem = updateVerificationStatus(item, newStatus);
        await onUpdate(itemType, normalizedItem.safeId, updatedItem);
      } catch (error) {
        console.error("[FinancialItemCard] Failed to update verification status:", error);
      }
    },
    [item, itemType, normalizedItem.safeId, onUpdate],
  );

  return {
    isEditing,
    confirmingDelete,
    isSaving,
    saveSuccessVisible,
    normalizedItem,
    normalizedFormData,
    displayAmount,
    verificationStatus,
    showVerificationSourceField,
    canUpdateStatus,
    handleCardClick,
    handleCancelClick,
    handleSaveClick,
    handleDeleteClick,
    handleDeleteConfirm,
    handleFieldChange,
    handleStatusChange,
  };
}
