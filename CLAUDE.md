# CLAUDE.md — CMSNext AI Assistant Guide

This file provides guidance for AI assistants (Claude Code and similar tools) working on the CMSNext codebase. Read this before making any changes.

## Quick Reference

- **Project:** Local-first case tracking SPA — no backend, no network
- **Stack:** React 18, TypeScript (strict), Tailwind CSS v4, Vite, Vitest
- **Storage:** File System Access API (Chromium-only: Chrome 86+, Edge 86+)
- **Architecture:** Domain → Services → Hooks → Components (strict layering)
- **Machine-readable index:** [`llms.txt`](llms.txt)

---

## Development Commands

```bash
npm run dev            # Start dev server (http://localhost:5173, IPv4 forced)
npm run build          # TypeScript check + Vite production build
npm run build:pages    # GitHub Pages build (base=/CMSNext/)
npm run typecheck      # Type-check only (tsc --noEmit)
npm run lint           # ESLint with --max-warnings 0 (zero tolerance)
npm run lint:check     # Same as lint
npm test               # Run full test suite (watch mode)
npm run test:run       # Single run — use in CI
npm run test:coverage  # Coverage report (70% threshold on all metrics)
npm run test:ui        # Vitest browser UI
npm run dead-code      # Knip — detect unused exports/dependencies
npm run analyze        # Bundle size analysis (generates dist/bundle-analysis.html)
npm run seed           # Seed dev data (default preset)
npm run seed:demo      # Seed demo preset
npm run seed:small     # Seed small preset
npm run seed:large     # Seed large preset
```

**Quality gates (must pass before committing):**
1. `npm run typecheck` — zero errors
2. `npm run lint` — zero warnings
3. `npm run test:run` — all tests pass

---

## Architecture Overview

The application follows a strict **4-layer architecture**. Never skip layers.

```
┌─────────────────────────────────────────────────────────┐
│ 1. Domain Layer  (domain/*)                             │
│    Pure functions, no I/O, no React, no side effects    │
│    Fully testable without mocks (~6,356 lines)          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Service Layer  (utils/DataManager.ts + services/*)   │
│    DataManager orchestrates 7 stateless services        │
│    All mutations and file I/O happen here               │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Hooks Layer  (hooks/*)                               │
│    React state management + service/domain calls        │
│    Target: 40–50 lines max per hook                     │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Component Layer  (components/*)                      │
│    Pure UI rendering — calls hooks, never services      │
│    shadcn/ui primitives + Tailwind v4 tokens            │
└─────────────────────────────────────────────────────────┘
```

**Contexts** (`contexts/*`) provide global state (DataManager, FileStorage, Theme, Encryption, etc.) to the hook and component layers.

---

## Directory Structure

