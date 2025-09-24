# CMSNext Improvement Implementation Strategy

## 📋 Executive Summary
The September 24, 2025 code review (A- / 88) praised CMSNext’s filesystem-first architecture and robust validation while identifying three high-impact opportunities:

1. **Decompose oversized components** – `App.tsx` (~1,000 lines) and `FinancialItemCard.tsx` (~625 lines) should be broken into cohesive, testable modules.
2. **Expand automated testing beyond core services** – complement the DataManager/Autosave coverage with React Testing Library suites and end-to-end flows.
3. **Polish the file-storage experience** – replace ad-hoc `window.*` flags with typed state, surface autosave status, and harden recovery messaging when permissions fail.

This plan realigns the roadmap around those themes while preserving the filesystem-only contract.

## ✅ Current Baseline
- **React hook loading fix** (Sept 22) restored stable chunking by simplifying the Vite build and keeping lazy modal loading focused on large dialogs.
- **ESLint 9 migration** (Sept 24) adopted `eslint.config.js` with `@eslint/eslintrc`’s `FlatCompat` bridge so legacy `extends` entries continue to work while we transition to fully flat-aware configs.
- **Validation, virtualization, and Autosave improvements** from earlier iterations remain in place and inform the next round of work.

## 🔝 Priority Roadmap
| Phase | Focus | Outcome Targets |
|-------|-------|-----------------|
| 1 | Component decomposition | Memo-friendly building blocks for navigation, connection flow, and financial items |
| 2 | Testing expansion | RTL coverage for UI flows, smoke integrations for connect + CRUD |
| 3 | File-storage experience | Typed state machine, consistent error logging, autosave status surfaced |
| 4 | Performance & observability | Bundle analysis, render profiling, lightweight telemetry |
| 5 | Documentation & DX | Updated guides, threat model outline, formatting/tooling guardrails |

### Phase 1 · Component Decomposition (In Progress)
- **App shell extraction**
  - Split `AppContent` into navigation, connection/onboarding, and case workspace modules.
  - Isolate `useEffect` chains into dedicated hooks (`useConnectionFlow`, `useImportListeners`) to reduce dependency-array churn.
- **Financial workflows**
  - Break `FinancialItemCard.tsx` into view, edit form, skeleton management, and list controller components.
  - Move shared create/update helpers into `hooks/useFinancialItems.ts` to separate UI from data mutations.

**Success metric:** both files < 400 lines with clear ownership boundaries and unit coverage for new hooks/components.

### Phase 2 · Testing Expansion (Planned)
- Add React Testing Library suites for `CaseForm`, `FinancialItemCard`, and `ConnectToExistingModal`, covering happy paths, validation errors, and cancellation flows.
- Create an integration-style test that exercises “connect → load cases → edit → save”, using `msw` to emulate File System Access behaviour.
- Update `/docs/development/testing-infrastructure.md` to describe when to add RTL vs. Vitest-only coverage.

**Success metric:** +10 UI/flow tests, maintain zero lint errors, CI runtime increase < 2 minutes.

### Phase 3 · File-Storage Experience (Planned)
- Replace the `window.*` coordination flags with a typed state machine (e.g., reducer or XState) owned by `FileStorageContext`.
- Standardize error logging (structured `console.error` metadata) and toast messages for connect/disconnect/import failures.
- Surface autosave state (last save time, permission status) in `FileStorageSettings` or the global toolbar so users know when persistence pauses.

**Success metric:** no global mutable flags, user-facing autosave indicator, documented recovery steps for denied permissions.

### Phase 4 · Performance & Observability (Planned)
- Run a bundle analysis (e.g., `vite-bundle-visualizer`) after Phase 1 to reconfirm vendor split sizes.
- Instrument key operations with `performance.mark`/`measure` (connect duration, autosave latency) or lightweight logging.
- Profile `AppContent` renders to validate memoization gains (goal: render cost reduction > 25%).

### Phase 5 · Documentation & Developer Experience (Planned)
- Refresh docs in `/docs/` and `/README.md` to describe the new connection flow, autosave indicators, and expanded testing expectations.
- Capture a concise threat model (single-user, trusted filesystem assumptions) and link it from the docs index.
- Evaluate adding Prettier or flat-config-native formatting rules once the `FlatCompat` bridge is retired.

## 📈 Success Metrics
- **Code size:** Top-level components < 400 lines; no hook > 250 lines.
- **Testing:** > 75% coverage for UI-critical modules; end-to-end workflow smoke test automated.
- **User feedback:** Autosave status visible; error toasts include actionable guidance.
- **Performance:** Bundle diff documented; render profiling shows measurable improvements.

## 🛠 Tooling Notes
- ESLint runs via `eslint.config.js` using `FlatCompat` to translate legacy presets; prefer flat-ready rule sets when adding new plugins.
- TypeScript 5.9.2 remains the enforced compiler; keep `@typescript-eslint` dependencies on the 8.x line for compatibility.

## 🚀 Immediate Next Steps
1. Draft a decomposition plan for `App.tsx`, including module boundaries and routing responsibilities.
2. Spike the `FinancialItemCard` split, ensuring new subcomponents are memoized and typed.
3. Outline the testing matrix (components vs. flows) before committing new suites.
4. Capture current autosave/user messaging to baseline improvements before Phase 3.