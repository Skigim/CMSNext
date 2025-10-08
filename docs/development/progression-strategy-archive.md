# CMSNext Improvement Strategy — Archived Phases

_Archived log initiated September 26, 2025 · last updated October 3, 2025_

## Phase 1 · Component Decomposition (Completed)
- **App shell extraction**
  - ✅ Extracted connection and onboarding responsibilities into `useConnectionFlow`, trimming modal wiring out of `App.tsx`.
  - ✅ Ported note modal and CRUD logic into `useNoteFlow`, keeping case state updates centralized and predictable.
  - ✅ Introduced `useNavigationFlow`, which centralizes view/sidebar handling and dropped `App.tsx` under the 400-line target.
  - ✅ Split `AppContent` into memo-friendly view modules (`AppContentView`, `AppLoadingState`, `ConnectionOnboarding`, `CaseWorkspace`) with a `useAppContentViewModel` helper, and migrated import listeners into `useImportListeners` to reduce dependency-array churn.
- **Financial workflows**
  - ✅ Moved financial item modal orchestration into `useFinancialItemFlow`, aligning CRUD handlers with the DataManager pattern.
  - ✅ Broke `FinancialItemCard` into dedicated presentation pieces (`FinancialItemCardHeader`, `FinancialItemCardMeta`, `FinancialItemCardActions`, `FinancialItemCardForm`) plus the `useFinancialItemCardState` hook; card wrapper now focuses on composition and remains well under the 400-line goal.
  - 🔄 Next: Strengthen the financial item experience with targeted RTL coverage and explore list-level controller abstractions if new requirements emerge.

**Success metric:** Maintain `App.tsx` at or below the 397-line footprint while finishing the workspace split, and drive `FinancialItemCard.tsx` to < 400 lines post-refactor with unit coverage for the new hooks/components.

## Phase 2 · Testing Expansion (Completed September 30, 2025)

### Recent gains
- Added FinancialItem card/list/meta/action/save-indicator RTL suites with mocked storage APIs and permission flows.
- Extended integration coverage for connection and autosave badges; full `npm run test:coverage` now executes 115 specs.
- Captured fresh coverage baselines (73.3% statements) and logged remaining hot spots (`AutosaveFileService`, `dataTransform`, legacy UI shells).

### Next testing targets (tracked as follow-up backlog)
- Broaden form coverage (CaseForm/CategoryManager) and high-variance hooks (`useFinancialItemFlow`, `useNotes`).
- Introduce lightweight smoke specs for diagnostic panels once decomposition work lands.
- Track coverage deltas quarterly and retire the manual spreadsheet in favor of generated Vitest HTML reports.

**Success metric:** +10 UI/flow tests, maintain zero lint errors, CI runtime increase < 2 minutes.

## Phase 3 · File-Storage Experience (Completed October 3, 2025)

### Subphase 3.1 · Storage State Machine
- ✅ Replaced the remaining `window.*` coordination flags with a reducer-backed state machine owned by `FileStorageContext`.
- ✅ Modeled the full permission lifecycle (`idle → requesting → ready → blocked`, including `recovering` and `error` branches) so UI consumers can subscribe to stable selectors via `useFileStorageLifecycleSelectors`.
- ✅ Updated hooks (`useConnectionFlow`, `useNavigationFlow`, `useImportListeners`) to consume the typed state instead of ad-hoc booleans; propagated lifecycle-aware messaging through `useAppContentViewModel` and gated case interactions on lifecycle locks.
- 🚧 Follow-up tracked separately: extend autosave helpers once lifecycle telemetry drives UI decisions.
- **Deliverables:** context reducer + action map, TypeScript definitions for storage states, regression tests covering grant/deny/revoke scenarios (completed).

### State schema reference
- **States**
  - `uninitialized`: provider mounted, Autosave service not yet ready.
  - `unsupported`: File System Access API unavailable or browser refused feature.
  - `idle`: service initialized, no directory handle selected.
  - `requestingPermission`: user prompted to pick/grant access to a directory.
  - `ready`: permission granted, autosave running, no pending work.
  - `saving`: autosave/manual save in flight (transient substate of `ready`).
  - `blocked`: permission revoked or directory handle missing; waiting on recovery.
  - `error`: non-recoverable IO failure (corrupt file, exceeded retries).
  - `recovering`: background retry after handled error; transitions back to `ready` or `blocked`.
- **Events**
  - `SERVICE_INITIALIZED`, `SUPPORT_UNAVAILABLE`
  - `CONNECT_REQUESTED`, `PERMISSION_GRANTED`, `PERMISSION_DENIED`
  - `HANDLE_RESTORED`, `HANDLE_LOST`
  - `AUTOSAVE_STARTED`, `AUTOSAVE_COMPLETED`, `AUTOSAVE_FAILED`
  - `MANUAL_SAVE_REQUESTED`, `MANUAL_SAVE_COMPLETED`
  - `ERROR_ENCOUNTERED`, `ERROR_RECOVERED`
- **Context data**
  - `permissionStatus`, `directoryHandleId`
  - `lastSaveTime`, `pendingWrites`, `consecutiveFailures`
  - `lastError` (message + errorCode + timestamp)
- **Actions / side effects** (triggered via effects, not inside reducer)
  - Fire toast notifications for permission or error changes.
  - Start/stop autosave timer.
  - Persist state snapshot for diagnostics.
