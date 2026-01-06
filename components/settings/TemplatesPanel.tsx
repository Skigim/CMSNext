import { useCallback } from "react";
import { FileText, FileCheck, FileSignature } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import VRScriptsEditor from "../category/VRScriptsEditor";
import { SummaryTemplateEditor } from "./SummaryTemplateEditor";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import type { VRScript } from "@/types/vr";
import type { SummaryTemplateConfig } from "@/types/categoryConfig";

/**
 * TemplatesPanel - Consolidated text generation templates management
 * 
 * Provides a unified interface for managing all text generation templates:
 * - VR (Verification Request) Scripts
 * - Case Summary Templates
 * - Narrative Templates
 * - Future: Note templates, Email templates, Letter templates
 */
export function TemplatesPanel() {
  const { config, updateCategory, loading } = useCategoryConfig();

  const handleSaveVRScripts = useCallback(
    async (scripts: VRScript[]) => {
      await updateCategory('vrScripts', scripts);
    },
    [updateCategory]
  );

  const handleSaveSummaryTemplate = useCallback(
    async (template: SummaryTemplateConfig) => {
      await updateCategory('summaryTemplate', template);
    },
    [updateCategory]
  );

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
          <VRScriptsEditor
            scripts={config.vrScripts ?? []}
            onSave={handleSaveVRScripts}
            isGloballyLoading={loading}
          />
        </CardContent>
      </Card>

      {/* Case Summary Templates Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            <CardTitle>Case Summary Template</CardTitle>
          </div>
          <CardDescription>
            Configure the default section order and visibility for case summary exports.
            These settings control the "Generate Case Summary" feature in case details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SummaryTemplateEditor
            template={config.summaryTemplate}
            onSave={handleSaveSummaryTemplate}
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
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <h4 className="text-sm font-medium mb-2">Available Narrative Generators</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Some narrative templates are already integrated into the application:
              </p>
              <div className="text-xs text-muted-foreground">
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li>
                    <strong>AVS Narrative</strong> - Automatically generates AVS consent date,
                    submit date, 5-day, and 11-day tracking dates (available in Intake view)
                  </li>
                </ul>
              </div>
            </div>
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Custom narrative templates coming soon...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Future support for eligibility narratives, case action templates, and more
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
