# CMSNext Improvement Implementation Strategy

## 📋 Executive Summary
The September 24, 2025 code review (A- / 88) praised CMSNext’s filesystem-first architecture and robust validation while identifying three high-impact opportunities:

1. **Continue decomposing orchestration-heavy modules** – `App.tsx` still sits near 690 lines even after recent trims and continues to centralize multiple flows that should move into focused providers/hooks; the `FinancialItemCard` suite has been split into ~100-line leaf components and can serve as the pattern for the remaining breakouts.
2. **Expand automated testing beyond core services** – complement the DataManager/Autosave coverage with React Testing Library suites and end-to-end flows.
3. **Polish the file-storage experience** – keep data orchestration inside the file-storage context (global bridges like `window.handleFileDataLoaded` were removed on Oct 6), surface autosave status, and harden recovery messaging when permissions fail.

This plan realigns the roadmap around those themes while preserving the filesystem-only contract.

## ✅ Current Baseline
- **React hook loading fix** (Sept 22) restored stable chunking by simplifying the Vite build and keeping lazy modal loading focused on large dialogs.
- **ESLint 9 migration** (Sept 24) adopted `eslint.config.js` with `@eslint/eslintrc`’s `FlatCompat` bridge so legacy `extends` entries continue to work while we transition to fully flat-aware configs.
- **Validation, virtualization, and Autosave improvements** from earlier iterations remain in place and inform the next round of work.
- **Financial UI coverage expansion** (Sept 30) added focused RTL suites for the financial item stack and lifted overall coverage to 73.3% statements / 68.8% branches / 55.2% functions / 73.3% lines.
- **Lint & storage cleanup** (Oct 6) cleared the lingering eslint warnings and replaced `window.handleFileDataLoaded` with context-level dispatchers, paving the way for usage metrics instrumentation.

## 🔝 Priority Roadmap
| Phase | Focus | Outcome Targets |
|-------|-------|-----------------|
| 4 | Performance & observability *(active prep)* | Bundle analysis, render profiling, lightweight telemetry |
| 5 | Documentation & DX | Updated guides, threat model outline, formatting/tooling guardrails |

> Phases 1–3 are complete and archived in `progression-strategy-archive.md`; this document now tracks active and upcoming efforts only.

## 🔄 Transition to Feature Development
- Phase 3 deliverables are wrapped; remaining platform work shifts toward net-new features.
- Phase 4 has entered an instrumentation prep window so performance work can start with reliable baselines.
- Phase 5 remains on deck and will reactivate once performance telemetry stabilizes and feature specs are locked in.

### Phase 4 · Performance & Observability (Active Prep)
- ✅ Tooling: `npm run analyze` now emits a treemap via `rollup-plugin-visualizer` to `dist/bundle-analysis.html`; stash a copy under `docs/development/performance/` (create the folder on first export) so runs stay diffable.
- ✅ Build defaults: `vite.config.ts` ships with manual chunk rules for React, UI vendors, and shared utilities plus gzip compression for production builds—treat these groupings as the current performance baseline when reviewing bundle diffs.
- ✅ Documentation: `performance-prep.md` and `performance-metrics.md` capture the baseline checklist and reporting template.
- ✅ UI cleanup: dashboard tiles were pruned (Oct 6) to reduce layout churn ahead of profiling work.
- ✅ Usage telemetry plan: `usage-logging-strategy.md` outlines filesystem-first event logging and diagnostics wiring.
- ✅ Baseline capture: `npm run analyze` outputs are archived at `docs/development/performance/2025-10-07-bundle-analysis.html`, `App.tsx` is wrapped in a React Profiler with logs stored via `performanceTracker` (`docs/development/performance/2025-10-07-performance-log.json`), and findings are summarized in `docs/development/performance/2025-10-07-baseline.md`.
- 📌 Follow-up targets: export an interaction trace using the new measurement helpers, break down `App.tsx` render hotspots (targeting commits >25 ms), measure autosave badge update latency, verify the manual chunks still cover the heaviest modules after upcoming changes, and prioritize chunk-splitting or memoization stories based on the collected data.

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
1. Stand up the filesystem-backed `UsageMetricsService` and shared context, then wire `useNavigationFlow` and the dashboard cards to record navigation metrics.
2. Fold the remaining “today” metrics into `ActivityReportCard`, removing the placeholder tile from `Dashboard.tsx` once parity is achieved.
3. Curate the near-term feature backlog and select the top candidate(s) for implementation.
4. Create lightweight specs and acceptance criteria for those features, including UX references or mockups.
5. Align supporting tasks (telemetry hooks, docs stubs, test scaffolding) with the chosen feature slate.
6. Refactor UI surfaces to rely on pure shadcn components, replacing bespoke hybrids with library-standard primitives.