# CMSNext - AI Agent Instructions

## General Approach

- Read task thoroughly; infer intent if unclear, then discover rather than guess.
- Gather context quickly, then act—balance understanding with forward momentum.
- Break complex work into logical steps; track via todo lists.
- Surface blockers immediately rather than proceeding with incomplete information.
- Run full test suite after significant changes; fix before committing.

## Architecture

### Data Layer

**Pattern:** `DataManager` orchestrates stateless services. File system is single source of truth—no caching.

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

- Services are stateless; receive dependencies via constructor injection.
- All mutations go through `DataManager` methods.
- No domain layer, repositories, or event bus—those don't exist.

### Storage Layer

**Flow:** `FileStorageContext` (handles/permissions) → `AutosaveFileService` → File System Access API

- **Validate:** Call `fileDataProvider.getAPI()`; halt if `null`.
- **Mutations:** After writes, call `safeNotifyFileStorageChange()` to trigger UI updates.
- **Debounce:** Autosave is 5s (15s during bulk operations). Do not bypass `AutosaveFileService`.
- **No auth:** All access is local-first and permission-based.

### Data Format (v2.0 Normalized)

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

- Flat arrays with foreign keys—no nested structures.
- Legacy nested formats are rejected with `LegacyFormatError`.
- Migration: use `discoverStatusesFromCases()` to auto-add statuses from case data.

### Theme System

8 themes in 4 families:

| Family  | Light         | Dark         |
| ------- | ------------- | ------------ |
| Neutral | `light`       | `dark`       |
| Slate   | `slate-light` | `slate-dark` |
| Stone   | `stone-light` | `stone-dark` |
| Zinc    | `zinc-light`  | `zinc-dark`  |

Access via `ThemeContext`. Theme affects all CSS variables including color slots.

### Color Slots

10 semantic colors for status customization:

```typescript
type ColorSlot =
  | "blue"
  | "green"
  | "red"
  | "amber"
  | "purple"
  | "slate"
  | "teal"
  | "rose"
  | "orange"
  | "cyan";
```

CSS variables per slot: `--color-slot-{name}`, `--color-slot-{name}-bg`, `--color-slot-{name}-border`

Status configuration:

```typescript
interface StatusConfig {
  name: string;
  colorSlot: ColorSlot;
}
```

### Browser Compatibility

- Check `isSupported` before accessing File System API.
- Surface compatibility prompt when API unavailable.
- Treat `AbortError` as user cancellation, not failure.

## UI Standards

### Component Library

- **Primary:** shadcn/ui primitives from `components/ui/*`
- **Styling:** Tailwind v4 tokens only; no divergent inline styles.
- **Performance:** Memoize expensive components and selectors.

### Feedback

- **Notifications:** Sonner toasts with loading → success/error transitions.
- **Never use:** `alert()`, `confirm()`, or browser dialogs.
- **Accessibility:** Maintain focus management in modals; verify keyboard paths.

## Code Organization

### Layer Structure

1. **Services:** Business logic in `utils/services/*` and `utils/DataManager.ts`
2. **Hooks:** React state + service calls in `hooks/*`
3. **Components:** UI only in `components/*`; call hooks, never services directly
4. **Contexts:** Global state providers in `contexts/*`

### Hooks

- Maintain local React state for UI.
- Delegate all business logic to services.
- Target: ~40-50 lines max per hook.

## Testing

### Stack

- **Runner:** Vitest (`vitest.config.ts`)
- **Components:** React Testing Library + `@testing-library/jest-dom`
- **Accessibility:** jest-axe with `toHaveNoViolations()` matcher
- **Setup:** `__tests__/setup.test.tsx`

### Patterns

- Run full suite after migrations or significant refactors.
- Add axe checks for new UI components.
- Mock services consistently in tests.

## Antipatterns

- ❌ No localStorage/sessionStorage or network APIs
- ❌ No direct filesystem calls outside the provider stack
- ❌ No long-lived feature branches; ship small slices with tests
- ❌ Do not mutate state without notifying storage
- ❌ Do not introduce optimistic UI that ignores autosave timing
- ❌ Do not put business logic in React components
- ❌ No domain layer, repositories, or event bus patterns

## Git Workflow

- **Branch:** Work directly on `main` for small changes; use `dev` for larger features.
- **Commits:** Follow `COMMIT_STYLE.md` format.
- **Tests:** Ensure all tests and build pass before pushing.

## Documentation

- **Product:** `README.md`
- **Features:** `docs/development/feature-catalogue.md`
- **Roadmap:** `docs/development/ROADMAP_STATUS_NOV_2025.md`
- **Testing:** `docs/development/testing-infrastructure.md`
- **Deployment:** `docs/DeploymentGuide.md`
