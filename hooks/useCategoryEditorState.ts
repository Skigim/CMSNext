import { useCallback, useEffect, useMemo, useState } from "react";
import { useIsMounted } from "./useIsMounted";

/**
 * Represents a single item in the category editor.
 * All items must have a `name` field.
 */
export type EditorItem = {
  name: string;
};

/**
 * Metadata about each item for validation.
 */
export type ItemMeta = {
  raw: string;
  trimmed: string;
  normalized: string;
};

/**
 * Options for the category editor state hook.
 */
export type UseCategoryEditorStateOptions<T extends EditorItem> = {
  /** Initial items from config */
  initialItems: T[];
  /** Callback to save cleaned items */
  onSave: (items: T[]) => Promise<void>;
  /** Whether the parent is in a loading state */
  isGloballyLoading: boolean;
  /** Function to create a new item from draft name and additional draft state */
  createItem: (name: string) => T;
  /** Function to clean an item (trim name, etc.) */
  cleanItem: (item: T) => T;
  /** Whether empty list is allowed (default: false) */
  allowEmpty?: boolean;
  /** Custom equality check for detecting changes (default: compare name only) */
  hasItemChanged?: (current: T, original: T) => boolean;
};

/**
 * Return type for the category editor state hook.
 */
export type UseCategoryEditorStateReturn<T extends EditorItem> = {
  /** Current list of items being edited */
  items: T[];
  /** Set items directly */
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  /** Metadata for each item */
  itemMeta: ItemMeta[];
  /** Indices of duplicate items */
  duplicateIndices: Set<number>;
  /** Whether any items have empty names */
  hasEmptyValues: boolean;
  /** Cleaned items (trimmed, non-empty) */
  cleanedItems: T[];
  /** Whether there are unsaved changes */
  hasChanges: boolean;
  /** Whether save button should be disabled */
  disableSave: boolean;
  /** Whether save is in progress */
  isSaving: boolean;
  /** Whether form has been touched */
  touched: boolean;
  /** Update the name of an item at index */
  handleNameChange: (index: number, name: string) => void;
  /** Update a field of an item at index */
  handleFieldChange: <K extends keyof T>(index: number, field: K, value: T[K]) => void;
  /** Remove an item at index */
  handleRemove: (index: number) => void;
  /** Add a new item from the current draft */
  handleAdd: (draftName: string, resetDraft: () => void) => void;
  /** Revert to initial items */
  handleRevert: (resetDraft: () => void) => void;
  /** Save changes */
  handleSave: () => Promise<void>;
  /** Check if a name already exists (for draft validation) */
  nameExists: (name: string) => boolean;
};

/**
 * Shared state management hook for category editors.
 * Eliminates duplicate logic across CategoryEditor, StatusCategoryEditor, and AlertTypeCategoryEditor.
 */
export function useCategoryEditorState<T extends EditorItem>({
  initialItems,
  onSave,
  isGloballyLoading,
  createItem,
  cleanItem,
  allowEmpty = false,
  hasItemChanged,
}: UseCategoryEditorStateOptions<T>): UseCategoryEditorStateReturn<T> {
  const isMounted = useIsMounted();
  const [items, setItems] = useState<T[]>(() => initialItems.map(item => ({ ...item })));
  const [isSaving, setIsSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // Sync with external changes
  useEffect(() => {
    setItems(initialItems.map(item => ({ ...item })));
  }, [initialItems]);

  // Compute metadata for validation
  const itemMeta = useMemo<ItemMeta[]>(
    () =>
      items.map(item => {
        const trimmed = item.name.trim();
        return {
          raw: item.name,
          trimmed,
          normalized: trimmed.toLowerCase(),
        };
      }),
    [items],
  );

  // Find duplicate indices
  const duplicateIndices = useMemo(() => {
    const seen = new Map<string, number>();
    const duplicates = new Set<number>();
    itemMeta.forEach((entry, index) => {
      if (!entry.trimmed) return;
      if (seen.has(entry.normalized)) {
        duplicates.add(index);
        duplicates.add(seen.get(entry.normalized)!);
      } else {
        seen.set(entry.normalized, index);
      }
    });
    return duplicates;
  }, [itemMeta]);

  const hasEmptyValues = useMemo(
    () => itemMeta.some(entry => !entry.trimmed),
    [itemMeta],
  );

  const cleanedItems = useMemo(
    () => items.map(cleanItem).filter(item => item.name.length > 0),
    [items, cleanItem],
  );

  const hasChanges = useMemo(() => {
    if (cleanedItems.length !== initialItems.length) return true;
    if (hasItemChanged) {
      return cleanedItems.some((item, i) => hasItemChanged(item, initialItems[i]));
    }
    // Default: compare names only
    return cleanedItems.some((item, i) => item.name !== initialItems[i]?.name);
  }, [cleanedItems, initialItems, hasItemChanged]);

  const disableSave =
    isSaving ||
    isGloballyLoading ||
    !hasChanges ||
    (!allowEmpty && cleanedItems.length === 0) ||
    hasEmptyValues ||
    duplicateIndices.size > 0;

  const handleNameChange = useCallback((index: number, name: string) => {
    setTouched(true);
    setItems(current => current.map((item, idx) => (idx === index ? { ...item, name } : item)));
  }, []);

  const handleFieldChange = useCallback(<K extends keyof T>(index: number, field: K, value: T[K]) => {
    setTouched(true);
    setItems(current =>
      current.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    );
  }, []);

  const handleRemove = useCallback((index: number) => {
    setTouched(true);
    setItems(current => current.filter((_, idx) => idx !== index));
  }, []);

  const nameExists = useCallback(
    (name: string) => itemMeta.some(entry => entry.normalized === name.trim().toLowerCase()),
    [itemMeta],
  );

  const handleAdd = useCallback(
    (draftName: string, resetDraft: () => void) => {
      const trimmed = draftName.trim();
      if (!trimmed) {
        setTouched(true);
        return;
      }

      if (nameExists(trimmed)) {
        resetDraft();
        setTouched(true);
        return;
      }

      setTouched(true);
      setItems(current => [...current, createItem(trimmed)]);
      resetDraft();
    },
    [nameExists, createItem],
  );

  const handleRevert = useCallback(
    (resetDraft: () => void) => {
      setItems(initialItems.map(item => ({ ...item })));
      resetDraft();
      setTouched(false);
    },
    [initialItems],
  );

  const handleSave = useCallback(async () => {
    setTouched(true);
    setIsSaving(true);
    try {
      await onSave(cleanedItems);
    } finally {
      if (isMounted.current) {
        setIsSaving(false);
      }
    }
  }, [cleanedItems, onSave, isMounted]);

  return {
    items,
    setItems,
    itemMeta,
    duplicateIndices,
    hasEmptyValues,
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
    nameExists,
  };
}
