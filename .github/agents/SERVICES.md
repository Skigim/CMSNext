# Agent Instructions: Services & Data Layer

## Overview

The data layer uses a `DataManager` orchestrator that coordinates stateless services. The file system is the single source of truth—services do not cache data. All business logic lives in services, never in React components or hooks.

## Key Files

| File                                      | Purpose                                     |
| ----------------------------------------- | ------------------------------------------- |
| `utils/DataManager.ts`                    | Main orchestrator, coordinates all services |
| `utils/services/FileStorageService.ts`    | File I/O, format validation                 |
| `utils/services/CaseService.ts`           | Case CRUD operations                        |
| `utils/services/FinancialsService.ts`     | Financial item management                   |
| `utils/services/NotesService.ts`          | Note management                             |
| `utils/services/ActivityLogService.ts`    | Activity logging                            |
| `utils/services/CategoryConfigService.ts` | Status/category configuration               |
| `utils/services/AlertsService.ts`         | Alert management                            |
| `types/index.ts`                          | TypeScript type definitions                 |

## Architecture

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

**Critical Rules:**

- Services are **stateless** - receive dependencies via constructor injection
- All mutations go through `DataManager` methods
- No domain layer, repositories, or event bus patterns
- File system is single source of truth—no caching

## Patterns

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

  /**
   * Get all entities for a case.
   * @param caseId - The case ID to query
   * @returns Array of entities (empty if none)
   */
  async getByCaseId(caseId: string): Promise<Entity[]> {
    const data = await this.fileService.read();
    return data.entities.filter((e) => e.caseId === caseId);
  }

  /**
   * Create a new entity.
   * @param input - Entity creation data
   * @returns The created entity with generated ID
   */
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
```

### DataManager Method Pattern

```typescript
/**
 * Add entity through DataManager orchestration.
 */
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

**Critical:** Flat arrays with foreign keys—no nested structures. Legacy nested formats are rejected with `LegacyFormatError`.

## Verification

After making service changes:

1. **Build passes:** `npm run build`
2. **Tests pass:** `npm test`
3. **Types correct:** `npx tsc --noEmit`
4. **Hook integration:** Verify hooks can consume the new method

## Common Pitfalls

| ❌ Don't                               | ✅ Do                              |
| -------------------------------------- | ---------------------------------- |
| Cache data in services                 | Always read fresh from file        |
| Throw generic errors                   | Use typed errors with context      |
| Skip activity logging                  | Log all mutations                  |
| Forget `safeNotifyFileStorageChange()` | Call after all writes              |
| Put logic in hooks                     | Keep business logic in services    |
| Use nested data structures             | Use flat arrays with FKs           |
| Introduce domain layer                 | Keep services simple and stateless |
