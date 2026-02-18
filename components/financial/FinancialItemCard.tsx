import { useRef } from "react";
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

  const cardRef = useRef<HTMLDivElement>(null);

  // Click handler opens the stepper modal
  const handleEditAction = () => onOpenStepperEdit(item);

  return (
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
            item={item}
            itemType={itemType}
          />
        </div>
      )}

      {/* Display mode - card is always in display mode now */}
      <CardHeader className="!block pb-2">
        <button
          type="button"
          className="w-full text-left bg-transparent border-none p-0 min-w-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary rounded-md"
          onClick={handleEditAction}
          aria-label={`Edit ${normalizedItem.displayName || "financial item"}`}
        >
          <FinancialItemCardHeader
            itemType={itemType}
            displayName={normalizedItem.displayName}
            dateAdded={normalizedItem.dateAdded}
            displayAmount={displayAmount}
            isAmountFallback={isAmountFallback}
          />
        </button>
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