```
CMSNext/
├── App.tsx                     # Root component; registers keyboard shortcuts + cross-component events
├── main.tsx                    # Vite entry point
├── index.html                  # HTML shell
│
├── components/                 # UI-only React components
│   ├── ui/                     # shadcn/ui primitives (Button, Dialog, Select, etc.)
│   ├── app/                    # Top-level app shells (AppContent, GlobalSearch, Sidebar)
│   ├── case/                   # Case detail views and editors
│   ├── financial/              # Financial item components
│   ├── alerts/                 # Alert display and management
│   ├── settings/               # Settings pages
│   ├── modals/                 # Modal dialogs
│   ├── common/                 # Shared UI (PaperCut, KeyboardShortcutsHelp)
│   ├── providers/              # AppProviders, FileStorageIntegrator
│   ├── routing/                # View routing components
│   └── ...                     # Other feature-area components
│
├── contexts/                   # React Context providers
│   ├── DataManagerContext.tsx  # DataManager access for all hooks
│   ├── FileStorageContext.tsx  # File handle and permission management
│   ├── fileStorageMachine.ts   # State machine for storage states
│   ├── EncryptionContext.tsx   # AES-256-GCM encryption session
│   ├── ThemeContext.tsx        # 8-theme system (4 families × light/dark)
│   ├── CategoryConfigContext.tsx
│   ├── SelectedMonthContext.tsx
│   └── TemplateContext.tsx
│
├── domain/                     # Pure business logic (no React, no I/O)
│   ├── alerts/                 # Alert matching, filtering, display formatting
│   ├── avs/                    # AVS file parsing
│   ├── cases/                  # Case formatting
│   ├── common/                 # Dates, phone, formatters, sanitization
│   ├── dashboard/              # Priority queue, pinned/recent, widgets, activity reports
│   ├── financials/             # Calculations, validation, history, verification
│   ├── positions/              # Position tracking
│   ├── templates/              # VR generator, case summary
│   └── validation/             # Zod schemas, duplicate detection
│
├── hooks/                      # Custom React hooks (bridge components ↔ services)
│   ├── index.ts                # Re-exports all hooks
│   ├── useCaseManagement.ts    # Case CRUD operations
│   ├── useFinancialItems.ts    # Financial item management
│   ├── useNotes.ts             # Note management
│   ├── useAlertsFlow.ts        # Alert management
│   ├── useFileDataSync.ts      # File data synchronization
│   ├── useNavigationFlow.ts    # Navigation state
│   ├── useDataSync.ts          # Watches dataChangeCount for re-renders
│   └── ...                     # 30+ additional feature hooks
│
├── utils/                      # Services and shared utilities
│   ├── DataManager.ts          # Thin orchestration layer (~461 lines)
│   ├── AutosaveFileService.ts  # Debounced autosave (5s / 15s bulk)
│   ├── IndexedDBHandleStore.ts # Persists file handles across sessions
│   ├── logger.ts               # Structured logging (createLogger)
│   ├── localStorage.ts         # Safe LocalStorage adapter
│   ├── errorUtils.ts           # extractErrorMessage utility
│   ├── encryption.ts           # AES-256-GCM crypto operations
│   ├── featureFlags.ts         # Feature flag system
│   ├── performanceTracker.ts   # Telemetry
│   ├── services/               # Stateless service classes
│   │   ├── FileStorageService.ts       # File I/O, v2.0 format validation
│   │   ├── CaseService.ts             # Case CRUD
│   │   ├── FinancialsService.ts       # Financial items CRUD
│   │   ├── NotesService.ts            # Note management
│   │   ├── ActivityLogService.ts      # Activity tracking
│   │   ├── CategoryConfigService.ts   # Status/category configuration
│   │   ├── AlertsService.ts           # Alert management and CSV import
│   │   ├── TemplateService.ts         # Template management
│   │   ├── CaseArchiveService.ts      # Case archival
│   │   ├── CaseBulkOperationsService.ts
│   │   ├── CaseOperationsService.ts
│   │   └── AdvancedAlertFilterService.ts
│   ├── constants/              # Static data (US states, storage keys, etc.)
│   └── alerts/                 # Alert-specific utilities
│
├── types/                      # TypeScript type definitions
│   ├── case.ts                 # CaseDisplay, FinancialItem, AlertRecord, etc.
│   ├── activityLog.ts
│   ├── categoryConfig.ts       # CategoryConfig, StatusConfig, ColorSlot
│   ├── template.ts
│   ├── archive.ts
│   ├── encryption.ts
│   ├── view.ts
│   └── ...
│
├── src/                        # Additional source (test setup)
│   └── test/
│       ├── setup.ts            # Vitest global setup
│       ├── testUtils.ts        # Shared test helpers
│       └── reactTestUtils.tsx  # RTL rendering utilities
│
├── __tests__/                  # Test files (mirrors source structure)
│   ├── services/               # Service unit tests
│   ├── components/             # Component tests
│   ├── hooks/                  # Hook tests
│   ├── domain/                 # Domain function tests
│   ├── integration/            # Integration tests
│   └── utils/                  # Utility tests
│
├── domain/                     # Domain test files alongside source
│   └── **/*.test.ts
│
├── scripts/                    # Dev tooling (seed, benchmarks, analysis)
├── docs/                       # Development documentation
│   ├── development/            # Roadmaps, feature catalogue, guidelines
│   ├── audit/                  # SonarCloud issues
│   └── DeploymentGuide.md
│
├── .github/                    # AI agent instructions and git configuration
│   ├── copilot-instructions.md # High-level AI guidance
│   ├── implementation-guide.md # Services, domain, hooks patterns
│   ├── ui-guide.md             # Component and Tailwind patterns
│   ├── testing-guide.md        # Vitest/RTL patterns
│   ├── BRANCHING.md            # Git workflow
│   ├── COMMIT_STYLE.md         # Commit message format
│   └── agents/                 # Specialized agent guides
│       ├── STORAGE.md          # File System Access API patterns
│       ├── HOOKS.md            # Custom hook patterns
│       ├── MEMORIES.md         # Repository memory index
│       └── TEMPLATES.md        # Ready-to-use prompt templates
│
├── styles/                     # Global CSS, theme definitions
├── public/                     # Static assets
├── components.json             # shadcn/ui configuration
├── tailwind.config.js          # Tailwind v4 configuration
├── vite.config.ts              # Vite + chunk splitting + compression
├── vitest.config.ts            # Vitest + jsdom + coverage thresholds
├── tsconfig.json               # Strict TypeScript (ES2021, noUnusedLocals)
├── eslint.config.js            # Flat config ESLint, zero-warning policy
├── knip.config.ts              # Dead code detection
└── sonar-project.properties    # SonarCloud analysis configuration
```

