/**
 * SortableList
 * ============
 * A reusable drag-and-drop sortable list component using @dnd-kit.
 * 
 * Provides a standardized pattern for sortable lists throughout the application.
 * Used by SortableAlertTypes, SortableSummaryTemplates, and other reorderable lists.
 * 
 * @example
 * ```tsx
 * <SortableList
 *   items={alertTypes}
 *   getItemId={(item) => item.name}
 *   onReorder={(newItems) => setAlertTypes(newItems)}
 *   renderItem={(item, { isDragging, dragHandleProps }) => (
 *     <div className={isDragging ? 'opacity-50' : ''}>
 *       <button {...dragHandleProps}><GripVertical /></button>
 *       <span>{item.name}</span>
 *     </div>
 *   )}
 * />
 * ```
 */

import { useCallback, useMemo, ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "../ui/utils";

// ============================================================================
// Types
// ============================================================================

/**
 * Props passed to the drag handle element
 */
export type DragHandleProps = {
  /** Spread onto the drag handle element */
  attributes: ReturnType<typeof useSortable>["attributes"];
  /** Spread onto the drag handle element */
  listeners: ReturnType<typeof useSortable>["listeners"];
};

/**
 * Render props passed to the item renderer
 */
export type SortableItemRenderProps = {
  /** Whether this item is currently being dragged */
  isDragging: boolean;
  /** Props to spread on the drag handle element */
  dragHandleProps: DragHandleProps;
  /** Index of the item in the list */
  index: number;
  /** Total number of items */
  totalCount: number;
};

export type SortableListProps<T> = {
  /** Array of items to render */
  items: T[];
  /** Function to extract a unique string ID from each item */
  getItemId: (item: T) => string;
  /** Callback when items are reordered */
  onReorder: (newItems: T[]) => void;
  /** Render function for each item */
  renderItem: (item: T, props: SortableItemRenderProps) => ReactNode;
  /** Optional callback when drag starts */
  onDragStart?: (item: T) => void;
  /** Optional callback when drag ends (regardless of reorder) */
  onDragEnd?: (item: T) => void;
  /** Whether the list is disabled */
  disabled?: boolean;
  /** Class name for the list container */
  className?: string;
  /** Class name for individual item wrappers */
  itemClassName?: string;
  /** Minimum distance (px) before drag activates */
  activationDistance?: number;
};

// ============================================================================
// Sortable Item Wrapper
// ============================================================================

type SortableItemWrapperProps<T> = {
  item: T;
  itemId: string;
  index: number;
  totalCount: number;
  renderItem: SortableListProps<T>["renderItem"];
  disabled?: boolean;
  itemClassName?: string;
};

function SortableItemWrapper<T>({
  item,
  itemId,
  index,
  totalCount,
  renderItem,
  disabled,
  itemClassName,
}: SortableItemWrapperProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragHandleProps: DragHandleProps = {
    attributes,
    listeners,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        isDragging && "z-10 relative",
        itemClassName
      )}
    >
      {renderItem(item, {
        isDragging,
        dragHandleProps,
        index,
        totalCount,
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SortableList<T>({
  items,
  getItemId,
  onReorder,
  renderItem,
  onDragStart,
  onDragEnd,
  disabled,
  className,
  itemClassName,
  activationDistance = 8,
}: SortableListProps<T>) {
  // Build stable ID list
  const itemIds = useMemo(
    () => items.map(getItemId),
    [items, getItemId]
  );

  // DnD sensors with configurable activation distance
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: activationDistance,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (onDragStart) {
        const item = items.find((i) => getItemId(i) === event.active.id);
        if (item) onDragStart(item);
      }
    },
    [items, getItemId, onDragStart]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // Call onDragEnd callback
      if (onDragEnd) {
        const item = items.find((i) => getItemId(i) === active.id);
        if (item) onDragEnd(item);
      }

      // Reorder if dropped on different position
      if (over && active.id !== over.id) {
        const oldIndex = itemIds.indexOf(active.id as string);
        const newIndex = itemIds.indexOf(over.id as string);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newItems = arrayMove(items, oldIndex, newIndex);
          onReorder(newItems);
        }
      }
    },
    [items, itemIds, getItemId, onReorder, onDragEnd]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={itemIds}
        strategy={verticalListSortingStrategy}
      >
        <div className={cn("space-y-2", className)}>
          {items.map((item, index) => (
            <SortableItemWrapper
              key={getItemId(item)}
              item={item}
              itemId={getItemId(item)}
              index={index}
              totalCount={items.length}
              renderItem={renderItem}
              disabled={disabled}
              itemClassName={itemClassName}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ============================================================================
// Utility: Standard Drag Handle
// ============================================================================

import { GripVertical } from "lucide-react";

export type DragHandleButtonProps = DragHandleProps & {
  disabled?: boolean;
  label?: string;
  className?: string;
};

/**
 * Standard drag handle button component.
 * Spread dragHandleProps from SortableItemRenderProps onto this.
 */
export function DragHandle({
  attributes,
  listeners,
  disabled,
  label = "Drag to reorder",
  className,
}: DragHandleButtonProps) {
  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted touch-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      disabled={disabled}
      aria-label={label}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
