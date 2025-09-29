import { ChevronDown, StickyNote } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { formatAccountNumber } from "../../utils/financialFormatters";
import { cn, interactiveHoverClasses } from "../ui/utils";
import type {
  NormalizedFinancialItem,
  VerificationBadgeInfo,
  VerificationStatus,
} from "./useFinancialItemCardState";

interface FinancialItemCardMetaProps {
  normalizedItem: NormalizedFinancialItem;
  verificationStatus: VerificationBadgeInfo;
  canUpdateStatus: boolean;
  onStatusChange: (status: VerificationStatus) => Promise<void> | void;
}

export function FinancialItemCardMeta({
  normalizedItem,
  verificationStatus,
  canUpdateStatus,
  onStatusChange,
}: FinancialItemCardMetaProps) {
  const truncatedNotes = normalizedItem.notes && normalizedItem.notes.length > 100
    ? `${normalizedItem.notes.substring(0, 100)}...`
    : normalizedItem.notes;

  return (
    <div className="mt-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {normalizedItem.location && <span>{normalizedItem.location}</span>}
        {normalizedItem.accountNumber && <span>{formatAccountNumber(normalizedItem.accountNumber)}</span>}
        {normalizedItem.notes && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <StickyNote className="h-3 w-3 text-muted-foreground/70 transition-colors hover:text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">{truncatedNotes}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            size="sm"
            disabled={!canUpdateStatus}
            onClick={event => event.stopPropagation()}
            className={cn(
              "h-6 px-2 py-1 text-xs transition-all",
              interactiveHoverClasses,
              verificationStatus.colorClass,
            )}
          >
            {verificationStatus.text}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            onClick={event => {
              event.stopPropagation();
              onStatusChange("Needs VR");
            }}
          >
            <MenuOption label="Needs VR" dotClassName="bg-secondary" />
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={event => {
              event.stopPropagation();
              onStatusChange("VR Pending");
            }}
          >
            <MenuOption label="VR Pending" dotClassName="bg-yellow-500" />
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={event => {
              event.stopPropagation();
              onStatusChange("AVS Pending");
            }}
          >
            <MenuOption label="AVS Pending" dotClassName="bg-orange-500" />
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={event => {
              event.stopPropagation();
              onStatusChange("Verified");
            }}
          >
            <MenuOption label="Verified" dotClassName="bg-green-500" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function BadgeDot({ className }: { className: string }) {
  return <div className={`h-2 w-2 rounded-full ${className}`} />;
}

function MenuOption({ label, dotClassName }: { label: string; dotClassName: string }) {
  return (
    <div className="flex items-center gap-2">
      <BadgeDot className={dotClassName} />
      {label}
    </div>
  );
}
