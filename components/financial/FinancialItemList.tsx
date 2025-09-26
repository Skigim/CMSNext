import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import type { CaseCategory, FinancialItem } from "../../types/case";
import { FinancialItemCard } from "./FinancialItemCard";

interface FinancialItemListProps {
  items: FinancialItem[];
  itemType: CaseCategory;
  onDelete: (category: CaseCategory, itemId: string) => void;
  onUpdate?: (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => void;
  onCreateItem?: (
    category: CaseCategory,
    itemData: Omit<FinancialItem, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  title: string;
  showActions?: boolean;
  onAddSkeleton?: (addSkeletonFn: () => void) => void;
}

export function FinancialItemList({
  items = [],
  itemType,
  onDelete,
  onUpdate,
  onCreateItem,
  title,
  showActions = true,
  onAddSkeleton: externalOnAddSkeleton,
}: FinancialItemListProps) {
  const [skeletonCards, setSkeletonCards] = useState<string[]>([]);

  const createSkeletonItem = (id: string): FinancialItem => ({
    id,
    description: "",
    amount: 0,
    verificationStatus: "Needs VR",
    dateAdded: new Date().toISOString(),
  });

  const handleAddSkeleton = () => {
    const skeletonId = `skeleton-${Date.now()}`;
    setSkeletonCards(prev => [...prev, skeletonId]);
  };

  useEffect(() => {
    if (externalOnAddSkeleton) {
      externalOnAddSkeleton(handleAddSkeleton);
    }
  }, [externalOnAddSkeleton]);

  const handleSaveSkeleton = async (skeletonId: string, itemData: FinancialItem) => {
    if (!onCreateItem) return;

    try {
      const { id, createdAt, updatedAt, ...createData } = itemData;
      await onCreateItem(itemType, createData);
      setSkeletonCards(prev => prev.filter(existingId => existingId !== skeletonId));
    } catch (error) {
      console.error("Failed to create item:", error);
    }
  };

  const handleCancelSkeleton = (skeletonId: string) => {
    setSkeletonCards(prev => prev.filter(existingId => existingId !== skeletonId));
  };

  const allItems = [...items, ...skeletonCards.map(id => createSkeletonItem(id))];

  return (
    <div className={title ? "space-y-4" : ""}>
      {title && (
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-medium text-foreground">{title}</h4>
          <Button size="sm" onClick={handleAddSkeleton} className="gap-2">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      )}

      {allItems.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No {itemType} items added yet</p>
        </div>
      ) : (
        <div className="group space-y-2">
          {allItems.map((item, index) => {
            const isSkeleton = typeof item.id === "string" && item.id.startsWith("skeleton-");
            const itemKey = item.id || `${itemType}-${index}`;

            return (
              <FinancialItemCard
                key={itemKey}
                item={item}
                itemType={itemType}
                onDelete={
                  isSkeleton && item.id
                    ? () => handleCancelSkeleton(item.id as string)
                    : onDelete
                }
                onUpdate={
                  isSkeleton
                    ? (_, itemId, updatedItem) => handleSaveSkeleton(itemId, updatedItem)
                    : onUpdate
                }
                showActions={showActions}
                isSkeleton={isSkeleton}
                isEditing={isSkeleton}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
