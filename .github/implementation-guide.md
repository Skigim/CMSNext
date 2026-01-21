```markdown
# Implementation Guide

Backend logic, services, hooks, domain layer, and data flow patterns for CMSNext.

## Architecture Overview
```

┌─────────────────────────────────────────────────────────┐
│ UI Layer (Components) │
│ - Renders data, handles user input │
│ - Calls Hooks, never Services or Domain directly │
└─────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────┐
│ Hooks Layer │
│ - React state management │
│ - Delegates to Services OR calls Domain directly │
└─────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────┐
│ Service Layer (DataManager + Services) │
│ - Orchestrates operations │
│ - Loads/saves via FileStorageService │
│ - Delegates calculations to Domain │
└─────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────┐
│ Domain Layer │
│ - Pure business logic, NO I/O │
│ - Functional approach (no classes) │
│ - Fully testable without mocks │
└─────────────────────────────────────────────────────────┘

```

## Service Layer

### DataManager Orchestration

```

DataManager (orchestrator)
├── FileStorageService # File I/O, format validation
├── CaseService # Case CRUD operations
├── FinancialsService # Financial item management
├── NotesService # Note management
├── ActivityLogService # Activity logging
├── CategoryConfigService # Status/category configuration
└── AlertsService # Alert management

```

**Critical Rules:**
- Services are **stateless** - receive dependencies via constructor injection
- All mutations go through `DataManager` methods
- File system is single source of truth—no caching
- No repositories or event bus patterns

### Storage Flow

```

FileStorageContext (handles/permissions)
→ AutosaveFileService
→ File System Access API

````

- **Validate:** Call `fileDataProvider.getAPI()`; halt if `null`
- **After writes:** Call `safeNotifyFileStorageChange()` to trigger UI updates
- **Autosave debounce:** 5s (15s during bulk operations)

### Creating a Service

