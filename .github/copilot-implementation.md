# Implementation Guidelines

Focus: Backend logic, services, hooks, and data flow.

## Service Patterns

### DataManager Orchestration

```
DataManager
├── FileStorageService    # File I/O, format validation
├── CaseService           # Case CRUD operations
├── FinancialsService     # Financial item management
├── NotesService          # Note management
├── ActivityLogService    # Activity logging
├── CategoryConfigService # Status/category configuration
└── AlertsService         # Alert management
```

- Services are **stateless** - receive dependencies via constructor injection
- All mutations go through `DataManager` methods
- No domain layer, repositories, or event bus patterns

### Storage Flow

```
FileStorageContext (handles/permissions)
    → AutosaveFileService
    → File System Access API
```

- Validate: Call `fileDataProvider.getAPI()`; halt if `null`
- After writes: Call `safeNotifyFileStorageChange()` to trigger UI updates
- Autosave debounce: 5s (15s during bulk operations)

## Hook Patterns

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

## Antipatterns

- ❌ No localStorage/sessionStorage or network APIs
- ❌ No direct filesystem calls outside the provider stack
- ❌ Do not mutate state without notifying storage
- ❌ Do not put business logic in React components
- ❌ No domain layer, repositories, or event bus patterns
- ❌ Do not introduce optimistic UI that ignores autosave timing

## File Locations

- **Services:** `utils/services/*` and `utils/DataManager.ts`
- **Hooks:** `hooks/*`
- **Types:** `types/*`
- **Contexts:** `contexts/*`
