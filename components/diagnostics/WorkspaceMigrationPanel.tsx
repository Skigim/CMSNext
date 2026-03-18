import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, FileWarning, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { useDataManagerSafe } from "@/contexts/DataManagerContext";
import type { WorkspaceMigrationReport } from "@/utils/workspaceV21Migration";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

function getDispositionBadgeVariant(
  disposition: WorkspaceMigrationReport["files"][number]["disposition"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (disposition) {
    case "migrated":
      return "default";
    case "failed":
      return "destructive";
    case "already-v2.1":
      return "secondary";
    default:
      return "outline";
  }
}

export function WorkspaceMigrationPanel() {
  const dataManager = useDataManagerSafe();
  const [report, setReport] = useState<WorkspaceMigrationReport | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  const hasFailures = useMemo(() => (report?.summary.failed ?? 0) > 0, [report]);

  const handleMigrateWorkspace = useCallback(async () => {
    if (!dataManager) {
      toast.error("Connect to a workspace folder before running migration.");
      return;
    }

    setIsMigrating(true);
    setReport(null);
    const toastId = toast.loading("Scanning workspace files for v2.1 migration...");

    try {
      const migrationReport = await dataManager.migrateWorkspaceToV21();
      setReport(migrationReport);

      const migratedSummary = `${migrationReport.summary.migrated} migrated, ${migrationReport.summary.alreadyV21} already v2.1`;
      if (migrationReport.summary.failed > 0) {
        toast.warning("Workspace migration completed with validation issues", {
          id: toastId,
          description: `${migratedSummary}, ${migrationReport.summary.failed} failed`,
        });
        return;
      }

      toast.success("Workspace migration report ready", {
        id: toastId,
        description: migratedSummary,
      });
    } catch (error) {
      toast.error("Failed to run workspace migration", {
        id: toastId,
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsMigrating(false);
    }
  }, [dataManager]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Persisted v2.1 Workspace Migration
        </CardTitle>
        <CardDescription>
          Explicitly upgrade the connected workspace and supported archive files to persisted v2.1,
          then validate each file so normal runtime reads stay strictly v2.1-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!dataManager && (
          <Alert variant="destructive">
            <FileWarning className="h-4 w-4" />
            <AlertTitle>Workspace not connected</AlertTitle>
            <AlertDescription>
              Connect to a folder before running the persisted v2.1 migration tool.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h4 className="font-medium">Upgrade the active workspace now</h4>
            <p className="text-sm text-muted-foreground">
              Processes <code>case-tracker-data.json</code> plus any{" "}
              <code>archived-cases-*.json</code> files in the connected folder.
            </p>
          </div>
          <Button
            onClick={handleMigrateWorkspace}
            disabled={!dataManager || isMigrating}
            className="gap-2"
          >
            {isMigrating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Migrating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Run Migration
              </>
            )}
          </Button>
        </div>

        {report && (
          <div className="space-y-4">
            <Alert variant={hasFailures ? "destructive" : "default"}>
              {hasFailures ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <AlertTitle>
                {hasFailures ? "Validation issues detected" : "Migration validation succeeded"}
              </AlertTitle>
              <AlertDescription>
                {report.summary.migrated} migrated • {report.summary.alreadyV21} already v2.1 •{" "}
                {report.summary.skipped} skipped • {report.summary.failed} failed
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              {report.files.map((file) => (
                <div
                  key={file.fileName}
                  className="rounded-lg border border-border/60 bg-muted/20 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{file.fileName}</span>
                        <Badge variant={getDispositionBadgeVariant(file.disposition)}>
                          {file.disposition}
                        </Badge>
                        <Badge variant="outline">{file.fileKind}</Badge>
                        {file.sourceVersion && (
                          <Badge variant="outline">source {file.sourceVersion}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{file.message}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-right">
                      <span>People: {file.counts.people}</span>
                      <span>Cases: {file.counts.cases}</span>
                      <span>Financials: {file.counts.financials}</span>
                      <span>Notes: {file.counts.notes}</span>
                      <span>Alerts: {file.counts.alerts}</span>
                    </div>
                  </div>

                  {file.validationErrors.length > 0 && (
                    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-sm font-medium text-destructive">Validation errors</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-destructive">
                        {file.validationErrors.map((error, index) => (
                          <li key={`${file.fileName}-${index}`}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
