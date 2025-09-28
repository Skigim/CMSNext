import { memo, type HTMLAttributes } from "react";
import { Loader2, ShieldAlert, CheckCircle2, CircleX, HardDrive, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import type { AutosaveStatusSummary, AutosaveStatusState } from "@/hooks/useAutosaveStatus";

const iconByState: Record<AutosaveStatusState, typeof Loader2> = {
  saving: Loader2,
  retrying: Loader2,
  "permission-required": ShieldAlert,
  error: CircleX,
  saved: CheckCircle2,
  idle: HardDrive,
  unsupported: AlertTriangle,
};

const toneClasses: Record<AutosaveStatusSummary["tone"], string> = {
  success: "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  warning: "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  danger: "border-destructive/60 bg-destructive/10 text-destructive",
  info: "border-primary/50 bg-primary/10 text-primary",
  muted: "border-border/60 bg-muted/30 text-muted-foreground",
};

export interface AutosaveStatusBadgeProps extends HTMLAttributes<HTMLDivElement> {
  summary: AutosaveStatusSummary;
  showDetail?: boolean;
}

export const AutosaveStatusBadge = memo(function AutosaveStatusBadge({
  summary,
  showDetail = false,
  className,
  ...rest
}: AutosaveStatusBadgeProps) {
  const Icon = iconByState[summary.state] ?? HardDrive;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2", className)}
      {...rest}
    >
      <Badge
        variant="outline"
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
          toneClasses[summary.tone],
        )}
      >
        <Icon
          aria-hidden
          className={cn(
            "h-3.5 w-3.5",
            summary.showSpinner ? "animate-spin" : undefined,
          )}
        />
        <span>{summary.displayLabel}</span>
      </Badge>

      {showDetail && (
        <span
          className="max-w-xs truncate text-xs text-muted-foreground"
          title={summary.detailText}
        >
          {summary.detailText}
        </span>
      )}
    </div>
  );
});
