# Component Migration Checklist

## Components Using `useFinancialItemFlow`

**Found:** 2 components need updates

1. **`components/app/AppContent.tsx`** - Main application content (import + usage)
2. **`components/app/CaseWorkspace.tsx`** - Type import only (`ItemFormState`)

### Search Command

```bash
grep -r "useFinancialItemFlow" components/ --include="*.tsx"
```

### Migration Pattern

**Before:**

```tsx
const { financialItems, ... } = useFinancialItemFlow({
  selectedCase,
  cases,
});
```

**After:**

```tsx
const {
  financialItems, // Note[]
  isLoading, // boolean
  error, // string | null
  createItem, // (data: FinancialItemCreateInput) => Promise<FinancialItem>
  updateItem, // (id: string, updates: FinancialItemUpdateInput) => Promise<void>
  deleteItem, // (id: string) => Promise<void>
  getItemsByCategory, // (category: FinancialCategory) => FinancialItem[]
} = useFinancialItemFlow({ caseId: selectedCase?.id ?? null });
```

---

## Components Using `useNoteFlow`

**Found:** 1 component needs updates

1. **`components/app/AppContent.tsx`** - Main application content (import + usage)

### Search Command

```bash
grep -r "useNoteFlow" components/ --include="*.tsx"
```

### Migration Pattern

**Before:**

```tsx
const {
  noteForm,
  handleAddNote,
  handleEditNote,
  handleDeleteNote,
  handleSaveNote,
  handleCancelNoteForm,
  handleBatchUpdateNote,
  handleBatchCreateNote,
} = useNoteFlow({ selectedCase, cases });
```

**After:**

```tsx
const {
  notes, // Note[]
  isLoading, // boolean
  error, // string | null
  createNote, // (data: NoteCreateInput) => Promise<Note>
  updateNote, // (noteId: string, updates: NoteUpdateInput) => Promise<void>
  deleteNote, // (noteId: string) => Promise<void>
  getNotesByCategory, // (category: NoteCategory) => Note[]
} = useNoteFlow({ caseId: selectedCase?.id ?? null });
```

---

## Breaking Changes Summary

### 1. Hook Signatures

- Both hooks now require `{ caseId }` instead of `{ selectedCase, cases }`
- `caseId` can be `string | null`

### 2. Return Values

- **Added:** `isLoading`, `error` states
- **Removed:** Legacy form handlers (useNoteFlow)
- **Changed:** Method names are simpler (e.g., `createNote` instead of `handleBatchCreateNote`)

### 3. Types

- `FinancialItemCreateInput` - New domain type
- `FinancialItemUpdateInput` - New domain type
- `NoteCreateInput` - New domain type
- `NoteUpdateInput` - New domain type

### 4. Error Handling

- Errors now surface through `error` state
- Toast notifications handled by service layer
- No need for manual toast calls in components

---

## Testing Strategy

### Unit Tests

For each migrated component:

1. Test with `caseId = null` (no case selected)
2. Test with `caseId = "valid-id"` (case selected)
3. Test loading states (`isLoading = true`)
4. Test error states (`error = "message"`)
5. Test successful CRUD operations

### Integration Tests

1. Verify optimistic updates work correctly
2. Verify rollback on error
3. Verify domain events published
4. Verify ApplicationState updated correctly

---

## Rollout Plan

### Phase 1: Identify Components

```bash
# Find all components using these hooks
grep -r "useFinancialItemFlow" components/ --include="*.tsx"
grep -r "useNoteFlow" components/ --include="*.tsx"
```

### Phase 2: Update Components (One at a Time)

1. Update import statements
2. Update hook call signature
3. Update render logic to use new return values
4. Add loading/error handling if not present
5. Test component in isolation
6. Test integration with rest of app

### Phase 3: Remove Legacy Code

After all components migrated:

1. Remove old `useNotes` hook (if no longer used)
2. Remove legacy DataManager methods
3. Clean up unused types

---

## Component Update Template

```tsx
// Before
import { useFinancialItemFlow } from '@/hooks/useFinancialItemFlow';

function MyComponent() {
  const { selectedCase } = useCaseManagement();
  const { financialItems, handleAddItem } = useFinancialItemFlow({
    selectedCase,
    cases: [], // Not needed anymore
  });

  return (
    <div>
      {financialItems.map(item => <div key={item.id}>{item.description}</div>)}
      <button onClick={() => handleAddItem(...)}>Add</button>
    </div>
  );
}

// After
import { useFinancialItemFlow } from '@/hooks/useFinancialItemFlow';
import type { FinancialItemCreateInput } from '@/domain/financials/entities/FinancialItem';

function MyComponent() {
  const { selectedCase } = useCaseManagement();
  const { financialItems, isLoading, error, createItem } = useFinancialItemFlow({
    caseId: selectedCase?.id ?? null,
  });

  const handleAdd = async () => {
    if (!selectedCase) return;

    const input: FinancialItemCreateInput = {
      caseId: selectedCase.id,
      description: '...',
      amount: 100,
      category: 'income',
      // ... other fields
    };

    try {
      await createItem(input);
    } catch (err) {
      // Error already shown via toast
      console.error('Create failed:', err);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {financialItems.map(item => <div key={item.id}>{item.description}</div>)}
      <button onClick={handleAdd}>Add</button>
    </div>
  );
}
```

---

## Notes for Reviewers

### Key Files to Check

1. `hooks/useFinancialItemFlow.ts` - Hook refactor
2. `hooks/useNoteFlow.ts` - Hook refactor
3. `application/services/*ManagementService.ts` - Service layer
4. `domain/*/use-cases/*.ts` - Business logic
5. `contexts/*ServiceContext.tsx` - Providers

### What to Look For

- ✅ Optimistic updates properly implemented
- ✅ Rollback on error works correctly
- ✅ Domain events published
- ✅ Toast feedback consistent
- ✅ Loading/error states managed
- ✅ Type safety maintained

### Red Flags

- ❌ Direct DataManager calls bypassing service layer
- ❌ Missing error handling
- ❌ Mutations without optimistic updates
- ❌ State updates without version increment
- ❌ Missing domain events

---

## Timeline Estimate

### Actual Scope

- **2 components to update:** `AppContent.tsx` (both hooks), `CaseWorkspace.tsx` (type only)
- **Estimated time:** 1-2 hours total

### Component Migration

- **AppContent.tsx:** 30-60 minutes (both useFinancialItemFlow + useNoteFlow)
- **CaseWorkspace.tsx:** 5-10 minutes (just update type import)

### Testing

- **Unit tests:** 30 minutes
- **Integration testing:** 30 minutes
- **Manual QA:** 30 minutes

### Total Estimate

- **Best case:** 1.5 hours
- **Realistic:** 2-3 hours
- **With buffer:** Half day
