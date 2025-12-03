import { memo, useCallback, useMemo, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown, Trash2, X } from "lucide-react";
import type { CaseStatus } from "@/types/case";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { getColorSlotBadgeStyle } from "@/types/colorSlots";

export interface BulkActionsToolbarProps {
  selectedCount: number;
  onDeleteSelected: () => Promise<void>;
  onStatusChange: (status: CaseStatus) => Promise<void>;
  onPriorityToggle?: (priority: boolean) => Promise<void>;
  onClearSelection: () => void;
  isDeleting?: boolean;
  isUpdating?: boolean;
  /** Priority state of selected cases: true if all are priority, false if all are not priority, null if mixed */
  selectedPriorityState?: boolean | null;
}

export const BulkActionsToolbar = memo(function BulkActionsToolbar({
  selectedCount,
  onDeleteSelected,
  onStatusChange,
  onPriorityToggle,
  onClearSelection,
  isDeleting = false,
  isUpdating = false,
  selectedPriorityState = null,
}: BulkActionsToolbarProps) {
  const { config } = useCategoryConfig();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const statusPalette = useMemo(() => {
    const map = new Map<string, CSSProperties>();
    config.caseStatuses.forEach((statusConfig) => {
      const style = getColorSlotBadgeStyle(statusConfig.colorSlot);
      map.set(statusConfig.name, style);
    });
    return map;
  }, [config.caseStatuses]);

  const statusNames = useMemo(
    () => config.caseStatuses.map(s => s.name),
    [config.caseStatuses]
  );

  const handleStatusSelect = useCallback(async (status: string) => {
    await onStatusChange(status as CaseStatus);
  }, [onStatusChange]);

  const handleDeleteConfirm = useCallback(async () => {
    setShowDeleteDialog(false);
    await onDeleteSelected();
  }, [onDeleteSelected]);

  const handlePriorityToggle = useCallback(async (checked: boolean) => {
    if (onPriorityToggle) {
      await onPriorityToggle(checked);
    }
  }, [onPriorityToggle]);

  // Show priority toggle only when all selected cases have the same priority state
  const showPriorityToggle = onPriorityToggle && selectedPriorityState !== null;

  if (selectedCount === 0) {
    return null;
  }

  const isDisabled = isDeleting || isUpdating;

  return (
    <>
      <div className="sticky bottom-4 z-10 flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-lg border bg-background/95 px-4 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Badge variant="secondary" className="px-2.5 py-1 text-sm font-medium">
            {selectedCount} selected
          </Badge>

          <div className="h-4 w-px bg-border" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isDisabled}>
                Set status
                <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-[12rem]">
              <DropdownMenuLabel>Change status to</DropdownMenuLabel>
              <DropdownMenuRadioGroup onValueChange={handleStatusSelect}>
                {statusNames.map((status) => (
                  <DropdownMenuRadioItem
                    key={status}
                    value={status}
                    className="cursor-pointer"
                  >
                    <Badge
                      className="mr-2 border"
                      style={statusPalette.get(status)}
                    >
                      {status}
                    </Badge>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {showPriorityToggle && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Switch
                  id="bulk-priority-toggle"
                  checked={selectedPriorityState}
                  onCheckedChange={handlePriorityToggle}
                  disabled={isDisabled}
                />
                <Label
                  htmlFor="bulk-priority-toggle"
                  className="text-sm cursor-pointer"
                >
                  Priority
                </Label>
              </div>
            </>
          )}

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDisabled}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>

          <div className="h-4 w-px bg-border" />

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isDisabled}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} case{selectedCount === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected case{selectedCount === 1 ? '' : 's'} and all associated data including notes and financial items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedCount} case{selectedCount === 1 ? '' : 's'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
