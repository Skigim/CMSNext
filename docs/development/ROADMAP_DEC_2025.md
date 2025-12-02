# CMSNext Roadmap - December 2025

**Report Date:** December 2, 2025  
**Branch:** main (stable)  
**Tests:** 269/269 passing ✅  
**Build:** Production-ready ✅  
**Average Feature Rating:** 76.5/100

---

## 🎯 December Objectives

1. **Code Quality Sprint** - Reduce hook complexity, fix anti-patterns
2. **Feature Completion** - Ship relationships feature properly
3. **Testing & Stability** - Establish performance baselines

---

## 📅 Weekly Plan

### Week 1: Hook Refactoring Sprint (Dec 2-8) ✅ COMPLETE

**Goal:** Reduce 4 hooks from >200 lines to ≤200 lines each

| Hook                | Before | After | Extracted                                   |
| ------------------- | ------ | ----- | ------------------------------------------- |
| `useNavigationFlow` | 424    | 125   | `useNavigationLock`, `useNavigationActions` |
| `useConnectionFlow` | 413    | 145   | `useConnectionHandlers`                     |
| `useCaseManagement` | 350    | 77    | `useCaseOperations`                         |
| `useAlertsFlow`     | 289    | 98    | `useAlertResolve`                           |

**Additional:** Created `CaseOperationsService` for pure business logic separation.

**Deliverables:**

- [x] 4 refactored hooks under 200 lines each
- [x] All 269 tests passing
- [x] No functionality regression
- [x] PR #87 merged to main

---

### Week 2: Anti-Pattern Fix + Relationships (Dec 9-15)

**Goal:** Fix FinancialItemModal anti-pattern, complete relationships feature

#### FinancialItemModal Refactor

- [ ] Extract business logic to `useFinancialItemFlow` hook
- [ ] Remove direct DataManager calls from component
- [ ] Add proper tests for extracted logic

#### Relationships Feature Completion

- [ ] Debug and verify persistence end-to-end
- [ ] Ensure relationships display in Intake tab
- [ ] Polish UI based on testing

**Deliverables:**

- [ ] FinancialItemModal using hooks exclusively (0 direct DataManager calls)
- [ ] Relationships feature fully functional
- [ ] Tests added for new functionality

---

### Week 3: Testing & Performance (Dec 16-22)

**Goal:** Establish testing baselines and accessibility coverage

#### Testing Improvements

- [ ] Add jest-axe accessibility tests for interactive components
- [ ] Add unit tests for refactored hooks
- [ ] Establish 1k+ case performance baseline

#### Dashboard Improvements (Stretch)

- [ ] Add 1-2 analytics enhancements to push Dashboard rating toward 75

**Deliverables:**

- [ ] Accessibility test coverage for key components
- [ ] Performance benchmark documented
- [ ] 260+ tests passing

---

### Week 4: Polish & Documentation (Dec 23-31)

**Goal:** Holiday week - light polish, documentation updates

- [ ] Update copilot-instructions with 200-line hook target
- [ ] Create December changelog
- [ ] Review and update feature catalogue ratings
- [ ] Plan January roadmap

---

## 📊 Success Metrics

| Metric                        | Current | December Target |
| ----------------------------- | ------- | --------------- |
| Hooks over 200 lines          | 0 ✅    | 0               |
| Components with anti-patterns | 1       | 0               |
| Test count                    | 269     | 270+            |
| Average feature rating        | 76.5    | 78+             |
| Accessibility test coverage   | Partial | Key components  |

---

## 🔴 Priority Items

### P0 - Must Complete (Week 1-2)

1. Hook refactoring (4 hooks)
2. FinancialItemModal anti-pattern fix
3. Relationships feature completion

### P1 - Should Complete (Week 3)

1. Accessibility testing additions
2. Performance baseline (1k cases)
3. Hook unit tests

### P2 - Nice to Have (Week 4)

1. Dashboard analytics improvements
2. Feature flag persistence
3. Documentation updates

---

## 🚫 Out of Scope (January+)

- Visual regression testing setup
- Release automation
- Advanced reporting features
- Real-time collaboration for notes

---

## 📝 Notes

### Lessons from November

- Service extraction was highly successful (83.5% DataManager reduction)
- Domain layer experiment was valuable learning but added complexity
- Legacy code removal streamlined codebase significantly

### Approach for December

- Focus on code quality over new features
- Ship small, test thoroughly
- Maintain 100% test pass rate throughout

---

**Prepared by:** GitHub Copilot  
**Last updated:** December 2, 2025