---

## Key Conventions

### TypeScript

- **Strict mode** is enabled: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- Path alias `@/*` maps to the repo root (`./`)
- Import with `@/` prefix: `import { foo } from "@/utils/foo"`
- Scripts (`scripts/`) and test infra (`src/test/`) are excluded from `tsconfig.json`
- `any` is allowed by ESLint config but should be avoided where possible

### Naming Conventions

| Pattern | Rule |
|---------|------|
| Booleans | Must use `is`, `has`, `should`, `can` prefixes (`isLoading`, `hasError`) |
| Variables | Explicit names (`caseData` not `data`, `fileContent` not `content`) |
| Error variables | Always named `error` (never `err`, `e`) |
| LocalStorage keys | Must follow `cmsnext-[feature-name]` pattern |

### Logging (Zero Console Policy)

**Never use** `console.log`, `console.warn`, or `console.error` in production code.

```typescript
// ✅ Required pattern
import { createLogger } from "@/utils/logger";
const logger = createLogger("MyComponent");
logger.debug("Loading...");
logger.info("Loaded", { count: items.length });
logger.warn("Slow query", { duration: ms });
logger.error("Failed", { error });
```

### LocalStorage Access

**Never access** `window.localStorage` directly.

```typescript
// ✅ Required pattern
import { createLocalStorageAdapter } from "@/utils/localStorage";
const adapter = createLocalStorageAdapter<MyType>("cmsnext-my-feature", defaultValue);
```

---

## Data Layer

### v2.0 Normalized Format

All data is stored in a flat, normalized JSON format. No nested case-level structures.

```typescript
interface NormalizedFileData {
  version: "2.0";
  cases: StoredCase[];          // id, caseNumber, status, etc.
  financials: StoredFinancialItem[]; // id, caseId (FK), amount, type, etc.
  notes: StoredNote[];          // id, caseId (FK), content, etc.
  alerts: AlertRecord[];        // id, caseId (FK), message, severity, etc.
  activityLog: CaseActivityEntry[];
  categoryConfig: CategoryConfig;
}
```

- Flat arrays with foreign keys — no nested structures
- Legacy nested formats trigger `LegacyFormatError` (never silently migrate)
- Main file: `case-tracker-data.json`

### Storage Hierarchy (3 tiers)

1. **Case data** → File System Access API (JSON files on disk)
2. **App preferences** → LocalStorage via `createLocalStorageAdapter` (pinned cases, column visibility, etc.)
3. **Session secrets** → React `useRef` (encryption passwords — never `useState`)

### Autosave

- Debounce: **5 seconds** (normal) / **15 seconds** (bulk operations)
- After every write, call `safeNotifyFileStorageChange()` to trigger UI refresh
- Never bypass `AutosaveFileService`

### Storage Flow

```
FileStorageContext (handles/permissions)
    ↓
AutosaveFileService (debouncing + write queue)
    ↓
FileStorageService (read/write + v2.0 validation)
    ↓
File System Access API (browser native)
```

### Encryption

- AES-256-GCM with PBKDF2 key derivation (100,000 iterations)
- Password stored in `useRef` (not `useState`) to prevent DevTools exposure
- Zero-knowledge: password never written to disk, no recovery backdoor

---

## Service Layer Patterns

### DataManager Services

```
DataManager (orchestrator, ~461 lines)
├── FileStorageService    # File I/O, format validation
├── CaseService           # Case CRUD operations
├── FinancialsService     # Financial item management
├── NotesService          # Note management
├── ActivityLogService    # Activity logging
├── CategoryConfigService # Status/category configuration
├── AlertsService         # Alert management and CSV import
└── TemplateService       # Template management
```

### Service Rules

