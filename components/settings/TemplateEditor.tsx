import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Undo2, Trash2, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
import type { Template, TemplateCategory, PlaceholderField } from "@/types/template";
import { TEMPLATE_PLACEHOLDER_FIELDS, TEMPLATE_CATEGORY_LABELS } from "@/types/template";
import { useTemplates } from "@/contexts/TemplateContext";
import { cn } from "../ui/utils";

// ============================================================================
// Types
// ============================================================================

type TemplateEditorProps = {
  /** Which template category to manage */
  category: TemplateCategory;
  /** Optional: custom placeholder fields (overrides defaults) */
  customPlaceholders?: Record<string, PlaceholderField>;
  /** Whether the parent context is loading */
  isGloballyLoading?: boolean;
};

// ============================================================================
// Placeholder Palette Component
// ============================================================================

type PlaceholderPaletteProps = {
  category: TemplateCategory;
  customPlaceholders?: Record<string, PlaceholderField>;
  onInsert: (placeholder: string) => void;
  disabled?: boolean;
};

function PlaceholderPalette({
  category,
  customPlaceholders,
  onInsert,
  disabled,
}: Readonly<PlaceholderPaletteProps>) {
  // Get placeholders available for this category
  const placeholdersByFieldCategory = useMemo(() => {
    const fields = customPlaceholders ?? TEMPLATE_PLACEHOLDER_FIELDS;
    const grouped: Record<string, Array<{ field: string; label: string }>> = {};
    
    for (const [field, config] of Object.entries(fields)) {
      // Only include placeholders available for this template category
      if (!config.availableFor.includes(category)) continue;
      
      const fieldCategory = config.fieldCategory;
      if (!grouped[fieldCategory]) {
        grouped[fieldCategory] = [];
      }
      grouped[fieldCategory].push({ field, label: config.label });
    }
    
    return grouped;
  }, [category, customPlaceholders]);
  
  // Order the categories in a logical way
  const categoryOrder = ["Financial Item", "Amount History", "Case", "Person", "System"];
  const orderedCategories = categoryOrder.filter(cat => placeholdersByFieldCategory[cat]);

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-muted-foreground">
        Click to insert placeholder
      </Label>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {orderedCategories.map(fieldCategory => (
          <div key={fieldCategory} className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {fieldCategory}
            </p>
            <div className="flex flex-wrap gap-1">
              {placeholdersByFieldCategory[fieldCategory].map(({ field, label }) => (
                <Tooltip key={field}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => onInsert(`{${field}}`)}
                      disabled={disabled}
                    >
                      {label}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <code className="text-xs">{`{${field}}`}</code>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Template View Row Component (Read-only)
// ============================================================================

type TemplateViewRowProps = {
  template: Template;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
};

function TemplateViewRow({
  template,
  onEdit,
  onDelete,
  disabled,
  isExpanded,
  onToggleExpand,
}: Readonly<TemplateViewRowProps>) {
  const hasContent = (template.template ?? "").trim().length > 0;

  return (
    <div className="rounded-lg border border-border/50 bg-background/60 overflow-hidden">
      {/* Header Row */}
      <div 
        className={cn(
          "flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50 transition-colors",
          isExpanded && "border-b border-border/50"
        )}
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggleExpand()}
      >
        <div className="text-muted-foreground">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{template.name}</span>
            {hasContent && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {template.template.length} chars
              </Badge>
            )}
            {!hasContent && (
              <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">
                No content
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                disabled={disabled}
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="sr-only">Edit</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit template</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                disabled={disabled}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Delete</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete template</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && hasContent && (
        <div className="p-3 bg-muted/30">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
            {template.template}
          </pre>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Template Edit Row Component
// ============================================================================

type TemplateEditRowProps = {
  template: Template;
  category: TemplateCategory;
  customPlaceholders?: Record<string, PlaceholderField>;
  onSave: (updates: { name: string; template: string }) => void;
  onCancel: () => void;
  disabled: boolean;
  isNew?: boolean;
};

function TemplateEditRow({
  template,
  category,
  customPlaceholders,
  onSave,
  onCancel,
  disabled,
  isNew,
}: Readonly<TemplateEditRowProps>) {
  const [name, setName] = useState(template.name);
  const [content, setContent] = useState(template.template);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasChanges = name !== template.name || content !== template.template;
  const isValid = name.trim().length > 0;

  const handleInsertPlaceholder = useCallback((placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.slice(0, start) + placeholder + content.slice(end);
    
    setContent(newContent);
    
    // Restore cursor position after placeholder
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + placeholder.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }, [content]);

  const handleSave = () => {
    if (isValid) {
      onSave({ name: name.trim(), template: content });
    }
  };

  return (
    <div className="rounded-lg border-2 border-primary/50 bg-background p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Label htmlFor="template-name" className="text-xs text-muted-foreground mb-1 block">
            Template Name
          </Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter template name..."
            disabled={disabled}
            className="h-9"
          />
        </div>
        <div className="flex items-center gap-1 pt-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onCancel}
                disabled={disabled}
              >
                <Undo2 className="h-4 w-4" />
                <span className="sr-only">Cancel</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cancel</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleSave}
                disabled={disabled || !isValid || (!isNew && !hasChanges)}
              >
                <Save className="h-4 w-4" />
                <span className="sr-only">Save</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isNew ? "Create template" : "Save changes"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          <Label htmlFor="template-content" className="text-xs text-muted-foreground">
            Template Content
          </Label>
          <Textarea
            id="template-content"
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter template content with {placeholder} fields..."
            disabled={disabled}
            className="min-h-[200px] font-mono text-sm"
          />
        </div>
        <div className="lg:col-span-1">
          <PlaceholderPalette
            category={category}
            customPlaceholders={customPlaceholders}
            onInsert={handleInsertPlaceholder}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Template Editor Component
// ============================================================================

/**
 * TemplateEditor - Unified editor for all template categories
 * 
 * Manages templates for VR, Summary, or Narrative categories.
 * Uses the TemplateContext for CRUD operations.
 */
export function TemplateEditor({
  category,
  customPlaceholders,
  isGloballyLoading = false,
}: Readonly<TemplateEditorProps>) {
  const { templates, loading, addTemplate, updateTemplate, deleteTemplate } = useTemplates();
  
  // Filter templates by category
  const categoryTemplates = useMemo(
    () => templates.filter(t => t.category === category),
    [templates, category]
  );

  // UI state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDisabled = loading || isGloballyLoading || isSaving;

  // Reset editing state when templates change
  useEffect(() => {
    if (!categoryTemplates.some(t => t.id === editingId)) {
      setEditingId(null);
    }
  }, [categoryTemplates, editingId]);

  const handleCreate = useCallback(async (data: { name: string; template: string }) => {
    setIsSaving(true);
    try {
      await addTemplate({
        name: data.name,
        category,
        template: data.template,
      });
      setIsCreating(false);
    } finally {
      setIsSaving(false);
    }
  }, [addTemplate, category]);

  const handleUpdate = useCallback(async (id: string, data: { name: string; template: string }) => {
    setIsSaving(true);
    try {
      await updateTemplate(id, {
        name: data.name,
        template: data.template,
      });
      setEditingId(null);
    } finally {
      setIsSaving(false);
    }
  }, [updateTemplate]);

  const handleDelete = useCallback(async (id: string) => {
    setIsSaving(true);
    try {
      await deleteTemplate(id);
      setDeleteDialogId(null);
    } finally {
      setIsSaving(false);
    }
  }, [deleteTemplate]);

  const templateToDelete = categoryTemplates.find(t => t.id === deleteDialogId);
  const categoryLabel = TEMPLATE_CATEGORY_LABELS[category];

  return (
    <div className="space-y-4">
      {/* Template List */}
      <div className="space-y-2">
        {categoryTemplates.map(template => (
          <div key={template.id}>
            {editingId === template.id ? (
              <TemplateEditRow
                template={template}
                category={category}
                customPlaceholders={customPlaceholders}
                onSave={(data) => handleUpdate(template.id, data)}
                onCancel={() => setEditingId(null)}
                disabled={isDisabled}
              />
            ) : (
              <TemplateViewRow
                template={template}
                onEdit={() => setEditingId(template.id)}
                onDelete={() => setDeleteDialogId(template.id)}
                disabled={isDisabled}
                isExpanded={expandedId === template.id}
                onToggleExpand={() => 
                  setExpandedId(prev => prev === template.id ? null : template.id)
                }
              />
            )}
          </div>
        ))}

        {categoryTemplates.length === 0 && !isCreating && (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No {categoryLabel.toLowerCase()} templates yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Add Template" to create your first template
            </p>
          </div>
        )}
      </div>

      {/* Create New Template */}
      {isCreating && (
        <TemplateEditRow
          template={{
            id: "new",
            name: "",
            category,
            template: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          category={category}
          customPlaceholders={customPlaceholders}
          onSave={handleCreate}
          onCancel={() => setIsCreating(false)}
          disabled={isDisabled}
          isNew
        />
      )}

      {/* Add Button */}
      {!isCreating && !editingId && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCreating(true)}
          disabled={isDisabled}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add {categoryLabel} Template
        </Button>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteDialogId !== null} 
        onOpenChange={(open) => !open && setDeleteDialogId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialogId && handleDelete(deleteDialogId)}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

