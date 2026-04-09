# CMSNext

Local-first case management software built with React, TypeScript, and the File System Access API.

- Machine-readable repo index for external review tools: [llms.txt](llms.txt)
- Architecture and implementation guidance: [.github/copilot-instructions.md](.github/copilot-instructions.md), [.github/instructions/](.github/instructions/)
- Current planning and feature inventory: [docs/development/ROADMAP_APR_2026.md](docs/development/ROADMAP_APR_2026.md), [docs/development/feature-catalogue.md](docs/development/feature-catalogue.md), [docs/development/features/README.md](docs/development/features/README.md)

## Overview

CMSNext is a single-page application for running a case workspace entirely from a user-chosen local folder. The app is local-first by design: there is no backend, no cloud sync, and no account system. Case data lives in JSON files on disk, is encrypted at rest, and is accessed through the browser's File System Access API.

The current app combines:

- Case creation and editing workflows, including a step-based intake flow
- Financial tracking with amount history and verification metadata
- Notes, alerts, dashboard widgets, and activity logging
- Text-generation templates for VR, summary, and narrative output
- Archive and restore workflows for completed or older cases
- Local import/export and storage diagnostics

## Implemented Today

### Case workspace

- Dashboard, case list, case details, intake, and settings views are all wired into the main workspace shell.
- Cases support status tracking, priority flags, pagination, multi-sort, fuzzy search, and bulk actions.
- Global search can search across cases and alerts from the quick actions bar.

### Step-based intake

- The intake workflow is implemented as a five-step flow: Applicant, Contact, Case Details, Checklist, and Review.
- Completing intake creates a full case record through the same DataManager/service stack used by the rest of the app.
- Users can still create or edit cases through the standard case flows as well.

### Financials, notes, and alerts

- Financial items are organized by category such as resources, income, and expenses.
- Financial entries support amount history, verification status, verification source, and inline editing.
- Notes support categories and bulk note workflows.
- Alerts support workflow states, filtering, bulk resolution, and CSV import/merge.

### Dashboard and productivity

- The dashboard includes quick actions, today's work, activity, and analytics widgets, including case-specific activity drill-down dialogs.
- Activity logging is built into the data layer and feeds dashboard reporting, including bounded in-dialog review of recent case timelines.
- Keyboard shortcuts, sidebar navigation events, and search shortcuts are implemented in the app shell.

### Templates and generated text

- The app includes a unified template system for three categories: VR, summary, and narrative.
- Templates support placeholder replacement using case, person, and financial data.
- Summary templates support drag-and-drop ordering.

### Archival and data lifecycle

- Cases can be queued for archival review, archived into yearly archive files, browsed later, searched, and restored.
- Archive files use the naming pattern `archived-cases-YYYY.json`.
- JSON import/export tooling is available from Settings, along with alerts CSV import and storage diagnostics.

### Appearance and settings

- Four built-in themes are currently implemented: Light, Paperwhite, Sterling, and Dark.
- Settings include appearance, storage, archival, categories, templates, keyboard shortcuts, paper cuts, and system diagnostics.

## Storage Model

CMSNext keeps case data local and uses a small number of storage layers for different concerns:

- Case data: JSON files in a folder selected by the user
- Folder-handle persistence: IndexedDB
- UI preferences: localStorage
- Encryption secret material: in-memory session state

### Primary data file

The main workspace file is:

```text
case-tracker-data.json
```

The app currently persists a canonical normalized v2.1 format with flat collections and foreign keys:

```ts
interface PersistedNormalizedFileDataV21 {
  version: "2.1";
  people: StoredPerson[]; // Note: uses StoredPerson, not PersistedPerson
  cases: PersistedCase[]; // Note: uses PersistedCase, not StoredCase
  financials: StoredFinancialItem[];
  notes: StoredNote[];
  alerts: AlertRecord[];
  exported_at: string;
  total_cases: number;
  activityLog: CaseActivityEntry[];
  categoryConfig: CategoryConfig;
  templates?: Template[];
}
```

