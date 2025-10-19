import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import type { CaseCategory, FinancialItem } from "../../types/case";
import { FinancialItemCard } from "./FinancialItemCard";

interface FinancialItemGridProps {
  items: FinancialItem[];
  itemType: CaseCategory;
  onDelete: (category: CaseCategory, itemId: string) => void;
  onAdd: (category: CaseCategory) => void;
  onUpdate?: (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => void;
  title: string;
  showActions?: boolean;
  columns?: "auto" | 1 | 2 | 3 | 4;
}

export function FinancialItemGrid({
  items = [],
  itemType,
  onDelete,
  onAdd,
  onUpdate,
  title,
  showActions = true,
  columns = "auto",
}: FinancialItemGridProps) {
  const getGridClass = () => {
    if (columns === "auto") return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
    return `grid-cols-${columns}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-foreground">{title}</h4>
        <Button size="sm" onClick={() => onAdd(itemType)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No {itemType} items added yet</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAdd(itemType)}
            className="mt-3"
          >
            Add First Item
          </Button>
        </div>
      ) : (
        <div className={`group grid ${getGridClass()} gap-3`}>
          {items.map((item, index) => {
            const itemKey = item.id || `${itemType}-${index}`;
            return (
              <FinancialItemCard
                key={itemKey}
                item={item}
                itemType={itemType}
                onDelete={onDelete}
                onUpdate={onUpdate}
                showActions={showActions}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
