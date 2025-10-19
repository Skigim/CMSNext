# Refreshed Agent Prompts - Post VS Code Update

**Branch:** `feat/telemetry-accessibility-dashboard`  
**Current Status:** Track 1 ✅ Complete | Track 2 ⏳ Ready | Track 3 ⏳ Ready  
**Tests:** 202/202 passing ✅

---

## ✅ Track 1: COMPLETE - No Action Needed

Track 1 (Telemetry) is **fully complete** with 2 commits. Agents 1 & 2 finished before the VS Code update.

---

## 📋 UPDATED PROMPTS (Tracks 2 & 3 Only)

### **Prompt 3: Track 2 - Accessibility Integration** ⏳ READY

You are **Agent 3** on Track 2 (Accessibility Gate).

**Your mission:**
Integrate axe-core into the test suite and add accessibility checks to case and financial workflows.

**Files to modify:**
- `package.json` - Add `jest-axe` dependency (run: `npm install --save-dev jest-axe`)
- `src/test/setup.ts` - Import and configure `toHaveNoViolations` matcher
- `__tests__/components/case/CaseForm.test.tsx` - Add `expect(container).toHaveNoViolations()` assertions
- `components/__tests__/CaseDetails.test.tsx` - Add accessibility checks
- `__tests__/components/financial/FinancialItemCard.test.tsx` - Add axe checks
- `components/__tests__/FinancialItemCardActions.test.tsx` - Add accessibility verification

**Success criteria:**
- `jest-axe` installed and configured in test setup
- All case workflow tests include axe assertions
- All financial workflow tests pass axe checks
- Keyboard navigation verified for forms
- Focus management tested
- Zero accessibility violations detected
- All 202+ tests pass

**Branch:** `feat/telemetry-accessibility-dashboard` (pull latest first!)

**Commit format:** `a11y: <description>` (e.g., "a11y: integrate axe-core and add case workflow checks")

**Important:** Run `npm install` after adding jest-axe to package.json, then run tests to verify.

Start immediately. Commit atomically (2-3 commits).

---

### **Prompt 4: Track 2 - Accessibility Documentation** ⏳ READY

You are **Agent 4** on Track 2 (Accessibility Gate).

**Your mission:**
Add accessibility checks to notes/dashboard workflows and create comprehensive accessibility documentation.

**Files to modify:**
- `__tests__/components/NotesSection.test.tsx` - Add axe checks, verify ARIA labels
- `__tests__/components/Dashboard.test.tsx` - Check dashboard accessibility
- `__tests__/components/app/AppNavigationShell.test.tsx` - Verify navigation accessibility (if exists)

**Files to create:**
- `docs/development/accessibility-testing.md` - **NEW** - Complete guide
- Update: `docs/development/testing-infrastructure.md` - Add axe integration section

**Accessibility doc must include:**
- WCAG 2.1 AA compliance targets
- How to run axe checks in tests (`toHaveNoViolations()` usage)
- Common violations and fixes
- Keyboard navigation testing patterns
- ARIA best practices for shadcn components
- Remediation checklist template
- CI integration guidance

**Testing Infrastructure update:**
Add section on axe-core integration, reference new accessibility-testing.md guide.

**Branch:** `feat/telemetry-accessibility-dashboard` (Agent 3 is working here)

**Commit format:** `a11y: <description>` (e.g., "a11y: add checks to notes and create documentation")

**Important:** Pull latest before starting. Coordinate with Agent 3 via commit messages.

Commit atomically (2-3 commits).

---

### **Prompt 5: Track 3 - Widget Registry & Priority Widget** ⏳ READY

You are **Agent 5** on Track 3 (Dashboard Insights).

**Your mission:**
Build the widget registry framework and create the Case Priority widget.

**IMPORTANT:** Track 1 is complete! Telemetry utilities are available in:
- `utils/telemetryInstrumentation.ts`
- `utils/telemetryCollector.ts`

**Files to create:**
- `components/app/widgets/WidgetRegistry.tsx` - **NEW** - Lazy loading framework
- `components/app/widgets/CasePriorityWidget.tsx` - **NEW** - Priority breakdown
- `hooks/useWidgetData.ts` - **NEW** - Data fetching with freshness

