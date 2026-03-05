import type { KeyboardEvent } from "react";
import { Card, CardHeader } from "../ui/card";
import type { FinancialItem, CaseCategory } from "../../types/case";
import { FinancialItemCardHeader } from "./FinancialItemCardHeader";
import { FinancialItemCardMeta } from "./FinancialItemCardMeta";
import { FinancialItemCardActions } from "./FinancialItemCardActions";
import { useFinancialItemCardState } from "./useFinancialItemCardState";

interface FinancialItemCardProps {
  item: FinancialItem;
  itemType: CaseCategory;
  onDelete: (category: CaseCategory, itemId: string) => void;
  onUpdate?: (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => void;
  showActions?: boolean;
  /** Opens stepper modal for editing */
  onOpenStepperEdit: (item: FinancialItem) => void;
}

export function FinancialItemCard({
  item,
  itemType,
  onDelete,
  onUpdate,
  showActions = true,
  onOpenStepperEdit,
}: Readonly<FinancialItemCardProps>) {
  const {
    verificationStatus,
    canUpdateStatus,
    normalizedItem,
    displayAmount,
    isAmountFallback,
    handleStatusChange,
  } = useFinancialItemCardState({
    item,
    itemType,
    onDelete,
    onUpdate,
  });

  // Click handler opens the stepper modal
  const handleEditAction = () => onOpenStepperEdit(item);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      // Only handle when the card itself is focused, not a nested interactive element
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      handleEditAction();
    }
  };

  return (
    <Card
      data-papercut-context="FinancialItemCard"
      className="group relative overflow-visible transition-shadow hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      role="button"
      tabIndex={0}
      aria-label={`Edit ${normalizedItem.displayName || "financial item"}`}
      onClick={handleEditAction}
      onKeyDown={handleKeyDown}
    >
      {/* Floating action buttons - top right corner overlapping card edge */}
      {showActions && (
        <div 
          className="absolute -right-2 -top-2 z-20 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 rounded-md bg-background border shadow-sm"
        >
          <FinancialItemCardActions
            item={item}
            itemType={itemType}
          />
        </div>
      )}

      {/* Display mode - card is always in display mode now */}
      <CardHeader className="!block pb-2">
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
      </CardHeader>
    </Card>
  );
}