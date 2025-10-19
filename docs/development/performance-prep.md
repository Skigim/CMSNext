# Performance Work Kickoff

## 🎯 Objectives
- Capture a reliable baseline for bundle size, load time, and key render paths before optimizations begin.
- Instrument the build pipeline and runtime so future work produces measurable deltas.
- Triage hotspots (large bundles, expensive renders) and map them to actionable follow-up issues.

## ✅ Tooling Readiness Checklist
- [x] Install `rollup-plugin-visualizer` and expose an `npm run analyze` script.
- [x] Generate a baseline treemap (`npm run analyze`) and archive the HTML report under `reports/performance/bundle-<date>.html` (`reports/performance/2025-10-07-bundle-analysis.html`).
- [x] Record bundle metrics (total, vendor chunks, app chunk) in a new entry in `docs/development/performance-metrics.md` (see 2025-10-07 entry).
- [x] Capture React Profiler output for the main navigation flow and autosave status updates (captured via `npm run perf:baseline`, raw log at `reports/performance/2025-10-07-performance-log.json`).
- [ ] Verify Chrome Performance panel results for connect → load → dashboard render to spot blocking scripts or layout thrashing.

## 🔍 Baseline Data to Collect
| Area | What to Measure | Tooling | Notes |
|------|-----------------|---------|-------|
| Bundle size | Total output, top 10 modules, compression impact | `npm run analyze` (treemap) | Run after `npm run build`; check brotli + gzip sizes. |
| Initial render | React commit duration, suspended renders, large component updates | React Profiler (Chrome DevTools) | Profile `AppContent` mount, navigation between dashboard and case workspace. |
| Runtime responsiveness | Interaction latency for sidebar toggle, case selection, autosave badge updates | Chrome Performance panel + `performance.mark` hooks | Annotate `useNavigationFlow` and `AutosaveStatusBadge` transitions if needed. |
| Network | Total JS payload, waterfall during initial load | Chrome DevTools Network tab | Ensure compression artifacts (`.gz`) served in production preview. |

## 🛠️ Recommended Instrumentation
- Add temporary `performance.mark` / `performance.measure` pairs inside `useNavigationFlow` and `AutosaveStatusBadge` during investigation (remove when satisfied).
- Enable React Profiler in dev builds (`npm run dev -- --profile`) when tracing render waterfalls.
- Capture slow component renders with `reportReactProfilerMetrics` (existing logger namespace) for automated logging, if feasible.

## 📄 Reporting Template
Create a dated section inside `docs/development/performance-metrics.md` (create the file if needed) and log the following:
- Date & commit SHA
- Bundle stats (from treemap)
- Profiling highlights (slow components, expensive effects)
- Top 3 opportunities with estimated impact
- Next actions assigned / owners

## 🚀 Next Steps
1. Run `npm run analyze`, archive the output, and summarize bundle findings in the metrics log.
2. Profile navigation flows with React Profiler to pinpoint remaining `AppContent` hotspots.
3. Open follow-up issues for each hotspot (e.g., memoization gaps, chunk splitting opportunities).
4. Re-run the same measurements after each optimization to verify regression budgets stay intact.
