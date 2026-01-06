import { useCallback } from "react";
import { FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import VRScriptsEditor from "../category/VRScriptsEditor";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";

/**
 * TemplatesPanel - Consolidated text generation templates management
 * 
 * Provides a unified interface for managing all text generation templates:
 * - VR (Verification Request) Scripts
 * - Future: Note templates
 * - Future: Email templates
 * - Future: Letter templates
 */
export function TemplatesPanel() {
  const { config, updateCategory } = useCategoryConfig();

  const handleSaveVRScripts = useCallback(
    async (scripts: Array<{ name: string; template: string }>) => {
      await updateCategory('vrScripts', scripts as unknown as string[]);
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
            notes, and other text content. Templates support dynamic placeholders that
            automatically fill in case and financial data.
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
                <p><strong>Current template types:</strong></p>
                <ul className="list-disc list-inside ml-2">
                  <li>VR Scripts - Verification Request templates</li>
                </ul>
                <p className="mt-2 italic">More template types coming soon...</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VR Scripts Section */}
      <Card>
        <CardHeader>
          <CardTitle>VR Scripts</CardTitle>
          <CardDescription>
            Create reusable templates for generating Verification Requests. Use placeholders
            to dynamically insert case information, financial details, and dates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VRScriptsEditor
            scripts={config.vrScripts ?? []}
            onSave={handleSaveVRScripts}
            isGloballyLoading={false}
          />
        </CardContent>
      </Card>

      {/* Future sections placeholder */}
      {/* 
      <Card>
        <CardHeader>
          <CardTitle>Note Templates</CardTitle>
          <CardDescription>Coming soon...</CardDescription>
        </CardHeader>
      </Card>
      */}
    </div>
  );
}
