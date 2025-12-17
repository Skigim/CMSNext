import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import type { AmountHistoryEntry, CaseCategory, FinancialItem } from "../../types/case";
import { FinancialItemCard } from "./FinancialItemCard";

interface FinancialItemListProps {
  items: FinancialItem[];
  itemType: CaseCategory;
  onDelete: (category: CaseCategory, itemId: string) => void;
  onUpdate?: (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => void;
  onAddHistoryEntry?: (
    category: CaseCategory,
    itemId: string,
    entry: Omit<AmountHistoryEntry, "id" | "createdAt">
  ) => Promise<FinancialItem>;
  onUpdateHistoryEntry?: (
    category: CaseCategory,
    itemId: string,
    entryId: string,
    updates: Partial<Omit<AmountHistoryEntry, "id" | "createdAt">>
  ) => Promise<FinancialItem>;
  onDeleteHistoryEntry?: (
    category: CaseCategory,
    itemId: string,
    entryId: string
  ) => Promise<FinancialItem>;
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
  onAddHistoryEntry,
  onUpdateHistoryEntry,
  onDeleteHistoryEntry,
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
      const createData: Omit<FinancialItem, "id" | "createdAt" | "updatedAt"> = {
        description: itemData.description,
        amount: itemData.amount,
        verificationStatus: itemData.verificationStatus,
        dateAdded: itemData.dateAdded,
        name: itemData.name,
        location: itemData.location,
        accountNumber: itemData.accountNumber,
        frequency: itemData.frequency,
        owner: itemData.owner,
        verificationSource: itemData.verificationSource,
        notes: itemData.notes,
        status: itemData.status,
      };
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
        <div className="space-y-2">
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
                onAddHistoryEntry={isSkeleton ? undefined : onAddHistoryEntry}
                onUpdateHistoryEntry={isSkeleton ? undefined : onUpdateHistoryEntry}
                onDeleteHistoryEntry={isSkeleton ? undefined : onDeleteHistoryEntry}
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
