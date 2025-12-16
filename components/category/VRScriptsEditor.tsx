import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Save, Undo2, Trash2, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
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
import type { VRScript } from "@/types/vr";
import { getPlaceholdersByCategory, createDefaultVRScript } from "@/utils/vrGenerator";
import { cn } from "../ui/utils";

// ============================================================================
// Types
// ============================================================================

type VRScriptsEditorProps = {
  scripts: VRScript[];
  onSave: (scripts: VRScript[]) => Promise<void>;
  isGloballyLoading: boolean;
};

// ============================================================================
// Placeholder Palette Component
// ============================================================================

type PlaceholderPaletteProps = {
  onInsert: (placeholder: string) => void;
  disabled?: boolean;
};

function PlaceholderPalette({ onInsert, disabled }: PlaceholderPaletteProps) {
  const placeholdersByCategory = useMemo(() => getPlaceholdersByCategory(), []);
  
  // Order the categories in a logical way
  const categoryOrder = ["Financial Item", "Amount History", "Case", "Person", "System"];
  const orderedCategories = categoryOrder.filter(cat => placeholdersByCategory[cat]);

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-muted-foreground">
        Click to insert placeholder
      </Label>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {orderedCategories.map(category => (
          <div key={category} className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {category}
            </p>
            <div className="flex flex-wrap gap-1">
              {placeholdersByCategory[category].map(({ field, label }) => (
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
// Script View Row Component (Read-only)
// ============================================================================

type ScriptViewRowProps = {
  script: VRScript;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
};

function ScriptViewRow({
  script,
  onEdit,
  onDelete,
  disabled,
  isExpanded,
  onToggleExpand,
}: ScriptViewRowProps) {
  const hasTemplate = (script.template ?? "").trim().length > 0;

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
            <span className="font-medium text-sm truncate">{script.name}</span>
            {hasTemplate && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {script.template.length} chars
              </Badge>
            )}
            {!hasTemplate && (
              <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">
                No template
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEdit}
                disabled={disabled}
                aria-label="Edit script"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit script</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onDelete}
                disabled={disabled}
                aria-label="Delete script"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete script</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Expanded Content (Read-only preview) */}
      {isExpanded && (
        <div className="p-4 bg-muted/20">
          <Label className="text-xs font-medium text-muted-foreground mb-2 block">
            Template Preview
          </Label>
          {hasTemplate ? (
            <pre className="text-sm font-mono bg-background/50 p-3 rounded border border-border/30 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
              {script.template}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground italic">No template content</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Script Editor Row Component (Editable)
// ============================================================================

type ScriptEditorRowProps = {
  script: VRScript;
  onUpdate: (script: VRScript) => void;
  onDelete: () => void;
  onCancel: () => void;
  disabled: boolean;
  isNameDuplicate: boolean;
  isNew: boolean;
};

function ScriptEditorRow({
  script,
  onUpdate,
  onDelete,
  onCancel,
  disabled,
  isNameDuplicate,
  isNew,
}: ScriptEditorRowProps) {
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate({
        ...script,
        name: e.target.value,
        updatedAt: new Date().toISOString(),
      });
    },
    [script, onUpdate]
  );

  const handleTemplateChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate({
        ...script,
        template: e.target.value,
        updatedAt: new Date().toISOString(),
      });
    },
    [script, onUpdate]
  );

  const handleInsertPlaceholder = useCallback(
    (placeholder: string) => {
      if (!textareaRef) return;
      
      const start = textareaRef.selectionStart;
      const end = textareaRef.selectionEnd;
      const before = script.template.slice(0, start);
      const after = script.template.slice(end);
      
      const newTemplate = before + placeholder + after;
      onUpdate({
        ...script,
        template: newTemplate,
        updatedAt: new Date().toISOString(),
      });
      
      // Restore cursor position after the inserted placeholder
      requestAnimationFrame(() => {
        if (textareaRef) {
          const newPos = start + placeholder.length;
          textareaRef.focus();
          textareaRef.setSelectionRange(newPos, newPos);
        }
      });
    },
    [script, onUpdate, textareaRef]
  );

  const isEmpty = !script.name?.trim();

  return (
    <div className="rounded-lg border-2 border-primary/50 bg-background/60 overflow-hidden">
      {/* Header with name input */}
      <div className="flex items-center gap-2 p-3 border-b border-border/50 bg-primary/5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Input
              value={script.name ?? ""}
              onChange={handleNameChange}
              placeholder="Script name..."
              disabled={disabled}
              autoFocus={isNew}
              className={cn(
                "h-8 max-w-[250px]",
                isEmpty && "border-destructive",
                isNameDuplicate && "border-amber-500"
              )}
              aria-label="Script name"
            />
            <Badge variant="outline" className="text-xs shrink-0 bg-primary/10">
              Editing
            </Badge>
          </div>
          {(isEmpty || isNameDuplicate) && (
            <p className="text-xs text-destructive mt-1">
              {isEmpty ? "Name is required" : "Duplicate name"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isNew && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  disabled={disabled}
                >
                  Cancel
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cancel editing</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onDelete}
                disabled={disabled}
                aria-label="Delete script"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete script</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Template Editor - Always shown when editing */}
      <div className="p-4 space-y-4 bg-muted/20">
        <div className="grid gap-4 lg:grid-cols-[1fr,280px]">
          {/* Template Editor */}
          <div className="space-y-2">
            <Label htmlFor={`template-${script.id}`} className="text-sm font-medium">
              Template Content
            </Label>
            <Textarea
              id={`template-${script.id}`}
              ref={setTextareaRef}
              value={script.template}
              onChange={handleTemplateChange}
              placeholder="Enter your VR template text here. Use placeholders like {description}, {amount}, {caseName}, etc."
              disabled={disabled}
              className="min-h-[200px] font-mono text-sm resize-y"
            />
            <p className="text-xs text-muted-foreground">
              Use curly braces for placeholders, e.g., {"{amount}"} or {"{caseName}"}
            </p>
          </div>

          {/* Placeholder Palette */}
          <div className="lg:border-l lg:pl-4 border-border/50">
            <PlaceholderPalette 
              onInsert={handleInsertPlaceholder} 
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main VR Scripts Editor
// ============================================================================

export function VRScriptsEditor({
  scripts,
  onSave,
  isGloballyLoading,
}: VRScriptsEditorProps) {
  const [localScripts, setLocalScripts] = useState<VRScript[]>(() => [...scripts]);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newScriptIds, setNewScriptIds] = useState<Set<string>>(() => new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Sync local state with props when scripts prop changes (e.g., after save)
  // This ensures the UI reflects the persisted state
  useEffect(() => {
    // Only sync if we're not actively saving (to avoid race conditions)
    if (!isSaving) {
      setLocalScripts([...scripts]);
      // Clear editing state after save
      setEditingId(null);
      setNewScriptIds(new Set());
    }
  }, [scripts, isSaving]);

  // Track changes
  const hasChanges = useMemo(() => {
    if (localScripts.length !== scripts.length) return true;
    return localScripts.some((local, index) => {
      const original = scripts[index];
      if (!original) return true;
      return (
        local.name !== original.name ||
        local.template !== original.template
      );
    });
  }, [localScripts, scripts]);

  // Validation
  const validation = useMemo(() => {
    const nameCount = new Map<string, number>();
    localScripts.forEach(s => {
      const name = s.name?.trim().toLowerCase() ?? "";
      nameCount.set(name, (nameCount.get(name) || 0) + 1);
    });

    const duplicates = new Set(
      Array.from(nameCount.entries())
        .filter(([name, count]) => name && count > 1)
        .map(([name]) => name)
    );

    const hasEmpty = localScripts.some(s => !s.name?.trim());
    const hasDuplicates = duplicates.size > 0;

    return { duplicates, hasEmpty, hasDuplicates, isValid: !hasEmpty && !hasDuplicates };
  }, [localScripts]);

  // Handlers
  const handleAddScript = useCallback(() => {
    const newScript = createDefaultVRScript("New Script");
    setLocalScripts(prev => [...prev, newScript]);
    setEditingId(newScript.id);
    setNewScriptIds(prev => new Set(prev).add(newScript.id));
  }, []);

  const handleUpdateScript = useCallback((updated: VRScript) => {
    setLocalScripts(prev =>
      prev.map(s => (s.id === updated.id ? updated : s))
    );
  }, []);

  const handleDeleteScript = useCallback((id: string) => {
    setLocalScripts(prev => prev.filter(s => s.id !== id));
    if (editingId === id) {
      setEditingId(null);
    }
    if (expandedId === id) {
      setExpandedId(null);
    }
    setNewScriptIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDeleteConfirmId(null);
  }, [editingId, expandedId]);

  const handleCancelEdit = useCallback((id: string) => {
    // If it's a new script that hasn't been saved, remove it
    if (newScriptIds.has(id)) {
      setLocalScripts(prev => prev.filter(s => s.id !== id));
      setNewScriptIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      // Revert to saved version
      const savedScript = scripts.find(s => s.id === id);
      if (savedScript) {
        setLocalScripts(prev =>
          prev.map(s => (s.id === id ? { ...savedScript } : s))
        );
      }
    }
    setEditingId(null);
  }, [newScriptIds, scripts]);

  const handleRevert = useCallback(() => {
    setLocalScripts([...scripts]);
    setEditingId(null);
    setExpandedId(null);
    setNewScriptIds(new Set());
  }, [scripts]);

  const handleSave = useCallback(async () => {
    if (!validation.isValid) return;
    setIsSaving(true);
    try {
      await onSave(localScripts);
      // editingId will be cleared by the useEffect when scripts prop updates
    } finally {
      setIsSaving(false);
    }
  }, [localScripts, onSave, validation.isValid]);

  const isDisabled = isSaving || isGloballyLoading;
  const canSave = hasChanges && validation.isValid && !isDisabled;

  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">VR Scripts</p>
          <p className="text-xs text-muted-foreground max-w-xl">
            Create and manage Verification Request templates. Scripts can be applied to financial items to generate VR letters.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {localScripts.length} script{localScripts.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <Separator className="my-4" />

      <div className="mb-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddScript}
          disabled={isDisabled}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Script
        </Button>
      </div>

      <div className="space-y-3">
        {localScripts.map(script => {
          const isEditing = editingId === script.id;
          const isNew = newScriptIds.has(script.id);
          
          if (isEditing) {
            return (
              <ScriptEditorRow
                key={script.id}
                script={script}
                onUpdate={handleUpdateScript}
                onDelete={() => setDeleteConfirmId(script.id)}
                onCancel={() => handleCancelEdit(script.id)}
                disabled={isDisabled}
                isNameDuplicate={validation.duplicates.has((script.name ?? "").trim().toLowerCase())}
                isNew={isNew}
              />
            );
          }
          
          return (
            <ScriptViewRow
              key={script.id}
              script={script}
              onEdit={() => setEditingId(script.id)}
              onDelete={() => setDeleteConfirmId(script.id)}
              disabled={isDisabled}
              isExpanded={expandedId === script.id}
              onToggleExpand={() => setExpandedId(expandedId === script.id ? null : script.id)}
            />
          );
        })}

        {localScripts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No VR scripts configured yet.</p>
            <p className="text-xs mt-1">Click "Add Script" to create your first template.</p>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={handleRevert}
          disabled={isDisabled || !hasChanges}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Revert
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
        >
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete VR Script?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The script will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDeleteScript(deleteConfirmId)}
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

export default VRScriptsEditor;
