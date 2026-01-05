# CMSNext Repository Memories

> **48 memories** captured from GitHub Copilot settings as of January 5, 2026.

This file serves as a human-readable reference for all repository memories used by GitHub Copilot.

---

## Architecture & Data Flow

### Core Architecture

DataManager orchestrates 7 stateless services (FileStorageService, CaseService, FinancialsService, NotesService, AlertsService, ActivityLogService, CategoryConfigService). File system is single source of truth - no caching.

### Provider Hierarchy

AppProviders wraps ThemeContext + other providers. FileStorageIntegrator handles file storage connection flow. App structure: `AppProviders > FileStorageIntegrator > AppContent`.

### Domain Layer

Domain layer contains pure business logic functions - no I/O, no React, no side effects. Import from `@/domain/*` for validation and business rules. Functional style, no OOP.

### Context Usage

Use `useDataManagerSafe()` for safe context access (returns null outside provider). DataManagerProvider must wrap components using DataManager. React Context provides global state.

---

## Data Format & Storage

### Data Format

Uses v2.0 normalized data format with flat arrays (cases, financials, notes, alerts) and foreign key references (caseId). Legacy nested formats are rejected with `LegacyFormatError`.

### File Structure

Case data format is JSON with version "2.0". Files: `case-tracker-data.json` (main), `.backup-[timestamp].json` (auto backups). Automatic backups created before major operations.

### File Storage

File System Access API is the storage layer. Check `isSupported` before use. Treat `AbortError` as user cancellation. AutosaveFileService has 5s debounce (15s during bulk ops).

### File Storage States

FileStorage uses state machine with lifecycle states: `idle`, `connecting`, `connected`, `ready`, `error`, `recovering`. Permission states: `prompt`, `granted`, `denied`.

### Storage Constants

Storage constants in `utils/constants/storage.ts`. `STORAGE_CONSTANTS` contains file names, paths, and magic values. Use constants instead of hardcoded strings.

### Handle Persistence

IndexedDBHandleStore persists folder handles across sessions. Standalone module (213 lines) with dedicated tests. Used by AutosaveFileService for reconnection.

### Write Operations

`writeNormalizedData` auto-enriches categoryConfig by discovering statuses from cases and alert types from alerts. Implements rollback on write failure to keep UI in sync.

### Browser Compatibility

File System Access API only works in Chromium browsers (Chrome 86+, Edge 86+, Opera 72+). Firefox and Safari not supported. Check `isSupported` before use.

---

## Type System

### Core Types

Core types: `StoredCase` (case without nested relations), `StoredFinancialItem` (with caseId, category FKs), `StoredNote` (with caseId FK), `AlertRecord`. `CaseDisplay` is the full display type.

### Category Config

CategoryConfig contains: `caseTypes`, `caseStatuses` (StatusConfig[]), `alertTypes` (AlertTypeConfig[]), `livingArrangements`, `noteCategories`, `verificationStatuses`, `vrScripts`.

### Color Slots

10 semantic color slots: `blue`, `green`, `red`, `amber`, `purple`, `slate`, `teal`, `rose`, `orange`, `cyan`. StatusConfig has `name`, `colorSlot`, and `countsAsCompleted` fields.

### Amount History

AmountHistoryEntry tracks historical financial amounts with `startDate`, `endDate`, `amount`, `verificationSource`. Auto-migration creates history from dateAdded for legacy items.

### Activity Logging

CaseActivityEntry types: `status-change`, `priority-change`. Activity log entries sorted by timestamp (newest first). Used by dashboard widgets for metrics.

---

## Patterns & Conventions

### Hook Patterns

Hooks should be 40-50 lines (max 200). Hooks call DataManager methods, never services directly. Components call hooks, never services. Business logic belongs in services, not hooks.

### Toast Patterns

Use `toastPromise()` for simple async ops, `withToast()` for operations needing isMounted guards/setError/setLoading. Never use browser `alert()`/`confirm()` - use shadcn AlertDialog.

### Mounted Guards

Use `useIsMounted()` hook for isMounted ref in async operations. Check `isMounted.current` before state updates after await to prevent memory leaks on unmounted components.

### Error Reporting

`reportFileStorageError()` for consistent error reporting with operation context. `FileStorageOperation` type for categorizing errors. Integrates with toast notifications.

### Logging

Use `createLogger(scope)` for logging. Log levels: `debug`, `info`, `warn`, `error`, `lifecycle`. Default level is 'info' in dev. Set `VITE_LOG_LEVEL=debug` for verbose logs. Includes dedupe for repetitive warnings.

### Documentation Style

JSDoc style: use `@param`, `@returns`, `@throws`, `@example` for public methods. Include usage examples for complex APIs. Document interfaces with `@interface`.

### Commit Style

