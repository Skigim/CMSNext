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
          className="financial-item-confirm-btn financial-item-confirm-btn--approve"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={event => {
            event.stopPropagation();
            onDeleteClick();
          }}
          className="financial-item-confirm-btn financial-item-confirm-btn--cancel"
        >
          <X className="h-4 w-4" />
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
      className="financial-item-delete-btn"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
