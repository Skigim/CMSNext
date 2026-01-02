# CMSNext Roadmap - January 2026

**Report Date:** January 2, 2026  
**Branch:** dev  
**Focus:** Scalability, Domain Architecture, and Data Intelligence  
**Status:** Week 0 Complete ✅ | Week 1 Starting

---

## 🎯 January Objectives

1. **Architectural Evolution** - Establish a pure **Domain Layer** to isolate business rules from React/Persistence.
2. **UI Scalability** - Implement virtualization for lists to support 5,000+ item datasets.
3. **Data Intelligence** - Deploy a charting engine and "Predictive" widgets (Trends/Forecasting).
4. **Tech Debt Reduction** - Reduce oversized files flagged in December audit.

---

## 📅 Weekly Plan

### Week 0: Audit Response & Quick Wins (Dec 30 - Jan 1)

_Focus: Address December 2025 audit findings with low-risk extractions._

#### Refactoring Targets (from Audit)

| File                     | Current Lines | Target | Extraction                                     |
| ------------------------ | ------------- | ------ | ---------------------------------------------- |
| `AutosaveFileService.ts` | 1844          | <1200  | Extract `IndexedDBHandleStore` (~100 lines)    |
| `CaseService.ts`         | ~~1002~~ 761  | <700   | ✅ Already reduced via prior refactoring       |
| `DataManager.ts`         | 1136          | —      | Defer (thin facade, splitting adds complexity) |

#### Tasks

- [x] ~~Extract `IndexedDBHandleStore` from `AutosaveFileService.ts`~~ Done (213 lines extracted)
- [x] ~~Extract `CaseBulkOperationsService` from `CaseService.ts`~~ Already at 761 lines
- [x] ~~Add unit tests for extracted modules~~ `IndexedDBHandleStore.test.ts` added
- [x] ~~Fix 3 lint warnings (QuickCaseModal.tsx, alertsData.ts)~~ 0 lint warnings

---

### Week 1: The Domain Core (Jan 2-8)

_Focus: Establishing the new architectural pattern without breaking the app._

**Detailed plan:** [WEEK1_DOMAIN_LAYER_PLAN.md](WEEK1_DOMAIN_LAYER_PLAN.md)

#### Day 1: Cleanup & Prep

- [x] ~~Delete `prototypeCaseInfoForm.tsx` (1001 lines dead code)~~ Already deleted
- [x] ~~Document hook overlap: `useFinancialItems.ts` vs `useFinancialItemFlow.ts`~~ See WEEK1 plan
- [x] ~~Define Domain pattern (functional, not OOP)~~ See WEEK1 plan + `.github/agents/DOMAIN.md`

#### Day 2-3: Domain Structure

- [x] ~~Create `domain/financials/` directory~~ Structure ready (moved from `src/domain/` to `domain/` to match `@/` alias)
- [x] ~~Extract `validateFinancialItem()` from `useFinancialItemFlow.ts`~~ Done with 14 tests
- [ ] Extract `findDuplicateIndices()` from `useCategoryEditorState.ts`
- [x] ~~Add tests for new domain functions~~ 14 tests for validation

**Identified Extraction Candidates (from codebase audit):**

| Priority | Source File                 | Logic                       | Target                            | Status  |
| -------- | --------------------------- | --------------------------- | --------------------------------- | ------- |
| P0       | `useFinancialItemFlow.ts`   | Form validation rules       | `domain/financials/validation.ts` | ✅ Done |
| P0       | `useCategoryEditorState.ts` | Duplicate detection         | `domain/validation/duplicates.ts` | Pending |
| P1       | `useCaseListOperations.ts`  | Case filtering (~100 lines) | `domain/cases/filtering.ts`       | Pending |
| P2       | `AlertSection.tsx`          | Alert due date sorting      | `domain/alerts/sorting.ts`        | Pending |

#### Day 4-5: Integration & Documentation

- [x] ~~Wire `useFinancialItemFlow` to use domain validation~~ Done
- [ ] Update `project-structure-guidelines.md` with Domain Layer rules
- [ ] Verify no regressions (586 tests passing ✅)

---

### Week 2: UI Scalability & Virtualization (Jan 9-15)

_Focus: Rendering performance for large datasets._

#### Prep Work

- [ ] Profile `CaseList` rendering time with 5,000 mock cases.
- [ ] Audit `CaseCard` for expensive re-renders.

#### Features

- [ ] **Virtualization Engine:** Implement `react-window` or `tanstack-virtual` for the main Case List.
- [ ] **Windowing Hooks:** Create `useVirtualWindow` to manage scroll state and item measurement.
- [ ] **Performance Monitor:** Add "Render Count" and "FPS" to the Debug/Diagnostics panel.

#### Refactoring & Polish

- [ ] Ensure "Bulk Actions" (multi-select) works seamlessly with virtualized items (items outside the DOM).

---

### Week 3: Visual Intelligence (Jan 16-22)

