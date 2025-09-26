import { MouseEvent } from "react";
import type { FinancialItem, CaseCategory } from "../../types/case";
import { FinancialItemSaveIndicator } from "./FinancialItemSaveIndicator";
import { FinancialItemCardHeader } from "./FinancialItemCardHeader";
import { FinancialItemCardMeta } from "./FinancialItemCardMeta";
import { FinancialItemCardActions } from "./FinancialItemCardActions";
import { FinancialItemCardForm } from "./FinancialItemCardForm";
import { useFinancialItemCardState } from "./useFinancialItemCardState";

interface FinancialItemCardProps {
  item: FinancialItem;
  itemType: CaseCategory;
  onDelete: (category: CaseCategory, itemId: string) => void;
  onUpdate?: (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => void;
  showActions?: boolean;
  isSkeleton?: boolean;
  isEditing?: boolean;
}

export function FinancialItemCard({
  item,
  itemType,
  onDelete,
  onUpdate,
  showActions = true,
  isSkeleton = false,
  isEditing: initialIsEditing = false,
}: FinancialItemCardProps) {
  const {
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
  } = useFinancialItemCardState({
    item,
    itemType,
    onDelete,
    onUpdate,
    isSkeleton,
    initialIsEditing,
  });

  const formItemId = String(normalizedItem.safeId ?? item.id ?? `financial-item-${itemType}`);

  const onDeleteButtonClick = (_event: MouseEvent<HTMLButtonElement>) => {
    handleDeleteClick();
  };

  const onDeleteConfirm = (_event: MouseEvent<HTMLButtonElement>) => {
    handleDeleteConfirm();
  };

  return (
    <div className={`financial-item-card ${isSkeleton ? "financial-item-card--skeleton" : ""}`}>
      <FinancialItemSaveIndicator isSaving={isSaving} saveSuccessVisible={saveSuccessVisible} />

      <div className="cursor-pointer p-4" onClick={handleCardClick}>
        <FinancialItemCardHeader
          itemType={itemType}
          displayName={normalizedItem.displayName}
          dateAdded={normalizedItem.dateAdded}
          displayAmount={displayAmount}
        />

        <FinancialItemCardMeta
          normalizedItem={normalizedItem}
          verificationStatus={verificationStatus}
          canUpdateStatus={canUpdateStatus}
          onStatusChange={handleStatusChange}
        />
      </div>

      {isEditing && showActions && (
        <div className="absolute -top-2 -right-2 z-10">
          <FinancialItemCardActions
            confirmingDelete={confirmingDelete}
            onDeleteClick={onDeleteButtonClick}
            onDeleteConfirm={onDeleteConfirm}
          />
        </div>
      )}

      <div
        className={`financial-item-form-accordion ${
          isEditing ? "financial-item-form-accordion--open" : "financial-item-form-accordion--closed"
        }`}
      >
        {isEditing && (
          <FinancialItemCardForm
            itemId={formItemId}
            itemType={itemType}
            formData={normalizedFormData}
            onFieldChange={handleFieldChange}
            onCancel={handleCancelClick}
            onSubmit={handleSaveClick}
            showVerificationSource={showVerificationSourceField}
          />
        )}
      </div>
    </div>
  );
}