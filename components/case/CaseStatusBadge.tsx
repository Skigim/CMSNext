import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
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
}

export const CaseStatusBadge = memo(function CaseStatusBadge({ status }: CaseStatusBadgeProps) {
  const { config } = useCategoryConfig();

  const statusPalette = useMemo(() => {
    const map = new Map<string, string>();
    const statuses = config.caseStatuses;

    statuses.forEach((caseStatus, index) => {
      map.set(caseStatus, STATUS_COLOR_PALETTE[index % STATUS_COLOR_PALETTE.length]);
    });

    return map;
  }, [config.caseStatuses]);

  const fallbackStatus = config.caseStatuses[0] ?? "Pending";
  const effectiveStatus: CaseDisplay["status"] = status ?? fallbackStatus;
  const className = statusPalette.get(effectiveStatus) ?? STATUS_COLOR_PALETTE[0];

  return (
    <Badge className={className} role="status">
      {effectiveStatus}
    </Badge>
  );
});
