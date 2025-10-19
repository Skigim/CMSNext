import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { FinancialItemList } from "../financial/FinancialItemList";
import { FinancialItem, CaseCategory } from "../../types/case";
import { Plus } from "lucide-react";
import { useRef } from "react";

interface CaseSectionProps {
  title: string;
  category: CaseCategory;
  items: FinancialItem[];
  onAddItem: (category: CaseCategory) => void;
  onDeleteItem: (category: CaseCategory, itemId: string) => void;
  onUpdateFullItem?: (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => Promise<void>;
  onCreateItem?: (category: CaseCategory, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export function CaseSection({ 
  title, 
  category, 
  items, 
  onAddItem, 
  onDeleteItem,
  onUpdateFullItem,
  onCreateItem
}: CaseSectionProps) {
  const addSkeletonFnRef = useRef<(() => void) | null>(null);

  const handleAddSkeletonRegistration = (fn: () => void) => {
    addSkeletonFnRef.current = fn;
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <h3 className="text-lg font-medium">{title}</h3>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <FinancialItemList
          items={items}
          itemType={category}
          onDelete={onDeleteItem}
          onUpdate={onUpdateFullItem}
          onCreateItem={onCreateItem}
          onAddSkeleton={handleAddSkeletonRegistration}
          title=""
          showActions={true}
        />
        <Button 
          size="sm" 
          onClick={() => {
            if (addSkeletonFnRef.current) {
              addSkeletonFnRef.current();
            } else {
              onAddItem(category);
            }
          }} 
          className="gap-2 w-full"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          Add {title.slice(0, -1)}
        </Button>
      </CardContent>
    </Card>
  );
}