```chatagent
# Agent Instructions: Domain Layer

## Overview

The Domain Layer contains **pure business logic** isolated from React, persistence, and external dependencies. Domain functions are the most testable code in the system—they take data in, compute results, and return data out. No side effects, no I/O.

## Key Files

| File                                | Purpose                                     |
| ----------------------------------- | ------------------------------------------- |
| `domain/financials/index.ts`        | Public exports for financial module         |
| `domain/financials/validation.ts`   | Financial item form validation              |
| `utils/financialHistory.ts`         | Existing pure functions (import from here)  |

## Architecture

```

┌─────────────────────────────────────────────────────────┐
│ UI Layer (Components) │
│ - Renders data, handles user input │
│ - Calls Hooks, never Services or Domain directly │
└─────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────┐
│ Hooks Layer │
│ - React state management │
│ - Delegates to Services OR calls Domain directly │
└─────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────┐
│ Service Layer (DataManager + Services) │
│ - Orchestrates operations │
│ - Loads/saves via FileStorageService │
│ - Delegates calculations to Domain │
└─────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────┐
│ Domain Layer │
│ - Pure business logic, NO I/O │
│ - Functional approach (no classes) │
│ - Fully testable without mocks │
└─────────────────────────────────────────────────────────┘

````

## Critical Rules

1. **NO I/O** - Domain functions never read/write files, call APIs, or access storage
2. **NO React** - No hooks, no state, no context, no effects
3. **NO Side Effects** - Same input always produces same output
4. **Functional** - Pure functions only, no classes or OOP patterns
5. **Minimal Dependencies** - Import only types and other domain functions

## Patterns

### Pure Calculation Function

```typescript
// src/domain/financials/calculations.ts
import type { FinancialItem, CaseCategory } from "@/types/case";
import { getAmountForMonth } from "@/domain/financials";

/**
 * Calculate the total value of financial items in a category.
 * Pure function - no I/O, no side effects.
 *
 * @param items - Array of financial items to sum
 * @param category - Category to filter by (resources, income, expenses)
 * @param targetDate - Date for historical amount lookup (defaults to now)
 * @returns Total amount for the category
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
````

### Testing Domain Functions

```typescript
// src/domain/financials/__tests__/calculations.test.ts
import { describe, it, expect } from "vitest";
import { calculateCategoryTotal } from "../calculations";

describe("calculateCategoryTotal", () => {
  it("sums amounts for a category", () => {
    const items = [
      { id: "1", category: "resources", amount: 1000 },
      { id: "2", category: "resources", amount: 500 },
      { id: "3", category: "income", amount: 2000 },
    ];

    expect(calculateCategoryTotal(items, "resources")).toBe(1500);
  });

  it("returns 0 for empty array", () => {
    expect(calculateCategoryTotal([], "resources")).toBe(0);
  });

  it("returns 0 when no items match category", () => {
    const items = [{ id: "1", category: "income", amount: 1000 }];
    expect(calculateCategoryTotal(items, "resources")).toBe(0);
  });
});
```

## Calling Domain from Hooks

```typescript
// hooks/useFinancialSummary.ts
import { useMemo } from "react";
import { calculateCategoryTotal } from "@/domain/financials";
import { useFinancialItems } from "./useFinancialItems";

export function useFinancialSummary(caseId: string) {
  const { items } = useFinancialItems(caseId);

  // Call domain function directly - no service needed for pure calculations
  const totals = useMemo(
    () => ({
      resources: calculateCategoryTotal(items, "resources"),
      income: calculateCategoryTotal(items, "income"),
      expenses: calculateCategoryTotal(items, "expenses"),
    }),
    [items]
  );

  return { totals };
}
```

## Calling Domain from Services

```typescript
// utils/services/FinancialsService.ts
import { calculateCategoryTotal } from "@/domain/financials";

class FinancialsService {
  async getCategorySummary(caseId: string): Promise<CategorySummary> {
    const items = await this.getItemsForCase(caseId);

    // Delegate calculation to domain - service just orchestrates
    return {
      resources: calculateCategoryTotal(items, "resources"),
      income: calculateCategoryTotal(items, "income"),
      expenses: calculateCategoryTotal(items, "expenses"),
    };
  }
}
```

## Directory Structure

```
src/
└── domain/
    └── financials/
        ├── index.ts              # Public exports
        ├── calculations.ts       # Aggregate functions
        └── __tests__/
            └── calculations.test.ts
```

**Future modules (not yet created):**

- `src/domain/cases/` - Status transitions, eligibility rules
- `src/domain/alerts/` - MCN matching, alert resolution rules
- `src/domain/verification/` - VR status rules, verification logic

## What NOT to Create

- ❌ Entity classes (e.g., `class FinancialItem { ... }`)
- ❌ Repository pattern (services already handle persistence)
- ❌ Event bus / domain events
- ❌ Abstract base classes
- ❌ Value objects with methods
- ❌ Complex inheritance hierarchies

## When to Use Domain vs Service

| Use Domain When                            | Use Service When                       |
| ------------------------------------------ | -------------------------------------- |
| Pure calculation (totals, aggregates)      | Need to read/write data                |
| Data transformation                        | Orchestrating multiple operations      |
| Validation rules (pure boolean returns)    | Need DataManager or FileStorageService |
| Business rules with no I/O                 | Need to trigger UI updates             |
| Logic that needs unit testing in isolation | Need error handling with toasts        |

## Relationship to Existing Code

The domain layer builds on existing pure functions:

| Existing File                   | Domain Relationship                     |
| ------------------------------- | --------------------------------------- |
| `utils/financialHistory.ts`     | Import from, extend in domain           |
| `utils/vrGenerator.ts`          | Future: Move template logic to domain   |
| `utils/caseSummaryGenerator.ts` | Future: Move formatting logic to domain |

**Principle:** Don't move existing utils immediately. Start fresh in `src/domain/`, import what you need, and migrate later if beneficial.

```

```
