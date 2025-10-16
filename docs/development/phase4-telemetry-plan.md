# Phase 4 Telemetry Captures - Multi-Track Plan

**Created:** October 16, 2025  
**Branch:** `feat/phase4-telemetry-captures`  
**Team:** 3 Agents working simultaneously  
**Timeline:** 1 day (8 hours total, ~2.5 hours per agent)  
**Prerequisites:** PR #29 merged, all telemetry infrastructure in place

---

## Overview

Complete the Phase 4 manual telemetry captures required before architecture refactor kickoff. Three agents will work in parallel on different telemetry capture areas, coordinating via commit messages and this shared plan.

### Objectives

1. **Real Navigation Trace** - Capture actual user journey through app
2. **React Profiler Session** - Analyze AppContent commits and hotspots
3. **Autosave Latency Benchmark** - Compare real vs. synthetic measurements
4. **Dashboard Load Profiling** - Measure performance with 3+ widgets

### Success Criteria

- [ ] All 4 telemetry captures complete with artifacts
- [ ] Performance baseline updated with real-world data
- [ ] Profiler flamegraphs and treemaps generated
- [ ] Documentation updated with findings
- [ ] Zero test regressions (211/211 passing)
- [ ] Build successful with no errors

---

## Agent Coordination Strategy

### Branch Strategy
- **Single shared branch:** `feat/phase4-telemetry-captures`
- **Commit often** with descriptive messages
- **Pull before push** to avoid conflicts
- **Tag commits** with agent number (e.g., `[Agent1]`, `[Agent2]`, `[Agent3]`)

### File Ownership (Avoid Conflicts)

**Agent 1:** Navigation & User Flows
- `scripts/captureNavigationTrace.ts` (create)
- `reports/performance/2025-10-16-navigation-trace.json` (create)
- `reports/performance/2025-10-16-navigation-trace.md` (create)

**Agent 2:** React Profiler & Rendering
- `scripts/captureProfilerSession.ts` (create)
- `reports/performance/2025-10-16-profiler-session.json` (create)
- `reports/performance/2025-10-16-profiler-flamegraph.html` (create)
- `components/app/ProfilerWrapper.tsx` (create)

**Agent 3:** Autosave & Dashboard Performance
- `scripts/autosaveBenchmark.ts` (enhance existing)
- `scripts/dashboardLoadBenchmark.ts` (create)
- `reports/performance/2025-10-16-autosave-real.json` (create)
- `reports/performance/2025-10-16-dashboard-load.json` (create)

### Communication Protocol

**Commit Message Format:**
```
[AgentN] scope: brief description

Longer description if needed.

Status: in-progress | complete
Dependencies: Agent X must complete Y first (if any)
```

**Examples:**
```
[Agent1] telemetry: add navigation trace capture script

Created script to record user navigation through dashboard → list → detail.
Uses performance.mark() to capture timestamps and memory snapshots.

Status: complete
```

```
[Agent2] telemetry: add React Profiler wrapper component

Wraps AppContent with Profiler to capture mount/update phases.
Includes flamegraph generation using speedscope format.

Status: in-progress
Dependencies: None
```

---

## Track 1: Navigation Trace (Agent 1)

### Objective
Capture real user navigation flow: Dashboard → Case List → Case Detail → Back to Dashboard

### Tasks

1. **Create Navigation Trace Script** (45 min)
   - Script: `scripts/captureNavigationTrace.ts`
   - Functionality:
     - Record navigation timing with `performance.mark()`
     - Capture memory snapshots at each step
     - Track telemetry events during navigation
     - Measure route transition latency
     - Export JSON report

2. **Perform Manual Trace** (30 min)
   - Start dev server
   - Open browser with DevTools
   - Execute navigation flow (3-5 iterations)
   - Collect performance timeline
   - Save Chrome DevTools trace file

3. **Analyze & Document** (45 min)
   - Parse trace data
   - Identify bottlenecks (>50ms operations)
   - Compare against synthetic baselines
   - Generate markdown report
   - Update `performance-metrics.md`

### Deliverables

- `scripts/captureNavigationTrace.ts`
- `reports/performance/2025-10-16-navigation-trace.json`
- `reports/performance/2025-10-16-navigation-trace.md`
- Updated `docs/development/performance-metrics.md`

### Expected Findings

- Dashboard mount time: ~20-30ms (baseline: 22.34ms)
- List view render: ~15-25ms
- Detail view render: ~10-20ms
- Navigation transition: <50ms
- Memory increase per navigation: <5MB

