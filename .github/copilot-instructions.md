# CMSNext - AI Coding Agent Instructions

## General Approach

- Read task thoroughly; infer intent if unclear, then proceed with discovery rather than guessing.
- Balance thorough understanding with forward momentum—gather context quickly, then act.
- Break complex work into logical, actionable steps tracked via todo lists.
- Update task status consistently: mark in-progress when starting, completed immediately when done.
- For multi-step tasks, combine independent read-only operations in parallel batches.
- Maintain context continuity across tasks—summarize decisions and keep roadmap + feature catalogue in sync.
- Surface blockers or missing context immediately rather than proceeding with incomplete information.

## Architecture & Stack

### Storage Layer (Filesystem-Only)

- **Data flow:** `FileStorageContext` (handles/permissions) → `AutosaveFileService` → File System Access API
- **Always validate:** Call `fileDataProvider.getAPI()`; halt work if it returns `null`.
- **Mutations:** After all writes, call `safeNotifyFileStorageChange()` to trigger UI updates.
- **Debounce:** Autosave is 5s; do not bypass `AutosaveFileService` or invent alternative storage layers.
- **No auth:** There is no authentication context; all access is local-first and permission-based.

### State Management

- **Core contexts:** `FileStorageContext` (permissions), `ThemeContext` (five themes: light, paperwhite, paper, soft-dark, dark)
- **Application state:** Centralized `ApplicationState` for case/financial/note data
- **Events:** Use `DomainEventBus` for cross-domain communication (CaseCreated, CaseUpdated, etc.)
- **Repositories:** Inject `StorageRepository` for domain-layer data access

### Browser Compatibility

- Guard unsupported browsers by checking `isSupported` before accessing File System API
- Surface the compatibility prompt when API is unavailable
- Treat `AbortError` as a non-error (user cancellation, not failure)

## UI & UX Standards

### Component Library

- **Primary:** shadcn/ui primitives from `components/ui/*`
- **Styling:** Tailwind v4 tokens only; no inline styles diverging from shadcn conventions
- **Performance:** Memoize expensive components and selectors; rely on domain hooks

### Feedback & Feedback

- **Notifications:** Sonner toasts with loading → success/error state transitions
- **Never use:** `alert()`, `confirm()`, or browser dialogs
- **Accessibility:** Maintain focus management in modals, verify keyboard paths, add axe checks as features land
- **Autosave UI:** Keep autosave badges and storage toasts aligned with actual storage state

## Domain Architecture

### Layer Structure

1. **Domain:** Use cases, entities, repositories (in `domain/*/`)
2. **Application:** Services that orchestrate use cases (in `application/services/`)
3. **Hooks:** Thin wrappers over services for React integration (in `hooks/`)
4. **Components:** UI only; call hooks, never services directly

### Use Cases

- One file per use case (single responsibility)
- Execute pattern: `async execute(request): Promise<response>`
- Handle errors consistently; log with domain context

### Services

- Orchestrate multiple use cases for complex flows
- Handle UI feedback (toasts, loading states)
- Translate between UI types and domain types
- Provide simplified API for React hooks

### Hooks

- Maintain local React state for UI
- Delegate all business logic to services
- Target: ~40-50 lines max per hook
- Memoize service instances to avoid recreation

## Testing

### Test Stack

- **Runner:** Vitest (`vitest.config.ts`)
- **Components:** React Testing Library + `@testing-library/jest-dom`
- **Accessibility:** jest-axe with `toHaveNoViolations()` matcher
- **Environment:** jsdom configured in `__tests__/setup.test.tsx`

### Test Patterns

- Run full suite after domain migrations
- Aim for 100% pass rate (347+ tests)
- Add axe checks for UI components
- Mock repositories and services consistently

## Antipatterns

- ❌ No localStorage/sessionStorage or network APIs
- ❌ No direct filesystem calls outside the provider stack
- ❌ No long-lived feature branches; ship small slices with tests
- ❌ Do not mutate state without notifying storage
- ❌ Do not introduce optimistic UI that ignores autosave timing
- ❌ Avoid circular dependencies (hook → service → hook)
- ❌ Do not put business logic in React components

## Documentation & Reference

- **Product & Features:** `README.md`, `docs/development/feature-catalogue.md`
- **Current Roadmap:** `docs/development/ROADMAP_STATUS_NOV_2025.md` (update monthly)
- **Testing Guide:** `docs/development/testing-infrastructure.md`
- **Deployment:** `docs/DeploymentGuide.md`
- **Phase Architecture:** `docs/development/agent-prompts/phase-*.md`

## Git Workflow

- **Branches:** Work on `dev` branch; keep `main` as stable release
- **Commits:** Follow `COMMIT_STYLE.md` for message format
- **PRs:** Small, focused PRs per domain/feature; include test results
- **History:** Force-push only on `dev`; use `--force-with-lease` on shared branches
