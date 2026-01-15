/**
 * SortableStatuses
 * =================
 * Drag-and-drop sortable list for status configurations.
 * Allows reordering statuses to control priority weight calculation.
 *
 * Weight is calculated dynamically based on position using exponential decay.
 * First priority-enabled status gets highest weight, last gets minimum weight.
 *
 * This component is designed to be used inside EditorShell which provides
 * the Save/Revert buttons. It only handles the list editing and reordering.
 */

import { useCallback, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
import { cn } from "../ui/utils";
import { SortableList, DragHandle } from "../common/SortableList";
import type { StatusConfig } from "@/types/categoryConfig";
import { COLOR_SLOTS, type ColorSlot } from "@/types/colorSlots";
import { previewWeightDistribution, STATUS_WEIGHT_MAX, STATUS_WEIGHT_MIN } from "@/domain/alerts/priority";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

// ============================================================================
// Types
// ============================================================================

type SortableStatusesProps = {
  statuses: StatusConfig[];
  onChange: (statuses: StatusConfig[]) => void;
  disabled?: boolean;
  showWeights?: boolean;
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
  onChange: (slot: ColorSlot) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ColorSlot)} disabled={disabled}>
      <SelectTrigger className="w-[52px] px-2" aria-label="Select color">
        <SelectValue>
          <span 
            className="inline-block w-5 h-5 rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: `var(--color-slot-${value})` }}
          />
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[160px]">
        <div className="grid grid-cols-5 gap-1 p-1">
          {COLOR_SLOTS.map(slot => (
            <button
              key={slot}
              type="button"
              onClick={() => onChange(slot)}
              className={cn(
                "w-6 h-6 rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                value === slot && "ring-2 ring-primary ring-offset-2"
              )}
              style={{ backgroundColor: `var(--color-slot-${slot})` }}
              aria-label={slot}
              title={slot}
            />
          ))}
        </div>
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SortableStatuses({
  statuses,
  onChange,
  disabled = false,
  showWeights = true,
}: SortableStatusesProps) {
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState<ColorSlot>("blue");
  const [draftCountsAsCompleted, setDraftCountsAsCompleted] = useState(false);

  // Calculate priority weights for display (non-completed statuses contribute to priority)
  const priorityStatuses = useMemo(
    () => statuses.filter((s) => !s.countsAsCompleted),
    [statuses]
  );
  const weights = useMemo(
    () => previewWeightDistribution(priorityStatuses.length, STATUS_WEIGHT_MAX, STATUS_WEIGHT_MIN),
    [priorityStatuses.length]
  );

  // Validate new status name
  const isDuplicateName = useCallback(
    (name: string) => {
      const normalized = name.trim().toLowerCase();
      return statuses.some((s) => s.name.trim().toLowerCase() === normalized);
    },
    [statuses]
  );

  const canAdd = draftName.trim() !== "" && !isDuplicateName(draftName);

  // Add new status
  const handleAdd = useCallback(() => {
    if (!canAdd) return;

    const newStatus: StatusConfig = {
      name: draftName.trim(),
      colorSlot: draftColor,
      priorityEnabled: true, // Default to true for backwards compatibility
      countsAsCompleted: draftCountsAsCompleted,
      sortOrder: statuses.length, // Append to end
    };

    onChange([...statuses, newStatus]);
    setDraftName("");
    setDraftCountsAsCompleted(false);
    // Cycle to next color
    const currentIndex = COLOR_SLOTS.indexOf(draftColor);
    setDraftColor(COLOR_SLOTS[(currentIndex + 1) % COLOR_SLOTS.length]);
  }, [canAdd, draftName, draftColor, draftCountsAsCompleted, statuses, onChange]);

  // Remove status
  const handleRemove = useCallback(
    (index: number) => {
      const updated = statuses.filter((_, i) => i !== index);
      // Reassign sortOrder sequentially
      const reordered = updated.map((s, i) => ({ ...s, sortOrder: i }));
      onChange(reordered);
    },
    [statuses, onChange]
  );

  // Update status field
  const handleFieldChange = useCallback(
    (index: number, field: keyof StatusConfig, value: unknown) => {
      const updated = statuses.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      );
      onChange(updated);
    },
    [statuses, onChange]
  );

  // Reorder statuses (drag and drop)
  const handleReorder = useCallback(
    (reordered: StatusConfig[]) => {
      // Reassign sortOrder based on new position
      const withSortOrder = reordered.map((s, i) => ({ ...s, sortOrder: i }));
      onChange(withSortOrder);
    },
    [onChange]
  );

  // Get weight for a specific status (completed statuses don't contribute to priority)
  const getStatusWeight = useCallback(
    (status: StatusConfig): number => {
      if (status.countsAsCompleted) return 0;
      const index = priorityStatuses.findIndex((s) => s.name === status.name);
      return index >= 0 && index < weights.length ? weights[index] : 0;
    },
    [priorityStatuses, weights]
  );

  // Format duplicate check error
  const showDuplicateError = useMemo(
    () => draftName.trim() !== "" && isDuplicateName(draftName),
    [draftName, isDuplicateName]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="w-9" aria-label="Drag handle column" />
        <span className="flex-1">Status Name</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="w-[80px] text-center cursor-help underline decoration-dotted">
              Completed
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p>Check if this status counts toward "cases processed" metrics. Completed statuses are excluded from priority scoring.</p>
          </TooltipContent>
        </Tooltip>
        {showWeights && <span className="w-[70px] text-right">Weight</span>}
        <span className="w-[52px]" aria-label="Color column" />
        <span className="w-9" aria-label="Remove button column" />
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 text-sm rounded-lg bg-muted/50">
        <div className="flex-1">
          <p className="font-medium mb-1">Priority Queue Ordering</p>
          <p className="text-xs text-muted-foreground">
            Drag to reorder statuses. Position determines priority weight (first = highest).
            Completed statuses are excluded from the Today's Work widget priority scoring.
          </p>
        </div>
      </div>

      {/* Sortable list */}
      <SortableList
        items={statuses}
        getItemId={(status) => status.name}
        onReorder={handleReorder}
        disabled={disabled}
        renderItem={(status, { isDragging, dragHandleProps, index }) => {
          const weight = getStatusWeight(status);
          return (
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-md bg-background border",
              isDragging && "shadow-lg ring-2 ring-primary/20 opacity-90"
            )}>
              <DragHandle {...dragHandleProps} disabled={disabled} label={`Drag to reorder ${status.name}`} />
              <Input
                value={status.name}
                onChange={(e) => handleFieldChange(index, "name", e.target.value)}
                disabled={disabled}
                className="flex-1"
                aria-label={`Status name ${index + 1}`}
              />
              <div className="w-[80px] flex justify-center">
                <Checkbox
                  checked={status.countsAsCompleted ?? false}
                  onCheckedChange={(checked) =>
                    handleFieldChange(index, "countsAsCompleted", checked === true)
                  }
                  disabled={disabled}
                  aria-label={`Mark ${status.name} as completed`}
                />
              </div>
              {showWeights && (
                <div className="w-[70px] text-right text-sm tabular-nums">
                  {weight > 0 ? (
                    <Badge variant="outline" className="font-mono text-xs">
                      {weight}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              )}
              <ColorSlotPicker
                value={status.colorSlot}
                onChange={(color) => handleFieldChange(index, "colorSlot", color)}
                disabled={disabled}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                aria-label={`Remove ${status.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        }}
      />

      {/* Add new status row */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-dashed">
          <div className="w-9" /> {/* Spacer for drag handle */}
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canAdd) {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Add new status..."
            disabled={disabled}
            className="flex-1"
            aria-label="New status name"
          />
          <div className="w-[80px] flex justify-center">
            <Checkbox
              checked={draftCountsAsCompleted}
              onCheckedChange={(checked) => setDraftCountsAsCompleted(checked === true)}
              disabled={disabled}
              aria-label="New status counts as completed"
            />
          </div>
          {showWeights && <div className="w-[70px]" />}
          <ColorSlotPicker value={draftColor} onChange={setDraftColor} disabled={disabled} />
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd || disabled}
            size="icon"
            variant="ghost"
            aria-label="Add status"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {showDuplicateError && (
          <p className="text-xs text-destructive ml-11">
            A status with this name already exists.
          </p>
        )}
      </div>
    </div>
  );
}
