import { useCallback, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ListChecks, Plus, RefreshCcw, Save, Undo2, X, FileText, Bell, Settings2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Checkbox } from "../ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  CATEGORY_DISPLAY_METADATA,
  CategoryKey,
  defaultCategoryConfig,
  type StatusConfig,
  type AlertTypeConfig,
} from "@/types/categoryConfig";
import { COLOR_SLOTS, type ColorSlot } from "@/types/colorSlots";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { useCategoryEditorState, useIsMounted } from "@/hooks";
import { cn } from "../ui/utils";
import { SortableAlertTypes } from "./SortableAlertTypes";

// ============================================================================
// Types
// ============================================================================

type CategoryManagerPanelProps = {
  title?: string;
  description?: string;
  supportingContent?: React.ReactNode;
  accentIcon?: LucideIcon;
  showResetButton?: boolean;
  className?: string;
};

type SimpleItem = { name: string };

// ============================================================================
// Color Slot Picker (shared component)
// ============================================================================

type ColorSlotPickerProps = {
  value: ColorSlot;
  onChange: (slot: ColorSlot) => void;
  disabled?: boolean;
};

function ColorSlotPicker({ value, onChange, disabled }: ColorSlotPickerProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ColorSlot)} disabled={disabled}>
      <SelectTrigger className="w-[52px] px-2" aria-label="Select color">
        <SelectValue>
          <span 
            className="inline-block w-5 h-5 rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: `var(--color-slot-${value})` }}
          />
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[160px]">
        <div className="grid grid-cols-5 gap-1 p-1">
          {COLOR_SLOTS.map(slot => (
            <button
              key={slot}
              type="button"
              onClick={() => onChange(slot)}
              className={cn(
                "w-6 h-6 rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                value === slot && "ring-2 ring-primary ring-offset-2"
              )}
              style={{ backgroundColor: `var(--color-slot-${slot})` }}
              aria-label={slot}
              title={slot}
            />
          ))}
        </div>
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// Editor Shell (shared layout component)
// ============================================================================

type EditorShellProps = {
  label: string;
  description: string;
  itemCount: number;
  hasChanges: boolean;
  disableSave: boolean;
  isSaving: boolean;
  isGloballyLoading: boolean;
  onRevert: () => void;
  onSave: () => void;
  headerContent?: React.ReactNode;
  emptyMessage?: React.ReactNode;
  children: React.ReactNode;
};

function EditorShell({
  label,
  description,
  itemCount,
  hasChanges,
  disableSave,
  isSaving,
  isGloballyLoading,
  onRevert,
  onSave,
  headerContent,
  emptyMessage,
  children,
}: EditorShellProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground max-w-xl">{description}</p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {itemCount} options
        </Badge>
      </div>

      <Separator className="my-4" />

      {headerContent}

      <div className="space-y-3">
        {children}
      </div>

      {emptyMessage}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onRevert}
          disabled={isSaving || isGloballyLoading || !hasChanges}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Revert
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={disableSave}
        >
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Item Row (shared row component)
// ============================================================================

type ItemRowProps = {
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  isDuplicate: boolean;
  isEmpty: boolean;
  disabled: boolean;
  ariaLabel: string;
  extraControls?: React.ReactNode;
};

