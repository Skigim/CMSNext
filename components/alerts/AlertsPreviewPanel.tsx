import { memo } from "react";
import { AlertTriangle, BellOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import type { StoredCase } from "../../types/case";

interface AlertsPreviewPanelProps {
  cases: StoredCase[];
}

export const AlertsPreviewPanel = memo(function AlertsPreviewPanel({ cases }: AlertsPreviewPanelProps) {
  void cases;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <BellOff className="h-5 w-5 text-muted-foreground" />
          Alerts Preview Workspace
        </CardTitle>
        <CardDescription>
          Sample alerts are currently disabled while we resolve a runtime loading error.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          We hit a 404 when attempting to bundle the preview CSV. The interactive preview will return once the
          data source is stable again.
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          <span>No alerts are being loaded at this time.</span>
        </div>
        <p className="text-xs">
          Toggle <code>ENABLE_SAMPLE_ALERTS</code> in <code>utils/featureFlags.ts</code> after the dataset issue is fixed.
          When re-enabled, restore the previous preview experience.
        </p>
      </CardContent>
    </Card>
  );
});
