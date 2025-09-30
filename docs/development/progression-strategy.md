# CMSNext Improvement Implementation Strategy

## 📋 Executive Summary
The September 24, 2025 code review (A- / 88) praised CMSNext’s filesystem-first architecture and robust validation while identifying three high-impact opportunities:

1. **Continue decomposing orchestration-heavy modules** – `App.tsx` now sits around 440 lines after earlier trims, but it still centralizes multiple flows that should move into focused providers/hooks; the `FinancialItemCard` suite has been split into ~100-line leaf components and can serve as the pattern for the remaining breakouts.
2. **Expand automated testing beyond core services** – complement the DataManager/Autosave coverage with React Testing Library suites and end-to-end flows.
3. **Polish the file-storage experience** – retire the last global coordination hooks (e.g., `window.handleFileDataLoaded`) in favor of typed state, surface autosave status, and harden recovery messaging when permissions fail.

This plan realigns the roadmap around those themes while preserving the filesystem-only contract.

## ✅ Current Baseline
- **React hook loading fix** (Sept 22) restored stable chunking by simplifying the Vite build and keeping lazy modal loading focused on large dialogs.
- **ESLint 9 migration** (Sept 24) adopted `eslint.config.js` with `@eslint/eslintrc`’s `FlatCompat` bridge so legacy `extends` entries continue to work while we transition to fully flat-aware configs.
- **Validation, virtualization, and Autosave improvements** from earlier iterations remain in place and inform the next round of work.
- **Financial UI coverage expansion** (Sept 30) added focused RTL suites for the financial item stack and lifted overall coverage to 73.3% statements / 68.8% branches / 55.2% functions / 73.3% lines.

## 🔝 Priority Roadmap
| Phase | Focus | Outcome Targets |
|-------|-------|-----------------|
| 1 | Component decomposition | Memo-friendly building blocks for navigation, connection flow, and financial items |
| 2 | Testing expansion | RTL coverage for UI flows, smoke integrations for connect + CRUD |
| 3 | File-storage experience | Typed state machine, consistent error logging, autosave status surfaced |
| 4 | Performance & observability | Bundle analysis, render profiling, lightweight telemetry |
| 5 | Documentation & DX | Updated guides, threat model outline, formatting/tooling guardrails |

> Phase 1 and Phase 2 implementation notes have moved to `progression-strategy-archive.md` to keep this plan focused on active work; highlights from the latest Phase 2 push are summarized below.

### Phase 2 · Testing Expansion (Status: ✅ refreshed Sept 30, 2025)

Recent gains
- Added FinancialItem card/list/meta/action/save-indicator RTL suites with mocked storage APIs and permission flows.
- Extended integration coverage for connection and autosave badges; full `npm run test:coverage` now executes 115 specs.
- Captured fresh coverage baselines (73.3% statements) and logged remaining hot spots (`AutosaveFileService`, `dataTransform`, legacy UI shells).

Next testing targets
- Broaden form coverage (CaseForm/CategoryManager) and high-variance hooks (`useFinancialItemFlow`, `useNotes`).
- Introduce lightweight smoke specs for diagnostic panels once decomposition work lands.
- Track coverage deltas quarterly and retire the manual spreadsheet in favor of generated Vitest HTML reports.

### Phase 3 · File-Storage Experience (In Progress)

#### Subphase 3.1 · Storage State Machine
- ✅ Replace the remaining `window.*` coordination flags with a reducer-backed state machine owned by `FileStorageContext`.
- ✅ Model the full permission lifecycle (`idle → requesting → ready → blocked`, including `recovering` and `error` branches) so UI consumers can subscribe to stable selectors via `useFileStorageLifecycleSelectors`.
- ✅ Update hooks (`useConnectionFlow`, `useNavigationFlow`, `useImportListeners`) to consume the typed state instead of ad-hoc booleans; propagate lifecycle-aware messaging through `useAppContentViewModel` and gate case interactions on lifecycle locks.
- 🚧 Planned: extend autosave helpers once lifecycle telemetry drives UI decisions.
- Deliverables: context reducer + action map, TypeScript definitions for storage states, regression tests covering grant/deny/revoke scenarios (**completed**).

**State schema draft**
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

#### Subphase 3.2 · Error & Toast Harmonization
- ✅ Introduce a centralized error helper that logs structured metadata (`operation`, `handleId`, `errorCode`) and emits consistent toast copy (`reportFileStorageError`).
- ✅ Normalize handling of benign cancellations (`AbortError`) so user-initiated dismissals exit silently.
- ✅ Thread the helper through `DataManager`, `AutosaveFileService`, and modal/import flows so every storage failure surfaces consistent copy and feeds telemetry.
- Deliverables: `reportFileStorageError` utility, updated toast messaging catalogue ([`docs/development/file-storage-toast-catalogue.md`](./file-storage-toast-catalogue.md)), Vitest coverage for read/write/import failures (**completed**).

