import { useCallback, useEffect, useMemo, useState } from "react";
import { useIsMounted } from "./useIsMounted";
import { findDuplicateIndices } from "@/domain/validation";

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
 * Shared state management hook for category editors
 * 
 * Eliminates duplicate logic across CategoryEditor, StatusCategoryEditor, and AlertTypeCategoryEditor.
 * Provides complete state, validation, and CRUD operations for managing lists of configurable items.
 * 
 * **Supported Operations:**
 * - Add: Create new item from draft name (validates uniqueness, auto-reset draft)
 * - Update: Change name or fields of existing item
 * - Remove: Delete item by index
 * - Revert: Restore to initial items, reset touched state
 * - Save: Async persist to parent component
 * 
 * **Validation:**
 * - Duplicate detection: Case-insensitive, normalized (trimmed) names
 * - Empty names: Detected but form depends on allowEmpty option
 * - Changes: Compares cleaned (trimmed, non-empty) items to initial items
 * - Save disable: When duplicates exist, has empty values, no changes, or globally loading
 * 
 * **Metadata Tracking:**
 * - `itemMeta`: For each item, stores raw name, trimmed, and normalized versions
 * - `duplicateIndices`: Set of indices with duplicate names (for UI highlighting)
 * - `cleanedItems`: Non-empty, trimmed items ready for persistence
 * - `hasChanges`: Boolean - true if cleaned items differ from initial
 * - `touched`: Boolean - tracks if user has made any edits (form touched state)
 * 
 * **Form Lifecycle:**
 * 1. Initialize with initialItems (copied to avoid mutations)
 * 2. User edits: handleNameChange/handleFieldChange update items + set touched=true
 * 3. User adds: handleAdd validates uniqueness, creates item, resets draft, updates items
 * 4. Validation: Continuous - meta/duplicates/changes computed on every item change
 * 5. Save: handleSave calls onSave with cleanedItems, shows loading state
 * 6. Revert: handleRevert restores initialItems, resets touched state
 * 7. External changes: useEffect syncs initialItems prop changes to local state
 * 
 * **Usage Example:**
 * ```typescript
 * const editor = useCategoryEditorState({
 *   initialItems: [
 *     { name: "Active", colorSlot: "green" },
 *     { name: "Closed", colorSlot: "gray" }
 *   ],
 *   createItem: (name) => ({ name, colorSlot: "blue" }),
 *   cleanItem: (item) => ({ ...item, name: item.name.trim() }),
 *   onSave: async (items) => {
 *     await dataManager.updateStatuses(items);
 *   },
 *   isGloballyLoading: isLoadingData,
 *   allowEmpty: false,
 *   hasItemChanged: (current, orig) => {
 *     return current.name !== orig.name || current.colorSlot !== orig.colorSlot;
 *   }
 * });
 * 
 * // Render form
 * {editor.items.map((item, i) => (
 *   <div key={i} className={editor.duplicateIndices.has(i) ? 'error' : ''}>
 *     <input
 *       value={item.name}
 *       onChange={(e) => editor.handleNameChange(i, e.target.value)}
 *     />
 *     {editor.itemMeta[i].trimmed === "" && <span>Required</span>}
 *     <button onClick={() => editor.handleRemove(i)}>Remove</button>
 *   </div>
 * ))}
 * 
 * <button onClick={() => editor.handleAdd(draftName, resetDraft)} disabled={editor.disableSave}>
 *   Add
 * </button>
 * 
 * <button onClick={() => editor.handleSave()} disabled={editor.disableSave}>
 *   {editor.isSaving ? "Saving..." : "Save"}
 * </button>
 * ```
 * 
 * **Generic Type Parameter:**
 * `T extends EditorItem` - Any object with at least `{ name: string }` field.
 * Allows status configs, alert types, categories, etc. to reuse same logic.
 * 
 * @template T Type of item being edited (must have `name: string` field)
 * 
 * @param {UseCategoryEditorStateOptions<T>} options
 *   - `initialItems`: Initial list of items from parent config
 *   - `onSave(items)`: Async callback to persist cleaned items
 *   - `isGloballyLoading`: Disable save if parent is loading
 *   - `createItem(name)`: Factory function to create new item from draft name
 *   - `cleanItem(item)`: Function to clean item (trim name, normalize, etc.)
 *   - `allowEmpty`: If true, allows saving with zero items (default: false)
 *   - `hasItemChanged`: Custom equality check for detecting changes (default: compare name only)
 * 
 * @returns {UseCategoryEditorStateReturn<T>} Editor state and handlers
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

  // Find duplicate indices using domain function
  const duplicateIndices = useMemo(
    () => findDuplicateIndices(itemMeta),
    [itemMeta],
  );

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
    console.log('[useCategoryEditorState] handleSave called', { cleanedItems });
    setTouched(true);
    setIsSaving(true);
    try {
      await onSave(cleanedItems);
      console.log('[useCategoryEditorState] handleSave completed');
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