_Focus: Moving from "Tracking" to "Insights"._

#### Prep Work

- [ ] Evaluate charting libraries (Recharts is recommended for React/Tailwind compatibility).

#### Features

- [ ] **Analytics Engine:** Create `useAnalyticsData` hook to aggregate domain data for charts.
- [ ] **Trend Widget:** "Assets over Time" line chart (using Historical Financial Data).
- [ ] **Distribution Widget:** "Case Status" pie/donut chart with drill-down interaction.
- [ ] **Forecast Widget:** Simple linear projection of "Spend-down" completion dates.

#### Refactoring & Polish

- [ ] Add unit tests for analytics aggregators.
- [ ] Update Feature Catalogue with new "Analytics" section.

---

### Week 4: Polish & Buffer (Jan 23-31)

_Focus: Integration testing and documentation._

#### Tasks

- [ ] End-to-end testing of Domain → Service → UI flow.
- [ ] Performance regression testing (ensure no slowdowns from architecture changes).
- [ ] Documentation updates for new patterns.
- [ ] Plan February roadmap.

---

## 📊 Success Metrics

| Metric                       | Start | Week 0  | Week 1 | Week 2 | Week 3 | Target |
| ---------------------------- | ----- | ------- | ------ | ------ | ------ | ------ |
| Business Logic Coverage      | 100%  | 100% ✅ |        |        |        | 100%   |
| Max Renderable Items (60fps) | ~100  |         |        | 5000+  |        | 5000+  |
| Logic in Components/Hooks    | High  |         | Med    | Low    | Low    | Low    |
| New Analytics Widgets        | 0     |         |        |        | 3      | 3      |
| Test count                   | 538   | 572 ✅  |        |        |        | 600+   |
| AutosaveFileService.ts lines | 1875  | 1844    |        |        |        | <1200  |
| CaseService.ts lines         | 1002  | 761 ✅  |        |        |        | <700   |
| Lint warnings                | 3     | 0 ✅    |        |        |        | 0      |

---

## 🔴 Priority by Week

### Week 1 - P0 (Architecture)

1. Establish `src/domain` structure.
2. Port first major module (Financials) to Domain pattern.
3. Decouple Service Layer from direct logic (Service becomes coordinator).

### Week 2 - P0 (Scalability)

1. Virtualize Case List.
2. Optimize bulk selection performance.

### Week 3 - P0 (Insights)

1. Integrate Charting Library.
2. Ship Trend & Distribution widgets.

---

## 🚫 Carried Over from December

- [x] ~~Dialog a11y warnings~~ - Fixed Dec 22
- [x] ~~Password input form wrapper~~ - Fixed Dec 22
- [ ] **File permission recovery flow** - Surface reconnect UI on permission loss

---

## 📋 Paper Cuts Backlog (Dec 22 Export)

| Issue                                          | Priority | Target Week |
| ---------------------------------------------- | -------- | ----------- |
| ~~Alert optimistic updates inconsistent~~      | ~~P1~~   | ✅ Done     |
| ~~Financial item history/verification sync~~   | ~~P1~~   | ✅ Done     |
| ~~Alerts in popover (like notes)~~             | ~~P2~~   | ✅ Done     |
| Consolidate action log per case                | P3       | Week 3      |
| Remove reports tab, add filtering to Case List | P3       | Week 3      |

---

## � Out of Scope (January)

| Item                    | Notes                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| **PWA Infrastructure**  | Service worker, manifest, install prompt, update flow. Target Chrome/Edge only. Revisit February+. |
| **Tauri Desktop Build** | Native app wrapper. Depends on PWA work being complete first.                                      |

---

## �📝 Notes

### The Domain Layer Shift

Moving to a Domain Layer means our `Services` (e.g., `CaseService`) will transition from _containing_ logic to _orchestrating_ it.

- **Before:** Service calculates eligibility and saves.
- **After:** Service loads Entity, Entity calculates eligibility, Service saves result.

This allows us to test the "Eligibility" logic in isolation without mocking the FileSystem.

### Layer Responsibilities (January Target)

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer (Components)                                  │
│  - Renders data, handles user input                     │
│  - Calls Hooks, never Services directly                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Hooks Layer                                            │
│  - React state management                               │
│  - Delegates to Services                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Service Layer (DataManager + Services)                 │
│  - Orchestrates operations                              │
│  - Loads/saves via FileStorageService                   │
│  - Delegates calculations to Domain                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Domain Layer (NEW)                                     │
│  - Pure business logic, no I/O                          │
│  - Entities, Value Objects, Use Cases                   │
│  - Fully testable without mocks                         │
└─────────────────────────────────────────────────────────┘
```

### Virtualization Strategy

For lists with 5,000+ items:

1. **react-window** - Lightweight, battle-tested
2. **@tanstack/virtual** - More features, newer API

Decision point: Week 2 prep work will benchmark both.

---

**Prepared by:** GitHub Copilot  
**Last updated:** January 2, 2026
