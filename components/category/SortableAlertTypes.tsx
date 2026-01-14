/**
 * SortableAlertTypes
 * ===================
 * Drag-and-drop sortable list for alert type configurations.
 * Allows reordering alert types to control priority weight calculation.
 *
 * Weight is calculated dynamically based on position using exponential decay.
 * First item (position 0) gets highest weight, last item gets minimum weight.
 *
 * This component is designed to be used inside EditorShell which provides
 * the Save/Revert buttons. It only handles the list editing and reordering.
 */

import { useCallback, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
import { cn } from "../ui/utils";
import { SortableList, DragHandle } from "../common/SortableList";
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
// Main Component
// ============================================================================

export function SortableAlertTypes({
  alertTypes,
  onChange,
  disabled = false,
  showWeights = true,
}: SortableAlertTypesProps) {
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState<ColorSlot>("amber");

  // Check for duplicates
  const duplicateNames = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const item of alertTypes) {
      const normalized = item.name.trim().toLowerCase();
      if (normalized && seen.has(normalized)) {
        duplicates.add(normalized);
      }
      seen.add(normalized);
    }
    return duplicates;
  }, [alertTypes]);

  // Calculate weights for display
  const weights = useMemo(() => {
    return previewWeightDistribution(alertTypes.length, ALERT_WEIGHT_MAX, ALERT_WEIGHT_MIN);
  }, [alertTypes.length]);

  const handleReorder = useCallback(
    (newItems: AlertTypeConfig[]) => {
      // Update sortOrder based on new positions
      const withSortOrder = newItems.map((item, idx) => ({
        ...item,
        sortOrder: idx,
      }));
      onChange(withSortOrder);
    },
    [onChange]
  );

  const handleNameChange = useCallback(
    (index: number, name: string) => {
      const newItems = [...alertTypes];
      newItems[index] = { ...newItems[index], name };
      onChange(newItems);
    },
    [alertTypes, onChange]
  );

  const handleColorChange = useCallback(
    (index: number, colorSlot: ColorSlot) => {
      const newItems = [...alertTypes];
      newItems[index] = { ...newItems[index], colorSlot };
      onChange(newItems);
    },
    [alertTypes, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const newItems = alertTypes.filter((_, i) => i !== index);
      const withSortOrder = newItems.map((item, idx) => ({
        ...item,
        sortOrder: idx,
      }));
      onChange(withSortOrder);
    },
    [alertTypes, onChange]
  );

  const handleAdd = useCallback(() => {
    const trimmedName = draftName.trim();
    if (!trimmedName) return;

    // Check for duplicate
    const normalized = trimmedName.toLowerCase();
    if (alertTypes.some((item) => item.name.trim().toLowerCase() === normalized)) {
      return;
    }

    const newItem: AlertTypeConfig = {
      name: trimmedName,
      colorSlot: draftColor,
      sortOrder: alertTypes.length,
    };

    onChange([...alertTypes, newItem]);

    // Reset draft
    setDraftName("");
    const currentIndex = COLOR_SLOTS.indexOf(draftColor);
    setDraftColor(COLOR_SLOTS[(currentIndex + 1) % COLOR_SLOTS.length]);
  }, [draftName, draftColor, alertTypes, onChange]);

  return (
    <div className="space-y-3">
      {/* Instructions */}
      <div className="text-xs text-muted-foreground">
        Drag to reorder alert types. Position determines priority weight (first = highest).
      </div>

      {/* Weight preview */}
      {showWeights && alertTypes.length > 0 && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
          <span className="font-medium">Weight range:</span>{" "}
          {ALERT_WEIGHT_MAX} (1st) → {ALERT_WEIGHT_MIN} (last)
          {alertTypes.length > 2 && (
            <span className="ml-2">
              ({alertTypes.length} types)
            </span>
          )}
        </div>
      )}

      {/* Sortable list */}
      {alertTypes.length > 0 && (
        <SortableList
          items={alertTypes}
          getItemId={(item) => item.name}
          onReorder={handleReorder}
          disabled={disabled}
          renderItem={(alertType, { isDragging, dragHandleProps, index }) => {
            const isDuplicate = duplicateNames.has(alertType.name.trim().toLowerCase());
            const weight = weights[index] ?? ALERT_WEIGHT_MIN;

            return (
              <div
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border bg-card transition-all",
                  isDragging && "shadow-lg ring-2 ring-primary/20 opacity-90",
                  isDuplicate && "border-destructive",
                  disabled && "opacity-60"
                )}
              >
                {/* Drag handle */}
                <DragHandle
                  {...dragHandleProps}
                  disabled={disabled}
                  label={`Drag to reorder ${alertType.name}`}
                />

                {/* Position badge */}
                <Badge variant="outline" className="text-xs w-6 justify-center">
                  {index + 1}
                </Badge>

                {/* Name input */}
                <Input
                  value={alertType.name}
                  onChange={(e) => handleNameChange(index, e.target.value)}
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
                  onChange={(color) => handleColorChange(index, color)}
                  disabled={disabled}
                />

                {/* Weight indicator */}
                {showWeights && (
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
                        Position {index + 1} of {alertTypes.length}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleRemove(index)}
                  disabled={disabled}
                  aria-label={`Remove ${alertType.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          }}
        />
      )}

      {/* Add new item */}
      <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed bg-muted/30">
        <div className="w-6" /> {/* Spacer for drag handle alignment */}
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
        {showWeights && (
          <Badge variant="secondary" className="text-xs w-12 justify-center font-mono opacity-50">
            —
          </Badge>
        )}
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
      {alertTypes.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No alert types configured. Types will be added automatically when alerts are imported.
        </p>
      )}
    </div>
  );
}
