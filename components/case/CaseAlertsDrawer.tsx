import { memo, useMemo, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import type { AlertWithMatch } from "@/utils/alertsData";
import { CaseStatusMenu } from "./CaseStatusMenu";
import type { CaseDisplay, CaseStatusUpdateHandler } from "@/types/case";
import { getAlertDisplayDescription, getAlertDueDateInfo } from "@/utils/alertDisplay";

interface CaseAlertsDrawerProps {
  alerts: AlertWithMatch[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseName: string;
  onResolveAlert?: (alert: AlertWithMatch) => void | Promise<void>;
  caseId?: string;
  caseStatus?: CaseDisplay["status"];
  onUpdateCaseStatus?: CaseStatusUpdateHandler;
}

export const CaseAlertsDrawer = memo(function CaseAlertsDrawer({
  alerts,
  open,
  onOpenChange,
  caseName,
  onResolveAlert,
  caseId,
  caseStatus,
  onUpdateCaseStatus,
}: CaseAlertsDrawerProps) {
  const handleResolve = useCallback(
    (alert: AlertWithMatch) => {
      void onResolveAlert?.(alert);
    },
    [onResolveAlert],
  );

  const { openAlerts, resolvedAlerts } = useMemo(() => {
    const openList: AlertWithMatch[] = [];
    const resolvedList: AlertWithMatch[] = [];

    alerts.forEach(alert => {
      if (alert.status === "resolved") {
        resolvedList.push(alert);
      } else {
        openList.push(alert);
      }
    });

    return { openAlerts: openList, resolvedAlerts: resolvedList };
  }, [alerts]);

  const canUpdateStatus = Boolean(caseId && onUpdateCaseStatus);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-papercut-context="AlertsDrawer" side="right" className="sm:max-w-md overflow-hidden">
        <SheetHeader className="border-b border-border/60 pb-4 shrink-0">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 text-left sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div>
                <SheetTitle className="text-left">Alerts for {caseName}</SheetTitle>
                <span className="text-sm font-normal text-muted-foreground">
                  {openAlerts.length} open · {resolvedAlerts.length} resolved
                </span>
              </div>
              {canUpdateStatus && caseId ? (
                <CaseStatusMenu
                  caseId={caseId}
                  status={caseStatus}
                  onUpdateStatus={onUpdateCaseStatus}
                />
              ) : null}
            </div>
            <SheetDescription className="text-left">
              Review incoming alerts and resolve items—resolution notes are logged automatically.
            </SheetDescription>
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
          <section className="space-y-3 py-4">
            <header className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Open alerts</h2>
              <span className="text-xs text-muted-foreground">{openAlerts.length} active</span>
            </header>
            {openAlerts.length === 0 ? (
              <EmptyState
                title="No open alerts for this case."
                compact
              />
            ) : (
              <ul className="space-y-3">
                {openAlerts.map(alert => {
                  const description = getAlertDisplayDescription(alert);
                  const { label, hasDate } = getAlertDueDateInfo(alert);
                  const dueLabel = hasDate ? `Due ${label}` : label;

                  return (
                    <li key={alert.id} className="rounded-lg border border-border/60 bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{description}</p>
                          <p className="text-xs text-muted-foreground">{dueLabel}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleResolve(alert)}
                          disabled={!onResolveAlert}
                        >
                          Resolve
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-3 py-4">
            <header className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Recently resolved</h2>
              <span className="text-xs text-muted-foreground">{resolvedAlerts.length}</span>
            </header>
            {resolvedAlerts.length === 0 ? (
              <EmptyState
                title="Resolved alerts will appear here for quick reference."
                compact
              />
            ) : (
              <ul className="space-y-3">
                {resolvedAlerts.map(alert => {
                  const description = getAlertDisplayDescription(alert);
                  const { label, hasDate } = getAlertDueDateInfo(alert);
                  const dueLabel = hasDate ? `Due ${label}` : label;

                  return (
                    <li
                      key={alert.id}
                      className="rounded-lg border border-muted-foreground/40 bg-muted/20 p-4 text-sm text-foreground"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{description}</p>
                          <p className="text-xs text-muted-foreground">{dueLabel}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolve(alert)}
                          disabled={!onResolveAlert}
                        >
                          Reopen
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
});