**Files to modify:**
- `components/app/Dashboard.tsx` - Integrate widget registry

**Widget Registry requirements:**
- Lazy load widgets using `React.lazy()` and `Suspense`
- Provide skeleton/loading states
- Support widget registration with metadata (title, refreshInterval)
- Track last updated timestamp per widget using `telemetryInstrumentation`
- Expose freshness indicator: "Last updated: X minutes ago"

**Case Priority Widget requirements:**
- Display count breakdown: Active, Urgent, Normal, Closed
- Use shadcn `Card` + `Badge` components
- Show freshness timestamp using telemetry utilities
- Skeleton state during load
- Responsive layout (stacks on mobile)
- Props accept `cases: CaseDisplay[]` array

**Dashboard Integration:**
- Import `WidgetRegistry` and widgets
- Register `CasePriorityWidget`
- Add widget rendering section to Dashboard layout
- Ensure responsive grid for widgets

**Branch:** `feat/telemetry-accessibility-dashboard` (pull latest first!)

**Commit format:** `dashboard: <description>` (e.g., "dashboard: create widget registry framework")

Start immediately. Commit atomically (2-3 commits).

---

### **Prompt 6: Track 3 - Activity Timeline Widget & Docs** ⏳ READY

You are **Agent 6** on Track 3 (Dashboard Insights).

**Your mission:**
Create the Activity Timeline widget and document the widget development pattern.

**IMPORTANT:** Wait for Agent 5 to commit Widget Registry before starting!

**Files to create:**
- `components/app/widgets/ActivityTimelineWidget.tsx` - **NEW** - Recent activity timeline
- `docs/development/widget-development.md` - **NEW** - Widget creation guide

**Files to update:**
- `docs/development/feature-catalogue.md` - Update Dashboard rating from 55 → 70
- `components/app/Dashboard.tsx` - Register ActivityTimelineWidget

**Activity Timeline Widget requirements:**
- Show last 7 days of activity (notes, saves, imports)
- Display type badges (Note, Save, Import) with lucide icons
- Show timestamps relative to now ("2 hours ago")
- Use shadcn `Card` + `Badge` + `ScrollArea` components
- Freshness indicator using `telemetryInstrumentation` utilities
- Empty state when no recent activity
- Limit to 10 most recent items
- Props accept `activityLogState: CaseActivityLogState`

**Widget Development Guide must include:**
- Step-by-step widget creation process
- Registry integration instructions
- Data fetching patterns with `useWidgetData`
- Freshness tracking using telemetry
- Skeleton/loading state patterns
- Testing recommendations
- Bundle size considerations
- Example widget code

**Feature Catalogue Update:**
Update Dashboard section:
- Change rating from 55 → 70
- Add to Strengths: Widget framework with freshness indicators
- Update Coverage: Mention widget lazy loading verified

**Branch:** `feat/telemetry-accessibility-dashboard` (Agent 5 is working here)

**Commit format:** `dashboard: <description>` (e.g., "dashboard: add activity timeline widget")

**IMPORTANT:** Pull latest before starting to get Widget Registry from Agent 5!

Commit atomically (2-3 commits).

---

## Quick Reference for All Remaining Agents

**To assign all remaining agents:**
```
#file:REFRESHED_PROMPTS.md Prompt 3
#file:REFRESHED_PROMPTS.md Prompt 4
#file:REFRESHED_PROMPTS.md Prompt 5
#file:REFRESHED_PROMPTS.md Prompt 6
```

**Execution order:**
- Prompts 3-4: Start immediately (parallel, Track 2)
- Prompt 5: Start immediately (Track 3, needs Track 1 telemetry - already done!)
- Prompt 6: Wait for Prompt 5 to commit Widget Registry

**Expected results:**
- Track 2 (Prompts 3-4): 4-6 commits
- Track 3 (Prompts 5-6): 4-5 commits
- **Total: 8-11 new commits** (Track 1 already has 3 commits)

**Current branch status:**
- ✅ All tests passing (202/202)
- ✅ Track 1 complete (telemetry foundation ready)
- ✅ Clean working tree
- ⏳ Ready for Tracks 2 & 3
