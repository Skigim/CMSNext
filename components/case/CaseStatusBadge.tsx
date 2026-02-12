import { memo, useMemo, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";
import type { CaseDisplay } from "@/types/case";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { getColorSlotBadgeStyle } from "@/types/colorSlots";
import { getStatusColorSlot } from "@/utils/categoryConfigMigration";

export interface CaseStatusBadgeProps {
  status?: CaseDisplay["status"];
  onStatusChange?: (status: CaseDisplay["status"]) =>
    | Promise<CaseDisplay | null>
    | CaseDisplay
    | null
    | void;
}

export const CaseStatusBadge = memo(function CaseStatusBadge({ status, onStatusChange }: CaseStatusBadgeProps) {
  const { config } = useCategoryConfig();

  const statusPalette = useMemo(() => {
    const map = new Map<string, CSSProperties>();
    
    config.caseStatuses.forEach((statusConfig) => {
      const style = getColorSlotBadgeStyle(statusConfig.colorSlot);
      map.set(statusConfig.name, style);
    });

    return map;
  }, [config.caseStatuses]);

  const fallbackStatus = (config.caseStatuses[0]?.name ?? "Pending") as CaseDisplay["status"];
  const effectiveStatus: CaseDisplay["status"] = status ?? fallbackStatus;
  
  // Get style from the palette, or derive from colorSlot lookup
  const badgeStyle = statusPalette.get(effectiveStatus) 
    ?? getColorSlotBadgeStyle(getStatusColorSlot(config.caseStatuses, effectiveStatus));

  const canChangeStatus = onStatusChange && config.caseStatuses.length > 1;
  const statusNames = config.caseStatuses.map(s => s.name);

  if (!canChangeStatus) {
    return (
      <Badge className="border" style={badgeStyle} role="status">
        {effectiveStatus}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge
          asChild
          className={cn(
            "border cursor-pointer select-none pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
          style={badgeStyle}
        >
          <button
            type="button"
            className="inline-flex items-center gap-1.5"
            aria-label="Change case status"
            aria-haspopup="listbox"
          >
            <span>{effectiveStatus}</span>
            <ChevronDown className="h-3 w-3 opacity-80" aria-hidden="true" />
          </button>
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem]">
        <DropdownMenuLabel>Set status</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={effectiveStatus}
          onValueChange={value => {
            if (!onStatusChange || value === effectiveStatus) {
              return;
            }
            onStatusChange(value as CaseDisplay["status"]);
          }}
        >
          {statusNames.map(statusName => (
            <DropdownMenuRadioItem key={statusName} value={statusName}>
              {statusName}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
