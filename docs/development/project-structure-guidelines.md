# Project Structure Guidelines

## Toast Notification Patterns

### Available Utilities

Two utilities exist in `utils/withToast.ts`:

| Utility          | Use Case                 | When to Use                                       |
| ---------------- | ------------------------ | ------------------------------------------------- |
| `toastPromise()` | Simple async operations  | Fire-and-forget, no state management needed       |
| `withToast()`    | Complex async operations | Need `isMounted` guards, `setError`, `setLoading` |

### When to Use Each

**Use `toastPromise()` for:**

- Simple CRUD operations in components
- Operations without post-async conditional logic
- Cases where you don't need to track loading/error state

```typescript
await toastPromise(api.delete(id), {
  loading: "Deleting...",
  success: "Deleted!",
  error: "Failed to delete",
});
```

**Use `withToast()` for:**

- Hook operations with `isMounted` refs
- Operations needing `setError`/`setLoading` callbacks
- Complex flows with state management

```typescript
const result = await withToast(
  () => dataManager.addItem(caseId, category, data),
  {
    loading: "Adding item...",
    success: "Item added",
    error: "Failed to add item",
    isMounted,
    setError,
    setLoading,
  }
);
```

**Keep existing patterns when:**

- Conditional logic after async operation (different messages based on result)
- Multi-step operations with partial success handling
- Custom toast types (warning, info) based on result

### Refactoring Decision

Not all existing toast patterns need refactoring. The utilities are primarily for:

1. **New code** - use utilities from the start
2. **Simple patterns** - straightforward loading → success/error flows
3. **Repeated patterns** - when you're adding similar operations

Avoid refactoring complex existing patterns that have:

- Conditional messages based on result values
- Partial success handling (loops with some failures)
- Multi-step workflows with intermediate toasts

---

## Hook Size Guidelines

### Target Size

- **Ideal:** 40-50 lines
- **Acceptable:** Up to 150 lines
- **Needs review:** 150-200 lines
- **Must refactor:** 200+ lines

### Extraction Strategies

1. **Extract to utility hooks** - Reusable state patterns (`useModalState`, `useAsyncState`)
2. **Extract to services** - Business logic (`CaseOperationsService`)
3. **Split by responsibility** - Separate form state from operations

---

## Service Layer Patterns

### DataManager Orchestration

```
DataManager (orchestrator)
├── FileStorageService    # File I/O, format validation
├── CaseService           # Case CRUD operations
├── FinancialsService     # Financial item management
├── NotesService          # Note management
├── ActivityLogService    # Activity logging
├── CategoryConfigService # Status/category configuration
└── AlertsService         # Alert management
```

### Service Rules

- Services are **stateless** - receive dependencies via constructor
- All mutations go through `DataManager` methods
- No direct service calls from components (use hooks)
- No domain layer, repositories, or event bus patterns

---

## File Organization

### Test Files

- Mirror source structure under `__tests__/`
- Test file naming: `{source-file}.test.ts`
- Shared test utilities in `__tests__/__mocks__/` and `src/test/`

### Documentation

- `docs/development/` - Active development docs
- `docs/development/archive/` - Completed planning docs
- `docs/development/strategy/archive/` - Historical strategy docs
