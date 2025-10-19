# Agent Prompts - Phase 4 Telemetry Captures

**Branch:** `feat/phase4-telemetry-captures`  
**Coordination:** Via commit messages and file ownership  
**Timeline:** 8 hours total (~2.5 hours per agent)

---

## 🤖 Agent 1: Navigation Trace Specialist

### Your Mission
Capture and analyze real user navigation flows through the CMSNext application. You'll create scripts to record performance data as users move from Dashboard → Case List → Case Detail and back.

### Context
- The app uses React Router for navigation
- Performance tracking infrastructure exists in `utils/performanceTracker.ts`
- Telemetry collector is in `utils/telemetryCollector.ts`
- You need to capture **real-world** navigation timing, not synthetic tests

### Your Files (No Conflicts with Other Agents)
- `scripts/captureNavigationTrace.ts` (create new)
- `reports/performance/2025-10-16-navigation-trace.json` (create new)
- `reports/performance/2025-10-16-navigation-trace.md` (create new)
- `docs/development/performance-metrics.md` (append new entry at top)

### Task Breakdown

#### Task 1: Create Navigation Trace Script (45 minutes)
**File:** `scripts/captureNavigationTrace.ts`

**Requirements:**
- Use `performance.mark()` and `performance.measure()` for timing
- Capture these navigation steps:
  1. Dashboard initial load
  2. Navigate to case list
  3. Navigate to case detail
  4. Navigate back to dashboard
- Record for each step:
  - Timestamp
  - Duration since previous step
  - Memory usage (`performance.memory` if available)
  - Active telemetry events
  - Component mount times
- Export JSON report with all captured data
- Include console logging for manual execution

**Script Structure:**
```typescript
// Pseudo-code outline (runs directly in the browser console)
(function navigationTracer() {
  type NavigationStep = {
    step: string;
    timestamp: number;
    duration: number;
    memoryUsed: number | null;
  };

  const steps: NavigationStep[] = [];
  const totals: Record<string, number[]> = {};

  console.log('Navigation Trace Capture');
  console.log('1. Make sure the app is open');
  console.log('2. Call window.navStep("dashboard-load") to begin');

  function recordStep(step: string) {
    const now = performance.now();
    const memoryUsed = performance.memory?.usedJSHeapSize ?? null;
    const previous = steps[steps.length - 1];
    const duration = previous ? now - previous.timestamp : 0;

    steps.push({ step, timestamp: now, duration, memoryUsed });
    if (!totals[step]) totals[step] = [];
    if (duration) totals[step].push(duration);

    console.log(`✅ ${step} @ ${now.toFixed(2)}ms`);
  }

  (window as any).navStep = (step: string) => {
    recordStep(step);
  };

  (window as any).downloadTrace = () => {
    const report = {
      capturedAt: new Date().toISOString(),
      browser: navigator.userAgent,
      steps,
      summary: summarise(totals),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `navigation-trace-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  function summarise(groups: Record<string, number[]>) {
    return Object.fromEntries(
      Object.entries(groups).map(([step, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        const avg = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
        const min = sorted[0] ?? 0;
        const max = sorted[sorted.length - 1] ?? 0;
        return [step, { avg, min, max }];
      })
    );
  }
})();
```

**Commit when done:**
```
[Agent1] telemetry: add navigation trace capture script

Created script to record user navigation through dashboard → list → detail.
Uses performance.mark() to capture timestamps and memory snapshots.

Status: complete
```

#### Task 2: Perform Manual Navigation Trace (30 minutes)

**Steps:**
1. Start dev server: `npm run dev`
2. Open browser at `http://localhost:5173`
3. Open DevTools Console and Performance tab
4. Start Performance recording
5. Execute navigation flow 3-5 times:
   - Dashboard → View All Cases → Select first case → View details → Back to Dashboard
6. Stop recording
7. Export trace as JSON
8. Save to `reports/performance/2025-10-16-navigation-trace.json`

**What to capture:**
- Timing for each route transition
- Memory increase per navigation
- Long tasks (>50ms)
- Script execution time
- Layout/paint durations

