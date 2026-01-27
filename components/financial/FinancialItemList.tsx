import { useState, useCallback } from "react";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import type { AmountHistoryEntry, CaseCategory, FinancialItem } from "../../types/case";
import { FinancialItemCard } from "./FinancialItemCard";
import { FinancialItemStepperModal } from "./FinancialItemStepperModal";

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
  /** Show owner field in stepper modal (for LTC cases) */
  showOwnerField?: boolean;
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
  showOwnerField = false,
}: FinancialItemListProps) {
  const [isStepperOpen, setIsStepperOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinancialItem | undefined>(undefined);

  // ============================================================================
  // Stepper Modal Handlers
  // ============================================================================

  const handleOpenStepperAdd = useCallback(() => {
    setEditingItem(undefined);
    setIsStepperOpen(true);
  }, []);

  const handleOpenStepperEdit = useCallback((item: FinancialItem) => {
    setEditingItem(item);
    setIsStepperOpen(true);
  }, []);

  const handleCloseStepperModal = useCallback(() => {
    setIsStepperOpen(false);
    setEditingItem(undefined);
  }, []);

  const handleStepperSave = useCallback(
    async (itemData: Omit<FinancialItem, "id" | "createdAt" | "updatedAt">) => {
      if (!onCreateItem) return;
      await onCreateItem(itemType, itemData);
    },
    [onCreateItem, itemType]
  );

  const handleStepperUpdate = useCallback(
    async (itemId: string, updates: Partial<FinancialItem>) => {
      if (!onUpdate) return;
      const existingItem = items.find((i) => i.id === itemId);
      if (existingItem) {
        onUpdate(itemType, itemId, { ...existingItem, ...updates } as FinancialItem);
      }
    },
    [onUpdate, itemType, items]
  );

  const handleStepperDelete = useCallback(
    async (itemId: string) => {
      onDelete(itemType, itemId);
    },
    [onDelete, itemType]
  );

  return (
    <div className={title ? "space-y-4" : ""}>
      {title && (
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-medium text-foreground">{title}</h4>
          <Button size="sm" onClick={handleOpenStepperAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No {itemType} items added yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => {
            const itemKey = item.id || `${itemType}-${index}`;

            return (
              <FinancialItemCard
                key={itemKey}
                item={item}
                itemType={itemType}
                onDelete={onDelete}
                onUpdate={onUpdate}
                onAddHistoryEntry={onAddHistoryEntry}
                onUpdateHistoryEntry={onUpdateHistoryEntry}
                onDeleteHistoryEntry={onDeleteHistoryEntry}
                showActions={showActions}
                onOpenStepperEdit={handleOpenStepperEdit}
              />
            );
          })}
        </div>
      )}

      {/* Stepper Modal for Add/Edit */}
      <FinancialItemStepperModal
        isOpen={isStepperOpen}
        onClose={handleCloseStepperModal}
        itemType={itemType}
        item={editingItem}
        showOwnerField={showOwnerField}
        onSave={handleStepperSave}
        onUpdate={handleStepperUpdate}
        onDelete={handleStepperDelete}
      />
    </div>
  );
}