Commit format: `type: description` with bullet points. Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`. Use `BREAKING CHANGE:` for breaking changes.

---

## Antipatterns

### What to Avoid

Antipatterns: No localStorage/sessionStorage, no network APIs, no direct filesystem calls outside provider stack, no business logic in components, no domain layer/repositories/event bus.

---

## UI & Components

### UI Components

Use shadcn/ui primitives from `components/ui/*`. Style with Tailwind CSS v4 tokens only. 8 themes in 4 families (light/dark variants of Neutral, Slate, Stone, Zinc).

### Common Components

Use `CopyButton` component for all copy-to-clipboard functionality. Use `EmptyState` for consistent empty state messaging with icon, title, description slots.

### Premium UI Features

Premium UI features: `scrollbar-gutter stable` (prevents modal layout shift), instant sidebar collapse, CopyButton with tooltipSide prop, global context menu with Undo/Redo/Cut/Copy/Paste.

### Keyboard Shortcuts

Keyboard shortcuts: `Ctrl+G` leader for chord nav (D=dashboard, L=list, S=settings), `Ctrl+N` (new case), `/` (search), `?` (help). Platform-aware (Ctrl on Windows, ⌘ on Mac).

### Navigation Events

Cross-component communication uses custom events: `app:navigate`, `app:newcase`, `app:focussearch`, `app:togglesidebar`. Dispatch with `dispatchNavigationEvent(path)`, etc.

---

## Features & Configuration

### Product Purpose

CMSNext is a case tracking application for managing individual cases with CRUD, financial tracking, notes, and alerts. Local-first with no database or auth. Privacy-first design.

### Feature Flags

Feature flags in `utils/featureFlags.ts`. Key flags: `settings.devTools` (dev-only), `settings.legacyMigration` (dev-only). Toggle via `useAppViewState().setFeatureFlags`.

### Feature Status

Feature catalogue tracks 13 features with ratings 70-92. 572+ tests passing. Key features: Case Management (92), Local-First Storage (90), Financial Operations (90), Premium UI/UX (87).

### Config Discovery

`discoverStatusesFromCases()` auto-adds statuses from case data to config. `discoverAlertTypesFromAlerts()` does same for alert types. Legacy `string[]` format auto-migrates to `StatusConfig[]`.

### Data Migration

Legacy migration (v1.x to v2.0) in `utils/legacyMigration.ts`. Dev-only feature gated by `settings.legacyMigration` flag. Transforms nested format to flat normalized format.

---

## Domain Features

### Alert Matching

Alerts matched to cases by MCN. Unmatched alerts with valid MCNs automatically create skeleton cases. Alert names parsed with proper casing (handles ALL CAPS, Mc/Mac/O' prefixes).

### VR Templates

VR Generator uses template placeholders like `{firstName}`, `{applicationDate+90}`. Date offset syntax `{fieldName+N}` works for any date field. Templates stored in `CategoryConfig.vrScripts`.

### Encryption

AES-256-GCM encryption with PBKDF2 key derivation (100k iterations). Password never stored - derived key used only in memory. Zero-knowledge design with no recovery backdoor.

---

## Testing

### Testing Practices

Use Vitest + React Testing Library. Forbidden: `toBeTruthy()`, `toBeDefined()`, `any` type. Required: strict equality, AAA pattern (Arrange-Act-Assert), edge case testing first. Use jest-axe for accessibility.

### Test Setup

Test setup in `src/test/setup.ts` mocks File System Access API, localStorage, matchMedia, ResizeObserver, IntersectionObserver. Test files in `__tests__/` mirror source structure.

### Linting

ESLint rules: `@typescript-eslint/no-explicit-any` is off, unused vars with `_` prefix ignored, `react-hooks/exhaustive-deps` is warn. Use `varsIgnorePattern ^_` for intentionally unused vars.

---

## Development Workflow

### Build Commands

Build: `npm run build`. Test: `npm run test:run`. Lint: `npm run lint`. Dev server: `npm run dev`. All tests must pass before shipping.

### Roadmaps

Monthly roadmap in `docs/development/ROADMAP_[MONTH]_[YEAR].md`. Template at `ROADMAP_TEMPLATE.md`. Archived roadmaps in `docs/development/archive/[YEAR]/`.

### AI Instructions

Copilot instructions split by task type: `copilot-implementation.md` for code generation, `copilot-frontend.md` for UI/code review, `copilot-testing.md` for tests.

### Storybook

Storybook configured in `.storybook/`. Run with `npm run storybook`. Stories use `*.stories.tsx` pattern. Used for component documentation and visual testing.

---

## Utilities

### Input Validation

Input sanitization in `utils/inputSanitization.ts`. Validation utilities in `utils/validation.ts`. Domain validation in `domain/validation/*`. Sanitize user inputs before storage.

### Telemetry

Performance tracking via `telemetryInstrumentation.ts` and `performanceTracker.ts`. `recordPerformanceMarker()` for widget timing. Used by dashboard widgets.

### Paper Cut Feedback

Paper Cut system captures UX friction. Hotkey: `Ctrl+Shift+B`. Auto-captures route and nearest `data-papercut-context` ancestor. Stored in localStorage with export to JSON.

---

_Last updated: January 5, 2026_