**Commit when done:**
```
[Agent1] telemetry: perform manual navigation trace

Captured 5 iterations of dashboard → list → detail → back navigation.
Recorded timing, memory, and performance metrics.

Status: complete
Artifacts: reports/performance/2025-10-16-navigation-trace.json
```

#### Task 3: Analyze & Document Findings (45 minutes)

**Create Analysis Report:** `reports/performance/2025-10-16-navigation-trace.md`

**Structure:**
```markdown
# Navigation Trace Analysis - October 16, 2025

## Overview
Analysis of real user navigation through CMSNext application.

## Methodology
- Iterations: 5
- Browser: Chrome 118
- Test data: 25 cases loaded

## Findings

### Dashboard Load
- Average: Xms
- Baseline: 22.34ms
- Variance: ±Yms
- Bottlenecks: [list]

### Case List Navigation
- Average: Xms
- Target: <50ms
- Memory increase: XMB

### Case Detail Navigation
- Average: Xms
- Target: <50ms
- Memory increase: XMB

### Back Navigation
- Average: Xms
- Uses browser cache: Yes/No

## Bottlenecks Identified
1. [Describe bottleneck 1]
2. [Describe bottleneck 2]

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]

## Comparison to Baseline
| Metric | Baseline | Real | Delta |
|--------|----------|------|-------|
| Dashboard mount | 22.34ms | Xms | +Yms |
| Navigation latency | 19.01ms | Xms | +Yms |
```

**Update Performance Metrics:** Add new entry to `docs/development/performance-metrics.md` at the top

**Commit when done:**
```
[Agent1] docs: document navigation trace findings

Analyzed 5 navigation iterations with detailed bottleneck identification.
Dashboard mount: [X]ms, navigation latency: [Y]ms.
All metrics within acceptable range (<50ms target).

Status: complete
Dependencies: None
```

### Success Criteria
- [ ] Script created and executable
- [ ] 3-5 navigation traces captured
- [ ] JSON report generated
- [ ] Markdown analysis complete
- [ ] Performance metrics updated
- [ ] 3 commits pushed with [Agent1] tag
- [ ] No test failures

### Communication
- Tag all commits with `[Agent1]`
- Mark status as `complete` when done
- If blocked, note `Dependencies:` in commit message

---

## 🤖 Agent 2: React Profiler Specialist

### Your Mission
Create and execute React Profiler sessions to analyze AppContent rendering behavior. Generate flamegraphs showing component mount/update times and identify optimization opportunities.

### Context
- AppContent is the main orchestrator in `App.tsx`
- React Profiler API: `<Profiler id="name" onRender={callback}>`
- Speedscope format for flamegraph visualization
- Existing performance tracker in `utils/performanceTracker.ts`

### Your Files (No Conflicts with Other Agents)
- `components/profiling/ProfilerWrapper.tsx` (create new)
- `scripts/captureProfilerSession.ts` (create new)
- `reports/performance/2025-10-16-profiler-session.json` (create new)
- `reports/performance/2025-10-16-profiler-flamegraph.html` (create new)
- `docs/development/performance-metrics.md` (append new entry at top)

### Task Breakdown

#### Task 1: Create Profiler Wrapper Component (30 minutes)
**File:** `components/profiling/ProfilerWrapper.tsx`

**Requirements:**
- Wrap any component with React Profiler
- Record mount and update phases
- Track actual vs. base duration
- Identify commits >25ms
- Export profiler data to JSON
- Include dev-mode toggle

**Component Structure:**
```typescript
import { Profiler, ProfilerOnRenderCallback, ReactNode } from 'react';
import { recordRenderProfile } from '@/utils/performanceTracker';

interface ProfilerWrapperProps {
  id: string;
  children: ReactNode;
  enabled?: boolean;
}

const onRenderCallback: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
  interactions
) => {
  // Record to performanceTracker
  recordRenderProfile({
    id,
    phase,
    actualDurationMs: actualDuration,
    baseDurationMs: baseDuration,
    startTime,
    commitTime,
    interactionCount: interactions.size,
    meta: {
      timestamp: new Date().toISOString(),
      slowCommit: actualDuration > 25,
    },
  });
  
  // Log slow commits
  if (actualDuration > 25) {
    console.warn(`[Profiler] Slow ${phase}: ${id} took ${actualDuration.toFixed(2)}ms`);
  }
};

export function ProfilerWrapper({ id, children, enabled = true }: ProfilerWrapperProps) {
  if (!enabled) {
    return <>{children}</>;
  }
  
  return (
    <Profiler id={id} onRender={onRenderCallback}>
      {children}
    </Profiler>
  );
}
```