### Commit Sequence

1. `[Agent1] telemetry: add navigation trace capture script`
2. `[Agent1] telemetry: perform manual navigation trace`
3. `[Agent1] docs: document navigation trace findings`

---

## Track 2: React Profiler Session (Agent 2)

### Objective
Analyze AppContent rendering behavior with React Profiler, generate flamegraph

### Tasks

1. **Create Profiler Wrapper** (30 min)
   - Component: `components/app/ProfilerWrapper.tsx`
   - Functionality:
     - Wrap AppContent with React Profiler
     - Record mount/update phases
     - Track actual vs. base duration
     - Identify slow components (>25ms commits)
     - Export profiler data

2. **Generate Capture Script** (30 min)
   - Script: `scripts/captureProfilerSession.ts`
   - Functionality:
     - Automate profiler data collection
     - Process React DevTools exports
     - Convert to speedscope format
     - Generate flamegraph HTML

3. **Perform Profiler Session** (30 min)
   - Enable Profiler wrapper
   - Start recording in React DevTools
   - Perform standard workflows:
     - Dashboard load
     - Create case
     - Edit financial items
     - Add notes
   - Export profiler JSON

4. **Analyze & Document** (30 min)
   - Identify commits >25ms
   - Find re-render hotspots
   - Suggest memoization opportunities
   - Generate flamegraph visualization
   - Document findings

### Deliverables

- `components/app/ProfilerWrapper.tsx`
- `scripts/captureProfilerSession.ts`
- `reports/performance/2025-10-16-profiler-session.json`
- `reports/performance/2025-10-16-profiler-flamegraph.html`
- Updated `docs/development/performance-metrics.md`

### Expected Findings

- AppContent mount: 20-30ms actual, 15-20ms base
- Frequent re-renders: useCaseManagement, useNavigationFlow
- Expensive commits: Dashboard with 3+ widgets (~30-40ms)
- Memoization opportunities: 5-10 components

### Commit Sequence

1. `[Agent2] telemetry: add React Profiler wrapper component`
2. `[Agent2] telemetry: add profiler session capture script`
3. `[Agent2] telemetry: perform profiler session and generate flamegraph`
4. `[Agent2] docs: document profiler findings and optimization opportunities`

---

## Track 3: Autosave & Dashboard Benchmarks (Agent 3)

### Objective
Measure real autosave latency and dashboard load times with multiple widgets

### Tasks

1. **Enhance Autosave Benchmark** (30 min)
   - Enhance: `scripts/autosaveBenchmark.ts`
   - Add real browser session measurement
   - Compare synthetic vs. real timings
   - Test with varying case counts (10, 50, 100)
   - Measure degraded storage scenarios

2. **Create Dashboard Load Benchmark** (45 min)
   - Script: `scripts/dashboardLoadBenchmark.ts`
   - Functionality:
     - Measure dashboard mount with 0, 2, 3, 5 widgets
     - Track widget data fetch times
     - Measure lazy loading overhead
     - Test with varying case counts
     - Export detailed timing report

3. **Run Benchmarks** (30 min)
   - Execute autosave benchmark
   - Execute dashboard benchmark
   - Collect multiple samples (5-10 runs)
   - Calculate statistical measures (mean, median, p95)

4. **Analyze & Document** (30 min)
   - Compare real vs. synthetic autosave
   - Identify dashboard performance profile
   - Recommend widget refresh intervals
   - Document findings
   - Update performance-metrics.md

### Deliverables

- Enhanced `scripts/autosaveBenchmark.ts`
- New `scripts/dashboardLoadBenchmark.ts`
- `reports/performance/2025-10-16-autosave-real.json`
- `reports/performance/2025-10-16-dashboard-load.json`
- Updated `docs/development/performance-metrics.md`

### Expected Findings

**Autosave:**
- Real browser: 140-180ms (vs. synthetic: 137ms)
- Degraded mode: 500-600ms (vs. synthetic: 483ms)
- Large datasets (100+ cases): 200-300ms

**Dashboard:**
- 0 widgets: 15-20ms mount
- 2 widgets: 30-40ms mount
- 3 widgets: 40-55ms mount
- 5 widgets: 60-80ms mount
- Widget data fetch: 10-30ms per widget

### Commit Sequence