- **Transition highlights**
  - `uninitialized + SERVICE_INITIALIZED → idle` (if supported) or `unsupported` otherwise.
  - `idle + CONNECT_REQUESTED → requestingPermission`.
  - `requestingPermission + PERMISSION_GRANTED → ready` (kick off autosave, clear failures).
  - `ready + AUTOSAVE_FAILED → recovering` (increment `consecutiveFailures`).
  - `recovering + ERROR_RECOVERED → ready`; `recovering + HANDLE_LOST → blocked`.
  - `blocked + HANDLE_RESTORED → ready`; `blocked + PERMISSION_GRANTED → ready`.
  - Any state + `ERROR_ENCOUNTERED` (non-recoverable) → `error` (surface guidance, halt autosave).

### Subphase 3.2 · Error & Toast Harmonization
- ✅ Introduced a centralized error helper that logs structured metadata (`operation`, `handleId`, `errorCode`) and emits consistent toast copy (`reportFileStorageError`).
- ✅ Normalized handling of benign cancellations (`AbortError`) so user-initiated dismissals exit silently.
- ✅ Threaded the helper through `DataManager`, `AutosaveFileService`, and modal/import flows so every storage failure surfaces consistent copy and feeds telemetry.
- **Deliverables:** `reportFileStorageError` utility, updated toast messaging catalogue (`docs/development/file-storage-toast-catalogue.md`), Vitest coverage for read/write/import failures (completed).

### Subphase 3.3 · Autosave Visibility
- ✅ Exposed autosave run state (last successful write timestamp, pending queue length, permission status) via a dedicated selector/hook.
- ✅ Surfaced status in `FileStorageSettings` and the global toolbar—highlighting “saving…”, “all changes saved”, and “permission required” states.
- ✅ Respected existing debounce behaviour from `AutosaveFileService` and memoized derived values to prevent render churn.
- **Deliverables:** `useAutosaveStatus` hook, shared status badge component, integration test simulating permission revocation mid-save (completed).

### Subphase 3.4 · Resilience Verification
**Objectives**
- Guaranteed autosave and connection flows recover gracefully from permission loss, IO failures, and user cancellations.
- Equipped QA and support with prescriptive playbooks for diagnosing storage-state anomalies.

**Testing workstreams**
1. ✅ **Vitest service coverage** – expanded suites now simulate permission revocation mid-write, retry escalation, and lifecycle transitions within `fileStorageMachine`.
2. ✅ **React Testing Library (RTL)** – autosave badge and connection flow specs assert badge copy, spinner states, and modal reopen flow across `ready → saving → retrying → permission required` transitions.
3. ✅ **Integration smoke runs** – in-memory handle driver reproduces connect → revoke → reconnect scenarios to verify catalogue-aligned messaging.

**Manual badge verification**
- ✅ Documented autosave badge copy for each lifecycle state (`idle`, `ready`, `saving`, `retrying`, `permission-required`, `error`, `unsupported`) in `docs/error-boundary-guide.md`.
- ✅ Captured optional console or badge snapshots for notable failures (stored in `docs/development/resilience-screenshots/`) to confirm metadata logging via `reportFileStorageError`.
- ✅ Referenced the badge legend throughout deployment and troubleshooting guides in place of the retired CSV matrix.

**Documentation & DX updates**
- ✅ Refreshed `error-boundary-guide.md` with the autosave badge legend, permission troubleshooting flowchart, and links to the toast catalogue.
- ✅ Appended a “File Storage Recovery” section to `docs/enhanced-error-boundary-summary.md` summarizing escalation steps.
- ✅ Added a resilience-focused checklist to `docs/DeploymentGuide.md` and the release smoke checklist.

**Timeline & exit criteria**
- Week 1: Landed Vitest expansions and state-machine fixtures; ensured coverage delta captured in `coverage/` report.
- Week 2: Layered RTL specs and integration flows; stabilized CI runtime under the +10% execution budget target.
- Week 3: Completed manual matrix execution, published documentation updates, and secured QA sign-off.
- Exit criteria met when badge documentation covered every lifecycle state, updated guides were merged, and `npm run test:run` reflected the broader suite without regressions.

**Success metric:** Achieved zero global mutable flags, surfaced a visible autosave indicator, centralized error logging, and published documented recovery flows.

## Phase 4 · Performance & Observability (Completed October 8, 2025)

### Baseline & Telemetry Automation
- ✅ Captured automated navigation timings and profiler samples via `npm run perf:baseline`, archiving outputs in `docs/development/performance/2025-10-07-*` and summarizing findings in `performance-metrics.md`.
- ✅ Re-ran `npm run analyze` after Phase 4 refactors, confirming manual chunk groupings remained stable and publishing the updated treemap at `docs/development/performance/2025-10-08-bundle-analysis.html`.

### Autosave Latency Benchmarking
- ✅ Measured `autosave:badgeUpdate` end-to-end latency across normal and degraded storage scenarios, logging benchmarks in `docs/development/performance/2025-10-08-autosave-latency.json` and referencing the results in `performance-metrics.md` for future diffs.

### Hook Test Coverage Expansion
- ✅ Added targeted unit/RTL coverage for the newly refactored flow hooks to ensure instrumentation and error handling remain regression-proof:
  - `__tests__/hooks/useNavigationFlow.test.ts` verifies happy-path navigation, blocked states, and measurement metadata.
  - `__tests__/hooks/useFileDataSync.test.ts` covers structured payload sync, legacy raw data reloads, and failure surfacing.
  - `__tests__/hooks/useAlertsFlow.test.ts` exercises reload, resolution, permission-denied flows, and toast messaging.

**Success metric:** Established a reproducible performance baseline, validated autosave responsiveness under varied storage conditions, and locked in regression protection for the supporting hooks while leaving only manual trace/profiler work outstanding.
