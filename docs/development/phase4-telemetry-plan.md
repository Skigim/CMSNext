# Phase 4 Telemetry Captures - Multi-Track Plan

**Created:** October 16, 2025  
**Branch:** `feat/phase4-telemetry-captures`  
**Team:** 3 Agents creating tools + 1 Human executing manual tasks  
**Timeline:** 1 day agent work + 2-3 hours human execution  
**Prerequisites:** PR #29 merged, all telemetry infrastructure in place

---

## Overview

Complete the Phase 4 manual telemetry captures required before architecture refactor kickoff. Three agents will work in parallel creating **automated instrumentation and measurement tools**. A human operator will then **execute** the manual browser interactions and performance profiling.

### Division of Labor

**Agents Build (Automated):**
- Instrumentation scripts
- Data collection utilities
- Analysis and reporting tools
- Documentation templates

**Human Executes (Manual):**
- Browser navigation workflows
- React DevTools profiling sessions
- Performance recording
- Data export and validation

### Objectives

1. **Navigation Instrumentation** - Build tools to track user journeys
2. **React Profiler Integration** - Create wrapper and analysis scripts
3. **Automated Benchmarks** - Build scripts for autosave/dashboard measurement
4. **Human Execution Guide** - Document manual steps for operator

### Success Criteria

- [ ] All instrumentation tools created by agents
- [ ] Automated benchmarks executable
- [ ] Human execution guide complete
- [ ] Manual tasks documented step-by-step
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

## Track 1: Navigation Instrumentation (Agent 1)

### Objective
Create instrumentation tools for tracking user navigation flows

### Agent Tasks (Automated - 2 hours)

1. **Create Browser-Side Instrumentation Script** (60 min)
   - Script: `public/navigation-tracer.js` (browser console script)
   - Functionality:
     - Add `performance.mark()` calls for key navigation events
     - Listen to route changes
     - Capture memory snapshots via `performance.memory`
     - Track telemetry events
     - Auto-export JSON after 5 navigation cycles
     - Console instructions for manual execution

2. **Create Analysis Script** (45 min)
   - Script: `scripts/analyzeNavigationTrace.ts`
   - Functionality:
     - Parse Chrome DevTools Performance JSON export
     - Identify bottlenecks (>50ms operations)
     - Compare against synthetic baselines
     - Generate markdown report from trace data
     - Output statistical summary

3. **Create Human Execution Guide** (15 min)
   - Document: `docs/development/MANUAL_NAVIGATION_TRACE.md`
   - Include:
     - Step-by-step browser instructions
     - DevTools setup
     - How to export trace data
     - Where to save files
     - What to look for in results

### Human Tasks (Manual - 30 min total)

**Technical User (15 min):**
1. Setup dev server and browser DevTools
2. Load `public/navigation-tracer.js` into console
3. Brief non-technical tester on Part 1 of their guide
4. Monitor console for completion message
5. Run analysis: `npx tsx scripts/analyzeNavigationTrace.ts`

**Non-Technical User (15 min):**
1. Follow `MANUAL_TESTING_GUIDE_NON_TECHNICAL.md` - Part 1
2. Perform 5 navigation cycles (dashboard → list → detail → back)
3. Report completion to technical user

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

## Track 2: React Profiler Integration (Agent 2)

### Objective
Create React Profiler tooling and analysis scripts for manual profiling sessions

### Agent Tasks (Automated - 2 hours)

1. **Create Profiler Wrapper Component** (30 min)
   - Component: `components/app/ProfilerWrapper.tsx`
   - Functionality:
     - Wrap AppContent with React.Profiler
     - Record mount/update phases to console
     - Track actual vs. base duration
     - Identify slow components (>25ms commits)
     - Provide dev-mode toggle
     - Add usage instructions in comments

