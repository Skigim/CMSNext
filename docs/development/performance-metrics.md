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
- Other findings: Instrumentation verified end-to-end (`npm run perf:baseline` output stored in `docs/development/performance/2025-10-07-performance-log.json`).

### Follow-up Actions
1. Capture a real navigation trace (dashboard → list → detail) and archive the raw measurement/profile output alongside the treemap.
2. Validate AppContent commit durations in live Profiler sessions and prioritize memoization if commits exceed ~25 ms.
3. Audit `utils-CBw3aSZY.js` for code that can shift behind dynamic imports before new helpers land.
