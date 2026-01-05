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

### Phase 4: Dashboard Quick Actions 📋 PLANNED

> _Add lightweight actions to dashboard case cards—pin cases for quick access and add notes without navigating away. Leverages existing note creation logic._

**Target:** Week 2-3 (Jan 9-15)

#### Tasks

- [ ] Add "Pin Case" toggle to dashboard case cards (ties into Phase 3 pinning)
- [ ] Add "Quick Note" button with popover form (reuse existing `useNoteFlow` logic)
- [ ] Test accessibility for inline actions
- [ ] Write integration tests for dashboard actions

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
- [x] Domain layer pattern established (`domain/dashboard/priorityQueue.ts`)
- [x] 2-column dashboard layout implemented
- [x] Repository memories documented (PR #91)
- [x] 683 tests passing

---

### Week 2: Recent & Pinned Cases (Jan 6-12)

_Focus: Complete Phase 3 and Phase 4_

#### Monday-Tuesday: Recent Cases

- [ ] Domain logic for recent case tracking
- [ ] Storage integration for view history
- [ ] `RecentCasesWidget` component

#### Wednesday-Thursday: Pinned Cases

- [ ] Domain logic for pin/unpin
- [ ] Storage integration for pins
- [ ] `PinnedCasesWidget` component
- [ ] Pin button on case cards and dashboard

#### Friday-Sunday: Dashboard Quick Actions

- [ ] Quick note popover (reuse `useNoteFlow`)
- [ ] Integration tests

---

### Week 3: Navigation & Polish (Jan 13-19)

_Focus: Phase 5 and final polish_

- [ ] Scroll/tab state preservation
- [ ] Breadcrumb navigation
- [ ] Dashboard keyboard shortcuts
- [ ] Accessibility testing
- [ ] E2E testing

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
| Phases complete     | 2       | 5      |
| Dashboard widgets   | 10      | 12     |
| Test count          | 748     | 770+   |
| Feature flags wired | 9       | 11     |

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
