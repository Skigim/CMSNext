import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pin, PinOff } from "lucide-react";
import { usePinnedCases } from "@/hooks/usePinnedCases";
import { cn } from "@/lib/utils";

interface PinButtonProps {
  /** Case ID to pin/unpin */
  caseId: string;
  /** Optional case name for dialog copy */
  caseName?: string;
  /** Optional size variant */
  size?: "sm" | "default";
  /** Optional additional className */
  className?: string;
}

/**
 * Reusable pin/unpin button for cases.
 * 
 * Uses usePinnedCases hook internally for state management.
 * Renders a toggle button that shows filled pin when pinned.
 * 
 * @example
 * ```tsx
 * <PinButton caseId={case.id} size="sm" />
 * ```
 */
export function PinButton({ caseId, caseName, size = "sm", className }: PinButtonProps) {
  const { getPinReason, isPinned, pin, unpin } = usePinnedCases();
  const pinned = isPinned(caseId);
  const pinReason = getPinReason(caseId);
  const [isReasonDialogOpen, setIsReasonDialogOpen] = useState(false);
  const [reason, setReason] = useState("");

  const dialogTitle = useMemo(() => {
    if (!caseName?.trim()) {
      return "Pin case";
    }

    return `Pin ${caseName}`;
  }, [caseName]);

  const button = (
    <Button
      variant="ghost"
      size={size === "sm" ? "sm" : "default"}
      onClick={(e) => {
        e.stopPropagation();

        if (pinned) {
          unpin(caseId);
          return;
        }

        setReason("");
        setIsReasonDialogOpen(true);
      }}
      className={cn(
        size === "sm" ? "h-6 w-6 p-0" : "h-8 w-8 p-0",
        pinned
          ? "text-blue-600 hover:text-blue-700"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      aria-label={pinned ? "Unpin case" : "Pin case"}
    >
      {pinned ? (
        <Pin
          className={size === "sm" ? "h-3.5 w-3.5 fill-current" : "h-4 w-4 fill-current"}
        />
      ) : (
        <PinOff className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      )}
    </Button>
  );

  return (
    <>
      {pinned && pinReason ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent className="max-w-xs whitespace-pre-wrap break-words">
            {pinReason}
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}

      <Dialog
        open={isReasonDialogOpen}
        onOpenChange={(open) => {
          setIsReasonDialogOpen(open);
          if (!open) {
            setReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Add an optional reason for pinning this case. This stays attached to the pin
              only and does not create a note.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              pin(caseId, reason);
              setIsReasonDialogOpen(false);
              setReason("");
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`pin-reason-${caseId}`}>Pin reason (optional)</Label>
              <Textarea
                id={`pin-reason-${caseId}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Add an optional reason for pinning this case"
                className="min-h-24"
                maxLength={240}
                autoFocus
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsReasonDialogOpen(false);
                  setReason("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Pin case</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
