import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BellRing } from "lucide-react";
import {
  filterOpenAlerts,
  buildAlertStorageKey,
  type AlertsIndex,
  type AlertMatchStatus,
} from "@/utils/alertsData";
import { getAlertClientName, getAlertDisplayDescription, getAlertDueDateInfo, getAlertMcn } from "@/utils/alertDisplay";
import { UnlinkedAlertsDialog } from "@/components/alerts/UnlinkedAlertsDialog";
import { CopyButton } from "@/components/common/CopyButton";
import { EmptyState } from "@/components/common/EmptyState";

interface AlertCenterWidgetProps {
  alerts: AlertsIndex;
  onNavigateToReports: () => void;
}

function formatAlertMatchStatus(status: AlertMatchStatus): string {
  if (status === "missing-mcn") {
    return "Missing MCN";
  }
  return status === "matched" ? "Matched" : "Unmatched";
}

export function AlertCenterWidget({ alerts, onNavigateToReports }: AlertCenterWidgetProps) {
  const openAlerts = useMemo(() => filterOpenAlerts(alerts.alerts), [alerts.alerts]);

  const unlinkedAlerts = useMemo(
    () => openAlerts.filter(alert => alert.matchStatus !== "matched"),
    [openAlerts],
  );

  const openAlertsCount = openAlerts.length;
  const unlinkedAlertCount = unlinkedAlerts.length;

  const [showUnlinkedDialog, setShowUnlinkedDialog] = useState(false);

  const latestAlerts = useMemo(() => openAlerts.slice(0, 5), [openAlerts]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Alert Center</CardTitle>
              <CardDescription>Latest updates from the alerts feed</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BellRing className={openAlertsCount ? "h-4 w-4 text-primary" : "h-4 w-4"} />
                {openAlertsCount ? `${openAlertsCount} open` : "No open alerts"}
              </div>
              {openAlertsCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onNavigateToReports}
                  className="flex items-center gap-1"
                >
                  View reports
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
              {unlinkedAlertCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowUnlinkedDialog(true)}
                  className="relative inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive transition hover:border-destructive/60 hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label={`${unlinkedAlertCount} unlinked alert${unlinkedAlertCount === 1 ? "" : "s"}`}
                >
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
                  <span>Unlinked</span>
                  <span>
                    <Badge variant="secondary" className="ml-0 flex h-4 items-center justify-center px-1 text-[10px] font-semibold">
                      {unlinkedAlertCount}
                    </Badge>
                  </span>
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {openAlertsCount === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              <p>No open alerts detected in the system.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Open alerts</p>
                  <p className="text-lg font-semibold text-foreground">{openAlertsCount}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Unlinked alerts</p>
                  <p className="text-lg font-semibold text-destructive">{unlinkedAlertCount}</p>
                </div>
              </div>

              {latestAlerts.length > 0 ? (
                <div className="space-y-3">
                  {latestAlerts.map((alert, index) => {
                    const description = getAlertDisplayDescription(alert);
                    const { label, hasDate } = getAlertDueDateInfo(alert);
                    const dueLabel = hasDate ? `Due ${label}` : label;
                    const clientName = getAlertClientName(alert) ?? "Client name unavailable";
                    const mcn = getAlertMcn(alert);
                    const storageKey = buildAlertStorageKey(alert);
                    const elementKey = storageKey ?? (alert.id ? `alert-${String(alert.id)}-${index}` : `alert-${index}`);

                    return (
                      <div
                        key={elementKey}
                        className="rounded-lg border border-border/60 bg-card/60 p-3"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{description}</p>
                          <p className="text-xs text-muted-foreground">{dueLabel || "No due date"}</p>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            <span>{clientName}</span>
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
                            <span className="uppercase tracking-wide">
                              Match: {formatAlertMatchStatus(alert.matchStatus)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="All open alerts are resolved. Great job!"
                />
              )}

              {openAlertsCount > latestAlerts.length && (
                <p className="text-xs text-muted-foreground">
                  Plus {openAlertsCount - latestAlerts.length} more open alert{openAlertsCount - latestAlerts.length === 1 ? "" : "s"} available in Reports.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      <UnlinkedAlertsDialog
        alerts={unlinkedAlerts}
        open={showUnlinkedDialog}
        onOpenChange={setShowUnlinkedDialog}
      />
    </>
  );
}
