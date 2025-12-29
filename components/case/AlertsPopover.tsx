/**
 * AlertsPopover Component
 * 
 * Lightweight popover UI for viewing and managing case alerts.
 * Replaces the full-screen drawer with an inline popover matching the NotesPopover pattern.
 * 
 * Features:
 * - Shows open alerts with resolve action
 * - Shows recently resolved alerts (up to 5) with reopen action
 * - Badge overlay indicating open count or checkmark when all resolved
 * - Integrated case status menu for quick status updates
 * 
 * @module components/case/AlertsPopover
 */
import { useState, useMemo, useCallback } from "react";
import { Button } from "../ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { Badge } from "../ui/badge";
import { BellRing, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertWithMatch } from "@/utils/alertsData";
import { getAlertDisplayDescription, getAlertDueDateInfo } from "@/utils/alertDisplay";
import { CaseStatusMenu } from "./CaseStatusMenu";
import type { CaseDisplay, CaseStatusUpdateHandler } from "@/types/case";

/**
 * Props for the AlertsPopover component.
 */
interface AlertsPopoverProps {
  /** Array of alerts associated with the case */
  alerts: AlertWithMatch[];
  /** Display name of the case (shown in header) */
  caseName: string;
  /** Optional CSS class for the trigger button */
  className?: string;
  /** Callback to resolve or reopen an alert */
  onResolveAlert?: (alert: AlertWithMatch) => void | Promise<void>;
  /** Case ID for status menu integration */
  caseId?: string;
  /** Current case status for status menu */
  caseStatus?: CaseDisplay["status"];
  /** Callback to update case status */
  onUpdateCaseStatus?: CaseStatusUpdateHandler;
}

/**
 * Popover component for viewing and managing case alerts.
 * 
 * Displays a button with badge overlay that opens a popover showing:
 * - Open alerts section with resolve buttons
 * - Recently resolved section with reopen buttons
 * 
 * @example
 * ```tsx
 * <AlertsPopover
 *   alerts={caseAlerts}
 *   caseName="John Doe"
 *   onResolveAlert={handleResolve}
 *   caseId={case.id}
 *   caseStatus={case.status}
 *   onUpdateCaseStatus={handleStatusUpdate}
 * />
 * ```
 */
export function AlertsPopover({
  alerts,
  caseName,
  className,
  onResolveAlert,
  caseId,
  caseStatus,
  onUpdateCaseStatus,
}: AlertsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { openAlerts, resolvedAlerts, totalCount, openCount } = useMemo(() => {
    const openList: AlertWithMatch[] = [];
    const resolvedList: AlertWithMatch[] = [];

    alerts.forEach((alert) => {
      if (alert.status === "resolved") {
        resolvedList.push(alert);
      } else {
        openList.push(alert);
      }
    });

    return {
      openAlerts: openList,
      resolvedAlerts: resolvedList,
      totalCount: alerts.length,
      openCount: openList.length,
    };
  }, [alerts]);

  const hasOpenAlerts = openCount > 0;

  const handleResolve = useCallback(
    (alert: AlertWithMatch) => {
      void onResolveAlert?.(alert);
    },
    [onResolveAlert],
  );

  const canUpdateStatus = Boolean(caseId && onUpdateCaseStatus);

  // Don't render if no alerts
  if (totalCount === 0) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(className, "relative pr-8")}
        >
          <BellRing className="w-4 h-4 mr-2" />
          Alerts
          {/* Badge overlay */}
          <span
            className={cn(
              "absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full text-xs font-medium min-w-5 h-5 px-1",
              hasOpenAlerts
                ? "bg-amber-500 text-white"
                : "bg-green-500 text-white"
            )}
          >
            {hasOpenAlerts ? openCount : <Check className="h-3 w-3" />}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        data-papercut-context="AlertsPopover"
        className="w-96 p-0 max-h-[500px] flex flex-col"
        align="start"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-2 shrink-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BellRing className="h-4 w-4" />
            <span className="truncate max-w-[150px]" title={caseName}>
              {caseName}
            </span>
            <Badge variant="secondary" className="text-xs">
              {openCount} open
            </Badge>
          </div>
          {canUpdateStatus && caseId ? (
            <CaseStatusMenu
              caseId={caseId}
              status={caseStatus}
              onUpdateStatus={onUpdateCaseStatus}
            />
          ) : null}
        </div>

        {/* Content with scroll */}
        <div className="flex-1 overflow-y-auto">
          {/* Open Alerts Section */}
          <div className="px-3 py-2 border-b">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">
                Open alerts
              </span>
              <span className="text-xs text-muted-foreground">
                {openCount} active
              </span>
            </div>

            {openAlerts.length === 0 ? (
              <div className="py-3 text-center text-sm text-muted-foreground">
                <Check className="h-6 w-6 mx-auto mb-1 text-green-500" />
                <p className="text-xs">All alerts resolved</p>
              </div>
            ) : (
              <div className="space-y-2">
                {openAlerts.map((alert) => {
                  const description = getAlertDisplayDescription(alert);
                  const { label, hasDate } = getAlertDueDateInfo(alert);
                  const dueLabel = hasDate ? `Due ${label}` : label;

                  return (
                    <div
                      key={alert.id}
                      className="rounded-md border border-border/60 bg-card p-2.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-sm font-medium text-foreground leading-tight truncate" title={description}>
                            {description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {dueLabel}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="h-7 px-2 shrink-0"
                          onClick={() => handleResolve(alert)}
                          disabled={!onResolveAlert}
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resolved Alerts Section */}
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">
                Recently resolved
              </span>
              <span className="text-xs text-muted-foreground">
                {resolvedAlerts.length}
              </span>
            </div>

            {resolvedAlerts.length === 0 ? (
              <div className="py-3 text-center text-sm text-muted-foreground">
                <AlertCircle className="h-6 w-6 mx-auto mb-1 opacity-40" />
                <p className="text-xs">Resolved alerts appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {resolvedAlerts.slice(0, 5).map((alert) => {
                  const description = getAlertDisplayDescription(alert);
                  const { label, hasDate } = getAlertDueDateInfo(alert);
                  const dueLabel = hasDate ? `Due ${label}` : label;

                  return (
                    <div
                      key={alert.id}
                      className="rounded-md border border-muted-foreground/40 bg-muted/20 p-2.5 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="font-medium text-foreground leading-tight truncate opacity-70" title={description}>
                            {description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {dueLabel}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 shrink-0"
                          onClick={() => handleResolve(alert)}
                          disabled={!onResolveAlert}
                        >
                          Reopen
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {resolvedAlerts.length > 5 && (
                  <p className="text-xs text-center text-muted-foreground py-1">
                    +{resolvedAlerts.length - 5} more resolved
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default AlertsPopover;
