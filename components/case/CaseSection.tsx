import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { FinancialItemList } from "../financial/FinancialItemList";
import { AmountHistoryEntry, FinancialItem, CaseCategory } from "../../types/case";
import { Copy, Plus } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { clickToCopy } from "@/utils/clipboard";
import {
  formatResourceItem,
  formatIncomeItem,
  formatExpenseItem,
} from "@/utils/caseSummaryGenerator";

import { useFinancialItems } from "../../hooks/useFinancialItems";
import { calculateCategoryTotal } from "@/domain/financials";

interface CaseSectionProps {
  title: string;
  category: CaseCategory;
  caseId: string;
}

export function CaseSection({
  title,
  category,
  caseId
}: CaseSectionProps) {
  const {
    groupedItems,
    createFinancialItem,
    updateFinancialItem,
    deleteFinancialItem,
    addAmountHistoryEntry,
    updateAmountHistoryEntry,
    deleteAmountHistoryEntry,
  } = useFinancialItems(caseId);

  const items = useMemo(() => groupedItems[category] || [], [groupedItems, category]);

  const addTriggerRef = useRef<(() => void) | null>(null);

  const handleAddTrigger = useCallback((triggerFn: () => void) => {
    addTriggerRef.current = triggerFn;
  }, []);

  const handleAddClick = useCallback(() => {
    addTriggerRef.current?.();
  }, []);

  const handleDelete = async (cat: CaseCategory, itemId: string) => {
    await deleteFinancialItem(caseId, cat, itemId);
  };

  const handleUpdate = async (cat: CaseCategory, itemId: string, updatedItem: FinancialItem) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, ...data } = updatedItem;
    await updateFinancialItem(caseId, cat, itemId, data);
  };

  const handleCreate = async (cat: CaseCategory, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    await createFinancialItem(caseId, cat, itemData);
  };

  const handleAddHistoryEntry = async (
    cat: CaseCategory,
    itemId: string,
    entry: Omit<AmountHistoryEntry, "id" | "createdAt">
  ) => {
    const result = await addAmountHistoryEntry(cat, itemId, entry);
    if (!result) throw new Error("Failed to add history entry");
    return result;
  };

  const handleUpdateHistoryEntry = async (
    cat: CaseCategory,
    itemId: string,
    entryId: string,
    updates: Partial<Omit<AmountHistoryEntry, "id" | "createdAt">>
  ) => {
    const result = await updateAmountHistoryEntry(cat, itemId, entryId, updates);
    if (!result) throw new Error("Failed to update history entry");
    return result;
  };

  const handleDeleteHistoryEntry = async (
    cat: CaseCategory,
    itemId: string,
    entryId: string
  ) => {
    const result = await deleteAmountHistoryEntry(cat, itemId, entryId);
    if (!result) throw new Error("Failed to delete history entry");
    return result;
  };

  const formatItem = useCallback((item: FinancialItem): string => {
    switch (category) {
      case "resources":
        return formatResourceItem(item);
      case "income":
        return formatIncomeItem(item);
      case "expenses":
        return formatExpenseItem(item);
      default:
        return item.description || "Unknown item";
    }
  }, [category]);

  const handleCopyCategory = useCallback(async () => {
    if (items.length === 0) return;

    const text = items
      .map(item => formatItem(item).trim())
      .filter(Boolean)
      .join("\n");

    await clickToCopy(text, {
      successMessage: `${title} copied to clipboard`,
    });
  }, [items, formatItem, title]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-lg font-medium">{title}</h3>
          {items.length > 0 && (
            <span className="text-sm text-muted-foreground font-normal">
              ${calculateCategoryTotal(items).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyCategory}
              aria-label={`Copy all ${title.toLowerCase()} to clipboard`}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleAddClick}
            aria-label={`Add ${title.toLowerCase().slice(0, -1)}`}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <FinancialItemList
          items={items}
          itemType={category}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onAddHistoryEntry={handleAddHistoryEntry}
          onUpdateHistoryEntry={handleUpdateHistoryEntry}
          onDeleteHistoryEntry={handleDeleteHistoryEntry}
          onCreateItem={handleCreate}
          title=""
          showActions={true}
          onAddTrigger={handleAddTrigger}
        />
      </CardContent>
    </Card>
  );
}