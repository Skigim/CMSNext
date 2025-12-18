import { useRef, useEffect } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import type { AmountHistoryEntry, FinancialItem, CaseCategory } from "../../types/case";
import { FinancialItemSaveIndicator } from "./FinancialItemSaveIndicator";
import { FinancialItemCardHeader } from "./FinancialItemCardHeader";
import { FinancialItemCardMeta } from "./FinancialItemCardMeta";
import { FinancialItemCardActions } from "./FinancialItemCardActions";
import { FinancialItemCardForm } from "./FinancialItemCardForm";
import { AmountHistoryModal } from "./AmountHistoryModal";
import { useFinancialItemCardState } from "./useFinancialItemCardState";

interface FinancialItemCardProps {
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
  showActions?: boolean;
  isSkeleton?: boolean;
  isEditing?: boolean;
}

export function FinancialItemCard({
  item,
  itemType,
  onDelete,
  onUpdate,
  onAddHistoryEntry,
  onUpdateHistoryEntry,
  onDeleteHistoryEntry,
  showActions = true,
  isSkeleton = false,
  isEditing: initialIsEditing = false,
}: FinancialItemCardProps) {
  const {
    isEditing,
    isSaving,
    saveSuccessVisible,
    normalizedItem,
    normalizedFormData,
    displayAmount,
    verificationStatus,
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
    handleFieldChange,
    handleStatusChange,
  } = useFinancialItemCardState({
    item,
    itemType,
    onDelete,
    onUpdate,
    onAddHistoryEntry,
    onUpdateHistoryEntry,
    onDeleteHistoryEntry,
    isSkeleton,
    initialIsEditing,
  });

  const formItemId = String(normalizedItem.safeId ?? item.id ?? `financial-item-${itemType}`);
  const canToggle = Boolean(onUpdate) || isSkeleton;
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to card when entering edit mode
  useEffect(() => {
    if (isEditing && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isEditing]);

  return (
    <>
      <Card
        ref={cardRef}
        data-papercut-context="FinancialItemCard"
        className={`group relative overflow-visible transition-shadow ${
          isSkeleton
            ? "border border-dashed border-primary/40 bg-primary/5 opacity-80"
            : "hover:shadow-md"
        }`}
      >
        <FinancialItemSaveIndicator isSaving={isSaving} saveSuccessVisible={saveSuccessVisible} />

        {/* Floating action buttons - top right corner overlapping card edge */}
        {showActions && (
          <div 
            className="absolute -right-2 -top-2 z-20 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 data-[visible=true]:opacity-100 rounded-md bg-background border shadow-sm" 
            data-visible={isEditing}
          >
            <FinancialItemCardActions
              onEditClick={canToggle ? handleCardClick : undefined}
              onHistoryClick={onAddHistoryEntry ? handleOpenHistoryModal : undefined}
              item={item}
              itemType={itemType}
            />
          </div>
        )}

        {/* Display mode - show card summary */}
        {!isEditing && (
          <CardHeader className="!block pb-2">
            <div
              className="min-w-0 cursor-pointer space-y-4"
              onClick={() => {
                if (!canToggle) return;
                handleCardClick();
              }}
              role={canToggle ? "button" : undefined}
              tabIndex={canToggle ? 0 : undefined}
              onKeyDown={event => {
                if (!canToggle) return;
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleCardClick();
                }
              }}
            >
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
          </CardHeader>
        )}

        {/* Edit mode - show form only */}
        {isEditing && (
          <CardContent className="p-0">
            <FinancialItemCardForm
              itemId={formItemId}
              itemType={itemType}
              formData={normalizedFormData}
              onFieldChange={handleFieldChange}
              onCancel={handleCancelClick}
              onSubmit={handleSaveClick}
              hasAmountHistory={hasAmountHistory}
              onOpenHistoryModal={onAddHistoryEntry ? handleOpenHistoryModal : undefined}
            />
          </CardContent>
        )}
      </Card>

      {/* Amount History Modal */}
      {onAddHistoryEntry && (
        <AmountHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={handleCloseHistoryModal}
          item={item}
          itemType={itemType}
          onAddEntry={handleAddHistoryEntry}
          onUpdateEntry={handleUpdateHistoryEntry}
          onDeleteEntry={handleDeleteHistoryEntry}
          onDeleteItem={async () => {
            onDelete(itemType, normalizedItem.safeId);
          }}
        />
      )}
    </>
  );
}