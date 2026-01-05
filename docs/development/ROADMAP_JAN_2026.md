# CMSNext Roadmap - January 2026

**Report Date:** January 5, 2026  
**Branch:** main  
**Focus:** Dashboard Transformation  
**Status:** Week 1 Complete ✅ | Phase 1-4 Complete ✅

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

### Phase 3: Recent & Pinned Cases ✅ COMPLETE

> _Add widgets for "Recently Viewed Cases" (last 5-10 accessed) and "Pinned Cases" (user favorites) with one-click navigation and inline status/alert indicators. Eliminates repetitive navigation for frequently accessed cases._

**Status:** Merged to main

**Delivered:**

- [x] `domain/dashboard/recentCases.ts` - Pure logic for tracking/retrieving recent cases (6 functions)
- [x] `domain/dashboard/pinnedCases.ts` - Pure logic for pin/unpin operations (8 functions)
- [x] `useRecentCases` hook with localStorage persistence
- [x] `usePinnedCases` hook with localStorage persistence
- [x] `RecentCasesWidget` component with clear/remove actions
- [x] `PinnedCasesWidget` component with unpin action
- [x] Pin button on CaseCard and CaseDetails
- [x] Recently viewed tracking in navigation flow
- [x] Feature flags: `dashboard.widgets.recentCases`, `dashboard.widgets.pinnedCases`
- [x] 124 unit tests (79 domain + 45 hooks)

---

### Phase 4: Dashboard Quick Actions ✅ COMPLETE

> _Add lightweight actions to dashboard case cards—pin cases for quick access and add notes without navigating away. Leverages existing note creation logic._

**Status:** Merged to main

**Delivered:**

- [x] Reusable `PinButton` component
- [x] Pin button on TodaysWorkWidget case items
- [x] Pin button on RecentCasesWidget case items  
- [x] Pin button on ActivityWidget case items
- [x] Pin button on ActivityTimelineWidget case items
- [x] Pin action available everywhere cases are displayed

**Deferred:**

- [ ] Quick Note popover (can be added later using existing `useNoteFlow`)

---

### Phase 5: Navigation & Context Flow 📋 PLANNED

> _Make the dashboard the central hub that all workflows return to—preserve scroll position, selected tabs, and widget states when navigating away and back. Add "Return to Dashboard" breadcrumbs and enhance keyboard shortcuts for dashboard-specific actions._

**Target:** Week 3 (Jan 13-19)

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
- [x] Phase 3: Recent & Pinned Cases
- [x] Phase 4: Dashboard Quick Actions (pin buttons)
- [x] Domain layer pattern established (`domain/dashboard/`)
- [x] 4-widget dashboard layout implemented
- [x] Repository memories documented (PR #91)
- [x] 872 tests passing

---

### Week 2: Navigation & Polish (Jan 6-12)

_Focus: Phase 5 and polish_

- [ ] Scroll/tab state preservation
- [ ] Breadcrumb navigation
- [ ] Dashboard keyboard shortcuts
- [ ] Accessibility testing
- [ ] Quick Note popover (optional)

---

### Week 3: Polish & Testing (Jan 13-19)

_Focus: E2E testing and refinements_

- [ ] E2E tests for navigation
- [ ] Performance optimization
- [ ] Bug fixes from user testing

---

### Week 4: Buffer & Planning (Jan 20-26)

_Focus: Catchup, polish, and February planning_

- [ ] Address any outstanding issues
- [ ] Documentation updates
- [ ] February roadmap planning
- [ ] Domain layer expansion planning

---

## 📊 Progress Metrics

| Metric              | Current | Target |
| ------------------- | ------- | ------ |
| Phases complete     | 4       | 5      |
| Dashboard widgets   | 12      | 12     |
| Test count          | 872     | 900+   |
| Feature flags wired | 11      | 11     |

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
