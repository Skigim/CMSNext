import { memo } from "react";
import { cn } from "@/components/ui/utils";
import { filterOpenAlerts, type AlertWithMatch } from "@/utils/alertsData";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface AlertBadgeProps {
  alerts: AlertWithMatch[];
  className?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export const AlertBadge = memo(function AlertBadge({ alerts, className, size = "sm", showLabel = true }: AlertBadgeProps) {
  const activeAlerts = filterOpenAlerts(alerts);

  if (activeAlerts.length === 0) {
    return null;
  }

  const count = activeAlerts.length;

  const groupedAlertsMap = new Map<string, { description: string; count: number }>();
  activeAlerts.forEach(alert => {
    const rawDescription = alert.description?.trim();
    const description = rawDescription && rawDescription.length > 0 ? rawDescription : "No description provided";
    const key = description.toLowerCase();
    const existing = groupedAlertsMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groupedAlertsMap.set(key, { description, count: 1 });
    }
  });

  const groupedAlerts = Array.from(groupedAlertsMap.values());
  const tooltipAlerts = groupedAlerts.slice(0, 5);
  const displayedAlertCount = tooltipAlerts.reduce((sum, group) => sum + group.count, 0);
  const additionalCount = count - displayedAlertCount;

  const sizeClasses = size === "sm"
    ? "text-[11px] px-2 py-0.5"
    : "text-sm px-3 py-1";

  const badge = (
    <span
      tabIndex={0}
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-700 font-medium transition-all hover:border-amber-400/60 hover:bg-amber-400/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        sizeClasses,
        className,
      )}
      aria-label={`${count} alert${count === 1 ? "" : "s"}`}
      role="button"
      aria-haspopup="dialog"
    >
      <span className="inline-flex h-2 w-2 rounded-full bg-current opacity-70" aria-hidden />
      <span>{count}</span>
      {showLabel && <span className="uppercase tracking-wide">Alerts</span>}
    </span>
  );

  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs space-y-2">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alert details</p>
            <ul className="space-y-1 text-xs leading-snug text-foreground">
              {tooltipAlerts.map((group, index) => (
                <li key={`${group.description.toLowerCase()}-${index}`} className="flex items-start gap-2">
                  <span className="text-muted-foreground">{index + 1}.</span>
                  <span className="flex-1">
                    {group.description}
                  </span>
                  {group.count > 1 && (
                    <span className="text-[11px] text-muted-foreground/80">×{group.count}</span>
                  )}
                </li>
              ))}
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
