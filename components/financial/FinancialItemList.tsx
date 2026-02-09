import { useState, useCallback, useEffect } from "react";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import type { CaseCategory, FinancialItem } from "../../types/case";
import { FinancialItemCard } from "./FinancialItemCard";
import { FinancialItemStepperModal } from "./FinancialItemStepperModal";

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
  /** Show owner field in stepper modal (for LTC cases) */
  showOwnerField?: boolean;
  /** Callback to register the add trigger function for external use */
  onAddTrigger?: (triggerFn: () => void) => void;
}

export function FinancialItemList({
  items = [],
  itemType,
  onDelete,
  onUpdate,
  onCreateItem,
  title,
  showActions = true,
  showOwnerField = false,
  onAddTrigger,
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

  // Register the add trigger for external use
  useEffect(() => {
    if (onAddTrigger) {
      onAddTrigger(handleOpenStepperAdd);
    }
  }, [onAddTrigger, handleOpenStepperAdd]);

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
