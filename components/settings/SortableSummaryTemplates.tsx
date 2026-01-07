/**
 * SortableSummaryTemplates
 * ========================
 * Drag-and-drop sortable list for case summary section templates.
 * Allows reordering sections to control how they appear in generated summaries.
 */

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, ChevronDown } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../ui/utils";
import { useTemplates } from "@/contexts/TemplateContext";
import type { Template } from "@/types/template";
import type { SummarySectionKey } from "@/types/categoryConfig";

// ============================================================================
// Types
// ============================================================================

type SortableSummaryTemplatesProps = {
  isGloballyLoading?: boolean;
};

// Section labels for display
const SECTION_LABELS: Record<SummarySectionKey, string> = {
  notes: "Notes",
  caseInfo: "Case Info",
  personInfo: "Person Info",
  relationships: "Relationships",
  resources: "Resources",
  income: "Income",
  expenses: "Expenses",
  avsTracking: "AVS Tracking",
};

// ============================================================================
// Sortable Item Component
// ============================================================================

type SortableTemplateItemProps = {
  template: Template;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSave: (content: string) => void;
  isSaving: boolean;
};

function SortableTemplateItem({
  template,
  isExpanded,
  onToggleExpand,
  onSave,
  isSaving,
}: SortableTemplateItemProps) {
  const [editedContent, setEditedContent] = useState(template.template);
  const hasChanges = editedContent !== template.template;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: template.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSave = useCallback(() => {
    onSave(editedContent);
  }, [editedContent, onSave]);

  const handleReset = useCallback(() => {
    setEditedContent(template.template);
  }, [template.template]);

  const sectionLabel = template.sectionKey 
    ? SECTION_LABELS[template.sectionKey] 
    : template.name;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card transition-shadow",
        isDragging && "shadow-lg ring-2 ring-primary/20 z-10",
      )}
    >
      {/* Header row - always visible */}
      <div className="flex items-center gap-2 p-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted touch-none"
          aria-label={`Drag to reorder ${sectionLabel}`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Section name */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm">{sectionLabel}</span>
          {template.sectionKey && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {template.sectionKey}
            </Badge>
          )}
        </div>

        {/* Expand/Edit button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleExpand}
          className="gap-1"
        >
          {isExpanded ? (
            <>
              <ChevronDown className="h-4 w-4" />
              <span className="sr-only">Collapse</span>
            </>
          ) : (
            <>
              <Pencil className="h-3 w-3" />
              <span className="text-xs">Edit</span>
            </>
          )}
        </Button>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 space-y-3 border-t">
          <div className="pt-3">
            <Label className="text-xs text-muted-foreground mb-1 block">
              Template content (use {"{placeholder}"} syntax)
            </Label>
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="font-mono text-xs min-h-[100px]"
              placeholder="Enter template content..."
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            {hasChanges && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isSaving}
              >
                Reset
              </Button>
            )}
            {!hasChanges && (
              <span className="text-xs text-muted-foreground">No changes</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SortableSummaryTemplates({ isGloballyLoading }: SortableSummaryTemplatesProps) {
  const { getTemplatesByCategory, updateTemplate, reorderTemplates, loading } = useTemplates();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Get summary templates sorted by sortOrder
  const summaryTemplates = useMemo(() => 
    getTemplatesByCategory("summary"),
    [getTemplatesByCategory]
  );

  // Track local order during drag operations
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const orderedIds = localOrder.length > 0 
    ? localOrder 
    : summaryTemplates.map(t => t.id);

  // Build ordered template list
  const orderedTemplates = useMemo(() => {
    const templateMap = new Map(summaryTemplates.map(t => [t.id, t]));
    return orderedIds
      .map(id => templateMap.get(id))
      .filter((t): t is Template => t !== undefined);
  }, [summaryTemplates, orderedIds]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before activating
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    
    const newOrder = arrayMove(orderedIds, oldIndex, newIndex);
    setLocalOrder(newOrder);

    // Persist the new order
    await reorderTemplates(newOrder);
    setLocalOrder([]); // Clear local state, let context take over
  }, [orderedIds, reorderTemplates]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handleSave = useCallback(async (id: string, content: string) => {
    setSavingId(id);
    try {
      await updateTemplate(id, { template: content });
    } finally {
      setSavingId(null);
    }
  }, [updateTemplate]);

  if (isGloballyLoading || loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (summaryTemplates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No summary templates found.</p>
        <p className="text-xs mt-1">
          Summary templates are created automatically when you first use the case summary feature.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <GripVertical className="h-3 w-3" />
        <span>Drag sections to change their order in generated summaries</span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {orderedTemplates.map(template => (
              <SortableTemplateItem
                key={template.id}
                template={template}
                isExpanded={expandedId === template.id}
                onToggleExpand={() => handleToggleExpand(template.id)}
                onSave={(content) => handleSave(template.id, content)}
                isSaving={savingId === template.id}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
