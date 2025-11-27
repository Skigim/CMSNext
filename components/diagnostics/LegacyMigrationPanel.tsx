import { useCallback, useState } from "react";
import { AlertTriangle, ArrowRight, Check, FileWarning, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Separator } from "../ui/separator";
import { useDataManagerSafe } from "@/contexts/DataManagerContext";
import {
  detectDataFormat,
  getFormatDescription,
  migrateLegacyData,
  type MigrationResult,
} from "@/utils/legacyMigration";

interface LegacyMigrationPanelProps {
  className?: string;
  onMigrationComplete?: () => void;
}

type MigrationState =
  | { status: "idle" }
  | { status: "detecting" }
  | { status: "detected"; format: ReturnType<typeof detectDataFormat>; rawData: unknown }
  | { status: "migrating" }
  | { status: "success"; result: MigrationResult }
  | { status: "error"; error: string };

export function LegacyMigrationPanel({
  className,
  onMigrationComplete,
}: LegacyMigrationPanelProps) {
  const dataManager = useDataManagerSafe();
  const [state, setState] = useState<MigrationState>({ status: "idle" });

  const handleDetectFormat = useCallback(async () => {
    if (!dataManager) {
      toast.error("Data manager not available. Please connect to a folder first.");
      return;
    }

    setState({ status: "detecting" });

    try {
      const rawData = await dataManager.readRawFileData();

      if (!rawData) {
        setState({ status: "error", error: "No data file found in the connected folder." });
        return;
      }

      const format = detectDataFormat(rawData);
      setState({ status: "detected", format, rawData });

      if (format === "v2.0") {
        toast.info("Data is already in the current v2.0 format. No migration needed.");
      } else if (format === "v1.x-nested") {
        toast.warning("Legacy v1.x format detected. Migration is available.");
      } else {
        toast.error(`Unsupported format detected: ${getFormatDescription(format)}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to detect format";
      setState({ status: "error", error: errorMsg });
      toast.error(errorMsg);
    }
  }, [dataManager]);

  const handleMigrate = useCallback(async () => {
    if (state.status !== "detected" || !dataManager) {
      return;
    }

    setState({ status: "migrating" });
    const toastId = toast.loading("Migrating data to v2.0 format...");

    try {
      const result = migrateLegacyData(state.rawData);

      if (!result.success || !result.data) {
        setState({ status: "error", error: result.errors.join("; ") });
        toast.error("Migration failed", { id: toastId, description: result.errors[0] });
        return;
      }

      // Write the migrated data - this automatically broadcasts the data update
      await dataManager.writeNormalizedData(result.data);

      setState({ status: "success", result });
      toast.success("Migration completed successfully!", {
        id: toastId,
        description: `Migrated ${result.stats.casesCount} cases, ${result.stats.financialsCount} financial items, ${result.stats.notesCount} notes`,
      });

      onMigrationComplete?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Migration failed";
      setState({ status: "error", error: errorMsg });
      toast.error("Migration failed", { id: toastId, description: errorMsg });
    }
  }, [state, dataManager, onMigrationComplete]);

  const handleReset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const isConnected = dataManager?.isConnected() ?? false;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileWarning className="h-5 w-5" />
          Legacy Data Migration
        </CardTitle>
        <CardDescription>
          Migrate data from legacy v1.x format to the current v2.0 normalized format
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Not Connected</AlertTitle>
            <AlertDescription>
              Please connect to a data folder before attempting migration.
            </AlertDescription>
          </Alert>
        )}

        {state.status === "idle" && isConnected && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If you're seeing a "legacy format" error when loading your data, you can use this
              tool to migrate your data to the current format.
            </p>
            <Button onClick={handleDetectFormat} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Detect Data Format
            </Button>
          </div>
        )}

        {state.status === "detecting" && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Detecting format...</span>
          </div>
        )}

        {state.status === "detected" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Detected Format</p>
                <p className="text-sm text-muted-foreground">
                  {getFormatDescription(state.format)}
                </p>
              </div>
              <Badge
                variant={state.format === "v2.0" ? "default" : "secondary"}
                className={state.format === "v1.x-nested" ? "bg-amber-500 text-white" : ""}
              >
                {state.format === "v2.0" ? "Current" : "Legacy"}
              </Badge>
            </div>

            {state.format === "v2.0" && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Already Current</AlertTitle>
                <AlertDescription>
                  Your data is already in the v2.0 format. No migration is needed.
                </AlertDescription>
              </Alert>
            )}

            {state.format === "v1.x-nested" && (
              <>
                <Alert variant="destructive" className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800 dark:text-amber-200">
                    Migration Required
                  </AlertTitle>
                  <AlertDescription className="text-amber-700 dark:text-amber-300">
                    Your data uses the legacy v1.x nested format. Click below to migrate to v2.0.
                    <br />
                    <strong>A backup will be created automatically before migration.</strong>
                  </AlertDescription>
                </Alert>

                <div className="flex items-center justify-center gap-4 py-4">
                  <Badge variant="outline" className="text-base px-4 py-2">
                    v1.x
                  </Badge>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <Badge variant="default" className="text-base px-4 py-2">
                    v2.0
                  </Badge>
                </div>

                <Button onClick={handleMigrate} className="w-full" size="lg">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Migrate to v2.0
                </Button>
              </>
            )}

            {(state.format === "nightingale-raw" || state.format === "unknown") && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Unsupported Format</AlertTitle>
                <AlertDescription>
                  {state.format === "nightingale-raw"
                    ? "Nightingale raw format is not yet supported for direct migration."
                    : "The data format could not be recognized."}
                  <br />
                  Please contact support for assistance.
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            <Button variant="outline" onClick={handleReset} className="w-full">
              Start Over
            </Button>
          </div>
        )}

        {state.status === "migrating" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Migrating data...</p>
            <p className="text-sm text-muted-foreground">
              This may take a moment for large datasets.
            </p>
          </div>
        )}

        {state.status === "success" && (
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
              <Check className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800 dark:text-green-200">
                Migration Successful
              </AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                Your data has been migrated to v2.0 format.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Cases</p>
                <p className="text-2xl font-bold">{state.result.stats.casesCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Financial Items</p>
                <p className="text-2xl font-bold">{state.result.stats.financialsCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-2xl font-bold">{state.result.stats.notesCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alerts</p>
                <p className="text-2xl font-bold">{state.result.stats.alertsCount}</p>
              </div>
            </div>

            {state.result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warnings</AlertTitle>
                <AlertDescription>
                  {state.result.errors.length} item(s) had issues during migration:
                  <ul className="list-disc pl-4 mt-2">
                    {state.result.errors.slice(0, 5).map((err, i) => (
                      <li key={i} className="text-sm">
                        {err}
                      </li>
                    ))}
                    {state.result.errors.length > 5 && (
                      <li className="text-sm">
                        ...and {state.result.errors.length - 5} more
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Button variant="outline" onClick={handleReset} className="w-full">
              Done
            </Button>
          </div>
        )}

        {state.status === "error" && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>

            <Button variant="outline" onClick={handleReset} className="w-full">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LegacyMigrationPanel;
