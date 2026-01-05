# CMSNext Roadmap - January 2026

**Report Date:** January 5, 2026  
**Branch:** main  
**Focus:** Dashboard Transformation  
**Status:** Week 1 Complete ✅ | Phase 1-2 Complete ✅

---

## 🎯 January Objectives

1. **Dashboard Transformation** - Transform the dashboard from a passive display into an active command center.
2. **User Workflow Optimization** - Surface priority work, reduce navigation friction, enable inline actions.
3. **Personalization** - Allow users to customize their dashboard experience.
4. **Domain Layer Foundation** - Establish patterns for pure business logic extraction (deferred from original plan).

---

## 📋 Dashboard Transformation Plan

### Phase 1: Quick Actions Hub ✅ COMPLETE

> _Add a prominent action bar at the top of the dashboard with instant access to global search, new case creation, bulk operations, and import/export. Think of it as the "command center" where users initiate most actions._

**PR:** #90  
**Status:** Merged to main

**Delivered:**

- [x] `QuickActionsBar` component with search, new case, bulk ops, import/export
- [x] Global search integration with `useAppViewState`
- [x] Keyboard shortcut support (Ctrl+N new case, / focus search)
- [x] Responsive design with collapsible actions on mobile

---

### Phase 2: Priority Task Queue ✅ COMPLETE

> _Create a new "Today's Work" widget that surfaces cases requiring immediate attention—priority flags, approaching deadlines, unresolved alerts, and recent modifications. Users start their day here instead of hunting through case lists._

**PR:** #93  
**Status:** Merged to main

**Delivered:**

- [x] `TodaysWorkWidget` component showing prioritized cases
- [x] `domain/dashboard/priorityQueue.ts` - Pure priority scoring logic
  - `calculatePriorityScore()` - Weighted scoring based on status and alert types
  - `getPriorityCases()` - Returns top N priority cases
  - `getPriorityReason()` - Human-readable reason strings
  - Alert classification: `isAvsDay5Alert()`, `isVerificationDueAlert()`, `isMailRcvdClosedAlert()`
- [x] `useTodaysWork` hook bridging UI and domain
- [x] Priority badges (high/medium/low) with color coding
- [x] One-click navigation to case detail
- [x] 59 unit tests for domain logic
- [x] Feature flag: `dashboard.widgets.todaysWork`
- [x] 2-column layout with placeholder for Phase 3 widget

**Priority Scoring Weights:**

| Factor                           | Points   |
| -------------------------------- | -------- |
| Intake status                    | 1000     |
| AVS Day 5 alerts                 | 500 each |
| Verification Due / VR Due alerts | 400 each |
| Mail on Closed alerts            | 400 each |
| Other unresolved alerts          | 100 each |
| Priority flag                    | 75       |
| Modified in 24h                  | 50       |

---

### Phase 3: Recent & Pinned Cases 🚧 IN PROGRESS

> _Add widgets for "Recently Viewed Cases" (last 5-10 accessed) and "Pinned Cases" (user favorites) with one-click navigation and inline status/alert indicators. Eliminates repetitive navigation for frequently accessed cases._

**Target:** Week 2 (Jan 6-12)

#### Tasks

- [ ] Create `domain/dashboard/recentCases.ts` - Pure logic for tracking/retrieving recent cases
- [ ] Create `domain/dashboard/pinnedCases.ts` - Pure logic for pin/unpin operations
- [ ] Add `recentlyViewed` array to user preferences storage
- [ ] Add `pinnedCaseIds` array to user preferences storage
- [ ] Create `useRecentCases` hook
- [ ] Create `usePinnedCases` hook
- [ ] Create `RecentCasesWidget` component
- [ ] Create `PinnedCasesWidget` component
- [ ] Add pin/unpin button to CaseCard and CaseDetail
- [ ] Update 2-column layout: Today's Work + Recent/Pinned
- [ ] Add feature flags: `dashboard.widgets.recentCases`, `dashboard.widgets.pinnedCases`
- [ ] Write 20+ unit tests for domain logic

#### Technical Notes

**Storage approach:**

```typescript
// In user preferences (encrypted local file)
interface UserDashboardPrefs {
  recentlyViewed: Array<{ caseId: string; viewedAt: string }>; // Last 10
  pinnedCaseIds: string[]; // User favorites
}
```

**Widget placement:**

- Replace `PlaceholderWidget` with `RecentCasesWidget`
- Add `PinnedCasesWidget` as third widget in Overview tab

---

### Phase 4: Inline Quick Actions 📋 PLANNED

> _Enable status updates, quick note additions, and alert resolution directly from dashboard case cards without navigating away. Every case card becomes actionable with inline dropdowns and modals._

**Target:** Week 2-3 (Jan 9-15)

#### Tasks

