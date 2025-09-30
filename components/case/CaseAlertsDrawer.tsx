import { memo, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, BellRing, CheckCircle2, Clock } from "lucide-react";
import type { AlertWithMatch } from "@/utils/alertsData";

const mediumDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

interface CaseAlertsDrawerProps {
  alerts: AlertWithMatch[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseName: string;
  onResolveAlert?: (alertId: string) => void;
  onAddNoteForAlert?: (alert: AlertWithMatch) => void;
}

const formatDisplayDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return mediumDateFormatter.format(date);
};

const matchLabels: Record<AlertWithMatch["matchStatus"], string> = {
  matched: "Linked to this case",
  unmatched: "No matching case found",
  "missing-mcn": "Missing MCN",
};

export const CaseAlertsDrawer = memo(function CaseAlertsDrawer({
  alerts,
  open,
  onOpenChange,
  caseName,
  onResolveAlert,
  onAddNoteForAlert,
}: CaseAlertsDrawerProps) {
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

  const totalAlerts = alerts.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader className="border-b border-border/60 pb-4">
          <SheetTitle className="flex flex-col gap-1 text-left">
            Alerts for {caseName}
            <span className="text-sm font-normal text-muted-foreground">
              {openAlerts.length} open · {resolvedAlerts.length} resolved · {totalAlerts} total
            </span>
          </SheetTitle>
          <SheetDescription className="text-left">
            Review incoming alerts, resolve items, or add notes for follow-up.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 px-4 pb-6">
          <section className="space-y-3 py-4">
            <header className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Open alerts</h2>
              <span className="text-xs text-muted-foreground">{openAlerts.length} active</span>
            </header>
            {openAlerts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>No open alerts. Great job!</span>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {openAlerts.map(alert => {
                  const dueDate = formatDisplayDate(alert.alertDate ?? alert.createdAt);
                  return (
                    <li key={alert.id} className="rounded-lg border border-border/60 bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border-amber-400/40 bg-amber-400/10 text-amber-700">
                              <BellRing className="mr-1 h-3.5 w-3.5" /> Active alert
                            </Badge>
                            {dueDate && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" /> {dueDate}
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-semibold text-foreground">{alert.description || "Alert"}</h3>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p className="flex items-center gap-2">
                              <BellRing className="h-3.5 w-3.5" />
                              <span>{matchLabels[alert.matchStatus]}</span>
                            </p>
                            {alert.mcNumber && (
                              <p>MCN: <span className="font-mono text-foreground">{alert.mcNumber}</span></p>
                            )}
                            {alert.metadata?.rawProgram && (
                              <p>Program: <span className="text-foreground">{alert.metadata.rawProgram}</span></p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={() => onResolveAlert?.(alert.id)}
                            disabled={!onResolveAlert}
                          >
                            Resolve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAddNoteForAlert?.(alert)}
                            disabled={!onAddNoteForAlert}
                          >
                            Add note
                          </Button>
                        </div>
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
              <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Resolved alerts will appear here for quick reference.</span>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {resolvedAlerts.map(alert => {
                  const resolvedAt = formatDisplayDate(alert.resolvedAt);
                  return (
                    <li
                      key={alert.id}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-800"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>{alert.description || "Alert"}</span>
                        </div>
                        {resolvedAt && (
                          <p className="text-xs text-emerald-700/80">Resolved {resolvedAt}</p>
                        )}
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
