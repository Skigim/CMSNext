import { Check } from "lucide-react";

interface FinancialItemSaveIndicatorProps {
  isSaving: boolean;
  saveSuccessVisible: boolean;
}

export function FinancialItemSaveIndicator({ isSaving, saveSuccessVisible }: FinancialItemSaveIndicatorProps) {
  if (!isSaving && !saveSuccessVisible) {
    return null;
  }

  return (
    <div className="financial-item-save-indicator">
      {isSaving ? (
        <div className="financial-item-save-indicator__spinner" aria-label="Saving" />
      ) : (
        <div className="financial-item-save-indicator__success" aria-label="Saved">
          <Check className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}
