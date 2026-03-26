import { useCallback, useMemo, useState } from "react";
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
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pin, PinOff } from "lucide-react";
import { usePinnedCases } from "@/hooks/usePinnedCases";
import { useSubmitShortcut } from "@/hooks/useSubmitShortcut";
import { cn } from "@/lib/utils";
import { MAX_PIN_REASON_LENGTH } from "@/utils/pinnedCaseReason";

const MAX_ACCESSIBLE_PIN_REASON_LENGTH = 80;
const PIN_LIMIT_REACHED_MESSAGE = "Pin limit reached";

function buildPinButtonLabel(isPinned: boolean, pinReason?: string): string {
  if (!isPinned) {
    return "Pin case";
  }

  if (!pinReason) {
    return "Unpin case";
  }

  const accessibleReason =
    pinReason.length > MAX_ACCESSIBLE_PIN_REASON_LENGTH
      ? `${pinReason.slice(0, MAX_ACCESSIBLE_PIN_REASON_LENGTH)}…`
      : pinReason;
  return `Unpin case. Pin reason: ${accessibleReason}`;
}

interface PinButtonProps {
  /** Case ID to pin/unpin */
  readonly caseId: string;
  /** Optional case name for dialog copy */
  readonly caseName?: string;
  /** Optional size variant */
  readonly size?: "sm" | "default";
  /** Optional additional className */
  readonly className?: string;
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
export function PinButton({
  caseId,
  caseName,
  size = "sm",
  className,
}: Readonly<PinButtonProps>) {
  const { canPinMore, getPinReason, isPinned, pin, unpin } = usePinnedCases();
  const pinned = isPinned(caseId);
  const pinReason = getPinReason(caseId);
  const [isReasonDialogOpen, setIsReasonDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const isPinActionDisabled = !pinned && !canPinMore;
  let tooltipContent: string | null = null;
  if (pinned && pinReason) {
    tooltipContent = pinReason;
  } else if (isPinActionDisabled) {
    tooltipContent = PIN_LIMIT_REACHED_MESSAGE;
  }

  const dialogTitle = useMemo(() => {
    if (!caseName?.trim()) {
      return "Pin case";
    }

    return `Pin ${caseName}`;
  }, [caseName]);

  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }

    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform ?? navigator.userAgent ?? "");
  }, []);

  const handleSubmit = useCallback(() => {
    pin(caseId, reason);
    setIsReasonDialogOpen(false);
    setReason("");
  }, [caseId, pin, reason]);

  const handleSubmitShortcut = useSubmitShortcut<HTMLTextAreaElement>({
    onSubmit: handleSubmit,
  });

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
      disabled={isPinActionDisabled}
      className={cn(
        size === "sm" ? "h-6 w-6 p-0" : "h-8 w-8 p-0",
        pinned
          ? "text-blue-600 hover:text-blue-700"
          : "text-muted-foreground hover:text-foreground",
        isPinActionDisabled && "opacity-50 cursor-not-allowed hover:text-muted-foreground",
        className
      )}
      aria-label={buildPinButtonLabel(pinned, pinReason)}
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
      {tooltipContent ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{button}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs whitespace-pre-wrap break-words">
            {tooltipContent}
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
        <DialogContent
          className="sm:max-w-md"
          aria-describedby={`pin-reason-description-${caseId}`}
        >
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription id={`pin-reason-description-${caseId}`}>
              Add an optional reason for pinning this case. This stays attached to the pin
              only and does not create a note.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
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
                maxLength={MAX_PIN_REASON_LENGTH}
                aria-describedby={`pin-reason-description-${caseId}`}
                onKeyDown={handleSubmitShortcut}
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-right">
                Press <Kbd><span className="text-xs">{isMac ? "⌘" : "Ctrl"}</span>+Enter</Kbd> to pin
              </p>
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