> **Naming convention note:** The mixed use of `StoredPerson` and `PersistedCase` reflects the evolution of the type system. `StoredPerson` distinguishes the persisted shape from the hydrated `Person` (which includes circular references), while `PersistedCase` distinguishes the on-disk format from `StoredCase` (the hydrated runtime case). This intentional distinction helps developers understand the different transformation layers.

Persisted v2.1 data is hydrated and dehydrated through the storage helpers. Normal runtime reads now accept only canonical persisted v2.1 workspaces; legacy v2.0 and older formats must be upgraded first with the explicit migration tooling. Normal saves no longer synthesize canonical `applications[]` from case-embedded compatibility fields, so application ownership must be written explicitly by the owning create/edit flows.

### Case-model surfaces

When working on case-model changes, distinguish these three layers:

1. **Canonical persisted model** — the file on disk stores normalized top-level collections and uses persisted types such as `PersistedCase` and `StoredPerson`. This is the source of truth for storage work.
2. **Hydrated runtime/workspace model** — `FileStorageService` and `CaseService` resolve persisted references into runtime shapes such as `NormalizedFileData`, `StoredCase`, and the overlapping `CaseDisplay` surface used by current UI flows. This is the target for runtime UI and workspace behavior.
3. **Compatibility/transitional type surface** — `CaseRecord` and related compatibility-oriented fields still exist to bridge older flows and current type debt. `CaseRecord` is **not** the canonical persisted v2.1 case model.

Current `CaseRecord` guidance:

- `financials` and `notes` are stale compatibility debt; canonical v2.1 stores them in top-level `financials[]` and `notes[]`, not inside each case.
- `personId` and `spouseId` are still active compatibility scaffolding in some flows, but authoritative person linkage is `PersistedCase.people[]`, with runtime hydration exposing `person` and `linkedPeople`.
- Other case metadata on `CaseRecord` can still be active, so contributors should remove or reshape only the explicitly transitional fields rather than treating the whole type as dead.

Type cleanup is still in progress. New persisted-model work should target normalized storage and persisted case types; new runtime/UI work should target the hydrated case composite/view model rather than extending `CaseRecord`.

### Additional files you may see

Depending on which workflows you use, the same folder can also contain files such as:

```text
case-tracker-data.json
archived-cases-2026.json
case-tracker-export-YYYY-MM-DD.json
```

The main data file remains the source of truth for the active workspace. Archive files are used for archived cases, and exported JSON files are portable snapshots produced from Settings.

## Privacy and Security

- No backend, no remote API, and no cloud account requirement
- AES-256-GCM encryption for data at rest
- PBKDF2 key derivation with 600,000 iterations
- Password is never stored; it exists only for the active session
- No password recovery flow by design
- Autosave is built into the local file service

Autosave behavior in the current app:

- Standard edits debounce to roughly 5 seconds
- Bulk operations use a longer debounce window of roughly 15 seconds
- The storage layer also includes named backup support, but the app's normal persistence model is the main data file plus archive/export files rather than a separate database or sync service

## Browser Support

CMSNext depends on the File System Access API for its primary workflow.

| Browser | Support       | Minimum Version |
| ------- | ------------- | --------------- |
| Chrome  | Supported     | 86+             |
| Edge    | Supported     | 86+             |
| Opera   | Supported     | 72+             |
| Firefox | Not supported | N/A             |
| Safari  | Not supported | N/A             |

Unsupported browsers are shown an onboarding message rather than a degraded cloud fallback, because the application is intentionally file-system based.

## Getting Started

### First run

1. Install dependencies with `npm install`.
2. Start the app with `npm run dev`.
3. Open the app in a supported Chromium-based browser.
4. Choose a folder when prompted.
5. Create a password for encrypted local storage.

### Returning users

1. Open the app.
2. Reconnect to the previously stored folder handle.
3. Enter the password to unlock encrypted data.

### First workflow to try

After setup, you can either:

- create a case from the standard case flow, or
- use the step-based intake workflow to create a case from a guided form

## Tech Stack

- React 18
- TypeScript in strict mode
- Vite
- Tailwind CSS v4
- shadcn/ui and Radix primitives
- Sonner for toasts
- Recharts for dashboard charts
- Zod for validation
- Vitest, React Testing Library, and jest-axe for testing