2. **Create Profiler Data Processor** (45 min)
   - Script: `scripts/processProfilerData.ts`
   - Functionality:
     - Read React DevTools Profiler JSON export
     - Identify commits >25ms
     - Find re-render hotspots
     - Calculate component render statistics
     - Export analysis as JSON and markdown

3. **Create Flamegraph Generator** (30 min)
   - Script: `scripts/generateFlamegraph.ts`
   - Functionality:
     - Convert profiler data to speedscope format
     - Generate interactive HTML flamegraph
     - Include render timeline visualization
     - Add navigation controls

4. **Create Human Execution Guide** (15 min)
   - Document: `docs/development/MANUAL_PROFILER_SESSION.md`
   - Include:
     - How to enable ProfilerWrapper
     - React DevTools Profiler setup
     - Workflows to perform (dashboard, create case, etc.)
     - How to export profiler JSON
     - How to run analysis scripts

### Human Tasks (Manual - 1 hour total)

**Technical User (30 min):**
1. Enable ProfilerWrapper in `App.tsx` (set `enabled={true}`)
2. Rebuild: `npm run dev`
3. Open React DevTools → Profiler tab
4. Start recording (blue circle button)
5. Brief non-technical tester on Parts 2-3 of their guide
6. Monitor recording stays active
7. Help non-technical user export profiler data
8. Process data: `npx tsx scripts/processProfilerData.ts`
9. Generate flamegraph: `npx tsx scripts/generateFlamegraph.ts`

**Non-Technical User (45 min):**
1. Follow `MANUAL_TESTING_GUIDE_NON_TECHNICAL.md` - Parts 2-4
2. Perform workflows:
   - Create 2 new cases
   - Add financial items (resources, income, expenses)
   - Add notes to cases
   - Create 5 quick cases
   - Browse around naturally
3. Work with technical user to export profiler data

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

## Track 3: Automated Benchmarks (Agent 3)

### Objective
Create fully automated performance benchmarks for autosave and dashboard

### Agent Tasks (Automated - 2.5 hours)

1. **Create Autosave Benchmark** (45 min)
   - Script: `scripts/benchmarkAutosave.ts`
   - Functionality:
     - **Fully automated** - runs in test environment
     - Test with varying case counts (10, 50, 100, 200)
     - Measure normal and simulated degraded scenarios
     - Calculate statistical measures (mean, median, p95, p99)
     - Export JSON report
     - **No manual steps required**

2. **Create Dashboard Load Benchmark** (60 min)
   - Script: `scripts/benchmarkDashboard.ts`
   - Functionality:
     - **Fully automated** - uses RTL render
     - Measure dashboard mount with 0, 2, 3, 5 widgets
     - Track widget data fetch times individually
     - Test lazy loading overhead
     - Vary case counts (10, 50, 100)
     - Calculate statistical analysis
     - Export JSON report
     - **No manual steps required**

3. **Create Benchmark Runner** (30 min)
   - Script: `scripts/runAllBenchmarks.ts`
   - Functionality:
     - Execute all benchmarks sequentially
     - Collect results
     - Generate consolidated report
     - Compare against baselines
     - Output summary to console

4. **Create Analysis & Reporting** (15 min)
   - Script: `scripts/analyzeBenchmarks.ts`
   - Functionality:
     - Read benchmark JSON files
     - Compare against synthetic baselines
     - Generate markdown report
     - Update performance-metrics.md template

### Human Tasks (Manual - 15 min)

**Technical User Only (No Non-Technical Help Needed):**

1. **Run Automated Benchmarks**
   - Execute: `npm run benchmark:all` (or `npx tsx scripts/runAllBenchmarks.ts`)
   - Wait for completion (~5-10 minutes)
   - Can run in parallel while non-technical user does Parts 2-3
   - Review console output

2. **Generate Reports**
   - Execute: `npx tsx scripts/analyzeBenchmarks.ts`
   - Review generated markdown
   - Update `docs/development/performance-metrics.md` with all findings

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
