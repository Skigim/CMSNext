import { useCallback, useState } from "react";
import { FileText, FileCheck, FileSignature, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { TemplateEditor } from "./TemplateEditor";
import { useTemplates } from "@/contexts/TemplateContext";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { useDataManagerSafe } from "@/contexts/DataManagerContext";

/**
 * TemplatesPanel - Consolidated text generation templates management
 * 
 * Provides a unified interface for managing all text generation templates:
 * - VR (Verification Request) Scripts
 * - Case Summary Templates
 * - Narrative Templates
 * 
 * All templates use the unified Template type with {field} placeholder syntax.
 */
export function TemplatesPanel() {
  const { loading, templates, addTemplate, refresh } = useTemplates();
  const { config } = useCategoryConfig();
  const dataManager = useDataManagerSafe();
  const [isMigrating, setIsMigrating] = useState(false);

  const handleManualMigration = useCallback(async () => {
    if (!dataManager) {
      toast.error("DataManager not available");
      console.error("[Migration] DataManager is null");
      return;
    }

    setIsMigrating(true);
    console.log("[Migration] Starting manual migration...");
    
    try {
      // Get current state
      const vrScripts = config.vrScripts ?? [];
      console.log("[Migration] Found vrScripts in CategoryConfig:", vrScripts.length, vrScripts);
      console.log("[Migration] Current templates:", templates.length, templates);

      if (vrScripts.length === 0) {
        toast.info("No VR scripts found in CategoryConfig to migrate");
        console.log("[Migration] No vrScripts to migrate");
        setIsMigrating(false);
        return;
      }

      // Check for duplicates
      const existingIds = new Set(templates.map(t => t.id));
      const existingNames = new Set(templates.map(t => t.name));
      console.log("[Migration] Existing template IDs:", [...existingIds]);
      console.log("[Migration] Existing template names:", [...existingNames]);

      const scriptsToMigrate = vrScripts.filter(s => {
        const skipById = existingIds.has(s.id);
        const skipByName = existingNames.has(s.name);
        console.log(`[Migration] Script "${s.name}" (${s.id}): skipById=${skipById}, skipByName=${skipByName}`);
        return !skipById && !skipByName;
      });

      if (scriptsToMigrate.length === 0) {
        toast.info("All VR scripts have already been migrated");
        console.log("[Migration] All scripts already migrated");
        setIsMigrating(false);
        return;
      }

      console.log("[Migration] Scripts to migrate:", scriptsToMigrate.length);

      // Migrate each script
      let migrated = 0;
      for (const script of scriptsToMigrate) {
        console.log(`[Migration] Migrating: "${script.name}"...`);
        try {
          const result = await addTemplate({
            name: script.name,
            category: 'vr',
            template: script.template,
          });
          if (result) {
            console.log(`[Migration] Success: "${script.name}" -> ${result.id}`);
            migrated++;
          } else {
            console.error(`[Migration] Failed: "${script.name}" - addTemplate returned null`);
          }
        } catch (err) {
          console.error(`[Migration] Error migrating "${script.name}":`, err);
        }
      }

      // Refresh to see changes
      await refresh();
      
      toast.success(`Migrated ${migrated} VR template(s)`);
      console.log(`[Migration] Complete. Migrated ${migrated} templates.`);
    } catch (err) {
      console.error("[Migration] Unexpected error:", err);
      toast.error("Migration failed - check console");
    } finally {
      setIsMigrating(false);
    }
  }, [dataManager, config.vrScripts, templates, addTemplate, refresh]);

  const vrScriptsCount = config.vrScripts?.length ?? 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Text Generation Templates</CardTitle>
          </div>
          <CardDescription>
            Create and manage reusable templates for generating verification requests,
            case summaries, narratives, and other text content. Templates support dynamic
            placeholders that automatically fill in case and financial data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <h4 className="text-sm font-medium mb-2">What are templates?</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Templates are pre-written text snippets with placeholders that get replaced
                with actual data when you generate content. For example, a VR script can
                include <code className="text-xs bg-background px-1 py-0.5 rounded">
                  {"{item.type}"}
                </code> which will be replaced with the actual financial item type.
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Available template types:</strong></p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li>VR Scripts - Verification Request templates</li>
                  <li>Case Summaries - Configurable case information exports</li>
                  <li>Narratives - Case note and narrative templates</li>
                </ul>
              </div>
            </div>

            {/* Migration Tool */}
            {vrScriptsCount > 0 && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                <h4 className="text-sm font-medium mb-2 text-amber-600 dark:text-amber-400">
                  Legacy VR Scripts Detected
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Found <strong>{vrScriptsCount}</strong> VR script(s) in the old CategoryConfig format.
                  Click the button below to migrate them to the new unified template system.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualMigration}
                    disabled={isMigrating || loading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isMigrating ? 'animate-spin' : ''}`} />
                    {isMigrating ? 'Migrating...' : 'Migrate VR Scripts'}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    (Check browser console for detailed logs)
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* VR Scripts Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            <CardTitle>VR Scripts</CardTitle>
          </div>
          <CardDescription>
            Create reusable templates for generating Verification Requests. Use placeholders
            to dynamically insert case information, financial details, and dates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateEditor
            category="vr"
            isGloballyLoading={loading}
          />
        </CardContent>
      </Card>

      {/* Case Summary Templates Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            <CardTitle>Case Summary Templates</CardTitle>
          </div>
          <CardDescription>
            Create templates for generating case summary sections. Each section can have
            its own template with placeholders for case and person data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateEditor
            category="summary"
            isGloballyLoading={loading}
          />
        </CardContent>
      </Card>

      {/* Narrative Templates Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Narrative Templates</CardTitle>
          </div>
          <CardDescription>
            Create templates for common case narratives like AVS tracking, eligibility
            determinations, and case actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateEditor
            category="narrative"
            isGloballyLoading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}