import { useCallback, useEffect, useState } from "react";
import { GripVertical, Save, Undo2, Eye, EyeOff } from "lucide-react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { cn } from "../ui/utils";
import type { SummaryTemplateConfig, SummarySectionKey } from "@/types/categoryConfig";

type SummaryTemplateEditorProps = {
  template: SummaryTemplateConfig;
  onSave: (template: SummaryTemplateConfig) => Promise<void>;
  isGloballyLoading: boolean;
};

// Human-readable labels for section keys
const SECTION_LABELS: Record<SummarySectionKey, string> = {
  notes: "Notes",
  caseInfo: "Case Information",
  personInfo: "Person Information",
  relationships: "Relationships/Representatives",
  resources: "Resources",
  income: "Income",
  expenses: "Expenses",
  avsTracking: "AVS Tracking",
};

// Section descriptions
const SECTION_DESCRIPTIONS: Record<SummarySectionKey, string> = {
  notes: "Case notes with MLTC prefix",
  caseInfo: "Application date, retro months, waiver status",
  personInfo: "Name, age, contact info, citizenship, aged/disabled",
  relationships: "Family members and representatives",
  resources: "Bank accounts, assets, property",
  income: "Employment, benefits, other income sources",
  expenses: "Medical, housing, and other expenses",
  avsTracking: "AVS submission and tracking dates",
};

export function SummaryTemplateEditor({ 
  template, 
  onSave, 
  isGloballyLoading 
}: SummaryTemplateEditorProps) {
  const [localTemplate, setLocalTemplate] = useState(template);
  const [isDirty, setIsDirty] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Sync with props when they change (e.g., after save or external update)
  useEffect(() => {
    setLocalTemplate(template);
    setIsDirty(false);
  }, [template]);

  const handleToggleSection = useCallback((section: SummarySectionKey) => {
    setLocalTemplate(prev => ({
      ...prev,
      defaultSections: {
        ...prev.defaultSections,
        [section]: !prev.defaultSections[section],
      },
    }));
    setIsDirty(true);
  }, []);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setLocalTemplate(prev => {
      const newOrder = [...prev.sectionOrder];
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(index, 0, removed);
      return { ...prev, sectionOrder: newOrder };
    });
    setDraggedIndex(index);
    setIsDirty(true);
  }, [draggedIndex]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  const handleSave = useCallback(async () => {
    await onSave(localTemplate);
    setIsDirty(false);
  }, [localTemplate, onSave]);

  const handleReset = useCallback(() => {
    setLocalTemplate(template);
    setIsDirty(false);
  }, [template]);

  const isLoading = isGloballyLoading;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Section Order & Defaults</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Drag to reorder sections. Toggle to set default visibility.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty || isLoading}
          >
            <Undo2 className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isLoading}
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        {localTemplate.sectionOrder.map((section, index) => {
          const isEnabled = localTemplate.defaultSections[section];
          return (
            <div
              key={section}
              draggable={!isLoading}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-3 p-4 border-b last:border-b-0 bg-background",
                "transition-colors hover:bg-muted/50",
                draggedIndex === index && "opacity-50",
                !isLoading && "cursor-move"
              )}
            >
              <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {isEnabled ? (
                    <Eye className="h-4 w-4 text-primary" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-sm">
                    {SECTION_LABELS[section]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {SECTION_DESCRIPTIONS[section]}
                </p>
              </div>

              <Switch
                checked={isEnabled}
                onCheckedChange={() => handleToggleSection(section)}
                disabled={isLoading}
              />
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border bg-muted/50 p-4">
        <h4 className="text-sm font-medium mb-2">How this works</h4>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>
            <strong>Section Order:</strong> Drag sections to change the order they appear in generated summaries
          </li>
          <li>
            <strong>Default Visibility:</strong> Toggle switches control which sections are selected by default in the summary generator
          </li>
          <li>
            <strong>Flexible Generation:</strong> Users can still enable/disable any section when generating a summary
          </li>
        </ul>
      </div>
    </div>
  );
}
