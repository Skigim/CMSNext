# CMSNext Repository Memories

> **52 memories** captured from GitHub Copilot settings as of January 13, 2026.

This file serves as a human-readable reference for all repository memories used by GitHub Copilot.

---

## Architecture & Data Flow

### Core Architecture
DataManager orchestrates 7 stateless services. `DataManager` handles File System state, while specific domain logic resides in `utils/services/*`. Service logic is normalized using `serviceHelpers.ts` for data verification.

### Domain Layer
Domain layer contains pure business logic functions - no I/O, no React, no side effects. Import from `@/domain/*` for validation and business rules. Functional style, no OOP.

### Shared Utilities
UI logic must be extracted to shared utilities:
* `utils/formatFreshness.ts` for relative time ("Just now").
* `utils/styleUtils.ts` for category colors.
* `utils/constants/usStates.ts` for static data.
* `utils/textUtils.ts` for string normalization.

---

## Data Format & Storage

### Storage Hierarchy
1.  **Case Data:** Persisted via **File System Access API** (JSON).
2.  **App Preferences:** Persisted via **LocalStorage Adapter** (`utils/localStorage.ts`).
3.  **Session State:** React Context / `useRef` (for sensitive keys).

### LocalStorage Strategy
**Strict Rule:** Never access `window.localStorage` directly.
Always use `createLocalStorageAdapter<T>(key, default)` from `utils/localStorage.ts`.
* **Naming:** Keys must follow `cmsnext-[feature-name]` (e.g., `cmsnext-pinned-cases`).
* **Safety:** Adapter handles SSR (`window` checks) and JSON parsing errors.

### File Storage
Uses v2.0 normalized data format. Main file: `case-tracker-data.json`.
Automatic backups created before major operations. Autosave has 5s debounce.

### Data Writes
`writeNormalizedData` auto-enriches categoryConfig. Implements rollback on write failure.
**Atomic Updates:** Services use atomic timestamps (single `new Date()` per transaction).

---

## Security & Encryption

### Encryption
AES-256-GCM with PBKDF2.
**Transient Secrets:** Passwords are stored in `useRef` (not `useState`) to prevent exposure in React DevTools/Memory.
**Zero Knowledge:** Password never stored on disk.

---

## Patterns & Conventions

### Service Layer Patterns
* **Validation:** Use `readDataAndVerifyCase` helper (Don't repeat "Read -> Verify -> Throw").
* **Errors:** Always catch `error` (never `err`). Use `extractErrorMessage(error)` utility.
* **Factory Methods:** Use factories for complex objects (e.g., `ActivityLogService.createStatusChangeEntry`).

### Hook Patterns
* **Size:** Hooks > 50 lines should be split.
* **Persistence:** Use `createLocalStorageAdapter`.
* **Sync:** Use `useDataSync` for watching `dataChangeCount`.
* **Guards:** Use `createDataManagerGuard` instead of manual null checks.

### Logging (Zero Logs Policy)
**Strict Rule:** `console.log`, `console.warn`, `console.error` are forbidden in production code.
* Use `createLogger(scope)` from `utils/logger.ts`.
* Log levels: `debug`, `info`, `warn`, `error`.

### Naming Conventions
* **Booleans:** Must use prefixes: `is`, `has`, `should`, `can` (e.g., `isAmountChanging`).
* **Variables:** Explicit names only (`caseData` not `data`, `fileContent` not `content`).
* **Errors:** Exception variables must be named `error`.

---

## UI & Components

### Component Hygiene
* **No Logic:** Formatting/Calculation logic moves to `@/domain` or `utils/*`.
* **Loading:** Use shared `WidgetSkeleton` or `LoadingSpinner`.
* **Constants:** Large constants (e.g., State lists) move to `utils/constants/*`.

### UI Components
Use shadcn/ui primitives (`components/ui/*`). Style with Tailwind CSS v4 tokens.
**Premium Features:** `scrollbar-gutter`, instant sidebar collapse, global context menu.

### Navigation
Cross-component communication via custom events: `app:navigate`, `app:newcase`.
Keyboard shortcuts: `Ctrl+G` leader system.

---

## Testing

### Testing Strategy
* **Unit:** Vitest + React Testing Library.
* **Mocks:** Do not mock `localStorage` manually; mock the adapter or use the provided test setup.
* **Accessibility:** Use `jest-axe`.
* **Forbidden:** `toBeTruthy`, `any`.

---

## Development Workflow

### Build & Quality
* **Build:** `npm run build`
* **Lint:** `npm run lint` (Strict strict-boolean-expressions)
* **Test:** `npm run test:run`

_Last updated: January 13, 2026 (Post-Refactor)_