- Services are **stateless** — all state comes from file storage
- Receive all dependencies via **constructor injection**
- All mutations go through `DataManager` methods
- Use `readDataAndVerifyCase` helper (don't repeat read→verify→throw)
- Always catch `error` (not `err`), use `extractErrorMessage(error)`
- Use `serviceHelpers.ts` for common data verification patterns
- Atomic timestamps: one `new Date()` call per transaction

### Creating a New Service

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
}
```

---

## Domain Layer Rules

- **Pure functions only** — no classes, no I/O, no React imports, no side effects
- Import via `@/domain` or `@/domain/{module}`
- Fully testable without mocks
- Domain functions are called by hooks and services, not by components directly

```
domain/
├── alerts/       # Matching, filtering, display formatting
├── avs/          # AVS file parsing
├── cases/        # Case formatting
├── common/       # Dates, phone, formatters, sanitization
├── dashboard/    # Priority queue, pinned/recent, widgets, activity
├── financials/   # Calculations, validation, history, verification
├── positions/    # Position tracking
├── templates/    # VR generator, case summary
└── validation/   # Zod schemas, duplicate detection
```

---

## Hook Layer Patterns

- Maintain local React state for UI (`loading`, `error`, UI toggles)
- Delegate all business logic to services via `DataManager`
- Get DataManager from context: `const { dataManager } = useDataManager()`
- Use `useDataSync` for watching `dataChangeCount` for auto-refresh
- Use `createDataManagerGuard` instead of manual null checks
- **Target: 40–50 lines max** per hook; split if larger

```typescript
export function useFeature(caseId: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { dataManager } = useDataManager();

  useEffect(() => {
    const loadItems = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await dataManager.getItemsByCaseId(caseId);
        setItems(result);
      } catch (error) {
        setError(extractErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };
    void loadItems();
  }, [caseId, dataManager]);

  return { items, isLoading, error };
}
```

---

## Component Layer Rules

- **No business logic in components** — formatting/calculation goes to `@/domain` or `utils/*`
- Use **shadcn/ui primitives** from `components/ui/*` exclusively
- Style with **Tailwind CSS v4 tokens only** — no divergent inline styles
- Use **Sonner toasts** for feedback — never `alert()`, `confirm()`, or browser dialogs
- Memoize expensive components and selectors

### ScrollArea Pattern (mandatory for constrained dropdowns)

```tsx
{/* Parent: all three properties required */}
<div className="overflow-hidden flex flex-col" style={{ maxHeight: "32rem" }}>
  {/* ScrollArea: both classes required */}
  <ScrollArea className="h-full max-h-80">
    {/* scrollable content */}
  </ScrollArea>
</div>
```

### Cross-Component Communication

Use custom DOM events (not prop drilling or context for ephemeral events):

```typescript
// Dispatchers (in App.tsx)
dispatchNavigationEvent(path)   // "app:navigate"
dispatchNewCaseEvent()          // "app:newcase"
dispatchFocusSearchEvent()      // "app:focussearch"
dispatchToggleSidebarEvent()    // "app:togglesidebar"
```

---

## Theme System

8 themes in 4 families:

| Family  | Light         | Dark          |
|---------|---------------|---------------|
| Neutral | `light`       | `dark`        |
| Slate   | `slate-light` | `slate-dark`  |
| Stone   | `stone-light` | `stone-dark`  |
| Zinc    | `zinc-light`  | `zinc-dark`   |

Access via `ThemeContext`. 10 semantic **color slots** for status customization:

```typescript
type ColorSlot = "blue" | "green" | "red" | "amber" | "purple" |
                 "slate" | "teal" | "rose" | "orange" | "cyan";
```

CSS variables: `--color-slot-{name}`, `--color-slot-{name}-bg`, `--color-slot-{name}-border`

---

## Testing

### Stack

| Tool | Purpose |
|------|---------|
| Vitest | Test runner (`vitest.config.ts`) |
| React Testing Library | Component testing |
| `@testing-library/jest-dom` | DOM matchers |
| jest-axe | Accessibility testing |
| `src/test/setup.ts` | Global test setup |

### Test File Locations

- Unit tests: `__tests__/**/*.test.{ts,tsx}` or alongside source in `domain/**/*.test.ts`
- Coverage threshold: **70%** on branches, functions, lines, statements

### AAA Pattern (mandatory)

```typescript
it("should throw when user not found", async () => {
  // ARRANGE
  mockFileService.read.mockResolvedValue({ cases: [] });
  const service = new CaseService(mockFileService);

  // ACT & ASSERT
  await expect(service.getCase("999")).rejects.toThrow("Case not found");
});
```

### Strict Assertion Rules

```typescript
// ❌ FORBIDDEN
expect(result).toBeTruthy();
expect(result).toBeDefined();
expect(array.length).toBeGreaterThan(0);
const mock = vi.fn() as any;

