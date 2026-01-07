import { FileText, FileCheck, FileSignature } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { TemplateEditor } from "./TemplateEditor";
import { useTemplates } from "@/contexts/TemplateContext";

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
  const { loading } = useTemplates();

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