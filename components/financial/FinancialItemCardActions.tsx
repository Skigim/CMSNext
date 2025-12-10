import { Button } from "../ui/button";
import { Check, Copy, Pencil, Trash2, X } from "lucide-react";
import type { CaseCategory, FinancialItem } from "../../types/case";
import { clickToCopy } from "../../utils/clipboard";
import {
  formatResourceItem,
  formatIncomeItem,
  formatExpenseItem,
} from "../../utils/caseSummaryGenerator";

interface FinancialItemCardActionsProps {
  confirmingDelete: boolean;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onEditClick?: () => void;
  item: FinancialItem;
  itemType: CaseCategory;
}

function formatFinancialItem(item: FinancialItem, itemType: CaseCategory): string {
  switch (itemType) {
    case "resources":
      return formatResourceItem(item);
    case "income":
      return formatIncomeItem(item);
    case "expenses":
      return formatExpenseItem(item);
    default:
      return item.description || "Unknown item";
  }
}

export function FinancialItemCardActions({
  confirmingDelete,
  onDeleteClick,
  onDeleteConfirm,
  onEditClick,
  item,
  itemType,
}: FinancialItemCardActionsProps) {
  const handleCopyClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    const text = formatFinancialItem(item, itemType);
    await clickToCopy(text, {
      successMessage: "Financial item copied to clipboard",
    });
  };

  if (confirmingDelete) {
    return (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={event => {
            event.stopPropagation();
            onDeleteConfirm();
          }}
          aria-label="Confirm delete financial item"
          className="h-8 w-8 text-green-600 hover:bg-green-100 hover:text-green-700"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={event => {
            event.stopPropagation();
            onDeleteClick();
          }}
          aria-label="Cancel delete financial item"
          className="h-8 w-8 text-destructive hover:bg-destructive/10"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-1">
      {onEditClick && (
        <Button
          variant="ghost"
          size="icon"
          onClick={event => {
            event.stopPropagation();
            onEditClick();
          }}
          aria-label="Edit financial item"
          className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopyClick}
        aria-label="Copy financial item to clipboard"
        className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Copy className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={event => {
          event.stopPropagation();
          onDeleteClick();
        }}
        aria-label="Delete financial item"
        className="h-8 w-8 text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