**Usage Example in App.tsx:**
```typescript
import { ProfilerWrapper } from './components/app/ProfilerWrapper';

// Wrap AppContent
<ProfilerWrapper id="AppContent" enabled={import.meta.env.DEV}>
  <AppContent {...props} />
</ProfilerWrapper>
```

**Commit when done:**
```
[Agent2] telemetry: add React Profiler wrapper component

Wraps components with React.Profiler to capture mount/update phases.
Records data via performanceTracker and logs slow commits (>25ms).

Status: complete
```

#### Task 2: Create Profiler Capture Script (30 minutes)
**File:** `scripts/captureProfilerSession.ts`

**Requirements:**
- Read profiler data from performanceTracker
- Convert to speedscope format for flamegraph
- Generate HTML visualization
- Export JSON report

**Script Structure:**
```typescript
import { getRenderProfiles } from '../utils/performanceTracker';
import { writeFile } from 'fs/promises';

interface SpeedscopeProfile {
  $schema: string;
  profiles: any[];
  shared: {
    frames: any[];
  };
  exporter: string;
  name: string;
}

async function captureProfilerSession() {
  // Get all render profiles
  const profiles = getRenderProfiles();
  
  // Convert to speedscope format
  const speedscope: SpeedscopeProfile = {
    $schema: 'https://www.speedscope.app/file-format-schema.json',
    profiles: convertProfiles(profiles),
    shared: { frames: extractFrames(profiles) },
    exporter: 'CMSNext Profiler',
    name: 'React Render Profile - Oct 16 2025',
  };
  
  // Generate HTML flamegraph
  const html = generateFlamegraphHTML(speedscope);
  
  // Save files
  await writeFile('reports/performance/2025-10-16-profiler-session.json', 
    JSON.stringify(profiles, null, 2));
  await writeFile('reports/performance/2025-10-16-profiler-flamegraph.html', html);
  
  console.log('✅ Profiler session captured');
}
```

**Commit when done:**
```
[Agent2] telemetry: add profiler session capture script

Processes React Profiler data and generates speedscope flamegraph.
Exports JSON report and HTML visualization.

Status: complete
```

#### Task 3: Perform Profiler Session (30 minutes)

**Steps:**
1. Enable ProfilerWrapper in App.tsx (already done in Task 1)
2. Start dev server: `npm run dev`
3. Open browser at `http://localhost:5173`
4. Open React DevTools Profiler tab
5. Start recording
6. Perform these workflows:
   - Dashboard load (2 times)
   - Create new case
   - Edit financial items (add 3 items)
   - Add 2 notes
   - Navigate between views
7. Stop recording
8. Export profiler JSON from React DevTools
9. Run your capture script: `npx tsx scripts/captureProfilerSession.ts`

**Commit when done:**
```
[Agent2] telemetry: perform profiler session and generate flamegraph

Recorded React Profiler data during standard workflows.
Generated flamegraph showing component render times.

Status: complete
Artifacts: 
- reports/performance/2025-10-16-profiler-session.json
- reports/performance/2025-10-16-profiler-flamegraph.html
```

#### Task 4: Analyze & Document (30 minutes)

**Update Performance Metrics:** Add entry to `docs/development/performance-metrics.md`

**Format:**
```markdown
## 2025-10-16 · Phase 4 React Profiler Session

### Profiler Summary
- Total commits recorded: X
- Commits >25ms: X
- AppContent mount: Xms actual / Yms base
- Slowest component: ComponentName (Xms)

### Hotspots Identified
1. **ComponentName** - Xms average, re-renders frequently
2. **ComponentName** - Yms average, expensive calculations

### Memoization Opportunities
1. `useCaseManagement` - memo costly selector
2. `FinancialItemCard` - React.memo wrapper
3. `NotesSection` - useMemo for filtered lists

### Follow-up Actions
1. Profile AppContent under load (100+ cases)
2. Add React.memo to identified components
3. Optimize selector functions in hooks
```