1. `[Agent3] telemetry: enhance autosave benchmark for real browser testing`
2. `[Agent3] telemetry: add dashboard load benchmark script`
3. `[Agent3] telemetry: run autosave and dashboard benchmarks`
4. `[Agent3] docs: document autosave and dashboard performance findings`

---

## Integration & Review

### Final Steps (All Agents)

1. **Pull Latest Changes** - Ensure all commits integrated
2. **Run Full Test Suite** - `npm run test:run`
3. **Verify Build** - `npm run build`
4. **Update Summary** - Consolidate findings in performance-metrics.md
5. **Create PR** - Open PR to main with comprehensive description

### PR Description Template

```markdown
# Phase 4 Telemetry Captures - Complete

## Summary
Completed all Phase 4 manual telemetry captures required before architecture refactor.
Three agents worked simultaneously on navigation tracing, React profiling, and 
performance benchmarking.

## Deliverables

### Track 1: Navigation Trace (Agent 1)
- ✅ Navigation trace script
- ✅ Manual trace performed (5 iterations)
- ✅ JSON report with timing data
- ✅ Markdown analysis with bottlenecks identified

### Track 2: React Profiler Session (Agent 2)
- ✅ Profiler wrapper component
- ✅ Profiler capture script
- ✅ Profiler session recorded
- ✅ Flamegraph generated
- ✅ Optimization opportunities documented

### Track 3: Autosave & Dashboard Benchmarks (Agent 3)
- ✅ Enhanced autosave benchmark (real browser)
- ✅ Dashboard load benchmark
- ✅ Performance reports (JSON)
- ✅ Statistical analysis completed

## Key Findings

**Navigation:**
- Dashboard mount: [X]ms (baseline: 22.34ms) ✅ Within target
- Navigation latency: [X]ms (target: <50ms) ✅ Within target

**Rendering:**
- AppContent commits: [X] commits >25ms identified
- Memoization opportunities: [X] components flagged

**Performance:**
- Autosave (real): [X]ms (synthetic: 137ms)
- Dashboard (3 widgets): [X]ms mount time
- Widget refresh: [X]ms average fetch time

## Testing
- ✅ All 211 tests passing
- ✅ Build successful (no errors)
- ✅ No accessibility regressions

## Documentation
- Updated `docs/development/performance-metrics.md` with all findings
- Created detailed reports in `reports/performance/`
- Added scripts to `scripts/` for reproducibility

## Next Steps
- Architecture refactor planning (Nov 1-7)
- Feature catalogue rating updates
- Accessibility audit across 5 themes
```

---

## Success Validation Checklist

Before merging:
- [ ] All 4 telemetry captures complete with artifacts
- [ ] Reports generated and stored in `reports/performance/`
- [ ] Scripts added to `scripts/` directory
- [ ] `performance-metrics.md` updated with latest entry
- [ ] All 211 tests passing
- [ ] Build successful (no TypeScript errors)
- [ ] No linting warnings
- [ ] PR description complete with findings
- [ ] All agent commits properly tagged
- [ ] No merge conflicts

---

## Troubleshooting

### Common Issues

**Issue:** Navigation trace not capturing timing data  
**Solution:** Ensure `performance.mark()` called before route changes; check browser support

**Issue:** React Profiler not recording  
**Solution:** Verify Profiler wrapper enabled; check React DevTools connected

**Issue:** Benchmark scripts timing out  
**Solution:** Increase timeout in Vitest config; reduce sample size

**Issue:** Merge conflicts between agents  
**Solution:** Follow file ownership; pull before push; communicate in commits

---

## Timeline (Single Day - 8 Hours)

| Hour | Agent 1 | Agent 2 | Agent 3 |
|------|---------|---------|---------|
| 0-1 | Setup nav trace script | Setup Profiler wrapper | Setup autosave enhancement |
| 1-2 | Perform manual trace | Create capture script | Create dashboard benchmark |
| 2-3 | Analyze trace data | Perform profiler session | Run autosave benchmark |
| 3-4 | Document findings | Generate flamegraph | Run dashboard benchmark |
| 4-5 | Update metrics doc | Document findings | Analyze results |
| 5-6 | Review & commit | Update metrics doc | Document findings |
| 6-7 | Integration testing | Integration testing | Integration testing |
| 7-8 | PR preparation | PR review | Final validation |

---

**Ready to Execute:** October 17, 2025  
**Target Completion:** October 17, 2025 (1 day)  
**Blocker Removal:** Architecture refactor can begin November 1, 2025
