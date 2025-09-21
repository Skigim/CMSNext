import { Card, CardContent, CardHeader } from "./ui/card";
import { FinancialItemList } from "./FinancialItemCard";
import { FinancialItemsTable } from "./FinancialItemsTable";
import { FinancialItem, CaseCategory } from "../types/case";

interface CaseSectionProps {
  title: string;
  category: CaseCategory;
  items: FinancialItem[];
  view: 'cards' | 'table';
  onAddItem: (category: CaseCategory) => void;
  onEditItem: (category: CaseCategory, itemId: string) => void;
  onDeleteItem: (category: CaseCategory, itemId: string) => void;
}

export function CaseSection({ 
  title, 
  category, 
  items, 
  view,
  onAddItem, 
  onEditItem, 
  onDeleteItem 
}: CaseSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <h3 className="text-lg font-medium">{title}</h3>
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