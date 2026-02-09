import { Button } from "../ui/button";
import { Copy } from "lucide-react";
import type { CaseCategory, FinancialItem } from "../../types/case";
import { clickToCopy } from "../../utils/clipboard";
import {
  formatResourceItem,
  formatIncomeItem,
  formatExpenseItem,
} from "../../utils/caseSummaryGenerator";

interface FinancialItemCardActionsProps {
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

  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopyClick}
        aria-label="Copy financial item to clipboard"
        className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Copy className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