**Commit when done:**
```
[Agent2] docs: document profiler findings and optimization opportunities

Identified X commits >25ms with detailed component analysis.
AppContent mount: Xms (within baseline tolerance).
Documented 5-10 memoization opportunities.

Status: complete
Dependencies: None
```

### Success Criteria
- [ ] ProfilerWrapper component created
- [ ] Capture script created
- [ ] Profiler session performed
- [ ] Flamegraph generated
- [ ] JSON report exported
- [ ] Performance metrics updated
- [ ] 4 commits pushed with [Agent2] tag
- [ ] No test failures

### Communication
- Tag all commits with `[Agent2]`
- Mark status as `complete` when done
- If blocked, note `Dependencies:` in commit message

---

## 🤖 Agent 3: Autosave & Dashboard Benchmark Specialist

### Your Mission
Measure real-world autosave latency and dashboard load performance with multiple widgets. Compare real browser measurements against synthetic baselines.

### Context
- Autosave benchmark exists: `scripts/performanceBaseline.ts`
- Dashboard has widget framework: `components/app/Dashboard.tsx`
- Performance tracker utilities: `utils/performanceTracker.ts`
- Storage health metrics: `getStorageHealthMetrics()`

### Your Files (No Conflicts with Other Agents)
- `scripts/autosaveBenchmark.ts` (enhance existing or create new)
- `scripts/dashboardLoadBenchmark.ts` (create new)
- `reports/performance/2025-10-16-autosave-real.json` (create new)
- `reports/performance/2025-10-16-dashboard-load.json` (create new)
- `docs/development/performance-metrics.md` (append new entry at top)

### Task Breakdown

#### Task 1: Enhance Autosave Benchmark (30 minutes)
**File:** `scripts/autosaveBenchmark.ts` (create or enhance)

**Requirements:**
- Measure real browser autosave latency (not synthetic)
- Test with varying case counts: 10, 50, 100
- Test normal and degraded storage scenarios
- Compare against synthetic baseline (137ms normal, 483ms degraded)
- Export statistical report (mean, median, p95, p99)

**Script Structure:**
```typescript
import { AutosaveFileService } from '../utils/AutosaveFileService';
import { generateTestCases } from '../utils/testHelpers';
import { writeFile } from 'fs/promises';

interface AutosaveBenchmarkResult {
  caseCount: number;
  scenario: 'normal' | 'degraded';
  samples: number[];
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

async function runAutosaveBenchmark() {
  const results: AutosaveBenchmarkResult[] = [];
  const caseCounts = [10, 50, 100];
  const scenarios = ['normal', 'degraded'];
  
  for (const count of caseCounts) {
    for (const scenario of scenarios) {
      // Generate test data
      const cases = generateTestCases(count);
      
      // Run 10 samples
      const samples: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        
        if (scenario === 'degraded') {
          // Simulate degraded storage (add artificial delay)
          await simulateDegradedStorage();
        }
        
        await autosaveService.save(cases);
        
        const duration = performance.now() - start;
        samples.push(duration);
      }
      
      // Calculate statistics
      results.push({
        caseCount: count,
        scenario,
        samples,
        mean: calculateMean(samples),
        median: calculateMedian(samples),
        p95: calculatePercentile(samples, 95),
        p99: calculatePercentile(samples, 99),
        min: Math.min(...samples),
        max: Math.max(...samples),
      });
    }
  }
  
  // Export JSON
  await writeFile(
    'reports/performance/2025-10-16-autosave-real.json',
    JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2)
  );
  
  console.log('✅ Autosave benchmark complete');
}
```

**Commit when done:**
```
[Agent3] telemetry: enhance autosave benchmark for real browser testing

Added real browser autosave measurement with varying case counts (10, 50, 100).
Tests both normal and degraded storage scenarios.
Exports statistical analysis (mean, median, p95, p99).

Status: complete
```

