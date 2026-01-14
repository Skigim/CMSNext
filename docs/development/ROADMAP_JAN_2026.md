# CMSNext Roadmap - January 2026

**Report Date:** January 14, 2026  
**Branch:** main  
**Focus:** Dashboard Transformation + Domain Layer Refactor + Priority System Enhancements  
**Status:** Week 1-2 Complete ✅ | Domain Refactor Complete ✅ | Week 3 In Progress 🔄

---

## 🎯 January Objectives

1. **Dashboard Transformation** - Transform the dashboard from a passive display into an active command center. ✅ PHASES 1-4 COMPLETE
2. **User Workflow Optimization** - Surface priority work, reduce navigation friction, enable inline actions. ✅ COMPLETE
3. **Personalization** - Allow users to customize their dashboard experience. (Phase 5 - planned)
4. **Domain Layer Refactor** - Extract pure business logic from utils/ to domain/ layer. ✅ COMPLETE
5. **Priority System Enhancements** - Dynamic weights and sortable alert priorities. ✅ COMPLETE (added mid-month)

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
- [x] Add "Return to Dashboard" breadcrumb to case detail views ✅ (already implemented in MainLayout.tsx)
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

### Week 2: Domain Layer - Phase A-F (Jan 6-12) ✅ COMPLETE

_Focus: Complete domain layer refactor - all pure logic migrated_

**Phase A: Foundation** ✅

- [x] `domain/common/dates.ts` - Date parsing, formatting, timezone handling
- [x] `domain/common/phone.ts` - Phone number formatting and validation
- [x] `domain/common/formatters.ts` - Currency, frequency display helpers
- [x] `domain/financials/history.ts` - Amount history tracking

**Phase B: Standalone Logic** ✅

- [x] `domain/avs/parser.ts` - AVS paste parsing
- [x] `domain/financials/verification.ts` - Verification status mapping
- [x] `domain/dashboard/widgets.ts` - Widget data processors

**Phase C: Alerts** ✅

- [x] `domain/alerts/types.ts` - Alert type definitions
- [x] `domain/alerts/matching.ts` - MCN normalization, alert matching

**Phase D: Templates** ✅

- [x] `domain/templates/vr.ts` - VR template rendering
- [x] `domain/templates/summary.ts` - Case summary generation

**Phase E: Sanitization & Validation** ✅

- [x] `domain/common/sanitization.ts` - XSS prevention, input sanitization
- [x] `domain/validation/forms.ts` - Zod schemas, form validation rules

**Phase F: Final Migrations** ✅

- [x] `domain/alerts/display.ts` - Alert display formatting
- [x] `domain/common/normalization.ts` - Financial item normalization
- [x] `domain/dashboard/activityReport.ts` - Activity report generation

---

### Week 3: Navigation & Polish (Jan 13-19)

_Focus: Priority enhancements, code quality, and polish_

**Completed This Week:**

- [x] **Config-Driven Priority Scoring**: Removed all hardcoded fallbacks (EXCLUDED_STATUSES, isExcludedStatus) - priority system now requires explicit config, fails open when missing (prevents silent bugs)
- [x] **2-Column Case Details Layout**: Complete restructuring from 3-column to 2-column layout for better balance
  - Eliminated IntakeColumn entirely (fields redistributed to PersonColumn and CaseColumn)
  - PersonColumn: Person data + Contact Methods (3-col grid) + Pregnancy + Marital Status + Eligibility (3-col grid: Citizenship/Residency/Aged-Disabled) + Relationships
  - CaseColumn: Application Validated + Case Identification (3-col grid: Number/Status/SSN/AVS Consent/Voter Form) + Waiver/Retro flags + Retro months input (below retro requested) + Reviews (3-col grid: VRs/Budgets/Narratives/Interfaces/AVS Submitted)
  - Removed duplicate Living Arrangement and Description fields
  - Replaced retro months checkbox grid with conditional text input (shows when retroRequested=true)
