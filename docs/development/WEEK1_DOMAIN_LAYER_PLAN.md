# Week 1 Deep Dive: Domain Layer Introduction

**Date:** January 2, 2026  
**Status:** Active - Day 1  
**Risk Level:** Medium-High (architectural change)

---

## 🔥 Pre-Domain Cleanup (Dec 23 or Jan 2)

**Based on Gemini code audit - verified against actual codebase.**

These items reduce noise before starting Domain Layer work:

### Immediate Actions

1. **Delete Dead Code**

   - [x] `components/forms/prototypeCaseInfoForm.tsx` (1001 lines of unused prototype) ✅ DELETED

2. **Hook Consolidation Analysis** ✅ DOCUMENTED (Jan 2, 2026)

   | Hook                      | Lines | Used By                      | Responsibility                                            |
   | ------------------------- | ----- | ---------------------------- | --------------------------------------------------------- |
   | `useFinancialItems.ts`    | 476   | `CaseDetails`, `CaseSection` | Data fetching, list state, CRUD mutations, amount history |
   | `useFinancialItemFlow.ts` | 447   | `AppContent`                 | Modal state, form state, form validation, CRUD mutations  |

   **Overlap Analysis:**

   | Operation      | useFinancialItems                               | useFinancialItemFlow                                  |
   | -------------- | ----------------------------------------------- | ----------------------------------------------------- |
   | `addItem`      | ✅ via `createFinancialItem()`                  | ✅ via `handleSaveItem()` / `handleCreateItem()`      |
   | `updateItem`   | ✅ via `updateFinancialItem()`                  | ✅ via `handleSaveItem()` / `handleBatchUpdateItem()` |
   | `deleteItem`   | ✅ via `deleteFinancialItem()`                  | ✅ via `handleDeleteItem()`                           |
   | Form state     | ❌                                              | ✅ (`formData`, `formErrors`, validation)             |
   | Modal state    | ✅ basic (`financialModalOpen`)                 | ✅ rich (`itemForm` with category)                    |
   | Amount History | ✅ full (`add/update/deleteAmountHistoryEntry`) | ❌                                                    |
   | Auto-refresh   | ✅ listens to `dataChangeCount`                 | ❌ parent refreshes                                   |
   | Grouped items  | ✅ (`groupedItems`)                             | ❌                                                    |

   **Architectural Assessment:**

   - `useFinancialItems` → **Data layer hook** - fetches/groups items, handles amount history
   - `useFinancialItemFlow` → **Form layer hook** - manages form lifecycle and validation

   **Decision:** Keep both. They serve different concerns:

   1. Components needing **item data** use `useFinancialItems`
   2. Components needing **form editing** use `useFinancialItemFlow`

   The overlap in CRUD calls is intentional - both provide convenience wrappers around DataManager.

### Gemini Findings Verified

| Finding                                          | Status          | Action                                                                 |
| ------------------------------------------------ | --------------- | ---------------------------------------------------------------------- |
| `useFinancialItemFlow.ts` overloaded (385 lines) | ✅ Confirmed    | Future refactor into `useFinancialFormState` + `useFinancialMutations` |
| `DataManager.ts` is clean Facade                 | ✅ Confirmed    | Keep as-is                                                             |
| `useWidgetData.ts` has switch statement          | ❌ Not accurate | Already uses generic `dataFetcher` pattern, no switch                  |
| `useFinancialItems.ts` redundant                 | ✅ Confirmed    | Document for future consolidation                                      |
| `prototypeCaseInfoForm.tsx` dead                 | ✅ Confirmed    | Delete                                                                 |
| `useNotes.ts` / `useNoteFlow.ts` duplication     | ⚠️ Partial      | Similar pattern, monitor for issues                                    |

---

## 🎯 The Goal

Introduce a **Domain Layer** that contains pure business logic, isolated from:

- React (no hooks, no state)
- Persistence (no file system calls)
- External dependencies (minimal imports)

The Domain Layer should be **the most testable code in the system**.

---

## ⚠️ Lessons From Previous Attempts

**What typically goes wrong with domain layer introductions:**

1. **Big Bang Rewrite** - Trying to migrate everything at once breaks the app
2. **Unclear Boundaries** - Services and Domain overlap, causing confusion
3. **Over-Engineering** - Creating abstract Entity base classes, Repositories, Event Buses
4. **Testing Duplication** - Ending up with tests in both layers covering the same logic
5. **Import Cycles** - Domain imports from Services, Services import from Domain

---

## 📊 Current Architecture Analysis

### What We Have Today

```
┌─────────────────────────────────────────────────────────┐
│  Components → Hooks → Services → FileStorageService    │
└─────────────────────────────────────────────────────────┘
```

### Where Business Logic Lives Now

| File                      | Type           | Lines | Logic                                           |
| ------------------------- | -------------- | ----- | ----------------------------------------------- |
| `financialHistory.ts`     | Pure functions | 246   | Date ranges, amount lookups, history management |
| `caseSummaryGenerator.ts` | Pure functions | 339   | Text formatting, section generation             |
| `vrGenerator.ts`          | Pure functions | 354   | Template rendering, placeholder substitution    |
| `FinancialsService.ts`    | Service class  | 556   | CRUD + some calculations                        |
| `CaseService.ts`          | Service class  | ~400  | CRUD + status logic                             |

