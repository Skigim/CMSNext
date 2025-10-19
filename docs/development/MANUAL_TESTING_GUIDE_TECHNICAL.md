# Manual Testing Guide (Technical User)

**Created:** October 16, 2025  
**Tester:** Technical team member  
**Duration:** ~2 hours  
**Prerequisites:** Agents completed Track 1, 2, 3 tooling

---

## 🎯 Your Responsibilities

Handle the technical setup, configuration, and data processing while non-technical tester executes user workflows.

---

## Phase 1: Pre-Testing Setup (30 minutes)

### Task 1: Verify Agent Deliverables

**Check that agents completed their work:**

```bash
# Verify all files exist
ls -la public/navigation-tracer.js
ls -la components/profiling/ProfilerWrapper.tsx
ls -la scripts/analyzeNavigationTrace.ts
ls -la scripts/generateFlamegraph.ts
ls -la scripts/autosaveBenchmark.ts
ls -la scripts/dashboardLoadBenchmark.ts
```

**If any files missing:** Agents need to complete their work first.

### Task 2: Enable ProfilerWrapper

**Edit:** `App.tsx`

**Find AppContent and wrap it:**

```typescript
import { ProfilerWrapper } from './components/profiling/ProfilerWrapper';

// In your render:
<ProfilerWrapper id="AppContent" enabled={true}>
  <AppContent {...props} />
</ProfilerWrapper>
```

**Rebuild:**
```bash
npm run dev
```

### Task 3: Set Up Browser DevTools

1. Open browser at `http://localhost:5173`
2. Open DevTools (F12)
3. Open Console tab
4. Open React DevTools → Profiler tab (install extension if needed)
5. Verify console shows: `[Performance] Tracker initialized`

### Task 4: Load Navigation Instrumentation

**In browser Console, paste:**

```bash
# Copy navigation tracer to clipboard
cat public/navigation-tracer.js | pbcopy
# Or on Linux: cat public/navigation-tracer.js | xclip -selection clipboard
```

**Paste into browser console and press Enter**

**Verify:** Console shows `Navigation tracer ready. Perform 5 navigation cycles.`

### Task 5: Enable React Profiler Recording

1. In React DevTools → Profiler tab
2. Click the **blue circle** button to start recording
3. Verify recording indicator appears (red dot)

### Task 6: Brief Non-Technical Tester

**Give them:**
- `docs/development/MANUAL_TESTING_GUIDE_NON_TECHNICAL.md`
- Confirm they can access browser at localhost:5173
- Walk them through Part 1 once (navigation cycle)
- Let them proceed independently

**Tell them:**
- "Just follow the guide step-by-step"
- "You can't break anything - this is a test environment"
- "If you get stuck, just ask"

---

## Phase 2: Monitor Non-Technical Testing (45 minutes)

### While Tester Works on Parts 1-3

**Your Tasks:**

1. **Monitor Console for Errors**
   - Watch for any red error messages
   - Note any warnings
   - Track navigation trace progress

2. **Check React Profiler Recording**
   - Verify red recording indicator stays active
   - Check recording hasn't auto-stopped
   - Note any performance warnings

3. **Be Available for Questions**
   - Help if tester gets stuck
   - Clarify any confusing steps
   - Troubleshoot issues

4. **Start Automated Benchmarks (Parallel)**
   
   While tester works, run automated benchmarks in separate terminal:
   
   ```bash
   # Open new terminal
  npm run bench:autosave
  npm run bench:dashboard
  # Or run directly:
  npx tsx scripts/autosaveBenchmark.ts
  npx tsx scripts/dashboardLoadBenchmark.ts
   ```
   
  Each script runs for a few minutes. Let both complete in background.

### When Tester Reaches Part 4

**Help them export Profiler data:**

1. Stop recording (click red circle in React Profiler)
2. Right-click in Profiler view
3. Select "Export profiling data..."
4. Save as: `reports/performance/2025-10-16-profiler-raw.json`

**Verify navigation trace saved:**
```bash
ls -la reports/performance/2025-10-16-navigation-trace.json
```

---

## Phase 3: Data Processing & Analysis (45 minutes)

### Task 1: Process Navigation Trace

```bash
# Analyze navigation data
npx tsx scripts/analyzeNavigationTrace.ts \
  reports/performance/2025-10-16-navigation-trace.json

# Output: reports/performance/2025-10-16-navigation-trace-analysis.md
```

**Review output:**
- Average navigation times
- Bottlenecks identified
- Comparison to baselines

### Task 2: Process React Profiler Data

