import { memo, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getAlertDisplayDescription, getAlertDueDateInfo, getAlertClientName, getAlertMcn } from "@/utils/alertDisplay";
import { CopyButton } from "@/components/common/CopyButton";
import type { AlertWithMatch } from "@/utils/alertsData";

export interface UnlinkedAlertsDialogProps {
  alerts: AlertWithMatch[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusLabels: Record<Exclude<AlertWithMatch["matchStatus"], "matched">, string> = {
  "missing-mcn": "Missing MCN",
  unmatched: "Needs review",
};

export const UnlinkedAlertsDialog = memo(function UnlinkedAlertsDialog({ alerts, open, onOpenChange }: UnlinkedAlertsDialogProps) {
  const sortedAlerts = useMemo(
    () =>
      [...alerts].sort((a, b) => {
        const aTime = new Date(a.updatedAt ?? a.alertDate ?? a.createdAt ?? "").getTime();
        const bTime = new Date(b.updatedAt ?? b.alertDate ?? b.createdAt ?? "").getTime();
        if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
          return 0;
        }
        if (Number.isNaN(aTime)) {
          return 1;
        }
        if (Number.isNaN(bTime)) {
          return -1;
        }
        return bTime - aTime;
      }),
    [alerts],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 sm:p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Unlinked alerts</DialogTitle>
          <DialogDescription>
            These alerts are unresolved and not currently linked to a case. Follow up to ensure they reach the right team.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="mt-4 max-h-[60vh] px-6 pb-6">
          {sortedAlerts.length === 0 ? (
            <div className="rounded-md border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
              All open alerts are linked to cases.
            </div>
          ) : (
            <ul className="space-y-3">
              {sortedAlerts.map(alert => {
                const description = getAlertDisplayDescription(alert);
                const { label, hasDate } = getAlertDueDateInfo(alert);
                const dueLabel = hasDate ? `Due ${label}` : label;
                const clientName = getAlertClientName(alert);
                const mcn = getAlertMcn(alert);
                const statusLabel = alert.matchStatus === "matched" ? null : statusLabels[alert.matchStatus];

                return (
                  <li key={alert.id} className="rounded-lg border border-border/60 bg-card/60 p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{description}</p>
                      {statusLabel && (
                        <Badge variant="destructive" className="uppercase">
                          {statusLabel}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{dueLabel}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                      <span>{clientName ?? "Client name unavailable"}</span>
                      <CopyButton
                        value={mcn}
                        label="MCN"
                        showLabel={false}
                        mono
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                        buttonClassName="text-[11px] text-muted-foreground"
                        textClassName="text-[11px]"
                        missingLabel="MCN unavailable"
                        missingClassName="text-[11px] text-muted-foreground"
                        variant="plain"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
});