**Key Insight:** We already have pure functions in `utils/`! The "Domain Layer" partially exists.

---

## 🧪 The Pilot: Financial Calculations

**Why Financials?**

1. `financialHistory.ts` is already pure functions with 378 lines of tests
2. Clear boundaries: amounts, dates, history entries
3. No UI coupling
4. High value: spend-down calculations would be domain logic

**What's Missing?**

- No centralized "calculate totals for a category" function
- No "spend-down projection" logic
- Amount aggregation happens in components (bad)

---

## 📁 Proposed Structure (Minimal)

```
src/
└── domain/
    └── financials/
        ├── index.ts              # Public exports
        ├── calculations.ts       # Aggregate functions (totals, projections)
        ├── types.ts              # Domain-specific types (optional)
        └── __tests__/
            └── calculations.test.ts
```

**Not creating yet:**

- `entities/` folder
- `valueObjects/` folder
- `useCases/` folder
- Base classes
- Event systems

---

## 🔧 Concrete Week 1 Tasks

### Day 1-2: Audit & Identify

- [ ] List all places where financial totals are calculated
- [ ] List all places where amount aggregation happens
- [ ] Document the "happy path" for spend-down calculation (if it exists)

### Day 3-4: Extract First Function

**Target:** Create `calculateCategoryTotal(items, category, targetDate)`

```typescript
// src/domain/financials/calculations.ts
import type { FinancialItem, CaseCategory } from "@/types/case";
import { getAmountForMonth } from "@/utils/financialHistory";

/**
 * Calculate the total value of financial items in a category.
 * Uses historical amounts if a target date is provided.
 */
export function calculateCategoryTotal(
  items: FinancialItem[],
  category: CaseCategory,
  targetDate: Date = new Date()
): number {
  return items
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + getAmountForMonth(item, targetDate), 0);
}
```

**Test:**

```typescript
// src/domain/financials/__tests__/calculations.test.ts
describe('calculateCategoryTotal', () => {
  it('sums amounts for a category', () => {
    const items: FinancialItem[] = [
      { id: '1', category: 'resources', amount: 1000, ... },
      { id: '2', category: 'resources', amount: 500, ... },
      { id: '3', category: 'income', amount: 2000, ... },
    ];
    expect(calculateCategoryTotal(items, 'resources')).toBe(1500);
  });

  it('uses historical amounts for past dates', () => {
    // ...
  });
});
```

### Day 5: Wire Up (Optional)

- [ ] Update one component to use the Domain function
- [ ] Ensure no regressions
- [ ] Document the pattern for future extractions

---

## ✅ Success Criteria for Week 1

| Criteria                                       | Target          |
| ---------------------------------------------- | --------------- |
| New `src/domain/` folder created               | Yes             |
| At least 1 pure calculation function extracted | Yes             |
| Tests for new domain function                  | 100% coverage   |
| Zero regressions in existing tests             | 534/534 passing |
| Pattern documented in guidelines               | Yes             |

---

## 🚫 Explicitly NOT Doing in Week 1

- ❌ Entity classes
- ❌ Repository pattern
- ❌ Event bus / domain events
- ❌ Migrating Services to "coordinators"
- ❌ Changing how hooks work
- ❌ Creating a full `src/domain` structure upfront

---

## 🔮 Future Weeks (If Week 1 Succeeds)

### Week 5+ (February)

1. **Verification Rules** - Extract eligibility/verification logic
2. **Case Status Logic** - Status transitions, completion rules
3. **Alert Matching** - MCN matching, case association rules

Each extraction follows the same pattern:

1. Identify pure calculation logic
2. Extract to `domain/[module]/`
3. Add exhaustive tests
4. Update consumers one at a time

---

## 📝 Decision Log

| Decision                           | Rationale                                           |
| ---------------------------------- | --------------------------------------------------- |
| Start with Financials              | Already have pure functions (`financialHistory.ts`) |
| No Entity classes                  | Over-engineering risk; functional approach simpler  |
| Keep in `src/domain/` not `utils/` | Clear separation, signals intent                    |
| One function first                 | Prove the pattern before scaling                    |

---

## 🤔 Open Questions

1. **Move `financialHistory.ts` into domain?**

   - Pro: Consolidates financial logic
   - Con: Breaking change, many import updates
   - **Decision:** Keep it for now, import from domain

2. **Types in domain or shared?**

   - Pro: Domain owns its types
   - Con: Duplication with `types/case.ts`
   - **Decision:** Use shared types, only create domain-specific if needed

3. **When do Services become "coordinators"?**
   - **Answer:** Not in January. Services continue to work as-is.
   - Domain functions are called from Services OR directly from hooks.

---

**Prepared by:** GitHub Copilot  
**Last updated:** January 2, 2026