#### Task 2: Create Dashboard Load Benchmark (45 minutes)
**File:** `scripts/dashboardLoadBenchmark.ts`

**Requirements:**
- Measure dashboard mount time with 0, 2, 3, 5 widgets
- Track widget data fetch times individually
- Measure lazy loading overhead
- Test with varying case counts: 10, 50, 100
- Export detailed timing report

**Script Structure:**
```typescript
import { render } from '@testing-library/react';
import { Dashboard } from '../components/app/Dashboard';
import { generateTestCases } from '../utils/testHelpers';
import { writeFile } from 'fs/promises';

interface DashboardLoadResult {
  widgetCount: number;
  caseCount: number;
  mountTime: number;
  widgetFetchTimes: number[];
  totalLoadTime: number;
  samples: number;
}

async function runDashboardBenchmark() {
  const results: DashboardLoadResult[] = [];
  const widgetCounts = [0, 2, 3, 5];
  const caseCounts = [10, 50, 100];
  
  for (const widgetCount of widgetCounts) {
    for (const caseCount of caseCounts) {
      // Generate test data
      const cases = generateTestCases(caseCount);
      
      // Run 5 samples
      const mountTimes: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        
        render(
          <Dashboard
            cases={cases}
            alerts={{}}
            activityLogState={[]}
            onViewAllCases={() => {}}
            onNewCase={() => {}}
            onNavigateToReports={() => {}}
            widgetCount={widgetCount}
          />
        );
        
        const mountTime = performance.now() - start;
        mountTimes.push(mountTime);
      }
      
      results.push({
        widgetCount,
        caseCount,
        mountTime: calculateMean(mountTimes),
        widgetFetchTimes: [], // Track individually
        totalLoadTime: calculateMean(mountTimes),
        samples: 5,
      });
    }
  }
  
  // Export JSON
  await writeFile(
    'reports/performance/2025-10-16-dashboard-load.json',
    JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2)
  );
  
  console.log('✅ Dashboard benchmark complete');
}
```

**Commit when done:**
```
[Agent3] telemetry: add dashboard load benchmark script

Measures dashboard mount time with varying widget counts (0, 2, 3, 5).
Tests across different case volumes (10, 50, 100).
Exports detailed timing breakdown.

Status: complete
```

#### Task 3: Run Benchmarks (30 minutes)

**Steps:**
1. Run autosave benchmark: `npx tsx scripts/autosaveBenchmark.ts`
2. Run dashboard benchmark: `npx tsx scripts/dashboardLoadBenchmark.ts`
3. Verify JSON reports generated
4. Review results for anomalies
5. Calculate summary statistics

**Commit when done:**
```
[Agent3] telemetry: run autosave and dashboard benchmarks

Executed benchmarks with multiple samples:
- Autosave: 10 samples per scenario/case count
- Dashboard: 5 samples per widget/case count

Status: complete
Artifacts:
- reports/performance/2025-10-16-autosave-real.json
- reports/performance/2025-10-16-dashboard-load.json
```

#### Task 4: Analyze & Document (30 minutes)

**Update Performance Metrics:** Add entry to `docs/development/performance-metrics.md`

