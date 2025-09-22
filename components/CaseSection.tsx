import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { FinancialItemList } from "./FinancialItemCard";
import { FinancialItemsTable } from "./FinancialItemsTable";
import { FinancialItem, CaseCategory } from "../types/case";
import { Plus } from "lucide-react";

interface CaseSectionProps {
  title: string;
  category: CaseCategory;
  items: FinancialItem[];
  view: 'cards' | 'table';
  onAddItem: (category: CaseCategory) => void;
  onEditItem: (category: CaseCategory, itemId: string) => void;
  onDeleteItem: (category: CaseCategory, itemId: string) => void;
  onUpdateItem?: (category: CaseCategory, itemId: string, field: string, value: string) => Promise<void>;
}

export function CaseSection({ 
  title, 
  category, 
  items, 
  view,
  onAddItem, 
  onEditItem, 
  onDeleteItem,
  onUpdateItem
}: CaseSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <h3 className="text-lg font-medium">{title}</h3>
        <Button size="sm" onClick={() => onAddItem(category)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {view === 'cards' ? (
          <FinancialItemList
            items={items}
            itemType={category}
            onEdit={onEditItem}
            onDelete={onDeleteItem}
            onAdd={onAddItem}
            title=""
            showActions={true}
          />
        ) : (
          <FinancialItemsTable
            items={items}
            itemType={category}
            onEdit={onEditItem}
            onDelete={onDeleteItem}
            onAdd={onAddItem}
            onUpdateItem={onUpdateItem}
            title=""
            showActions={true}
          />
        )}
      </CardContent>
    </Card>
  );
}