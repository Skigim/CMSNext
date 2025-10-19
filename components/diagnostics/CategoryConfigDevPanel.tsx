import { Wrench } from "lucide-react";
import { CategoryManagerPanel } from "../category/CategoryManagerPanel";

export function CategoryConfigDevPanel() {
  return (
    <CategoryManagerPanel
      title="Category Options (Developer)"
      description="Inspect and edit the lists that power select controls across the app."
      accentIcon={Wrench}
      supportingContent={(
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Changes are persisted to the workspace folder. Option lists update immediately across dashboards, forms, and validation logic.
          </p>
          <p className="text-xs text-muted-foreground/80">
            Developer note: values are sanitized, deduplicated, and stored via the category configuration service. Use this tool to verify migration or import scenarios.
          </p>
        </div>
      )}
    />
  );
}

export default CategoryConfigDevPanel;
