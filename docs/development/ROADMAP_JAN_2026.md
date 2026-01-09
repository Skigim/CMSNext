# CMSNext Roadmap - January 2026

**Report Date:** January 9, 2026  
**Branch:** main  
**Focus:** Dashboard Transformation + Domain Layer Refactor  
**Status:** Week 1 Complete ✅ | Phase 1-4 Complete ✅ | Domain Refactor In Progress 🔄

---

## 🎯 January Objectives

1. **Dashboard Transformation** - Transform the dashboard from a passive display into an active command center. ✅ PHASES 1-4 COMPLETE
2. **User Workflow Optimization** - Surface priority work, reduce navigation friction, enable inline actions. ✅ COMPLETE
3. **Personalization** - Allow users to customize their dashboard experience. (Phase 5 - planned)
4. **Domain Layer Refactor** - Extract pure business logic from utils/ to domain/ layer. 🔄 IN PROGRESS

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

### Week 1: Dashboard Foundation (Jan 2-5) ✅ COMPLETE

- [x] Phase 1: Quick Actions Hub (PR #90)
- [x] Phase 2: Today's Work Widget (PR #93)
- [x] Phase 3: Recent & Pinned Cases
- [x] Phase 4: Dashboard Quick Actions (pin buttons)
- [x] Domain layer pattern established (`domain/dashboard/`)
- [x] 4-widget dashboard layout implemented
- [x] Repository memories documented (PR #91)
- [x] 872 tests passing

---

### Week 2: Domain Layer - Phase A & B (Jan 6-12) 🔄 IN PROGRESS

_Focus: Foundational domain modules and standalone logic_

**Phase A: Foundation (Jan 9-10)**

- [ ] `domain/common/dates.ts` - Date parsing, formatting, timezone handling
- [ ] `domain/common/phone.ts` - Phone number formatting and validation
- [ ] `domain/common/formatters.ts` - Currency, frequency display helpers
- [ ] `domain/common/sanitization.ts` - XSS prevention, input sanitization

**Phase B: Standalone Logic (Jan 10-12)**

- [ ] `domain/validation/forms.ts` - Zod schemas, form validation rules
- [ ] `domain/financials/verification.ts` - Verification status mapping
- [ ] `domain/avs/parser.ts` - AVS paste parsing

---

### Week 3: Domain Layer - Phase C & D (Jan 13-19)

_Focus: Templates, alerts, and completion_

**Phase C: Alerts & Templates (Jan 13-15)**

- [ ] `domain/alerts/matching.ts` - MCN normalization, alert matching
- [ ] `domain/alerts/display.ts` - Alert type colors, formatting
- [ ] `domain/templates/vr.ts` - VR template rendering
- [ ] `domain/templates/summary.ts` - Case summary generation

**Phase D: Polish & Cleanup (Jan 16-19)**

- [ ] `domain/migration/config.ts` - Category config migration logic
- [ ] `domain/dashboard/stats.ts` - Widget statistics calculations
- [ ] Split mixed files (alertsData.ts pure vs I/O)
- [ ] Update agent instructions (DOMAIN.md)
- [ ] Delete migrated `utils/` files
- [ ] Full test suite verification (target: 950+ tests)

---

### Week 4: Buffer & Planning (Jan 20-26)

_Focus: Catchup, polish, and February planning_

- [ ] Address any outstanding issues
- [ ] Phase 5: Navigation keyboard shortcuts (if time permits)
- [ ] Documentation updates
- [ ] February roadmap planning

---

## 📊 Progress Metrics

| Metric               | Current | Target |
| -------------------- | ------- | ------ |
| Dashboard phases     | 4       | 5      |
| Domain modules       | 4       | 10     |
| Test count           | 859     | 950+   |
| Lines migrated       | ~1,500  | ~7,400 |
| utils/ files removed | 1       | 15+    |

---

## 🔧 Domain Layer Refactor (Week 2-3)

> **Goal:** Extract all pure business logic from `utils/` to `domain/` layer. Pure functions with no I/O, no React, fully testable.

### Current Domain Structure

```
domain/
├── cases/           ✅ COMPLETE
│   ├── formatting.ts    # formatCaseDisplayName, formatRetroMonths, calculateAge, etc.
│   └── index.ts
├── dashboard/       ✅ COMPLETE
│   ├── priorityQueue.ts # Priority scoring (94 tests)
│   ├── recentCases.ts   # Recent case tracking (34 tests)
│   ├── pinnedCases.ts   # Pinned case management (45 tests)
│   └── index.ts
├── financials/      ✅ COMPLETE
│   ├── history.ts       # Amount history (32 tests)
│   ├── validation.ts    # Input validation (14 tests)
│   ├── calculations.ts  # Totals (4 tests)
│   └── index.ts
└── validation/      ✅ COMPLETE
    └── duplicates.ts    # Duplicate detection (12 tests)
```

### Remaining Migrations (~2,000 lines)

| Source File               | Lines | Target                              | Priority  | Dependencies                  |
| ------------------------- | ----- | ----------------------------------- | --------- | ----------------------------- |
| `dateFormatting.ts`       | 179   | `domain/common/dates.ts`            | 🔴 HIGH   | Foundation for all date logic |
| `phoneFormatter.ts`       | 186   | `domain/common/phone.ts`            | 🟡 MEDIUM | Used by templates             |
| `avsParser.ts`            | 309   | `domain/avs/parser.ts`              | 🟡 MEDIUM | Standalone                    |
| `validation.ts`           | 335   | `domain/validation/forms.ts`        | 🟡 MEDIUM | Form validation rules         |
| `vrGenerator.ts`          | 381   | `domain/templates/vr.ts`            | 🟢 LOW    | Depends on dates, phone       |
| `caseSummaryGenerator.ts` | 527   | `domain/templates/summary.ts`       | 🟢 LOW    | Depends on dates, cases       |
| `financialFormatters.ts`  | 68    | `domain/financials/formatters.ts`   | 🟢 LOW    | Small, self-contained         |
| `verificationStatus.ts`   | 99    | `domain/financials/verification.ts` | 🟢 LOW    | Status mapping                |

### Migration Strategy

**Phase A: Foundation (Jan 9-10)**

1. `dateFormatting.ts` → `domain/common/dates.ts` - Core date utilities used everywhere
2. `phoneFormatter.ts` → `domain/common/phone.ts` - Phone formatting

**Phase B: Standalone Logic (Jan 13-14)**  
3. `avsParser.ts` → `domain/avs/parser.ts` - Self-contained parsing 4. `validation.ts` → `domain/validation/forms.ts` - Form validation rules

**Phase C: Templates (Jan 15-17)** 5. `vrGenerator.ts` → `domain/templates/vr.ts` - VR template rendering 6. `caseSummaryGenerator.ts` → `domain/templates/summary.ts` - Summary generation

**Phase D: Financial Polish (Jan 17-19)** 7. `financialFormatters.ts` → `domain/financials/formatters.ts` 8. `verificationStatus.ts` → `domain/financials/verification.ts`

### Migration Checklist (per file)

- [ ] Create new file in `domain/` with same exports
- [ ] Update all imports across codebase
- [ ] Move tests to `domain/*/__tests__/`
- [ ] Delete original file from `utils/`
- [ ] Run full test suite to verify

---

## 🗂️ Deferred Work

### Phase 5: Navigation & Context Flow (Moved to Week 3)

- [ ] Scroll/tab state preservation
- [ ] Breadcrumb navigation
- [ ] Dashboard keyboard shortcuts
- [ ] Quick Note popover

---

## 📚 Related Documents

- [Feature Catalogue](feature-catalogue.md) - Complete feature inventory
- [Project Structure Guidelines](project-structure-guidelines.md) - Architecture patterns
- [Week 1 Domain Layer Plan](WEEK1_DOMAIN_LAYER_PLAN.md) - Original domain planning
- [December 2025 Roadmap](archive/2025/ROADMAP_DEC_2025.md) - Previous month

---

_Last updated: January 9, 2026_
