import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
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
  const canToggle = Boolean(onUpdate) || isSkeleton;

  const handleOpenChange = (open: boolean) => {
    if (!canToggle) {
      return;
    }

    if (open && !isEditing) {
      handleCardClick();
    }

    if (!open && isEditing) {
      handleCancelClick();
    }
  };

  return (
    <Collapsible open={isEditing} onOpenChange={handleOpenChange}>
      <Card
        className={`relative overflow-hidden pb-3 transition-shadow ${
          isSkeleton
            ? "border border-dashed border-primary/40 bg-primary/5 opacity-80"
            : "hover:shadow-md"
        }`}
      >
        <FinancialItemSaveIndicator isSaving={isSaving} saveSuccessVisible={saveSuccessVisible} />

        {isEditing && showActions && (
          <div className="absolute right-3 top-3 z-10">
            <FinancialItemCardActions
              confirmingDelete={confirmingDelete}
              onDeleteClick={handleDeleteClick}
              onDeleteConfirm={handleDeleteConfirm}
              item={item}
              itemType={itemType}
            />
          </div>
        )}

        <CardHeader className="flex items-start gap-3">
          <div
            className="cursor-pointer flex-1 space-y-4"
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

          {canToggle && (
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-expanded={isEditing}
                aria-label={isEditing ? "Collapse financial item" : "Expand financial item"}
                className="self-start transition-transform data-[state=open]:rotate-180"
                onClick={event => event.stopPropagation()}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          )}
        </CardHeader>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <CardContent className="bg-muted/30 p-0">
            <FinancialItemCardForm
              itemId={formItemId}
              itemType={itemType}
              formData={normalizedFormData}
              onFieldChange={handleFieldChange}
              onCancel={handleCancelClick}
              onSubmit={handleSaveClick}
              showVerificationSource={showVerificationSourceField}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}