function ItemRow({
  value,
  onChange,
  onRemove,
  isDuplicate,
  isEmpty,
  disabled,
  ariaLabel,
  extraControls,
}: ItemRowProps) {
  const hasError = isDuplicate || isEmpty;
  
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-label={ariaLabel}
          aria-invalid={hasError}
          disabled={disabled}
          className={cn(
            "flex-1",
            hasError && "border-destructive/60 focus-visible:ring-destructive/40",
          )}
        />
        {extraControls}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${ariaLabel}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {hasError && (
        <p className="text-xs text-destructive">
          {isEmpty ? "Please provide a value." : "Duplicate entries are not allowed."}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Add Item Row (shared add row component)
// ============================================================================

type AddItemRowProps = {
  draftValue: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  disabled: boolean;
  placeholder: string;
  ariaLabel: string;
  extraControls?: React.ReactNode;
};

function AddItemRow({
  draftValue,
  onDraftChange,
  onAdd,
  disabled,
  placeholder,
  ariaLabel,
  extraControls,
}: AddItemRowProps) {
  return (
    <div className="flex items-center gap-2">
      <Input
        value={draftValue}
        onChange={e => onDraftChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd();
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        className="flex-1"
      />
      {extraControls}
      <Button
        type="button"
        onClick={onAdd}
        variant="secondary"
        disabled={disabled}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add
      </Button>
    </div>
  );
}

// ============================================================================
// Simple Category Editor (for string-only categories)
// ============================================================================

type SimpleCategoryEditorProps = {
  categoryKey: CategoryKey;
  valuesFromConfig: string[];
  onSave: (values: string[]) => Promise<void>;
  isGloballyLoading: boolean;
};

function SimpleCategoryEditor({
  categoryKey,
  valuesFromConfig,
  onSave,
  isGloballyLoading,
}: SimpleCategoryEditorProps) {
  const metadata = CATEGORY_DISPLAY_METADATA[categoryKey];
  const [draft, setDraft] = useState("");

  // Convert string[] to SimpleItem[] for the hook
  // Memoize to prevent infinite render loop
  const initialItems: SimpleItem[] = useMemo(() => 
    valuesFromConfig.map(name => ({ name })),
    [valuesFromConfig]
  );

  // Memoize callbacks to prevent unnecessary re-renders
  const handleOnSave = useCallback(async (cleaned: SimpleItem[]) => {
    await onSave(cleaned.map(item => item.name));
  }, [onSave]);

  const createItem = useCallback((name: string) => ({ name }), []);
  const cleanItem = useCallback((item: SimpleItem) => ({ name: item.name.trim() }), []);

  const {
    items,
    duplicateIndices,
    cleanedItems,
    hasChanges,
    disableSave,
    isSaving,
    touched,
    handleNameChange,
    handleRemove,
    handleAdd,
    handleRevert,
    handleSave,
  } = useCategoryEditorState<SimpleItem>({
    initialItems,
    onSave: handleOnSave,
    isGloballyLoading,
    createItem,
    cleanItem,
  });

  const resetDraft = () => setDraft("");

  return (
    <EditorShell
      label={metadata.label}
      description={metadata.description}
      itemCount={cleanedItems.length}
      hasChanges={hasChanges}
      disableSave={disableSave}
      isSaving={isSaving}
      isGloballyLoading={isGloballyLoading}
      onRevert={() => handleRevert(resetDraft)}
      onSave={handleSave}
      emptyMessage={
        touched && cleanedItems.length === 0 ? (
          <p className="mt-3 text-sm text-destructive">
            At least one option is required.
          </p>
        ) : null
      }
    >
      {items.map((item, index) => (
        <ItemRow
          key={`${categoryKey}-${index}`}
          value={item.name}
          onChange={(name) => handleNameChange(index, name)}
          onRemove={() => handleRemove(index)}
          isDuplicate={duplicateIndices.has(index)}
          isEmpty={!item.name.trim()}
          disabled={isSaving || isGloballyLoading}
          ariaLabel={`${metadata.label} option ${index + 1}`}
        />
      ))}
      <AddItemRow
        draftValue={draft}
        onDraftChange={setDraft}
        onAdd={() => handleAdd(draft, resetDraft)}
        disabled={isSaving || isGloballyLoading}
        placeholder={`Add new ${metadata.label.toLowerCase().slice(0, -1)}...`}
        ariaLabel={`Add ${metadata.label} option`}
      />
    </EditorShell>
  );
}

// ============================================================================
// Status Category Editor (with color picker + completion checkbox)
// ============================================================================

type StatusCategoryEditorProps = {
  statusConfigs: StatusConfig[];
  onSave: (configs: StatusConfig[]) => Promise<void>;
  isGloballyLoading: boolean;
};

function StatusCategoryEditor({
  statusConfigs,
  onSave,
  isGloballyLoading,
}: StatusCategoryEditorProps) {
  const metadata = CATEGORY_DISPLAY_METADATA.caseStatuses;
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState<ColorSlot>("blue");
  const [draftCountsAsCompleted, setDraftCountsAsCompleted] = useState(false);

  // Memoize to prevent re-creating on every render, which would reset the editor state
  const initialItems: StatusConfig[] = useMemo(() => 
    statusConfigs.map(s => ({
      ...s,
      countsAsCompleted: s.countsAsCompleted ?? false,
    })),
    [statusConfigs]
  );

  const {
    items,
    duplicateIndices,
    cleanedItems,
    hasChanges,
    disableSave,
    isSaving,
    touched,
    handleNameChange,
    handleFieldChange,
    handleRemove,
    handleAdd,
    handleRevert,
    handleSave,
  } = useCategoryEditorState<StatusConfig>({
    initialItems,
    onSave,
    isGloballyLoading,
    createItem: (name) => ({
      name,
      colorSlot: draftColor,
      countsAsCompleted: draftCountsAsCompleted,
    }),
    cleanItem: (item) => ({
      name: item.name.trim(),
      colorSlot: item.colorSlot,
      countsAsCompleted: item.countsAsCompleted ?? false,
    }),
    hasItemChanged: (current, original) =>
      current.name !== original.name ||
      current.colorSlot !== original.colorSlot ||
      current.countsAsCompleted !== (original.countsAsCompleted ?? false),
  });

  const resetDraft = () => {
    setDraftName("");
    setDraftCountsAsCompleted(false);
    // Cycle to next color
    const currentIndex = COLOR_SLOTS.indexOf(draftColor);
    setDraftColor(COLOR_SLOTS[(currentIndex + 1) % COLOR_SLOTS.length]);
  };

  return (
    <EditorShell
      label={metadata.label}
      description={metadata.description}
      itemCount={cleanedItems.length}
      hasChanges={hasChanges}
      disableSave={disableSave}
      isSaving={isSaving}
      isGloballyLoading={isGloballyLoading}
      onRevert={() => handleRevert(() => {
        setDraftName("");
        setDraftCountsAsCompleted(false);
      })}
      onSave={handleSave}
      headerContent={
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
          <span className="flex-1">Status Name</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="w-[70px] text-center cursor-help underline decoration-dotted">
                Completed
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p>Check if this status counts toward "cases processed" metrics on the dashboard.</p>
            </TooltipContent>
          </Tooltip>
          <span className="w-[52px]" />
          <span className="w-9" />
        </div>
      }
      emptyMessage={
        touched && cleanedItems.length === 0 ? (
          <p className="mt-3 text-sm text-destructive">
            At least one status is required.
          </p>
        ) : null
      }
    >
      {items.map((status, index) => (
        <ItemRow
          key={`status-${index}`}
          value={status.name}
          onChange={(name) => handleNameChange(index, name)}
          onRemove={() => handleRemove(index)}
          isDuplicate={duplicateIndices.has(index)}
          isEmpty={!status.name.trim()}
          disabled={isSaving || isGloballyLoading}
          ariaLabel={`Status option ${index + 1}`}
          extraControls={
            <>
              <div className="w-[70px] flex justify-center">
                <Checkbox
                  checked={status.countsAsCompleted ?? false}
                  onCheckedChange={(checked) => handleFieldChange(index, 'countsAsCompleted', checked === true)}
                  disabled={isSaving || isGloballyLoading}
                  aria-label={`Mark ${status.name || 'status'} as counting toward completion`}
                />
              </div>
              <ColorSlotPicker
                value={status.colorSlot}
                onChange={(color) => handleFieldChange(index, 'colorSlot', color)}
                disabled={isSaving || isGloballyLoading}
              />
            </>
          }
        />
      ))}
      <AddItemRow
        draftValue={draftName}
        onDraftChange={setDraftName}
        onAdd={() => handleAdd(draftName, resetDraft)}
        disabled={isSaving || isGloballyLoading}
        placeholder="Add new status..."
        ariaLabel="Add status option"
        extraControls={
          <>
            <div className="w-[70px] flex justify-center">
              <Checkbox
                checked={draftCountsAsCompleted}
                onCheckedChange={(checked) => setDraftCountsAsCompleted(checked === true)}
                disabled={isSaving || isGloballyLoading}
                aria-label="New status counts toward completion"
              />
            </div>
            <ColorSlotPicker
              value={draftColor}
              onChange={setDraftColor}
              disabled={isSaving || isGloballyLoading}
            />
          </>
        }
      />
    </EditorShell>
  );
}

// ============================================================================
// Alert Type Category Editor (with drag-and-drop reordering)
// ============================================================================

type AlertTypeCategoryEditorProps = {
  alertTypeConfigs: AlertTypeConfig[];
  onSave: (configs: AlertTypeConfig[]) => Promise<void>;
  isGloballyLoading: boolean;
};

function AlertTypeCategoryEditor({
  alertTypeConfigs,
  onSave,
  isGloballyLoading,
}: AlertTypeCategoryEditorProps) {
  const metadata = CATEGORY_DISPLAY_METADATA.alertTypes;
  const [localItems, setLocalItems] = useState<AlertTypeConfig[]>(alertTypeConfigs);
  const [isSaving, setIsSaving] = useState(false);

  // Sync with external changes
  useMemo(() => {
    setLocalItems(alertTypeConfigs);
  }, [alertTypeConfigs]);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (localItems.length !== alertTypeConfigs.length) return true;
    return localItems.some((item, i) => {
      const original = alertTypeConfigs[i];
      if (!original) return true;
      return (
        item.name !== original.name ||
        item.colorSlot !== original.colorSlot ||
        item.sortOrder !== original.sortOrder
      );
    });
  }, [localItems, alertTypeConfigs]);

  // Check for duplicates
  const hasDuplicates = useMemo(() => {
    const seen = new Set<string>();
    for (const item of localItems) {
      const normalized = item.name.trim().toLowerCase();
      if (normalized && seen.has(normalized)) return true;
      seen.add(normalized);
    }
    return false;
  }, [localItems]);

  const handleChange = useCallback((items: AlertTypeConfig[]) => {
    setLocalItems(items);
  }, []);

  const handleRevert = useCallback(() => {
    setLocalItems(alertTypeConfigs);
  }, [alertTypeConfigs]);

  const handleSave = useCallback(async () => {
    // Clean items before saving
    const cleaned = localItems
      .filter(item => item.name.trim())
      .map((item, idx) => ({
        name: item.name.trim(),
        colorSlot: item.colorSlot,
        sortOrder: idx,
      }));

    setIsSaving(true);
    try {
      await onSave(cleaned);
    } finally {
      setIsSaving(false);
    }
  }, [localItems, onSave]);

  const cleanedCount = localItems.filter(item => item.name.trim()).length;
  const disableSave = isSaving || isGloballyLoading || !hasChanges || hasDuplicates;

  return (
    <EditorShell
      label={metadata.label}
      description={`${metadata.description} Drag to reorder priorities.`}
      itemCount={cleanedCount}
      hasChanges={hasChanges}
      disableSave={disableSave}
      isSaving={isSaving}
      isGloballyLoading={isGloballyLoading}
      onRevert={handleRevert}
      onSave={handleSave}
      emptyMessage={
        cleanedCount === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No alert types configured. Types will be added automatically when alerts are imported.
          </p>
        ) : null
      }
    >
      <SortableAlertTypes
        alertTypes={localItems}
        onChange={handleChange}
        disabled={isSaving || isGloballyLoading}
        showWeights={true}
      />
    </EditorShell>
  );
}

// ============================================================================
// ============================================================================
// Category Manager Panel
// ============================================================================

export function CategoryManagerPanel({
  title = "Category Options",
  description = "Update the selectable options used across the application.",
  supportingContent,
  accentIcon: AccentIcon = ListChecks,
  showResetButton = true,
  className,
}: CategoryManagerPanelProps) {
  const isMounted = useIsMounted();
  const { config, loading, updateCategory, resetToDefaults } = useCategoryConfig();
  const [isResetting, setIsResetting] = useState(false);

  const handleSave = useCallback(
    async (key: CategoryKey, values: string[]) => {
      await updateCategory(key, values);
    },
    [updateCategory],
  );

  const handleSaveStatuses = useCallback(
    async (configs: StatusConfig[]) => {
      await updateCategory('caseStatuses', configs as unknown as string[]);
    },
    [updateCategory],
  );

  const handleSaveAlertTypes = useCallback(
    async (configs: AlertTypeConfig[]) => {
      await updateCategory('alertTypes', configs as unknown as string[]);
    },
    [updateCategory],
  );

  const handleResetAll = useCallback(async () => {
    if (!showResetButton) return;

    setIsResetting(true);
    try {
      await resetToDefaults();
    } finally {
      if (isMounted.current) {
        setIsResetting(false);
      }
    }
  }, [resetToDefaults, showResetButton, isMounted]);

  const defaultSupportingContent = (
    <p className="text-sm text-muted-foreground">
      Customize the lists for case types, statuses, living arrangements, note categories, and verification statuses. These settings are saved to your workspace directory via the file data provider.
    </p>
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AccentIcon className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {showResetButton && (
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetAll}
              disabled={isResetting || loading}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Reset to Defaults
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {supportingContent ?? defaultSupportingContent}
        <Tabs defaultValue="case-config" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="case-config" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Case Config</span>
            </TabsTrigger>
            <TabsTrigger value="notes-alerts" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notes & Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="other" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Other</span>
            </TabsTrigger>
          </TabsList>

          {/* Case Config Tab */}
          <TabsContent value="case-config" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure case types and workflow statuses. Status colors appear throughout the application.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <SimpleCategoryEditor
                categoryKey="caseTypes"
                valuesFromConfig={config.caseTypes ?? defaultCategoryConfig.caseTypes}
                onSave={values => handleSave("caseTypes", values)}
                isGloballyLoading={loading || isResetting}
              />
              <StatusCategoryEditor
                statusConfigs={config.caseStatuses}
                onSave={handleSaveStatuses}
                isGloballyLoading={loading || isResetting}
              />
            </div>
          </TabsContent>

          {/* Notes & Alerts Tab */}
          <TabsContent value="notes-alerts" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Manage note categories and alert type classifications.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <SimpleCategoryEditor
                categoryKey="noteCategories"
                valuesFromConfig={config.noteCategories ?? defaultCategoryConfig.noteCategories}
                onSave={values => handleSave("noteCategories", values)}
                isGloballyLoading={loading || isResetting}
              />
              <AlertTypeCategoryEditor
                alertTypeConfigs={config.alertTypes}
                onSave={handleSaveAlertTypes}
                isGloballyLoading={loading || isResetting}
              />
            </div>
          </TabsContent>

          {/* Other Settings Tab */}
          <TabsContent value="other" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Additional category options for forms and verification workflows.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <SimpleCategoryEditor
                categoryKey="livingArrangements"
                valuesFromConfig={config.livingArrangements ?? defaultCategoryConfig.livingArrangements}
                onSave={values => handleSave("livingArrangements", values)}
                isGloballyLoading={loading || isResetting}
              />
              <SimpleCategoryEditor
                categoryKey="verificationStatuses"
                valuesFromConfig={config.verificationStatuses ?? defaultCategoryConfig.verificationStatuses}
                onSave={values => handleSave("verificationStatuses", values)}
                isGloballyLoading={loading || isResetting}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default CategoryManagerPanel;
