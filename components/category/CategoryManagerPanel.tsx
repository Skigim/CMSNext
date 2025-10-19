import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ListChecks, Plus, RefreshCcw, Save, Undo2, X } from "lucide-react";
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
import {
  CATEGORY_DISPLAY_METADATA,
  CategoryKey,
  defaultCategoryConfig,
} from "@/types/categoryConfig";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { cn } from "../ui/utils";

const CATEGORY_KEYS: CategoryKey[] = [
  "caseTypes",
  "caseStatuses",
  "livingArrangements",
  "noteCategories",
];

type CategoryEditorProps = {
  categoryKey: CategoryKey;
  valuesFromConfig: string[];
  onSave: (values: string[]) => Promise<void>;
  isGloballyLoading: boolean;
};

type CategoryManagerPanelProps = {
  title?: string;
  description?: string;
  supportingContent?: React.ReactNode;
  accentIcon?: LucideIcon;
  showResetButton?: boolean;
  className?: string;
};

const normalizeValues = (values: string[]): string[] =>
  values.map(value => value.trim()).filter(Boolean);

const arraysEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
};

function CategoryEditor({
  categoryKey,
  valuesFromConfig,
  onSave,
  isGloballyLoading,
}: CategoryEditorProps) {
  const metadata = CATEGORY_DISPLAY_METADATA[categoryKey];
  const [values, setValues] = useState<string[]>(() => [...valuesFromConfig]);
  const [draft, setDraft] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [touched, setTouched] = useState<boolean>(false);

  useEffect(() => {
    setValues(valuesFromConfig);
  }, [valuesFromConfig]);

  const valueMeta = useMemo(
    () =>
      values.map(value => {
        const trimmed = value.trim();
        return {
          raw: value,
          trimmed,
          normalized: trimmed.toLowerCase(),
        };
      }),
    [values],
  );

  const duplicateIndices = useMemo(() => {
    const seen = new Map<string, number>();
    const duplicates = new Set<number>();
    valueMeta.forEach((entry, index) => {
      if (!entry.trimmed) {
        return;
      }
      if (seen.has(entry.normalized)) {
        duplicates.add(index);
        duplicates.add(seen.get(entry.normalized)!);
      } else {
        seen.set(entry.normalized, index);
      }
    });
    return duplicates;
  }, [valueMeta]);

  const hasEmptyValues = useMemo(() => valueMeta.some(entry => !entry.trimmed), [valueMeta]);

  const cleanedValues = useMemo(() => normalizeValues(values), [values]);
  const baselineValues = useMemo(() => normalizeValues(valuesFromConfig), [valuesFromConfig]);

  const hasChanges = useMemo(() => !arraysEqual(cleanedValues, baselineValues), [baselineValues, cleanedValues]);

  const disableSave =
    isSaving ||
    isGloballyLoading ||
    !hasChanges ||
    cleanedValues.length === 0 ||
    hasEmptyValues ||
    duplicateIndices.size > 0;

  const handleValueChange = useCallback((index: number, next: string) => {
    setTouched(true);
    setValues(current => current.map((value, idx) => (idx === index ? next : value)));
  }, []);

  const handleRemove = useCallback((index: number) => {
    setTouched(true);
    setValues(current => current.filter((_, idx) => idx !== index));
  }, []);

  const handleAdd = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setTouched(true);
      return;
    }

    const exists = valueMeta.some(entry => entry.normalized === trimmed.toLowerCase());
    if (exists) {
      setDraft("");
      setTouched(true);
      return;
    }

    setTouched(true);
    setValues(current => [...current, trimmed]);
    setDraft("");
  }, [draft, valueMeta]);

  const handleRevert = useCallback(() => {
    setValues(valuesFromConfig);
    setDraft("");
    setTouched(false);
  }, [valuesFromConfig]);

  const handleSave = useCallback(async () => {
    setTouched(true);
    setIsSaving(true);
    try {
      await onSave(cleanedValues);
    } finally {
      setIsSaving(false);
    }
  }, [cleanedValues, onSave]);

  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{metadata.label}</p>
          <p className="text-xs text-muted-foreground max-w-xl">{metadata.description}</p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {cleanedValues.length} options
        </Badge>
      </div>

      <Separator className="my-4" />

      <div className="space-y-3">
        {values.map((value, index) => {
          const isDuplicate = duplicateIndices.has(index);
          const isEmpty = !value.trim();
          return (
            <div key={`${categoryKey}-${index}`} className="flex flex-col gap-1">
              <div className="flex gap-2">
                <Input
                  value={value}
                  onChange={event => handleValueChange(index, event.target.value)}
                  data-testid={`${categoryKey}-value-${index}`}
                  aria-label={`${metadata.label} option ${index + 1}`}
                  aria-invalid={isDuplicate || isEmpty}
                  disabled={isSaving || isGloballyLoading}
                  className={cn(
                    "flex-1",
                    (isDuplicate || isEmpty) &&
                      "border-destructive/60 focus-visible:ring-destructive/40",
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleRemove(index)}
                  disabled={isSaving || isGloballyLoading}
                  aria-label={`Remove ${metadata.label} option ${index + 1}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {(isDuplicate || isEmpty) && (
                <p className="text-xs text-destructive">
                  {isEmpty ? "Please provide a value." : "Duplicate entries are not allowed."}
                </p>
              )}
            </div>
          );
        })}
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAdd();
              }
            }}
            placeholder={`Add new ${metadata.label.toLowerCase().slice(0, -1)}...`}
            aria-label={`Add ${metadata.label} option`}
            disabled={isSaving || isGloballyLoading}
          />
          <Button
            type="button"
            onClick={handleAdd}
            variant="secondary"
            disabled={isSaving || isGloballyLoading}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {touched && cleanedValues.length === 0 && (
        <p className="mt-3 text-sm text-destructive">
          At least one option is required.
        </p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={handleRevert}
          disabled={isSaving || isGloballyLoading || !hasChanges}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Revert
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={disableSave}
        >
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}

export function CategoryManagerPanel({
  title = "Category Options",
  description = "Update the selectable options used across the application.",
  supportingContent,
  accentIcon: AccentIcon = ListChecks,
  showResetButton = true,
  className,
}: CategoryManagerPanelProps) {
  const { config, loading, updateCategory, resetToDefaults } = useCategoryConfig();
  const [isResetting, setIsResetting] = useState(false);

  const handleSave = useCallback(
    async (key: CategoryKey, values: string[]) => {
      await updateCategory(key, values);
    },
    [updateCategory],
  );

  const handleResetAll = useCallback(async () => {
    if (!showResetButton) {
      return;
    }

    setIsResetting(true);
    try {
      await resetToDefaults();
    } finally {
      setIsResetting(false);
    }
  }, [resetToDefaults, showResetButton]);

  const defaultSupportingContent = (
    <p className="text-sm text-muted-foreground">
      Customize the lists for case types, statuses, living arrangements, and note categories. These settings are saved to your workspace directory via the file data provider.
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
        <div className="grid gap-4 lg:grid-cols-2">
          {CATEGORY_KEYS.map(key => (
            <CategoryEditor
              key={key}
              categoryKey={key}
              valuesFromConfig={config[key] ?? defaultCategoryConfig[key]}
              onSave={values => handleSave(key, values)}
              isGloballyLoading={loading || isResetting}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default CategoryManagerPanel;
