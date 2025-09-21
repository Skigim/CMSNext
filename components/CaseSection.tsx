import { useState } from "react";
import { Card, CardContent, CardHeader } from "./ui/card";
import { FinancialItemList } from "./FinancialItemCard";
import { FinancialItemsTable } from "./FinancialItemsTable";
import { ViewToggle } from "./ViewToggle";
import { FinancialItem, CaseCategory } from "../types/case";

interface CaseSectionProps {
  title: string;
  category: CaseCategory;
  items: FinancialItem[];
  onAddItem: (category: CaseCategory) => void;
  onEditItem: (category: CaseCategory, itemId: string) => void;
  onDeleteItem: (category: CaseCategory, itemId: string) => void;
}

export function CaseSection({ 
  title, 
  category, 
  items, 
  onAddItem, 
  onEditItem, 
  onDeleteItem 
}: CaseSectionProps) {
  const [view, setView] = useState<'cards' | 'table'>('cards');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <h3 className="text-lg font-medium">{title}</h3>
        <ViewToggle view={view} onViewChange={setView} />
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
            title=""
            showActions={true}
          />
        )}
      </CardContent>
    </Card>
  );
}