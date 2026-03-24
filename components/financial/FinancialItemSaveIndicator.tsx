import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

type FinancialItemSaveIndicatorProps = Readonly<{
  isSaving: boolean;
  saveSuccessVisible: boolean;
}>;

export function FinancialItemSaveIndicator({ isSaving, saveSuccessVisible }: Readonly<FinancialItemSaveIndicatorProps>) {
  if (!isSaving && !saveSuccessVisible) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute right-4 top-8 z-[5] flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {isSaving ? (
        <Badge
          variant="outline"
          className="h-6 min-w-6 px-1.5 shadow-sm"
        >
          <Spinner aria-hidden="true" className="text-primary/80" size={12} />
          <span className="sr-only">Saving</span>
        </Badge>
      ) : (
        <Badge
          variant="secondary"
          className="h-6 min-w-6 px-1.5 shadow-sm"
        >
          <Check aria-hidden="true" className="h-3 w-3" />
          <span className="sr-only">Saved</span>
        </Badge>
      )}
    </div>
  );
}
