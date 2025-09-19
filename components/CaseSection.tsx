import { Card, CardContent } from "./ui/card";
import { FinancialItemList } from "./FinancialItemCard";
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
  return (
    <Card>
      <CardContent className="p-6">
        <FinancialItemList
          items={items}
          itemType={category}
          onEdit={onEditItem}
          onDelete={onDeleteItem}
          onAdd={onAddItem}
          title={title}
          showActions={true}
        />
      </CardContent>
    </Card>
  );
}