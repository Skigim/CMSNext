# CMSNext Roadmap - January 2026

**Report Date:** December 22, 2025  
**Branch:** dev (planning)  
**Focus:** Scalability, Domain Architecture, and Data Intelligence  
**Status:** Planning Phase

---

## 🎯 January Objectives

1. **Architectural Evolution** - Establish a pure **Domain Layer** to isolate business rules from React/Persistence.
2. **UI Scalability** - Implement virtualization for lists to support 5,000+ item datasets.
3. **Data Intelligence** - Deploy a charting engine and "Predictive" widgets (Trends/Forecasting).

---

## 📅 Weekly Plan

### Week 1: The Domain Core (Jan 2-8)

_Focus: Establishing the new architectural pattern without breaking the app._

**Detailed plan:** [WEEK1_DOMAIN_LAYER_PLAN.md](WEEK1_DOMAIN_LAYER_PLAN.md)

#### Day 1: Cleanup & Prep

- [ ] Delete `prototypeCaseInfoForm.tsx` (1001 lines dead code)
- [ ] Document hook overlap: `useFinancialItems.ts` vs `useFinancialItemFlow.ts`
- [ ] Define Domain pattern (functional, not OOP)

#### Day 2-3: Domain Structure

- [ ] Create `src/domain/financials/` directory
- [ ] Extract `calculateCategoryTotal()` as first domain function
- [ ] Add tests for new domain function

#### Day 4-5: Integration & Documentation

- [ ] Wire up one component to use Domain function
- [ ] Update `project-structure-guidelines.md` with Domain Layer rules
- [ ] Verify no regressions (534+ tests passing)

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

| Metric                       | Start | Week 1 | Week 2 | Week 3 | Target |
| ---------------------------- | ----- | ------ | ------ | ------ | ------ |
| Business Logic Coverage      | 100%  |        |        |        | 100%   |
| Max Renderable Items (60fps) | ~100  |        | 5000+  |        | 5000+  |
| Logic in Components/Hooks    | High  | Med    | Low    | Low    | Low    |
| New Analytics Widgets        | 0     |        |        | 3      | 3      |
| Test count                   | 534   |        |        |        | 600+   |

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

| Issue | Priority | Target Week |
|-------|----------|-------------|
| Alert optimistic updates inconsistent | P1 | Week 1 |
| Financial item history/verification sync | P1 | Week 1 |
| Alerts in popover (like notes) | P2 | Week 2 |
| Consolidate action log per case | P3 | Week 3 |
| Remove reports tab, add filtering to Case List | P3 | Week 3 |

---

## 📝 Notes

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
**Last updated:** December 22, 2025
