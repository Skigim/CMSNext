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
          size="icon"
          onClick={event => {
            event.stopPropagation();
            onDeleteConfirm();
          }}
          aria-label="Confirm delete financial item"
          className="h-8 w-8 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700"
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
  );
}
