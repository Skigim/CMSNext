import { memo, useMemo } from "react";
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
const STATUS_COLOR_PALETTE = [
  "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  "bg-red-500/10 text-red-500 border-red-500/20",
  "bg-amber-500/10 text-amber-500 border-amber-500/20",
  "bg-purple-500/10 text-purple-500 border-purple-500/20",
  "bg-slate-500/10 text-slate-500 border-slate-500/20",
];

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
    const map = new Map<string, string>();
    const statuses = config.caseStatuses;

    statuses.forEach((caseStatus, index) => {
      map.set(caseStatus, STATUS_COLOR_PALETTE[index % STATUS_COLOR_PALETTE.length]);
    });

    return map;
  }, [config.caseStatuses]);

  const fallbackStatus = (config.caseStatuses[0] ?? "Pending") as CaseDisplay["status"];
  const effectiveStatus: CaseDisplay["status"] = status ?? fallbackStatus;
  const className = statusPalette.get(effectiveStatus) ?? STATUS_COLOR_PALETTE[0];

  const canChangeStatus = onStatusChange && config.caseStatuses.length > 1;

  if (!canChangeStatus) {
    return (
      <Badge className={className} role="status">
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
            className,
            "cursor-pointer select-none pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
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
            void onStatusChange(value as CaseDisplay["status"]);
          }}
        >
          {config.caseStatuses.map(caseStatus => (
            <DropdownMenuRadioItem key={caseStatus} value={caseStatus}>
              {caseStatus}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
