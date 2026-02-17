/**
 * Narrative Generator Modal
 * 
 * Modal for generating narrative text from templates.
 * User selects a template, previews the rendered content, and copies to clipboard.
 */

import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Separator } from "../ui/separator";
import { Copy, FileText, AlertCircle, Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import type { StoredCase } from "@/types/case";
import { useTemplates } from "@/contexts/TemplateContext";
import { buildCaseLevelContext, renderTemplate } from "@/utils/vrGenerator";

interface NarrativeGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storedCase: StoredCase;
}

export function NarrativeGeneratorModal({
  open,
  onOpenChange,
  storedCase,
}: Readonly<NarrativeGeneratorModalProps>) {
  // Get narrative templates from unified template system
  const { getTemplatesByCategory } = useTemplates();
  const narrativeTemplates = useMemo(
    () => getTemplatesByCategory("narrative"),
    [getTemplatesByCategory]
  );

  // Local state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [renderedText, setRenderedText] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelectedTemplateId(narrativeTemplates[0]?.id ?? null);
      setRenderedText("");
    }
  }

  const selectedTemplate = narrativeTemplates.find(t => t.id === selectedTemplateId);

  const handleAddTemplate = useCallback(() => {
    if (!selectedTemplate) {
      toast.error("Select a template first");
      return;
    }

    // Render template with case context
    const caseContext = buildCaseLevelContext(storedCase);
    const textToAdd = renderTemplate(selectedTemplate.template, caseContext);

    // Append to existing text with separator
    if (renderedText) {
      setRenderedText(renderedText + "\n-----\n" + textToAdd);
    } else {
      setRenderedText(textToAdd);
    }

    toast.success("Template added");
  }, [selectedTemplate, renderedText, storedCase]);

  const handleCopy = async () => {
    if (!renderedText) {
      toast.error("Nothing to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(renderedText);
      toast.success("Narrative copied to clipboard");
      onOpenChange(false);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleClear = useCallback(() => {
    setRenderedText("");
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-papercut-context="NarrativeGenerator" className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Narrative
          </DialogTitle>
          <DialogDescription>
            Select a narrative template to generate case notes, AVS tracking, or other text snippets.
          </DialogDescription>
        </DialogHeader>

        {narrativeTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Narrative Templates</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Create narrative templates in Settings → Templates tab to generate text snippets.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Go to Settings
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* Template selector */}
            <div className="space-y-2">
              <Label htmlFor="narrative-template">Template</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedTemplateId ?? ""}
                  onValueChange={(value) => setSelectedTemplateId(value || null)}
                >
                  <SelectTrigger id="narrative-template" className="flex-1">
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {narrativeTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTemplate}
                  disabled={!selectedTemplateId}
                  className="px-2"
                  title="Add selected template to output"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Template preview info */}
            {selectedTemplate && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="text-muted-foreground">
                  <strong>Preview:</strong> Click + to render this template with case data.
                  You can add multiple templates and edit the result before copying.
                </p>
              </div>
            )}

            <Separator />

            {/* Output */}
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <div className="flex items-center justify-between">
                <Label htmlFor="narrative-output">Generated Text</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    disabled={!renderedText}
                    className="h-7"
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    disabled={!renderedText}
                    className="h-7"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
              <Textarea
                id="narrative-output"
                value={renderedText}
                onChange={(e) => setRenderedText(e.target.value)}
                placeholder="Select a template and click + to generate text..."
                className="flex-1 min-h-[200px] font-mono text-sm resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleCopy} disabled={!renderedText}>
            <Copy className="h-4 w-4 mr-2" />
            Copy & Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

