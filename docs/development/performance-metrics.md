# Performance Metrics Log

> Use this log to track bundle and runtime measurements before and after significant performance work. Each entry should be appended chronologically (newest at the top).

## Template
```
## YYYY-MM-DD · Commit <short-sha>

### Bundle Summary
- Total JS output: 
- Largest chunk(s): 
- Notable modules: 
- Compression savings: 

### Runtime Observations
- React Profiler notes: 
- Interaction latency: 
- Other findings: 

### Follow-up Actions
1. 
2. 
3. 
```

## 2025-10-07 · Commit 0bfa1f4

### Bundle Summary
- Total JS output: ~865 kB raw / ~248 kB gzip across core + vendor bundles.
- Largest chunk(s): `index-BNMZD3Ql.js` at 491.43 kB raw / 132.50 kB gzip remains the orchestration hotspot.
- Notable modules: `utils-CBw3aSZY.js` (82.62 kB raw / 23.34 kB gzip) aggregates Autosave, file storage, and reporting helpers—prime for deferred loading.
- Compression savings: Main bundle shrinks ~73% after gzip (491.43 → 132.50 kB), vendor chunks see similar ratios (e.g., `ui-vendor-CHDmJV_O.js` 151.77 → 46.62 kB).

### Runtime Observations
- React Profiler notes: `AppContent` mount logged at 22.34 ms actual / 16.34 ms base with metadata captured via `performanceTracker`.
- Interaction latency: `navigation:backToDashboard` sample completed in 19.01 ms under the scripted baseline run.
- Other findings: Instrumentation verified end-to-end (`npm run perf:baseline` output stored in `reports/performance/2025-10-07-performance-log.json`).

### Follow-up Actions
1. Capture a real navigation trace (dashboard → list → detail) and archive the raw measurement/profile output alongside the treemap.
2. Validate AppContent commit durations in live Profiler sessions and prioritize memoization if commits exceed ~25 ms.
3. Audit `utils-CBw3aSZY.js` for code that can shift behind dynamic imports before new helpers land.

## 2025-10-08 · Commit TBD (feature/perf-phase4-alignment)

### Bundle Summary
- Total JS output: ~1.24 MB raw / ~139 kB gzip (`index-CoT1BYhK.js` primary bundle) — +0.8 kB raw / +0.3 kB gzip versus 2025-10-07 baseline.
- Largest chunk(s): `index-CoT1BYhK.js` at 492.35 kB raw / 132.81 kB gzip (↔); `ui-vendor-CHDmJV_O.js` at 151.77 kB raw / 46.62 kB gzip (↔); `utils-CBw3aSZY.js` steady at 82.62 kB raw / 23.34 kB gzip (↔).
- Notable modules: Hook test additions pulled minimal shared runtime; manual chunks hold steady.
- Compression savings: Primary bundle reduces ~73% post-gzip (492.35 → 132.81 kB), parity with baseline.

### Runtime Observations
- Autosave badge benchmark: Synthetic `autosave:badgeUpdate` measurement logs produced via `AutosaveLatencyBenchmark` helper (`reports/performance/2025-10-08-autosave-latency.json`). Normal storage flow stabilizes badge in ~137 ms, degraded flow (retrying with pending writes) stretches to ~483 ms.
- Interaction trace & live profiler review: **Pending manual capture** (requires in-browser navigation run and React DevTools Profiler session).

### Follow-up Actions
1. Owner run: capture real dashboard → case → dashboard trace with profiler export; archive under `reports/performance/2025-10-08-interaction-trace.*` and update this log.
2. Analyze resulting `AppContent` commits (>25 ms) and file memoization/chunk-splitting stories; update Phase 4 TODOs.
3. Expand autosave latency benchmark to include actual browser session metrics and compare with synthetic baseline.