## Architecture

The repository follows a layered architecture:

```text
domain -> services/DataManager -> hooks -> components
```

### Layers

- `domain/`: pure business logic, no React, no I/O
- `utils/services/` and `utils/DataManager.ts`: orchestration and file-backed mutations
- `hooks/`: React state and workflow hooks
- `components/`: UI rendering and interaction
- `contexts/`: provider-based application state

### Provider stack

At app startup, the provider tree is layered in this order:

```text
ErrorBoundary
  ThemeProvider
    EncryptionProvider
      FileSystemErrorBoundary
        FileStorageProvider
          DataManagerProvider
            CategoryConfigProvider
              TemplateProvider
```

## Repository Layout

The current repository is organized at the root rather than under a single `src/` folder:

```text
components/     UI components and screens
contexts/       React providers and app-wide state
domain/         Pure business logic
hooks/          Feature and workflow hooks
utils/          DataManager, services, storage, helpers
types/          Shared TypeScript types
__tests__/      Component, hook, service, and integration tests
docs/           Product, roadmap, audit, and development docs
styles/         Global styles and theme definitions
```

## Development

### Common commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test:run
npm run build
```

### Other useful commands

```bash
npm run build:pages
npm run test:coverage
npm run test:ui
npm run seed
npm run seed:demo
npm run seed:small
npm run seed:large
npm run analyze
npm run dead-code
```

## Runtime Environment Configuration

CMSNext now centralizes runtime behavior in a typed app config layer. In Vite-powered builds, set these as `VITE_*` variables in `.env` files or CI; the app config also accepts the unprefixed names in Node/test contexts.

- `APP_ENV=dev|staging|production`
- `ENCRYPTION_MODE=disabled|noop|full`
- `DEVTOOLS_ENABLED=true|false`
- `SCHEMA_INSPECTOR_ENABLED=true|false`
- `DATA_FLOW_DEBUG_ENABLED=true|false`
- `VERBOSE_LOGGING=true|false`

### Encryption modes

- `full` — current production behavior with real AES-256-GCM encryption
- `noop` — preserves the app-facing unlock flow, but stores readable JSON on disk
- `disabled` — bypasses unlock/password gating and stores readable JSON on disk

### Intended branch mapping

- `dev` → `APP_ENV=dev`, `ENCRYPTION_MODE=disabled` by default, dev tooling on
- `dev` override → set `ENCRYPTION_MODE=noop` if you want password gating without encrypted files
- `staging` → `APP_ENV=staging`, `ENCRYPTION_MODE=full`, dev tooling on
- `main` → `APP_ENV=production`, `ENCRYPTION_MODE=full`, dev tooling off

### Safety validation

The config layer fails fast for unsafe combinations:

- `production` requires `ENCRYPTION_MODE=full`
- `production` requires dev tools, schema inspection, data-flow debug, and verbose logging to be disabled
- `staging` requires `ENCRYPTION_MODE=full`

### Quality gates

The intended verification flow for code changes is:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

## Testing and Quality

The repo includes automated coverage across domain logic, services, hooks, contexts, components, and integration flows.

- Test runner: Vitest
- UI/component tests: React Testing Library
- Accessibility checks: jest-axe
- Coverage threshold: 70%
- Lint policy: zero warnings
- TypeScript: strict mode

## Notes and Constraints

- The application is intentionally local-first and browser-file-system based.
- There is no server-side fallback for unsupported browsers.
- If a password is forgotten, encrypted data cannot be recovered.
- The active branch also contains the ongoing step-based intake workflow work, and the README reflects the code currently present in this repository.

## Further Reading

- [CLAUDE.md](CLAUDE.md)
- [.github/implementation-guide.md](.github/implementation-guide.md)
- [.github/ui-guide.md](.github/ui-guide.md)
- [.github/testing-guide.md](.github/testing-guide.md)
- [docs/DeploymentGuide.md](docs/DeploymentGuide.md)
- [docs/development/feature-catalogue.md](docs/development/feature-catalogue.md)