- [ ] Add inline status dropdown to dashboard case cards
- [ ] Add "Quick Note" button with popover form
- [ ] Add "Resolve Alert" action for cases with alerts
- [ ] Ensure all mutations trigger proper storage sync
- [ ] Add optimistic UI updates with rollback on failure
- [ ] Test accessibility for all inline actions
- [ ] Write integration tests for inline workflows

---

### Phase 5: Dashboard Personalization 📋 PLANNED

> _Allow users to show/hide widgets, reorder them, and create custom dashboard presets (e.g., "Morning Briefing" vs. "Analytics Deep Dive"). Store preferences in encrypted local files following existing filesystem architecture._

**Target:** Week 3 (Jan 13-19)

#### Tasks

- [ ] Create `DashboardSettings` modal for widget visibility
- [ ] Implement widget reordering with drag-and-drop
- [ ] Create preset system (save/load dashboard configurations)
- [ ] Wire feature flags to actual widget visibility toggles
- [ ] Store preferences in encrypted user settings file
- [ ] Add "Reset to Default" option
- [ ] Write tests for preference persistence

---

### Phase 6: Navigation & Context Flow 📋 PLANNED

> _Make the dashboard the central hub that all workflows return to—preserve scroll position, selected tabs, and widget states when navigating away and back. Add "Return to Dashboard" breadcrumbs and enhance keyboard shortcuts for dashboard-specific actions._

**Target:** Week 4 (Jan 20-26)

#### Tasks

- [ ] Preserve dashboard scroll position on navigation
- [ ] Preserve selected tab (Overview/Analytics) on return
- [ ] Add "Return to Dashboard" breadcrumb to case detail views
- [ ] Implement dashboard-specific keyboard shortcuts:
  - `D` - Focus Today's Work widget
  - `R` - Focus Recent Cases widget
  - `P` - Focus Pinned Cases widget
  - `Tab` - Cycle through widgets
- [ ] Add widget focus indicators for keyboard navigation
- [ ] Write E2E tests for navigation preservation

---

## 📅 Weekly Plan

### Week 1: Foundation (Jan 2-5) ✅ COMPLETE

- [x] Phase 1: Quick Actions Hub (PR #90)
- [x] Phase 2: Today's Work Widget (PR #93)
- [x] Domain layer pattern established (`domain/dashboard/priorityQueue.ts`)
- [x] 2-column dashboard layout implemented
- [x] Repository memories documented (PR #91)
- [x] 683 tests passing

---

### Week 2: Recent & Pinned + Inline Actions (Jan 6-12)

_Focus: Complete Phase 3 and start Phase 4_

#### Monday-Tuesday: Recent Cases

- [ ] Domain logic for recent case tracking
- [ ] Storage integration for view history
- [ ] `RecentCasesWidget` component

#### Wednesday-Thursday: Pinned Cases

- [ ] Domain logic for pin/unpin
- [ ] Storage integration for pins
- [ ] `PinnedCasesWidget` component
- [ ] Pin button on case cards

#### Friday-Sunday: Inline Actions Start

- [ ] Inline status dropdown on dashboard cards
- [ ] Quick note popover

---

### Week 3: Inline Actions + Personalization (Jan 13-19)

_Focus: Complete Phase 4 and Phase 5_

#### Monday-Wednesday: Finish Inline Actions

- [ ] Alert resolution from dashboard
- [ ] Optimistic updates with rollback
- [ ] Accessibility testing

#### Thursday-Sunday: Dashboard Personalization

- [ ] Widget visibility settings
- [ ] Drag-and-drop reordering
- [ ] Preset system

---

### Week 4: Navigation & Polish (Jan 20-26)

_Focus: Phase 6 and final polish_

- [ ] Scroll/tab state preservation
- [ ] Breadcrumb navigation
- [ ] Dashboard keyboard shortcuts
- [ ] E2E testing
- [ ] Documentation updates
- [ ] February roadmap planning

---

## 📊 Progress Metrics

| Metric              | Current | Target |
| ------------------- | ------- | ------ |
| Phases complete     | 2       | 6      |
| Dashboard widgets   | 10      | 12+    |
| Test count          | 720     | 750+   |
| Feature flags wired | 9       | 12     |

---

## 🗂️ Deferred Work

### Domain Layer Expansion (Moved to February)

The domain layer pattern was successfully established in Phase 2 with `domain/dashboard/priorityQueue.ts`. Full expansion to other areas (alerts, cases, financials, statistics) is deferred to February to maintain focus on dashboard transformation.

**Candidates for February:**

- `domain/alerts/` - Alert filtering, sorting, status logic
- `domain/cases/` - Case filtering, sorting, search logic
- `domain/statistics/` - Widget calculation extraction
- `domain/notes/` - Note sorting and filtering

---

## 📚 Related Documents

- [Feature Catalogue](feature-catalogue.md) - Complete feature inventory
- [Project Structure Guidelines](project-structure-guidelines.md) - Architecture patterns
- [December 2025 Roadmap](archive/2025/ROADMAP_DEC_2025.md) - Previous month

---

_Last updated: January 5, 2026_
