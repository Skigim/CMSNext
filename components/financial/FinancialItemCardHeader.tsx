import { Landmark, Receipt, Wallet } from "lucide-react";
import type { CaseCategory } from "../../types/case";

interface FinancialItemCardHeaderProps {
  itemType: CaseCategory;
  displayName?: string | null;
  dateAdded?: string | null;
  displayAmount: string;
}

export function FinancialItemCardHeader({
  itemType,
  displayName,
  dateAdded,
  displayAmount,
}: FinancialItemCardHeaderProps) {
  const icon = getCategoryIcon(itemType);
  const dateLabel = dateAdded ? new Date(dateAdded).toLocaleDateString() : "No date";

  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground truncate">{displayName}</p>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <p className="text-lg font-mono text-foreground whitespace-nowrap">{displayAmount}</p>
      </div>
    </div>
  );
}

function getCategoryIcon(category: CaseCategory) {
  switch (category) {
    case "resources":
      return <Landmark className="h-5 w-5" />;
    case "income":
      return <Wallet className="h-5 w-5" />;
    case "expenses":
      return <Receipt className="h-5 w-5" />;
    default:
      return null;
  }
}
