import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import type { CaseDisplay } from "@/types/case";

const STATUS_STYLES: Record<CaseDisplay["status"], string> = {
  Pending: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Denied: "bg-red-500/10 text-red-500 border-red-500/20",
  Spenddown: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

export interface CaseStatusBadgeProps {
  status?: CaseDisplay["status"];
}

export const CaseStatusBadge = memo(function CaseStatusBadge({ status }: CaseStatusBadgeProps) {
  const effectiveStatus: CaseDisplay["status"] = status ?? "Pending";
  const className = STATUS_STYLES[effectiveStatus] ?? STATUS_STYLES.Pending;

  return (
    <Badge className={className} role="status">
      {effectiveStatus}
    </Badge>
  );
});