#### Subphase 3.3 · Autosave Visibility
- ✅ Expose autosave run state (last successful write timestamp, pending queue length, permission status) via a dedicated selector or hook.
- ✅ Surface status in `FileStorageSettings` and the global toolbar—highlight “saving…”, “all changes saved”, and “permission required” states.
- ✅ Respect existing debounce behaviour from `AutosaveFileService` and memoize derived values to prevent render churn.
- Deliverables: `useAutosaveStatus` hook, shared status badge component, integration test simulating permission revocation mid-save (**completed**).

#### Subphase 3.4 · Resilience Verification
**Objectives**
- Guarantee autosave and connection flows recover gracefully from permission loss, IO failures, and user cancellations.
- Equip QA and support with prescriptive playbooks for diagnosing storage-state anomalies.

**Testing Workstreams**
1. ✅ **Vitest service coverage** – expanded suites now simulate permission revocation mid-write, retry escalation, and lifecycle transitions within `fileStorageMachine`.
2. ✅ **React Testing Library (RTL)** – autosave badge and connection flow specs assert badge copy, spinner states, and modal reopen flow across `ready → saving → retrying → permission required` transitions.
3. ✅ **Integration smoke runs** – in-memory handle driver reproduces connect → revoke → reconnect scenarios to verify catalogue-aligned messaging.

**Manual Badge Verification**
- ✅ Document autosave badge copy for each lifecycle state (`idle`, `ready`, `saving`, `retrying`, `permission-required`, `error`, `unsupported`) in `docs/error-boundary-guide.md`.
- ✅ Capture optional console or badge snapshots for notable failures (stored in `docs/development/resilience-screenshots/`) to confirm metadata logging via `reportFileStorageError`.
- ✅ Reference the badge legend throughout deployment and troubleshooting guides in place of the retired CSV matrix.

**Documentation & DX Updates**
- ✅ Refresh `error-boundary-guide.md` with: autosave badge legend, permission troubleshooting flowchart, and links to the toast catalogue.
- ✅ Append a “File Storage Recovery” section to `docs/enhanced-error-boundary-summary.md` summarizing escalation steps.
- ✅ Add a resilience-focused checklist to `docs/DeploymentGuide.md` and the release smoke checklist.

**Timeline & Exit Criteria**
- **Week 1:** Land Vitest expansions and state-machine fixtures; ensure coverage delta captured in `coverage/` report.
- **Week 2:** Layer RTL specs and integration flows; stabilize CI runtime under +10% execution budget.
- **Week 3:** Complete manual matrix execution, publish documentation updates, and secure sign-off from QA.
- Exit when badge documentation covers every lifecycle state, updated guides are merged, and `npm run test:run` reflects the broader suite without regressions.

- Deliverables: expanded automated test matrix, documentation refresh (error guides, deployment checklist), archived manual verification artefacts.

**Phase 3 success metric:** zero global mutable flags, a visible autosave indicator, structured error logging, and documented recovery flows.

## 🔄 Transition to Feature Development
- Phase 3 deliverables are wrapped; remaining platform work shifts toward net-new features.
- Phases 4 and 5 move to the backlog so performance and DX polish can ride along with future feature workstreams.
- Prepare feature specs, UX mocks, and acceptance criteria before the next implementation sprint.

### Phase 4 · Performance & Observability (Backlog)
- ⏸️ Deferred while feature delivery takes center stage. Revisit once the next feature milestones are stable.
- Prioritize lightweight profiling alongside upcoming stories rather than as a standalone initiative.

### Phase 5 · Documentation & Developer Experience (Backlog)
- ⏸️ Deferred until feature-facing changes land. Fold doc and DX improvements into release prep for those features.
- Keep lint/format tooling steady to avoid churn while feature teams iterate.

## 📈 Success Metrics
- **Code size:** Top-level components < 400 lines; no hook > 250 lines.
- **Testing:** > 75% coverage for UI-critical modules; end-to-end workflow smoke test automated.
- **User feedback:** Autosave status visible; error toasts include actionable guidance.
- **Performance:** Bundle diff documented; render profiling shows measurable improvements.

## 🛠 Tooling Notes
- ESLint runs via `eslint.config.js` using `FlatCompat` to translate legacy presets; prefer flat-ready rule sets when adding new plugins.
- TypeScript 5.9.2 remains the enforced compiler; keep `@typescript-eslint` dependencies on the 8.x line for compatibility.

## 🚀 Immediate Next Steps
1. Curate the near-term feature backlog and select the top candidate(s) for implementation.
2. Create lightweight specs and acceptance criteria for those features, including UX references or mockups.
3. Align supporting tasks (telemetry hooks, docs stubs, test scaffolding) with the chosen feature slate.