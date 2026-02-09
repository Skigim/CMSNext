import { useRef } from "react";
import { Card, CardHeader } from "../ui/card";
import type { AmountHistoryEntry, FinancialItem, CaseCategory } from "../../types/case";
import { FinancialItemCardHeader } from "./FinancialItemCardHeader";
import { FinancialItemCardMeta } from "./FinancialItemCardMeta";
import { FinancialItemCardActions } from "./FinancialItemCardActions";
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
  /** Opens stepper modal for editing */
  onOpenStepperEdit: (item: FinancialItem) => void;
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
  onOpenStepperEdit,
}: FinancialItemCardProps) {
  const {
    verificationStatus,
    canUpdateStatus,
    normalizedItem,
    displayAmount,
    isAmountFallback,
    // History modal
    isHistoryModalOpen,
    handleOpenHistoryModal,
    handleCloseHistoryModal,
    handleAddHistoryEntry,
    handleUpdateHistoryEntry,
    handleDeleteHistoryEntry,
    handleStatusChange,
  } = useFinancialItemCardState({
    item,
    itemType,
    onDelete,
    onUpdate,
    onAddHistoryEntry,
    onUpdateHistoryEntry,
    onDeleteHistoryEntry,
  });

  const cardRef = useRef<HTMLDivElement>(null);

  // Click handler opens the stepper modal
  const handleEditAction = () => onOpenStepperEdit(item);

  return (
    <>
      <Card
        ref={cardRef}
        data-papercut-context="FinancialItemCard"
        className="group relative overflow-visible transition-shadow hover:shadow-md"
      >
        {/* Floating action buttons - top right corner overlapping card edge */}
        {showActions && (
          <div 
            className="absolute -right-2 -top-2 z-20 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 rounded-md bg-background border shadow-sm"
          >
            <FinancialItemCardActions
              onHistoryClick={onAddHistoryEntry ? handleOpenHistoryModal : undefined}
              item={item}
              itemType={itemType}
            />
          </div>
        )}

        {/* Display mode - card is always in display mode now */}
        <CardHeader className="!block pb-2">
          <div
            className="min-w-0 cursor-pointer space-y-4"
            onClick={handleEditAction}
            role="button"
            tabIndex={0}
            onKeyDown={event => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleEditAction();
              }
            }}
          >
            <FinancialItemCardHeader
              itemType={itemType}
              displayName={normalizedItem.displayName}
              dateAdded={normalizedItem.dateAdded}
              displayAmount={displayAmount}
              isAmountFallback={isAmountFallback}
            />
            <FinancialItemCardMeta
              normalizedItem={normalizedItem}
              verificationStatus={verificationStatus}
              canUpdateStatus={canUpdateStatus}
              onStatusChange={handleStatusChange}
            />
          </div>
        </CardHeader>
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