**Format:**
```markdown
## 2025-10-16 · Phase 4 Autosave & Dashboard Benchmarks

### Autosave Performance

#### Real Browser vs. Synthetic
| Scenario | Case Count | Synthetic | Real (Mean) | Real (p95) | Delta |
|----------|------------|-----------|-------------|------------|-------|
| Normal | 10 | 137ms | Xms | Yms | +Zms |
| Normal | 50 | - | Xms | Yms | - |
| Normal | 100 | - | Xms | Yms | - |
| Degraded | 10 | 483ms | Xms | Yms | +Zms |
| Degraded | 50 | - | Xms | Yms | - |
| Degraded | 100 | - | Xms | Yms | - |

**Key Findings:**
- Real browser autosave ~20-40ms slower than synthetic
- Large datasets (100+ cases) increase latency by X%
- Degraded mode shows consistent 3-4x slowdown

### Dashboard Load Performance

| Widgets | Case Count | Mount Time | Widget Fetch | Total |
|---------|------------|------------|--------------|-------|
| 0 | 10 | Xms | - | Xms |
| 2 | 10 | Xms | Yms | Zms |
| 3 | 10 | Xms | Yms | Zms |
| 5 | 10 | Xms | Yms | Zms |

**Key Findings:**
- Each widget adds ~10-20ms to mount time
- Widget data fetch: 10-30ms per widget
- Dashboard with 5 widgets: 60-80ms total load
- Lazy loading overhead: <5ms per widget

### Recommendations
1. **Autosave:** Consider batching writes for large datasets
2. **Dashboard:** Limit default widgets to 3-4 for optimal performance
3. **Widget Refresh:** Use 5-minute intervals (current) to balance freshness/performance
4. **Degraded Storage:** Increase retry timeout to 600ms based on real measurements

### Follow-up Actions
1. Test dashboard with 10+ widgets to identify breakpoint
2. Profile autosave with 500+ cases
3. Measure memory impact of multiple widgets
```

**Commit when done:**
```
[Agent3] docs: document autosave and dashboard performance findings

Real autosave: [X]ms mean (vs synthetic: 137ms), within acceptable range.
Dashboard (3 widgets): [Y]ms mount time, meets <100ms target.
Recommended widget refresh: 5 minutes (current setting validated).

Status: complete
Dependencies: None
```

### Success Criteria
- [ ] Autosave benchmark enhanced/created
- [ ] Dashboard benchmark created
- [ ] Both benchmarks executed with multiple samples
- [ ] JSON reports generated
- [ ] Statistical analysis complete
- [ ] Performance metrics updated
- [ ] 4 commits pushed with [Agent3] tag
- [ ] No test failures

### Communication
- Tag all commits with `[Agent3]`
- Mark status as `complete` when done
- If blocked, note `Dependencies:` in commit message

---

## Final Integration (All Agents)

### Once All Tracks Complete

1. **Pull Latest Changes**
```bash
git pull origin feat/phase4-telemetry-captures
```

2. **Verify Everything**
```bash
npm run test:run    # All 211 tests passing
npm run build       # Build successful
npm run lint        # No warnings
```

3. **Update Summary in performance-metrics.md**
Add a consolidated summary at the very top:

```markdown
## 2025-10-16 · Phase 4 Telemetry Captures - COMPLETE

### Multi-Track Summary
Completed all Phase 4 manual telemetry captures with 3 agents working simultaneously.

**Track 1 (Agent 1): Navigation Trace**
- Dashboard mount: [X]ms (baseline: 22.34ms)
- Navigation latency: [Y]ms (target: <50ms)
- ✅ All metrics within acceptable range

**Track 2 (Agent 2): React Profiler Session**
- AppContent commits: [X] total, [Y] >25ms
- Flamegraph generated with [Z] components profiled
- Identified [N] memoization opportunities

**Track 3 (Agent 3): Autosave & Dashboard Benchmarks**
- Autosave (real): [X]ms mean (synthetic: 137ms)
- Dashboard (3 widgets): [Y]ms mount
- ✅ Performance targets met

### Architecture Refactor Status
- ✅ Phase 4 telemetry captures complete
- ✅ Performance baselines established
- ✅ Optimization opportunities documented
- 🟢 **READY** for architecture refactor (Nov 1, 2025)
```

4. **Create PR**
Open PR from `feat/phase4-telemetry-captures` to `main` with comprehensive description (use template from phase4-telemetry-plan.md)

5. **Celebrate! 🎉**
Phase 4 complete, architecture refactor can begin!

---

## Reference Documents

- **Architecture Refactor Plan:** `docs/development/architecture-refactor-plan.md`
- **Phase 4 Telemetry Plan:** `docs/development/phase4-telemetry-plan.md`
- **Actionable Roadmap:** `docs/development/actionable-roadmap.md`
- **Feature Catalogue:** `docs/development/feature-catalogue.md`
- **Performance Metrics Log:** `docs/development/performance-metrics.md`
