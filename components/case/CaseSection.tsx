import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { FinancialItemList } from "../financial/FinancialItemList";
import { FinancialItem, CaseCategory } from "../../types/case";
import { Plus } from "lucide-react";
import { useRef } from "react";

import { useFinancialItems } from "../../hooks/useFinancialItems";

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
    deleteFinancialItem 
  } = useFinancialItems(caseId);

  const items = groupedItems[category] || [];

  const addSkeletonFnRef = useRef<(() => void) | null>(null);

  const handleAddSkeletonRegistration = (fn: () => void) => {
    addSkeletonFnRef.current = fn;
  };

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <h3 className="text-lg font-medium">{title}</h3>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <FinancialItemList
          items={items}
          itemType={category}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onCreateItem={handleCreate}
          onAddSkeleton={handleAddSkeletonRegistration}
          title=""
          showActions={true}
        />
        <Button 
          size="sm" 
          onClick={() => {
            if (addSkeletonFnRef.current) {
              addSkeletonFnRef.current();
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