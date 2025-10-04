import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { FileText, Clock, Plus, ArrowRight, CheckCircle2, XCircle, Coins, TrendingUp } from "lucide-react";
import { CaseDisplay } from "../../types/case";
import { FileServiceDiagnostic } from "../diagnostics/FileServiceDiagnostic";
import { useCategoryConfig } from "../../contexts/CategoryConfigContext";
import { BellRing } from "lucide-react";
import { filterOpenAlerts, type AlertsIndex } from "../../utils/alertsData";
import { getAlertClientName, getAlertDisplayDescription, getAlertDueDateInfo, getAlertMcn } from "@/utils/alertDisplay";
import { UnlinkedAlertsDialog } from "@/components/alerts/UnlinkedAlertsDialog";
import { McnCopyControl } from "@/components/common/McnCopyControl";

interface DashboardProps {
  cases: CaseDisplay[];
  alerts: AlertsIndex;
  onViewAllCases: () => void;
  onNewCase: () => void;
}

export function Dashboard({ cases, alerts, onViewAllCases, onNewCase }: DashboardProps) {
  const { config } = useCategoryConfig();

  const validCases = useMemo(
    () => cases.filter(c => c && c.caseRecord && typeof c.caseRecord === "object"),
    [cases],
  );

  const totalCases = cases.length;

  const statusCount = useCallback(
    (status: CaseDisplay["status"]) =>
      validCases.filter(c => c.caseRecord.status === status).length,
    [validCases],
  );

  const recentCases = validCases.slice(0, 5);

  const statusPalette = useMemo(
    () => [
      "text-amber-600",
      "text-emerald-600",
      "text-red-600",
      "text-purple-600",
      "text-blue-600",
      "text-slate-600",
    ],
    [],
  );

  const statusIconMap = useMemo(
    () => ({
      pending: { icon: Clock, description: "Awaiting determination" },
      approved: { icon: CheckCircle2, description: "Cleared for services" },
      denied: { icon: XCircle, description: "Requires follow-up" },
      spenddown: { icon: Coins, description: "Spenddown management" },
    }),
    [],
  );

  const statusStats = useMemo(
    () =>
      config.caseStatuses.map((status, index) => {
        const key = status.toLowerCase();
        const meta = statusIconMap[key as keyof typeof statusIconMap] || {
          icon: TrendingUp,
          description: "Tracked cases",
        };

        return {
          title: `${status} Cases`,
          value: statusCount(status),
          description: meta.description,
          icon: meta.icon,
          color: statusPalette[index % statusPalette.length],
        };
      }),
    [config.caseStatuses, statusCount, statusIconMap, statusPalette],
  );

  const totalAlerts = alerts.alerts.length;

  const openAlerts = useMemo(() => filterOpenAlerts(alerts.alerts), [alerts.alerts]);

  const unlinkedAlerts = useMemo(
    () => openAlerts.filter(alert => alert.matchStatus !== "matched"),
    [openAlerts],
  );

  const openAlertsCount = openAlerts.length;
  const unlinkedAlertCount = unlinkedAlerts.length;

  const [showUnlinkedDialog, setShowUnlinkedDialog] = useState(false);

  const stats = useMemo(
    () => [
      {
        title: "Alerts",
        value: totalAlerts,
        description:
          openAlertsCount === 0
            ? "No open alerts"
            : `${openAlertsCount} open${unlinkedAlertCount ? ` • ${unlinkedAlertCount} unlinked` : ""}`,
        icon: BellRing,
        color: totalAlerts > 0 ? "text-amber-600" : "text-muted-foreground",
      },
      {
        title: "Total Cases",
        value: totalCases,
        description: "All tracked cases",
        icon: FileText,
        color: "text-blue-600",
      },
      ...statusStats,
    ],
    [openAlertsCount, statusStats, totalAlerts, totalCases, unlinkedAlertCount],
  );

  const latestAlerts = useMemo(() => openAlerts.slice(0, 5), [openAlerts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your case management system</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onNewCase} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Case
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Cases */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Cases</CardTitle>
                <CardDescription>Latest cases added to the system</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={onViewAllCases}>
                View All
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentCases.length > 0 ? (
              <div className="space-y-3">
                {recentCases.map((case_) => (
                  <div key={case_.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {case_.person.firstName} {case_.person.lastName}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <McnCopyControl
                          mcn={case_.caseRecord?.mcn ?? null}
                          className="inline-flex items-center gap-1 text-muted-foreground"
                          labelClassName="text-sm font-normal text-muted-foreground"
                          buttonClassName="text-sm text-muted-foreground"
                          textClassName="text-sm"
                          missingLabel="N/A"
                          missingClassName="text-sm text-muted-foreground"
                          variant="plain"
                        />
                        <span>• Status: {case_.caseRecord?.status || 'Unknown'}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {case_.caseRecord?.createdDate ? new Date(case_.caseRecord.createdDate).toLocaleDateString() : 'No date'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No cases yet</p>
                <Button variant="outline" size="sm" onClick={onNewCase} className="mt-2">
                  Create your first case
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Alert Center</CardTitle>
                <CardDescription>Live feed from the alerts dataset</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BellRing className={totalAlerts ? "h-4 w-4 text-amber-600" : "h-4 w-4"} />
                  {totalAlerts ? `${totalAlerts} total` : "No alerts"}
                </div>
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
            {totalAlerts === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                <p>No alerts detected in the sample feed.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Total alerts</p>
                    <p className="text-2xl font-semibold text-foreground">{totalAlerts}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Open alerts</p>
                    <p className="text-lg font-semibold text-foreground">{openAlertsCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Unlinked</p>
                    <p className="text-lg font-semibold text-destructive">
                      {unlinkedAlertCount}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {latestAlerts.map(alert => {
                    const description = getAlertDisplayDescription(alert);
                    const { label, hasDate } = getAlertDueDateInfo(alert);
                    const dueLabel = hasDate ? `Due ${label}` : label;
                    const clientName = getAlertClientName(alert) ?? "Client name unavailable";
                    const mcn = getAlertMcn(alert);

                    return (
                      <div
                        key={alert.id}
                        className="rounded-lg border border-border/60 bg-card/60 p-3"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{description}</p>
                          <p className="text-xs text-muted-foreground">{dueLabel}</p>
                          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                            <span>{clientName}</span>
                            <McnCopyControl
                              mcn={mcn}
                              showLabel={false}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                              buttonClassName="text-[11px] text-muted-foreground"
                              textClassName="text-[11px]"
                              missingLabel="MCN unavailable"
                              missingClassName="text-[11px] text-muted-foreground"
                              variant="plain"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start h-auto p-4"
                onClick={onNewCase}
              >
                <div className="flex items-center w-full">
                  <Plus className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Create New Case</div>
                    <div className="text-sm text-muted-foreground">Add a new case to the system</div>
                  </div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start h-auto p-4"
                onClick={onViewAllCases}
              >
                <div className="flex items-center w-full">
                  <FileText className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">View All Cases</div>
                    <div className="text-sm text-muted-foreground">Browse and manage existing cases</div>
                  </div>
                </div>
              </Button>



              <Button 
                variant="outline" 
                className="w-full justify-start h-auto p-4"
                disabled
              >
                <div className="flex items-center w-full">
                  <TrendingUp className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Reports</div>
                    <div className="text-sm text-muted-foreground">Generate case reports (Coming soon)</div>
                  </div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for future dashboard widgets */}
      <Card>
        <CardHeader>
          <CardTitle>Analytics Overview</CardTitle>
          <CardDescription>Case management insights and trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-medium mb-2">Analytics Coming Soon</h3>
            <p className="text-sm">
              Charts and insights about your case management will appear here.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Temporary diagnostic tool */}
      <FileServiceDiagnostic />

      <UnlinkedAlertsDialog
        alerts={unlinkedAlerts}
        open={showUnlinkedDialog}
        onOpenChange={setShowUnlinkedDialog}
      />
    </div>
  );
}

export default Dashboard;