```bash
# Generate flamegraph input for speedscope
npx tsx scripts/generateFlamegraph.ts \
  reports/performance/2025-10-16-profiler-raw.json

# Output: reports/performance/2025-10-16-profiler-raw.speedscope.json
```

**Upload to https://www.speedscope.app/** and open the generated `.speedscope.json` file for interactive analysis.

**Analyze:**
- Identify commits >25ms
- Find re-render hotspots
- Note memoization opportunities

### Task 3: Review Automated Benchmarks

**Check benchmark results:**
```bash
# View autosave results
cat reports/performance/autosave-benchmark-2025-10-16.json | jq

# View dashboard results
cat reports/performance/dashboard-load-benchmark-2025-10-16.json | jq
```

**Generate consolidated analysis:**
```bash
npx tsx scripts/analyzeBenchmarks.ts

# Output: reports/performance/2025-10-16-benchmark-analysis.md
```

### Task 4: Update Performance Metrics

**Edit:** `docs/development/performance-metrics.md`

**Add new entry at top:**

```markdown
## 2025-10-16 · Phase 4 Telemetry Captures - COMPLETE

### Multi-Track Summary

**Track 1: Navigation Trace (5 user iterations)**
- Dashboard mount: [X]ms average (baseline: 22.34ms)
- Case list navigation: [X]ms average
- Case detail navigation: [X]ms average
- Back navigation: [X]ms average
- Memory increase per cycle: [X]MB
- **Status:** ✅ [Within/Outside] acceptable range

**Track 2: React Profiler Session (45min user workflows)**
- Total commits recorded: [X]
- Commits >25ms: [X] commits
- AppContent mount: [X]ms actual / [Y]ms base
- Slowest components: 
  1. [ComponentName] - [X]ms
  2. [ComponentName] - [Y]ms
- **Memoization opportunities identified:** [N]

**Track 3: Automated Benchmarks**

*Autosave Performance:*
| Cases | Normal (mean) | Normal (p95) | Degraded (mean) | Degraded (p95) |
|-------|---------------|--------------|-----------------|----------------|
| 10    | [X]ms        | [Y]ms        | [A]ms          | [B]ms          |
| 50    | [X]ms        | [Y]ms        | [A]ms          | [B]ms          |
| 100   | [X]ms        | [Y]ms        | [A]ms          | [B]ms          |

*Dashboard Performance:*
| Widgets | Cases | Mount Time | Widget Fetch | Total |
|---------|-------|------------|--------------|-------|
| 0       | 10    | [X]ms     | -            | [X]ms |
| 2       | 10    | [X]ms     | [Y]ms        | [Z]ms |
| 3       | 50    | [X]ms     | [Y]ms        | [Z]ms |
| 5       | 100   | [X]ms     | [Y]ms        | [Z]ms |

### Key Findings

1. **Navigation Performance:** [Summary]
2. **Render Performance:** [Summary]
3. **Autosave Latency:** [Summary]
4. **Dashboard Scaling:** [Summary]

### Recommendations

1. [Recommendation based on data]
2. [Recommendation based on data]
3. [Recommendation based on data]

### Architecture Refactor Status
- ✅ Phase 4 telemetry captures complete
- ✅ Performance baselines established
- ✅ Bottlenecks identified
- 🟢 **READY** for architecture refactor (Nov 1, 2025)

### Follow-up Actions
1. [Action item]
2. [Action item]
3. [Action item]
```

---

## Phase 4: Validation & Cleanup (15 minutes)

### Task 1: Verify All Artifacts

```bash
# Check all reports exist
ls -la reports/performance/2025-10-16-*

# Expected files:
# - navigation-trace.json
# - navigation-trace-analysis.md
# - profiler-raw.json
# - profiler-analysis.json
# - profiler-flamegraph.html
# - autosave-benchmark.json
# - dashboard-benchmark.json
# - benchmark-analysis.md
```

### Task 2: Run Tests

```bash
# Ensure no regressions
npm run test:run

# Expected: 211/211 passing
```

### Task 3: Verify Build

```bash
npm run build

# Expected: Successful build, no errors
```

### Task 4: Disable ProfilerWrapper

**Edit:** `App.tsx`

**Change enabled to false or remove wrapper:**

```typescript
<ProfilerWrapper id="AppContent" enabled={false}>
  <AppContent {...props} />
</ProfilerWrapper>
```

**Or comment out the wrapper entirely**

### Task 5: Commit All Results

