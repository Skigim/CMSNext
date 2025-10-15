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
    <div className="pointer-events-none absolute right-4 top-8 z-[5] flex items-center justify-center">
      {isSaving ? (
        <div
          aria-label="Saving"
          className="h-4 w-4 animate-spin rounded-full border-2 border-primary/40 border-t-primary"
        />
      ) : (
        <div
          aria-label="Saved"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
        >
          <Check className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}
