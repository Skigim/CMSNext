import { useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import {
  FileText,
  Clock,
  Plus,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Coins,
  TrendingUp,
} from "lucide-react";
import { CaseDisplay, AlertSeverity } from "../../types/case";
import { FileServiceDiagnostic } from "../diagnostics/FileServiceDiagnostic";
import { useCategoryConfig } from "../../contexts/CategoryConfigContext";
import { BellRing, AlertTriangle } from "lucide-react";
import type { AlertsIndex } from "../../utils/alertsData";

interface DashboardProps {
  cases: CaseDisplay[];
  alerts: AlertsIndex;
  onViewAllCases: () => void;
  onNewCase: () => void;
}

function getSeverityBadgeClasses(severity: AlertSeverity): string {
  switch (severity) {
    case "Critical":
      return "bg-red-500/15 text-red-600 border-red-500/20";
    case "High":
      return "bg-amber-500/15 text-amber-600 border-amber-500/20";
    case "Medium":
      return "bg-yellow-500/15 text-yellow-600 border-yellow-500/20";
    case "Low":
      return "bg-blue-500/15 text-blue-600 border-blue-500/20";
    default:
      return "bg-muted text-muted-foreground border-muted-foreground/20";
  }
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

  const stats = useMemo(
    () => [
      {
        title: "Active Alerts",
        value: alerts.summary.total,
        description:
          alerts.summary.total === 0
            ? "All clear"
            : `${alerts.summary.matched} linked to cases`,
        icon: BellRing,
        color: alerts.summary.total > 0 ? "text-amber-600" : "text-muted-foreground",
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
    [alerts.summary.matched, alerts.summary.total, statusStats, totalCases],
  );

  const latestAlerts = useMemo(() => alerts.alerts.slice(0, 5), [alerts.alerts]);

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
        {stats.map((stat, index) => (
          <Card key={index}>
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
                      <div className="text-sm text-muted-foreground">
                        MCN: {case_.caseRecord?.mcn || 'N/A'} • Status: {case_.caseRecord?.status || 'Unknown'}
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BellRing className={alerts.summary.total ? "h-4 w-4 text-amber-600" : "h-4 w-4"} />
                {alerts.summary.total ? `${alerts.summary.total} active` : "All clear"}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {alerts.summary.total === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                <p>No alerts detected in the sample feed.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs uppercase text-muted-foreground">Linked to cases</p>
                  <p className="text-lg font-semibold text-foreground">{alerts.summary.matched}</p>
                  <p className="text-xs text-muted-foreground mt-1">Anything that needs a manual match will trigger a toast.</p>
                </div>

                <div className="space-y-3">
                  {latestAlerts.map(alert => {
                    const severityClass = getSeverityBadgeClasses(alert.severity);
                    return (
                      <div
                        key={alert.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/60 p-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{alert.alertType || alert.alertCode}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${severityClass}`}>
                              <AlertTriangle className="h-3 w-3" />
                              {alert.severity}
                            </span>
                          </div>
                          {alert.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{alert.description}</p>
                          )}
                          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            {alert.personName && <span>{alert.personName}</span>}
                            {alert.mcNumber && <span>MCN {alert.mcNumber}</span>}
                            {alert.source && <span>{alert.source}</span>}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground text-right min-w-[128px]">
                          <div>{alert.updatedAt ? new Date(alert.updatedAt).toLocaleDateString() : "—"}</div>
                          <div className="truncate">
                            {alert.matchedCaseName ? `Case: ${alert.matchedCaseName}` : alert.matchStatus === "matched" ? "Linked case" : "Needs review"}
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

    </div>
  );
}

export default Dashboard;