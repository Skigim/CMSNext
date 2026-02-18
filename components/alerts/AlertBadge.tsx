import { memo } from "react";
import { cn } from "@/components/ui/utils";
import { filterOpenAlerts, type AlertWithMatch } from "@/utils/alertsData";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getAlertDisplayDescription, getAlertDueDateInfo } from "@/utils/alertDisplay";

export interface AlertBadgeProps {
  alerts: AlertWithMatch[];
  className?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
  onClick?: () => void;
}

export const AlertBadge = memo(function AlertBadge({ alerts, className, size = "sm", showLabel = true, onClick }: AlertBadgeProps) {
  const activeAlerts = filterOpenAlerts(alerts);

  if (activeAlerts.length === 0) {
    return null;
  }

  const count = activeAlerts.length;

  const sortedAlerts = [...activeAlerts].sort((a, b) => {
    const getTimestamp = (alert: AlertWithMatch) => {
      const raw = alert.alertDate ?? alert.createdAt ?? null;
      if (!raw) {
        return Number.POSITIVE_INFINITY;
      }

      const date = new Date(raw);
      const timestamp = date.getTime();
      return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
    };

    return getTimestamp(a) - getTimestamp(b);
  });

  const tooltipAlerts = sortedAlerts.slice(0, 5);
  const additionalCount = count - tooltipAlerts.length;

  const sizeClasses = size === "sm"
    ? "text-[11px] px-2 py-0.5"
    : "text-sm px-3 py-1";

  const badge = (
    <button
      type="button"
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-700 font-medium transition-all hover:border-amber-400/60 hover:bg-amber-400/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        sizeClasses,
        className,
      )}
      aria-label={`${count} alert${count === 1 ? "" : "s"}`}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      <span className="inline-flex h-2 w-2 rounded-full bg-current opacity-70" aria-hidden />
      <span>{count}</span>
      {showLabel && <span className="uppercase tracking-wide">Alerts</span>}
    </button>
  );

  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs space-y-2">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alert details</p>
            <ul className="space-y-1 text-xs leading-snug text-foreground">
              {tooltipAlerts.map(alert => {
                const description = getAlertDisplayDescription(alert);
                const { label, hasDate } = getAlertDueDateInfo(alert);
                const dueLabel = hasDate ? `Due ${label}` : label;

                return (
                  <li key={alert.id} className="space-y-0.5">
                    <p className="font-medium text-foreground">{description}</p>
                    <p className="text-[11px] text-muted-foreground">{dueLabel}</p>
                  </li>
                );
              })}
            </ul>
            {additionalCount > 0 && (
              <p className="text-[11px] text-muted-foreground/80">
                +{additionalCount} more alert{additionalCount === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
