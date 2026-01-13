/**
 * SortableAlertTypes
 * ===================
 * Drag-and-drop sortable list for alert type configurations.
 * Allows reordering alert types to control priority weight calculation.
 *
 * Weight is calculated dynamically based on position using exponential decay.
 * First item (position 0) gets highest weight, last item gets minimum weight.
 */

import { useCallback, useMemo, useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
import { cn } from "../ui/utils";
import type { AlertTypeConfig } from "@/types/categoryConfig";
import { COLOR_SLOTS, type ColorSlot } from "@/types/colorSlots";
import { previewWeightDistribution, ALERT_WEIGHT_MAX, ALERT_WEIGHT_MIN } from "@/domain/alerts/priority";

// ============================================================================
// Types
// ============================================================================

type SortableAlertTypesProps = {
  alertTypes: AlertTypeConfig[];
  onChange: (alertTypes: AlertTypeConfig[]) => void;
  disabled?: boolean;
};

type SortableAlertItemProps = {
  alertType: AlertTypeConfig;
  index: number;
  totalCount: number;
  onNameChange: (name: string) => void;
  onColorChange: (color: ColorSlot) => void;
  onRemove: () => void;
  disabled?: boolean;
  isDuplicate?: boolean;
};

// ============================================================================
// Color Slot Picker (inline)
// ============================================================================

function ColorSlotPicker({
  value,
  onChange,
  disabled,
}: {
  value: ColorSlot;
  onChange: (color: ColorSlot) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {COLOR_SLOTS.slice(0, 5).map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          disabled={disabled}
          className={cn(
            "w-5 h-5 rounded-full border-2 transition-all",
            value === color
              ? "ring-2 ring-offset-1 ring-primary"
              : "hover:scale-110",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          style={{
            backgroundColor: `var(--color-slot-${color})`,
            borderColor: `var(--color-slot-${color}-border)`,
          }}
          aria-label={`Select ${color} color`}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Sortable Item Component
// ============================================================================

function SortableAlertItem({
  alertType,
  index,
  totalCount,
  onNameChange,
  onColorChange,
  onRemove,
  disabled,
  isDuplicate,
}: SortableAlertItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: alertType.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Calculate weight for display
  const weight = useMemo(() => {
    const weights = previewWeightDistribution(
      totalCount,
      ALERT_WEIGHT_MAX,
      ALERT_WEIGHT_MIN
    );
    return weights[index] ?? ALERT_WEIGHT_MIN;
  }, [index, totalCount]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg border bg-card transition-all",
        isDragging && "shadow-lg ring-2 ring-primary/20 z-10 opacity-90",
        isDuplicate && "border-destructive",
        disabled && "opacity-60"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          "cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted touch-none",
          disabled && "cursor-not-allowed"
        )}
        disabled={disabled}
        aria-label={`Drag to reorder ${alertType.name}`}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Position badge */}
      <Badge variant="outline" className="text-xs w-6 justify-center">
        {index + 1}
      </Badge>

      {/* Name input */}
      <Input
        value={alertType.name}
        onChange={(e) => onNameChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "flex-1 h-8",
          isDuplicate && "border-destructive focus-visible:ring-destructive"
        )}
        placeholder="Alert type name"
        aria-label={`Alert type ${index + 1} name`}
      />

      {/* Color picker */}
      <ColorSlotPicker
        value={alertType.colorSlot}
        onChange={onColorChange}
        disabled={disabled}
      />

      {/* Weight indicator */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="text-xs w-12 justify-center font-mono"
          >
            {weight}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Priority weight: {weight} points</p>
          <p className="text-xs text-muted-foreground">
            Position {index + 1} of {totalCount}
          </p>
        </TooltipContent>
      </Tooltip>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${alertType.name}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SortableAlertTypes({
  alertTypes,
  onChange,
  disabled,
}: SortableAlertTypesProps) {
  // Track local order for optimistic UI updates
  const [localItems, setLocalItems] = useState<AlertTypeConfig[]>(alertTypes);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState<ColorSlot>("amber");

  // Sync with external changes
  useEffect(() => {
    setLocalItems(alertTypes);
  }, [alertTypes]);

  // Check for duplicates
  const duplicateNames = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const item of localItems) {
      const normalized = item.name.trim().toLowerCase();
      if (seen.has(normalized)) {
        duplicates.add(normalized);
      }
      seen.add(normalized);
    }
    return duplicates;
  }, [localItems]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = localItems.findIndex((item) => item.name === active.id);
      const newIndex = localItems.findIndex((item) => item.name === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const newItems = arrayMove(localItems, oldIndex, newIndex);
      
      // Update sortOrder based on new positions
      const withSortOrder = newItems.map((item, idx) => ({
        ...item,
        sortOrder: idx,
      }));

      setLocalItems(withSortOrder);
      onChange(withSortOrder);
    },
    [localItems, onChange]
  );

  const handleNameChange = useCallback(
    (index: number, name: string) => {
      const newItems = [...localItems];
      newItems[index] = { ...newItems[index], name };
      setLocalItems(newItems);
      onChange(newItems);
    },
    [localItems, onChange]
  );

  const handleColorChange = useCallback(
    (index: number, colorSlot: ColorSlot) => {
      const newItems = [...localItems];
      newItems[index] = { ...newItems[index], colorSlot };
      setLocalItems(newItems);
      onChange(newItems);
    },
    [localItems, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const newItems = localItems.filter((_, i) => i !== index);
      // Update sortOrder after removal
      const withSortOrder = newItems.map((item, idx) => ({
        ...item,
        sortOrder: idx,
      }));
      setLocalItems(withSortOrder);
      onChange(withSortOrder);
    },
    [localItems, onChange]
  );

  const handleAdd = useCallback(() => {
    const trimmedName = draftName.trim();
    if (!trimmedName) return;

    // Check for duplicate
    const normalized = trimmedName.toLowerCase();
    if (localItems.some((item) => item.name.trim().toLowerCase() === normalized)) {
      return;
    }

    const newItem: AlertTypeConfig = {
      name: trimmedName,
      colorSlot: draftColor,
      sortOrder: localItems.length,
    };

    const newItems = [...localItems, newItem];
    setLocalItems(newItems);
    onChange(newItems);

    // Reset draft
    setDraftName("");
    const currentIndex = COLOR_SLOTS.indexOf(draftColor);
    setDraftColor(COLOR_SLOTS[(currentIndex + 1) % COLOR_SLOTS.length]);
  }, [draftName, draftColor, localItems, onChange]);

  const orderedIds = useMemo(
    () => localItems.map((item) => item.name),
    [localItems]
  );

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <GripVertical className="h-3 w-3" />
        <span>
          Drag to reorder. Position determines priority weight (first = highest).
        </span>
      </div>

      {/* Weight preview */}
      {localItems.length > 0 && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
          <span className="font-medium">Weight range:</span>{" "}
          {ALERT_WEIGHT_MAX} (1st) → {ALERT_WEIGHT_MIN} (last)
          {localItems.length > 2 && (
            <span className="ml-2">
              ({localItems.length} items, exponential decay)
            </span>
          )}
        </div>
      )}

      {/* Sortable list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {localItems.map((alertType, index) => (
              <SortableAlertItem
                key={alertType.name}
                alertType={alertType}
                index={index}
                totalCount={localItems.length}
                onNameChange={(name) => handleNameChange(index, name)}
                onColorChange={(color) => handleColorChange(index, color)}
                onRemove={() => handleRemove(index)}
                disabled={disabled}
                isDuplicate={duplicateNames.has(
                  alertType.name.trim().toLowerCase()
                )}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add new item */}
      <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed bg-muted/30">
        <div className="w-6" /> {/* Spacer for alignment */}
        <Badge variant="outline" className="text-xs w-6 justify-center opacity-50">
          +
        </Badge>
        <Input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          disabled={disabled}
          className="flex-1 h-8"
          placeholder="Add new alert type..."
          aria-label="New alert type name"
        />
        <ColorSlotPicker
          value={draftColor}
          onChange={setDraftColor}
          disabled={disabled}
        />
        <Badge variant="secondary" className="text-xs w-12 justify-center font-mono opacity-50">
          —
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleAdd}
          disabled={disabled || !draftName.trim()}
          aria-label="Add alert type"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Empty state */}
      {localItems.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No alert types configured. Types will be added automatically when alerts are imported.
        </p>
      )}
    </div>
  );
}