- [x] Dynamic priority weight calculation for alert types and statuses
- [x] Sortable alert types UI with shared DnD utility
- [x] Security audit findings addressed
- [x] `guardDataManager` utility for standardized null checks
- [x] `createDataManagerGuard` factory function
- [x] Code hygiene audit + refactoring (PR #95)
- [x] SimpleCategoryEditor re-render optimization fixes
- [x] localStorage mocking improvements in tests
- [x] Placeholder Palette component for templates
- [x] Sidebar open/close behavior simplified

---

### Week 4: Buffer & Planning (Jan 20-26)

_Focus: Polish, security fixes, and February planning_

- [x] Fix `hono` high severity vulnerability (npm audit fix)
- [ ] Address remaining security audit findings (see Audit section)
- [ ] Activity log auto-archiving policy
- [ ] Documentation updates
- [ ] February roadmap planning

---

## 📊 Progress Metrics

| Metric            | Current | Target    |
| ----------------- | ------- | --------- |
| Dashboard phases  | 4       | 4 ✅      |
| Domain modules    | 8       | 8 ✅      |
| Test count        | 894     | 950+      |
| Lines migrated    | ~6,356  | ~6,356 ✅ |
| utils/ re-exports | 9       | 9 ✅      |

---

## 🔧 Domain Layer Refactor ✅ COMPLETE

> **Goal:** Extract all pure business logic from `utils/` to `domain/` layer. Pure functions with no I/O, no React, fully testable.
>
> **Status:** ✅ Completed January 9, 2026

### Final Domain Structure

```
domain/                     (~6,356 lines)
├── alerts/                 # Alert matching, filtering, display
│   ├── types.ts
│   ├── matching.ts
│   ├── display.ts
│   └── index.ts
├── avs/                    # AVS file parsing
│   ├── parser.ts
│   └── index.ts
├── cases/                  # Case formatting
│   ├── formatting.ts
│   └── index.ts
├── common/                 # Shared utilities
│   ├── dates.ts            # Date parsing, formatting
│   ├── phone.ts            # Phone number formatting
│   ├── formatters.ts       # Currency, frequency
│   ├── sanitization.ts     # XSS prevention
│   ├── normalization.ts    # Data normalization
│   └── index.ts
├── dashboard/              # Dashboard logic
│   ├── priorityQueue.ts    # Priority scoring
│   ├── recentCases.ts      # Recent case tracking
│   ├── pinnedCases.ts      # Pinned case management
│   ├── widgets.ts          # Widget data processors
│   ├── activityReport.ts   # Activity report generation
│   └── index.ts
├── financials/             # Financial logic
│   ├── history.ts          # Amount history
│   ├── validation.ts       # Input validation
│   ├── calculations.ts     # Totals
│   ├── verification.ts     # Status mapping
│   └── index.ts
├── templates/              # Report templates
│   ├── vr.ts               # VR template rendering
│   ├── summary.ts          # Case summary generation
│   └── index.ts
├── validation/             # Validation rules
│   ├── forms.ts            # Zod schemas
│   ├── duplicates.ts       # Duplicate detection
│   └── index.ts
└── index.ts                # Barrel export
```

### Migrated Files (utils/ → domain/)

| Original File               | Domain Location                      | Lines |
| --------------------------- | ------------------------------------ | ----- |
| `dateFormatting.ts`         | `domain/common/dates.ts`             | 200   |
| `phoneFormatter.ts`         | `domain/common/phone.ts`             | 285   |
| `inputSanitization.ts`      | `domain/common/sanitization.ts`      | 414   |
| `dataNormalization.ts`      | `domain/common/normalization.ts`     | 94    |
| `avsParser.ts`              | `domain/avs/parser.ts`               | 309   |
| `alertsData.ts` (pure)      | `domain/alerts/matching.ts`          | 387   |
| `alertDisplay.ts`           | `domain/alerts/display.ts`           | 84    |
| `vrGenerator.ts`            | `domain/templates/vr.ts`             | 429   |
| `caseSummaryGenerator.ts`   | `domain/templates/summary.ts`        | 300   |
| `summarySectionRenderer.ts` | `domain/templates/summary.ts`        | -     |
| `validation.ts`             | `domain/validation/forms.ts`         | 387   |
| `verificationStatus.ts`     | `domain/financials/verification.ts`  | 113   |
| `widgetDataProcessors.ts`   | `domain/dashboard/widgets.ts`        | 300   |
| `activityReport.ts`         | `domain/dashboard/activityReport.ts` | 296   |

### Remaining in utils/ (I/O-dependent)

These files intentionally remain in `utils/` because they have I/O dependencies:

- **AutosaveFileService.ts** - File system I/O
- **DataManager.ts** - Service orchestration
- **alertsData.ts** - CSV parsing (Papa dependency)
- **clipboard.ts** - Browser clipboard API
- **encryption.ts** - Web Crypto API
- **csvParser.ts** - Papa CSV parsing
- **legacyMigration.ts** - File format migration
- **nightingaleMigration.ts** - Legacy data transform
- **logger.ts** - Console I/O
- **featureFlags.ts** - localStorage access

---

## �️ Audit Findings & Remediation (Jan Mid-Month)

**Security Audit completed January 13, 2026** - See [SECURITY_AUDIT.md](../audit/SECURITY_AUDIT.md)

### npm Vulnerabilities

- [x] **High:** `hono` JWT algorithm confusion vulnerability (fix available via `npm audit fix`)
- [x] ~~**ReDoS:** `@modelcontextprotocol/sdk`~~ (no longer in dependencies)
- [x] ~~**DoS:** `qs`~~ (no longer in dependencies)

### Code Quality Findings

| Priority | Finding                                | Status     |
| -------- | -------------------------------------- | ---------- |
| High     | AVS duplicate detection error handling | 📋 Planned |
| Medium   | File storage silent load failures      | 📋 Planned |
| Medium   | Template reorder optimistic UI         | 📋 Planned |
| Medium   | Encryption auth error specificity      | 📋 Planned |
| Low      | Synchronous AVS parsing                | 📋 Backlog |
| Low      | Activity log unbounded growth          | 📋 Backlog |

### Accessibility

- [x] Perform manual verification of keyboard navigation and screen reader support

## �🗂️ Deferred Work

---

## ✅ Unplanned Work Completed

The following features were delivered but not originally on the roadmap:

### Unified Template System (Week 2)

- [x] Unified template system implementation
- [x] VR generation rewired to use templates
- [x] Legacy VRScript system removed
- [x] Case summary generator migrated to templates
- [x] Drag-and-drop reordering for summary templates
- [x] Summary template editor in TemplatesPanel
- [x] Placeholder Palette component

### Priority System Enhancements (Week 3)

- [x] Dynamic weight calculation for alert types
- [x] Dynamic weight calculation for statuses
- [x] Sortable alert types UI with DnD
- [x] Alert age scoring and oldest alert utilities

### Code Quality (Week 3)

- [x] `guardDataManager` utility for standardized null checks
- [x] `createDataManagerGuard` factory function
- [x] Console.warn/error replaced with logger
- [x] Shared utilities extraction
- [x] SimpleCategoryEditor re-render optimization
- [x] localStorage adapter mocking improvements

### Filters (Week 2)

- [x] Show Completed Cases filter
- [x] Case list padding improvements

---

## 📚 Related Documents

- [Feature Catalogue](feature-catalogue.md) - Complete feature inventory
- [Project Structure Guidelines](project-structure-guidelines.md) - Architecture patterns
- [Week 1 Domain Layer Plan](WEEK1_DOMAIN_LAYER_PLAN.md) - Original domain planning
- [December 2025 Roadmap](archive/2025/ROADMAP_DEC_2025.md) - Previous month

---

_Last updated: January 14, 2026_
