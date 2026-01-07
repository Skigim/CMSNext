import { useState, useCallback, useMemo } from "react";
import { FileText, FileCheck, FileSignature, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { TemplateEditor } from "./TemplateEditor";
import { useTemplates } from "@/contexts/TemplateContext";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { 
  generateDefaultSectionTemplates, 
  needsSummaryTemplateMigration,
  migrateSummaryTemplates,
  mergeSectionTemplates,
} from "@/utils/summarySectionMigration";
import { toast } from "sonner";

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
  const { loading, getTemplatesByCategory, addTemplate } = useTemplates();
  const { config } = useCategoryConfig();
  const [migrating, setMigrating] = useState(false);

  // Check if summary templates exist in the Template system
  const summaryTemplates = useMemo(() => 
    getTemplatesByCategory('summary'),
    [getTemplatesByCategory]
  );

  // Check if legacy templates need migration
  const hasLegacyTemplates = useMemo(() => 
    needsSummaryTemplateMigration(config.summaryTemplate),
    [config.summaryTemplate]
  );

  // Determine migration state
  const needsInitialization = summaryTemplates.length === 0;
  const showMigrationPrompt = needsInitialization || hasLegacyTemplates;

  /**
   * Run summary template migration
   * - If legacy templates exist in CategoryConfig, migrate those
   * - Otherwise, generate default section templates
   */
  const handleMigration = useCallback(async () => {
    setMigrating(true);
    const loadingToast = toast.loading("Migrating summary templates...");

    try {
      let templatesToAdd;

      if (hasLegacyTemplates) {
        // Migrate from legacy CategoryConfig
        const migrated = migrateSummaryTemplates(config.summaryTemplate);
        templatesToAdd = mergeSectionTemplates(summaryTemplates, migrated);
        // Filter to only new templates (not already in system)
        templatesToAdd = templatesToAdd.filter(t => 
          !summaryTemplates.some(existing => existing.sectionKey === t.sectionKey)
        );
      } else {
        // Generate fresh defaults
        const defaults = generateDefaultSectionTemplates();
        templatesToAdd = defaults.filter(t => 
          !summaryTemplates.some(existing => existing.sectionKey === t.sectionKey)
        );
      }

      // Add each template
      let successCount = 0;
      for (const template of templatesToAdd) {
        const result = await addTemplate({
          name: template.name,
          category: template.category,
          template: template.template,
          sectionKey: template.sectionKey,
        });
        if (result) successCount++;
      }

      toast.dismiss(loadingToast);
      
      if (successCount > 0) {
        toast.success(`Migrated ${successCount} summary template${successCount > 1 ? 's' : ''}`);
      } else if (templatesToAdd.length === 0) {
        toast.info("All summary templates are already up to date");
      } else {
        toast.error("Failed to migrate templates");
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("Migration failed: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setMigrating(false);
    }
  }, [hasLegacyTemplates, config.summaryTemplate, summaryTemplates, addTemplate]);

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
        <CardContent className="space-y-4">
          {/* Migration Prompt */}
          {showMigrationPrompt && (
            <Alert variant={hasLegacyTemplates ? "default" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {hasLegacyTemplates 
                  ? "Legacy Templates Found" 
                  : "Initialize Summary Templates"}
              </AlertTitle>
              <AlertDescription className="mt-2">
                <p className="text-sm mb-3">
                  {hasLegacyTemplates 
                    ? "Custom summary templates were found in your category configuration. Click below to migrate them to the new Template system."
                    : "No summary section templates found. Click below to create the default templates for all 8 case summary sections."}
                </p>
                <Button 
                  onClick={handleMigration} 
                  disabled={migrating || loading}
                  size="sm"
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${migrating ? 'animate-spin' : ''}`} />
                  {migrating 
                    ? "Migrating..." 
                    : hasLegacyTemplates 
                      ? "Migrate Legacy Templates" 
                      : "Generate Default Templates"}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Show success state if templates exist */}
          {!showMigrationPrompt && summaryTemplates.length > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-700">Templates Ready</AlertTitle>
              <AlertDescription>
                {summaryTemplates.length} summary section template{summaryTemplates.length > 1 ? 's' : ''} configured.
              </AlertDescription>
            </Alert>
          )}

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