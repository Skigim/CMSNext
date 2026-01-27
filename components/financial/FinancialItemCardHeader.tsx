import { Landmark, Receipt, Wallet, Clock } from "lucide-react";
import type { CaseCategory } from "../../types/case";
import { formatDateForDisplay } from "@/domain/common";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface FinancialItemCardHeaderProps {
  itemType: CaseCategory;
  displayName?: string | null;
  dateAdded?: string | null;
  displayAmount: string;
  /** True if displaying a past entry's amount (no entry covers selected month) */
  isAmountFallback?: boolean;
}

export function FinancialItemCardHeader({
  itemType,
  displayName,
  dateAdded,
  displayAmount,
  isAmountFallback = false,
}: FinancialItemCardHeaderProps) {
  const icon = getCategoryIcon(itemType);
  const dateLabel = dateAdded ? formatDateForDisplay(dateAdded) : "No date";

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
        <div className="flex items-center gap-1.5">
          {isAmountFallback && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Clock 
                    className="h-4 w-4 text-amber-500" 
                    aria-label="Amount from previous period"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>No entry for selected month. Showing most recent amount.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <p className={`text-lg font-mono whitespace-nowrap ${isAmountFallback ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
            {displayAmount}
          </p>
        </div>
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