```typescript
/**
 * Manages [entity] operations.
 * Stateless - all state comes from file storage.
 */
export class EntityService {
  private fileService: FileStorageService;

  constructor(fileService: FileStorageService) {
    this.fileService = fileService;
  }

  async getByCaseId(caseId: string): Promise<Entity[]> {
    const data = await this.fileService.read();
    return data.entities.filter((e) => e.caseId === caseId);
  }

  async create(input: CreateEntityInput): Promise<Entity> {
    const data = await this.fileService.read();

    const entity: Entity = {
      id: generateId(),
      ...input,
      createdAt: new Date().toISOString(),
    };

    data.entities.push(entity);
    await this.fileService.write(data);

    return entity;
  }
}
````

### DataManager Method Pattern

```typescript
async addEntity(caseId: string, input: CreateEntityInput): Promise<Entity> {
  // 1. Delegate to service
  const entity = await this.entityService.create({
    ...input,
    caseId,
  });

  // 2. Log activity
  await this.activityLogService.log({
    action: 'ENTITY_CREATED',
    entityId: entity.id,
    caseId,
  });

  // 3. Notify storage changed
  safeNotifyFileStorageChange();

  return entity;
}
```

### Read-Modify-Write Pattern

```typescript
async updateEntity(id: string, updates: Partial<Entity>): Promise<Entity> {
  // READ current state
  const data = await this.fileService.read();

  // FIND and validate
  const index = data.entities.findIndex(e => e.id === id);
  if (index === -1) {
    throw new Error(`Entity not found: ${id}`);
  }

  // MODIFY
  const updated = {
    ...data.entities[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  data.entities[index] = updated;

  // WRITE back
  await this.fileService.write(data);

  return updated;
}
```

## Domain Layer

### Critical Rules

1. **NO I/O** - Domain functions never read/write files, call APIs, or access storage
2. **NO React** - No hooks, no state, no context, no effects
3. **NO Side Effects** - Same input always produces same output
4. **Functional** - Pure functions only, no classes or OOP patterns
5. **Minimal Dependencies** - Import only types and other domain functions

### Pure Calculation Function

```typescript
// domain/financials/calculations.ts
import type { FinancialItem, CaseCategory } from "@/types/case";

/**
 * Calculate the total value of financial items in a category.
 * Pure function - no I/O, no side effects.
 */
export function calculateCategoryTotal(
  items: FinancialItem[],
  category: CaseCategory,
  targetDate: Date = new Date(),
): number {
  return items
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + getAmountForMonth(item, targetDate), 0);
}
```

### Directory Structure

```
domain/
├── alerts/       # Matching, filtering, display formatting
├── avs/          # AVS file parsing
├── cases/        # Case formatting, factories
├── common/       # Dates, phone, formatters, sanitization
├── dashboard/    # Priority queue, pinned/recent, widgets
├── financials/   # Calculations, validation, history
├── templates/    # VR generator, case summary
├── validation/   # Zod schemas, duplicate detection
└── workflows/    # Workflow state logic
```

Import via `@/domain` or `@/domain/{module}`.

### When to Use Domain vs Service

| Use Domain When                            | Use Service When                       |
| ------------------------------------------ | -------------------------------------- |
| Pure calculation (totals, aggregates)      | Need to read/write data                |
| Data transformation                        | Orchestrating multiple operations      |
| Validation rules (pure boolean returns)    | Need DataManager or FileStorageService |
| Business rules with no I/O                 | Need to trigger UI updates             |
| Logic that needs unit testing in isolation | Need error handling with toasts        |

## Hooks Layer

### Structure

```typescript
export function useFeature() {
  // Local React state for UI
  const [state, setState] = useState();

  // Get services from context
  const { dataManager } = useDataManager();

  // Delegate business logic to services
  const handleAction = useCallback(async () => {
    await dataManager.someOperation();
    // Update local state
  }, [dataManager]);

  return { state, handleAction };
}
```

### Rules

- Target: **~40-50 lines max** per hook
- Maintain local React state for UI
- **Never** put business logic in hooks - delegate to services
- Use `useCallback` for stable function references

### Calling Domain from Hooks

```typescript
import { useMemo } from "react";
import { calculateCategoryTotal } from "@/domain/financials";
import { useFinancialItems } from "./useFinancialItems";

export function useFinancialSummary(caseId: string) {
  const { items } = useFinancialItems(caseId);

  // Call domain function directly - no service needed for pure calculations
  const totals = useMemo(
    () => ({
      resources: calculateCategoryTotal(items, "resources"),
      income: calculateCategoryTotal(items, "income"),
      expenses: calculateCategoryTotal(items, "expenses"),
    }),
    [items],
  );

  return { totals };
}
```

## Data Format (v2.0 Normalized)

```typescript
interface NormalizedFileData {
  cases: Case[]; // id, caseNumber, status, createdAt, etc.
  financials: Financial[]; // id, caseId (FK), amount, type, etc.
  notes: Note[]; // id, caseId (FK), content, createdAt, etc.
  alerts: Alert[]; // id, caseId (FK), message, severity, etc.
  categoryConfig: CategoryConfig;
  activityLog: ActivityLogEntry[];
}
```

- Flat arrays with foreign keys - **no nested structures**
- Legacy nested formats are rejected with `LegacyFormatError`

## Form Data Factories

When initializing form state for case/person data, use the centralized factories:

```typescript
import { createCaseRecordData, createPersonData } from "@/domain/cases";

// Creating new case form state
const [caseData, setCaseData] = useState(() =>
  createCaseRecordData(null, {
    caseType: config.caseTypes[0],
    caseStatus: config.caseStatuses[0]?.name,
    livingArrangement: config.livingArrangements[0],
  }),
);

// Editing existing case
const [caseData, setCaseData] = useState(() =>
  createCaseRecordData(existingCase, { caseStatus: defaultStatus }),
);
```

**IMPORTANT:** When adding a new field to `NewCaseRecordData` or `NewPersonData`:

1. Add the field to the type in `types/case.ts`
2. Update the factory in `domain/cases/factories.ts`
3. That's it - all forms automatically get the new field

## Antipatterns

- ❌ No localStorage/sessionStorage or network APIs
- ❌ No direct filesystem calls outside the provider stack
- ❌ Do not mutate state without notifying storage
- ❌ Do not put business logic in React components
- ❌ No repositories or event bus patterns
- ❌ Do not introduce optimistic UI that ignores autosave timing
- ❌ Do not add I/O or React dependencies to domain layer
- ❌ **No inline form data initialization** - use factories

## File Locations

| Path                   | Purpose                     |
| ---------------------- | --------------------------- |
| `utils/DataManager.ts` | Main orchestrator           |
| `utils/services/*.ts`  | Individual services         |
| `domain/*`             | Pure business logic         |
| `hooks/*`              | React hooks                 |
| `types/*`              | TypeScript type definitions |
| `contexts/*`           | React context providers     |

## Verification

After making changes:

1. **Build passes:** `npm run build`
2. **Tests pass:** `npm test`
3. **Types correct:** `npx tsc --noEmit`

```

```
