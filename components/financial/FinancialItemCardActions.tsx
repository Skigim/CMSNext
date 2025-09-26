import { Button } from "../ui/button";
import { Check, Trash2, X } from "lucide-react";

interface FinancialItemCardActionsProps {
  confirmingDelete: boolean;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
}

export function FinancialItemCardActions({
  confirmingDelete,
  onDeleteClick,
  onDeleteConfirm,
}: FinancialItemCardActionsProps) {
  if (confirmingDelete) {
    return (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={event => {
            event.stopPropagation();
            onDeleteConfirm();
          }}
          aria-label="Confirm delete financial item"
          className="financial-item-confirm-btn financial-item-confirm-btn--approve"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={event => {
            event.stopPropagation();
            onDeleteClick();
          }}
          aria-label="Cancel delete financial item"
          className="financial-item-confirm-btn financial-item-confirm-btn--cancel"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={event => {
        event.stopPropagation();
        onDeleteClick();
      }}
      aria-label="Delete financial item"
      className="financial-item-delete-btn"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