```bash
git add reports/performance/
git add docs/development/performance-metrics.md

git commit -m "telemetry: complete Phase 4 manual captures

Navigation trace (5 iterations):
- Dashboard mount: [X]ms
- Navigation latency: [Y]ms

React Profiler (45min session):
- Commits >25ms: [N] identified
- AppContent: [X]ms actual

Automated benchmarks:
- Autosave: [X]ms mean (100 cases)
- Dashboard: [Y]ms (3 widgets)

All artifacts saved in reports/performance/
Performance metrics updated with findings.

Status: Phase 4 complete ✅"
```

---

## Phase 5: Create PR (15 minutes)

### Prepare PR Description

```bash
# Generate file list
git diff --name-only origin/main

# Review changes
git diff origin/main docs/development/performance-metrics.md
```

### Create Pull Request

**Title:** `telemetry: Phase 4 manual captures complete`

**Description:**

```markdown
# Phase 4 Telemetry Captures - Complete

## Summary
Completed all Phase 4 manual telemetry captures with combined technical + 
non-technical testing approach. Agents built tooling, technical user set up
infrastructure, non-technical user executed workflows, technical user processed data.

## Team Division

**Agents (Tracks 1-3):** Built instrumentation, analysis tools, automated benchmarks
**Non-Technical Tester:** Executed 1.5hrs of user workflows
**Technical Tester:** Setup, monitoring, data processing, analysis

## Deliverables

### Track 1: Navigation Trace
- ✅ Browser instrumentation script
- ✅ 5 navigation iterations performed
- ✅ Timing data collected
- ✅ Analysis report generated

### Track 2: React Profiler Session
- ✅ Profiler wrapper component
- ✅ 45min profiling session (create cases, add items, add notes)
- ✅ Profiler data exported
- ✅ Flamegraph generated
- ✅ Optimization opportunities identified

### Track 3: Automated Benchmarks
- ✅ Autosave benchmark (10, 50, 100, 200 cases)
- ✅ Dashboard benchmark (0-5 widgets, varying case counts)
- ✅ Statistical analysis complete
- ✅ Consolidated report generated

## Key Findings

**Navigation Performance:**
- Dashboard mount: [X]ms (baseline: 22.34ms) - [Status]
- Navigation average: [Y]ms (target: <50ms) - [Status]

**Rendering Performance:**
- AppContent commits: [N] total, [M] >25ms
- Identified [X] memoization opportunities
- Flamegraph reveals [finding]

**Autosave Performance:**
- Real browser: [X]ms mean (synthetic: 137ms)
- 100 cases: [Y]ms (acceptable for dataset size)
- Degraded mode: [Z]ms (within 3-4x expected slowdown)

**Dashboard Performance:**
- 3 widgets: [X]ms mount (target: <100ms) - [Status]
- 5 widgets: [Y]ms mount (scaling acceptable)
- Widget fetch: [Z]ms average

## Recommendations

1. [Based on data]
2. [Based on data]
3. [Based on data]

## Testing
- ✅ All 211 tests passing
- ✅ Build successful
- ✅ No regressions introduced
- ✅ ProfilerWrapper disabled in production

## Documentation
- Updated `docs/development/performance-metrics.md` with findings
- All reports in `reports/performance/` directory
- Non-technical testing guide created for future use

## Next Steps
- ✅ Phase 4 telemetry captures complete
- 🟢 Architecture refactor ready to begin (Nov 1, 2025)
- Feature catalogue rating updates
- Accessibility audit across 5 themes
```

### Open PR

```bash
# Push branch
git push origin feat/phase4-telemetry-captures

# Open PR on GitHub
gh pr create --title "telemetry: Phase 4 manual captures complete" \
  --body "$(cat PR_DESCRIPTION.md)"
```

---

## 📊 Success Checklist

Before merging:

- [ ] All artifacts in `reports/performance/`
- [ ] Performance metrics updated
- [ ] Navigation trace analysis complete
- [ ] React Profiler flamegraph generated
- [ ] Automated benchmarks run successfully
- [ ] All 211 tests passing
- [ ] Build successful
- [ ] ProfilerWrapper disabled
- [ ] Findings documented
- [ ] Recommendations provided
- [ ] PR created with comprehensive description

---

## 🎉 Phase 4 Complete!

**Achievements:**
- ✅ Real-world navigation data captured
- ✅ React rendering performance profiled
- ✅ Automated performance benchmarks baseline
- ✅ Architecture refactor unblocked

**Next:** Architecture refactor execution (November 2025)

---

**Questions or Issues?** Review agent-generated documentation or check AGENT_PROMPTS.md
