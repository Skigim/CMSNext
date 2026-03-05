# Agent Instructions: Custom Hooks

## Overview

Custom hooks bridge React components and the service layer. They manage local React state for UI concerns while delegating all business logic to services. Hooks are the only place where services are called—components never import services directly.

## Key Files

| File                              | Purpose                   |
| --------------------------------- | ------------------------- |
| `hooks/index.ts`                  | Re-exports all hooks      |
| `hooks/useCaseManagement.ts`      | Case CRUD operations      |
| `hooks/useFinancialItems.ts`      | Financial item management |
| `hooks/useNotes.ts`               | Note management           |
| `hooks/useAlertsFlow.ts`          | Alert management          |
| `hooks/useFileDataSync.ts`        | File data synchronization |
| `hooks/useNavigationFlow.ts`      | Navigation state          |
| `contexts/DataManagerContext.tsx` | DataManager provider      |

## Architecture

```
Component
    ↓ (uses)
Custom Hook
    ├── Local React State (loading, error, UI state)
    ├── DataManager Context (service access)
    └── Callback handlers (delegate to services)
```

**Hooks maintain local React state for UI, services handle business logic.**

## Patterns

### Basic Hook Structure

```typescript
/**
 * Hook for managing [feature].
 * Target: 40-50 lines max.
 */
export function useFeature(caseId: string) {
  // Local React state for UI
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get services from context
  const { dataManager } = useDataManager();

  // Load data on mount or when dependencies change
  useEffect(() => {
    const loadItems = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await dataManager.getItemsByCaseId(caseId);
        setItems(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    };

    loadItems();
  }, [caseId, dataManager]);

  // Stable callback references with useCallback
  const addItem = useCallback(
    async (input: CreateItemInput) => {
      try {
        const newItem = await dataManager.addItem(caseId, input);
        setItems((prev) => [...prev, newItem]);
        toast.success("Item added");
        return newItem;
      } catch (err) {
        toast.error("Failed to add item");
        throw err;
      }
    },
    [caseId, dataManager]
  );

  return {
    items,
    isLoading,
    error,
    addItem,
  };
}
```

### Hook with Form State

```typescript
export function useItemForm(initialData?: Item) {
  const [formData, setFormData] = useState<ItemFormData>(
    initialData ?? getDefaultFormData()
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [isDirty, setIsDirty] = useState(false);

  const updateField = useCallback(
    <K extends keyof ItemFormData>(field: K, value: ItemFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setIsDirty(true);
      // Clear field error on change
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    []
  );

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    if (formData.amount <= 0) {
      newErrors.amount = "Amount must be positive";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const reset = useCallback(() => {
    setFormData(initialData ?? getDefaultFormData());
    setErrors({});
    setIsDirty(false);
  }, [initialData]);

  return {
    formData,
    errors,
    isDirty,
    updateField,
    validate,
    reset,
  };
}
```

### Hook Composition

```typescript
export function useCaseDetail(caseId: string) {
  // Compose smaller hooks
  const caseData = useCaseData(caseId);
  const notes = useNotes(caseId);
  const financials = useFinancialItems(caseId);
  const alerts = useAlerts(caseId);

  const isLoading =
    caseData.isLoading || notes.isLoading || financials.isLoading;

  return {
    case: caseData.case,
    notes: notes.items,
    financials: financials.items,
    alerts: alerts.items,
    isLoading,
    // Expose individual hook actions
    addNote: notes.addNote,
    addFinancial: financials.addItem,
  };
}
```

## Rules

1. **Target ~40-50 lines max** - Split large hooks into smaller composable hooks
2. **Delegate to services** - Never put business logic in hooks
3. **Use `useCallback`** - Stable function references prevent unnecessary re-renders
4. **Handle errors gracefully** - Show toast, set error state, don't let errors bubble silently
5. **Clean up effects** - Return cleanup functions for subscriptions

## Context Access Pattern

```typescript
import { useDataManager } from "@/contexts/DataManagerContext";

export function useFeature() {
  // DataManager is provided at app root
  const { dataManager } = useDataManager();

  // Validate availability
  if (!dataManager) {
    throw new Error("useFeature must be used within DataManagerProvider");
  }

  // Use dataManager methods...
}
```

## Verification

After creating or modifying hooks:

1. **Build passes:** `npm run build`
2. **Types correct:** `npx tsc --noEmit`
3. **Tests pass:** `npm test`
4. **Component integration:** Verify components can consume the hook
5. **Memory leaks:** Check for missing cleanup in useEffect

## Common Pitfalls

| ❌ Don't                        | ✅ Do                                     |
| ------------------------------- | ----------------------------------------- |
| Put business logic in hooks     | Delegate to DataManager/services          |
| Skip `useCallback` for handlers | Wrap callbacks for stability              |
| Ignore errors                   | Set error state, show toast               |
| Create huge hooks               | Split into composable smaller hooks       |
| Forget dependencies             | Include all deps in useEffect/useCallback |
| Let errors bubble silently      | Always handle and display errors          |
| Access services in components   | Access services only in hooks             |