// ✅ REQUIRED
expect(result).toEqual({ id: "123", status: "ACTIVE" });
expect(array).toHaveLength(3);
expect(array[0]).toMatchObject({ id: 1 });
const mock = vi.fn<[string], Promise<Entity>>();
```

### Accessibility Testing

Add axe checks to all new UI components:

```typescript
import { axe, toHaveNoViolations } from "jest-axe";
expect.extend(toHaveNoViolations());

it("has no accessibility violations", async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Do NOT mock localStorage directly

Use the `createLocalStorageAdapter` or provided test setup instead.

---

## ESLint Rules

- **Zero warnings policy**: `--max-warnings 0` — all warnings are build blockers
- Inline disables only (`eslint-disable-next-line` or `eslint-disable-line`)
- Every inline disable **must include a justification comment**
- File-wide `eslint-disable` is forbidden unless absolutely unavoidable
- Fix the violation; disable only as last resort

---

## Git Workflow

### Branching (GitHub Flow)

```bash
# Start from up-to-date main
git checkout main && git pull origin main

# Create feature branch
git checkout -b feature/my-feature-name

# Work, commit often
git commit -m "feat: add priority scoring to dashboard"

# Ensure quality gates pass, then merge
npm run typecheck && npm run lint && npm run test:run && npm run build
git checkout main && git merge feature/my-feature-name
git push origin main
```

### Commit Message Format (Conventional Commits)

```
<type>: <short description>

• <change 1>
• <change 2>
• <change 3>

<optional additional context>
```

| Type | Use |
|------|-----|
| `feat:` | New feature or enhancement |
| `fix:` | Bug fix |
| `refactor:` | Code improvement, no behavior change |
| `perf:` | Performance optimization |
| `test:` | Adding or updating tests |
| `docs:` | Documentation only |
| `chore:` | Build, dependencies, maintenance |
| `style:` | Formatting, no logic change |

Breaking changes: append `!` and include `BREAKING CHANGE:` in body.

---

## Antipatterns (Strictly Forbidden)

| Antipattern | Reason |
|-------------|--------|
| `localStorage`/`sessionStorage` direct access | Use `createLocalStorageAdapter` |
| `window.localStorage` anywhere in code | Same as above |
| Network API calls (`fetch`, `axios`, etc.) | App is 100% local-first |
| Direct filesystem calls outside provider stack | Must flow through `AutosaveFileService` |
| Business logic in React components | Belongs in domain layer |
| Business logic in hooks | Belongs in service layer; hooks only manage UI state |
| `console.log/warn/error` in production code | Use `createLogger` |
| `alert()` / `confirm()` / browser dialogs | Use Sonner toasts |
| `toBeTruthy` / `toBeDefined` in tests | Use strict equality assertions |
| `as any` in test mocks | Use typed `vi.fn<[Args], Return>()` |
| Repositories or event bus patterns | Not part of this architecture |
| Optimistic UI that ignores autosave timing | Could cause data loss |
| Long-lived feature branches | Ship small slices with tests |
| File-wide `eslint-disable` comments | Inline + justified only |
| `err` or `e` as error variable names | Must be `error` |

---

## Browser Compatibility Note

The File System Access API is **Chromium-only**:

- ✅ Chrome 86+, Edge 86+, Opera 72+
- ❌ Firefox (not supported)
- ❌ Safari (not supported)

Always check `fileDataProvider.getAPI()` before file operations; return early with a compatibility message if `null`.

```typescript
const api = fileDataProvider.getAPI();
if (!api) {
  showCompatibilityMessage();
  return;
}
```

---

## Key Documentation

| Resource | Location |
|----------|----------|
| Architecture overview | `.github/copilot-instructions.md` |
| Service/domain/hook patterns | `.github/implementation-guide.md` |
| Component and Tailwind patterns | `.github/ui-guide.md` |
| Testing standards | `.github/testing-guide.md` |
| Storage layer guide | `.github/agents/STORAGE.md` |
| Hook patterns | `.github/agents/HOOKS.md` |
| Repository memories | `.github/agents/MEMORIES.md` |
| Prompt templates | `.github/agents/TEMPLATES.md` |
| Current roadmap | `docs/development/ROADMAP_FEB_2026.md` |
| Feature catalogue | `docs/development/feature-catalogue.md` |
| Deployment | `docs/DeploymentGuide.md` |
| SonarCloud issues | `docs/audit/sonarcloud-open-issues.json` |
| LLM index | `llms.txt` |
