# Test Suite Architecture Audit

**Generated:** January 13, 2026  
**Scope:** `src/test/*`, `**/*.test.ts`, `**/*.test.tsx`  
**Objective:** Align test suite with refactored architecture

---

## Summary Table

| Category                         | Issue Count            | Severity  | Status         |
| -------------------------------- | ---------------------- | --------- | -------------- |
| Obsolete localStorage Mocks      | 3 files, 19+ usages    | 🔴 High   | Needs Refactor |
| `any` Type Usage                 | 11 files, 49 instances | 🟠 Medium | Needs Refactor |
| Loose Assertions (`toBeDefined`) | 9 files, 44 instances  | 🟡 Low    | Needs Review   |
| Loose Assertions (`toBeTruthy`)  | 1 file, 3 instances    | 🟡 Low    | Needs Review   |
| Console Noise in Tests           | 0 instances            | 🟢 Clean  | OK             |
| Missing Test Coverage            | 4 utilities            | 🔴 High   | Needs Creation |
| Skipped/`.only` Tests            | 0 instances            | 🟢 Clean  | OK             |

---

## 1. Obsolete Mocks (Zombie Tests)

### Issue

Tests directly access `localStorage.getItem`/`localStorage.setItem` instead of mocking the new `utils/localStorage.ts` adapter.

### Affected Files

| File                                                                                   | Line                                                | Usage Type                              |
| -------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------- |
| [useCaseListPreferences.test.ts](__tests__/hooks/useCaseListPreferences.test.ts#L77)   | 77, 98, 127, 147, 164, 183, 205, 219, 241, 272      | Direct `localStorage.getItem`/`setItem` |
| [useAlertListPreferences.test.ts](__tests__/hooks/useAlertListPreferences.test.ts#L73) | 73, 96, 113, 127, 141, 159, 177, 190, 211, 230, 261 | Direct `localStorage.getItem`/`setItem` |
| [CaseListCopy.test.tsx](__tests__/components/CaseListCopy.test.tsx#L28)                | 28                                                  | Direct `window.localStorage.setItem`    |

### Recommendation

These tests should mock the `LocalStorageAdapter` from `utils/localStorage.ts` instead of directly manipulating `window.localStorage`. This aligns with the architecture where:

- Tests mock the **Adapter**, not the **window object**
- Allows testing adapter behavior (e.g., serialization, error handling) separately

---

## 2. Deprecated Patterns

### 2.1 Strict Types: `any` Usage in Tests

**Total:** 49 instances across 11 test files

#### By File

| File                                                                                    | Count | Context                          |
| --------------------------------------------------------------------------------------- | ----- | -------------------------------- |
| [CaseDetails.test.tsx](components/__tests__/CaseDetails.test.tsx)                       | 11    | Mock component props             |
| [AutosaveFileService.test.ts](__tests__/AutosaveFileService.test.ts)                    | 10    | Private member access            |
| [autosaveStatus.test.tsx](__tests__/integration/autosaveStatus.test.tsx)                | 5     | globalThis test driver           |
| [CaseWorkspace.test.tsx](__tests__/components/app/CaseWorkspace.test.tsx)               | 5     | Mock component props             |
| [AlertBadge.test.tsx](__tests__/components/AlertBadge.test.tsx)                         | 4     | Mock component props             |
| [AppLoadingState.test.tsx](__tests__/components/app/AppLoadingState.test.tsx)           | 4     | Mock component props             |
| [IndexedDBHandleStore.test.ts](__tests__/utils/IndexedDBHandleStore.test.ts)            | 3     | IndexedDB mock                   |
| [alertsCsvParser.test.ts](__tests__/utils/alerts/alertsCsvParser.test.ts)               | 2     | Partial mock objects             |
| [phone.test.ts](domain/common/__tests__/phone.test.ts)                                  | 2     | Null/undefined edge case testing |
| [AlertsService.test.ts](__tests__/services/AlertsService.test.ts)                       | 1     | Partial case record mock         |
| [ConnectionOnboarding.test.tsx](__tests__/components/app/ConnectionOnboarding.test.tsx) | 1     | Mock component props             |
| [AppNavigationShell.test.tsx](__tests__/components/app/AppNavigationShell.test.tsx)     | 1     | Mock component props             |

#### Common Patterns to Address

1. **Mock Component Props** (Most Common)

   ```typescript
   // ❌ Current
   Button: ({ children, onClick, ...props }: any) => ...

   // ✅ Should be
   Button: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: () => void }>) => ...
   ```

2. **Private Member Access**

   ```typescript
   // ❌ Current
   (service as any).directoryHandle = mockDirectoryHandle;

   // ✅ Should expose test helpers or use dependency injection
   ```

3. **Partial Mock Objects**

   ```typescript
   // ❌ Current
   { caseRecord: { mcn } as any }

   // ✅ Should use factory functions from test fixtures
   createMockCase({ mcn: "12345" })
   ```

### 2.2 Loose Assertions: `toBeDefined()`

**Total:** 44 instances across 9 test files

| File                                                                               | Count | Examples                                     |
| ---------------------------------------------------------------------------------- | ----- | -------------------------------------------- |
| [categoryConfigMigration.test.ts](__tests__/utils/categoryConfigMigration.test.ts) | 17    | `expect(result.find(...)).toBeDefined()`     |
| [alertsCsvParser.test.ts](__tests__/utils/alerts/alertsCsvParser.test.ts)          | 6     | `expect(result).toBeDefined()`               |
| [FinancialsService.test.ts](__tests__/services/FinancialsService.test.ts)          | 5     | `expect(result.amountHistory).toBeDefined()` |
| [encryption.test.ts](__tests__/utils/encryption.test.ts)                           | 5     | `expect(result.payload).toBeDefined()`       |
| [storage.test.ts](__tests__/utils/constants/storage.test.ts)                       | 4     | `expect(STORAGE_CONSTANTS).toBeDefined()`    |
| [validation.test.ts](domain/financials/__tests__/validation.test.ts)               | 3     | `expect(result.errors.field).toBeDefined()`  |
| [setup.test.tsx](__tests__/setup.test.tsx)                                         | 3     | Setup verification tests                     |
| [parser.test.ts](domain/avs/__tests__/parser.test.ts)                              | 2     | `expect(item.dateAdded).toBeDefined()`       |
| [CaseDetails.test.tsx](components/__tests__/CaseDetails.test.tsx)                  | 1     | `expect(latestProps).toBeDefined()`          |

**Recommendation:** Replace with strict equality checks:

```typescript
// ❌ Loose
expect(result.find((s) => s.name === "Active")).toBeDefined();

// ✅ Strict
expect(result.find((s) => s.name === "Active")).toEqual(
  expect.objectContaining({ name: "Active", colorSlot: expect.any(String) })
);
```

### 2.3 Loose Assertions: `toBeTruthy()`

**Total:** 3 instances in 1 file

| File                                                              | Line | Context                                            |
| ----------------------------------------------------------------- | ---- | -------------------------------------------------- |
| [AlertsService.test.ts](__tests__/services/AlertsService.test.ts) | 103  | `expect(result?.resolvedAt).toBeTruthy()`          |
| [AlertsService.test.ts](__tests__/services/AlertsService.test.ts) | 137  | `expect(result?.resolvedAt).toBeTruthy()`          |
| [AlertsService.test.ts](__tests__/services/AlertsService.test.ts) | 251  | `expect(result.alerts[0].resolvedAt).toBeTruthy()` |

**Recommendation:** Assert specific timestamp format:

```typescript
// ❌ Loose
expect(result?.resolvedAt).toBeTruthy();

// ✅ Strict
expect(result?.resolvedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
// or
expect(typeof result?.resolvedAt).toBe("string");
```

### 2.4 Console Noise

**Status:** ✅ Clean

No `console.log` or `console.error` calls found within test blocks.

---

## 3. Missing Test Coverage

### Utilities Without Tests

| File                        | Exists | Test File | Status      |
| --------------------------- | ------ | --------- | ----------- |
| `utils/formatFreshness.ts`  | ✅     | ❌ None   | **Missing** |
| `utils/textUtils.ts`        | ✅     | ❌ None   | **Missing** |
| `utils/localStorage.ts`     | ✅     | ❌ None   | **Missing** |
| `hooks/useDebouncedSave.ts` | ✅     | ❌ None   | **Missing** |
| `hooks/useDataSync.ts`      | ✅     | ❌ None   | **Missing** |

### Coverage Notes

- **formatFreshness.ts** (~85 lines): Pure function, easily testable with time mocking
- **textUtils.ts** (~70 lines): Pure functions (`normalizeString`, `isEmpty`), easily testable
- **localStorage.ts** (~165 lines): Adapter pattern, needs mock strategy for `window.localStorage`
- **useDebouncedSave.ts**: React hook with timing, needs `vi.useFakeTimers()`
- **useDataSync.ts**: React hook with dependencies, needs context mocking

---

## 4. Skipped Tests

**Status:** ✅ Clean

No instances of:

- `it.skip()`
- `describe.skip()`
- `test.skip()`
- `.only()`
- `it.todo()`

---

## Prioritized Action Items

### Priority 1: High Impact (Blocking)

| #   | Action                                                     | Effort | Impact                         |
| --- | ---------------------------------------------------------- | ------ | ------------------------------ |
| 1   | Create test file for `utils/localStorage.ts`               | Medium | Enables proper adapter mocking |
| 2   | Refactor `useCaseListPreferences.test.ts` to mock adapter  | Medium | Removes 10 zombie usages       |
| 3   | Refactor `useAlertListPreferences.test.ts` to mock adapter | Medium | Removes 11 zombie usages       |

### Priority 2: Coverage Gaps

| #   | Action                                           | Effort | Impact                       |
| --- | ------------------------------------------------ | ------ | ---------------------------- |
| 4   | Create test file for `utils/formatFreshness.ts`  | Low    | Pure function, easy coverage |
| 5   | Create test file for `utils/textUtils.ts`        | Low    | Pure function, easy coverage |
| 6   | Create test file for `hooks/useDebouncedSave.ts` | Medium | Hook with timers             |
| 7   | Create test file for `hooks/useDataSync.ts`      | Medium | Hook with context            |

### Priority 3: Type Safety

| #   | Action                                                          | Effort | Impact            |
| --- | --------------------------------------------------------------- | ------ | ----------------- |
| 8   | Add proper types to mock components in `CaseDetails.test.tsx`   | Low    | 11 `any` removals |
| 9   | Add proper types to mock components in `CaseWorkspace.test.tsx` | Low    | 5 `any` removals  |
| 10  | Refactor `AutosaveFileService.test.ts` private access patterns  | Medium | 10 `any` removals |

### Priority 4: Assertion Quality

| #   | Action                                                       | Effort | Impact        |
| --- | ------------------------------------------------------------ | ------ | ------------- |
| 11  | Replace `toBeDefined()` in `categoryConfigMigration.test.ts` | Low    | 17 assertions |
| 12  | Replace `toBeTruthy()` in `AlertsService.test.ts`            | Low    | 3 assertions  |
| 13  | Replace `toBeDefined()` in remaining files                   | Medium | 27 assertions |

---

## Test File Inventory

### Existing Test Files (by directory)

```
__tests__/
├── AutosaveFileService.test.ts
├── setup.test.tsx
├── components/
│   ├── AlertBadge.test.tsx
│   ├── CaseList.test.tsx
│   ├── CaseListCopy.test.tsx
│   ├── CaseStatusBadge.test.tsx
│   ├── Dashboard.test.tsx
│   ├── IntakeChecklistView.test.tsx
│   ├── QuickActionsBar.test.tsx
│   ├── Settings.test.tsx
│   ├── app/ (4 tests)
│   ├── common/
│   ├── diagnostics/
│   ├── error/
│   ├── figma/
│   └── financial/
├── contexts/
│   └── ThemeContext.test.tsx
├── domain/
│   └── dashboard/
├── hooks/
│   ├── useAlertListPreferences.test.ts
│   ├── useAlertsCsvImport.test.ts
│   ├── useAppViewState.test.ts
│   ├── useCaseListPreferences.test.ts
│   ├── useFileDataSync.test.ts
│   ├── useNavigationFlow.test.ts
│   ├── usePinnedCases.test.ts
│   ├── useRecentCases.test.ts
│   └── useTodaysWork.test.ts
├── integration/
│   └── autosaveStatus.test.tsx
├── services/
│   ├── AlertsService.test.ts
│   ├── CaseBulkOperationsService.test.ts
│   └── FinancialsService.test.ts
└── utils/
    ├── IndexedDBHandleStore.test.ts
    ├── activityReport.test.ts
    ├── alerts/
    ├── caseSummaryGenerator.test.ts
    ├── categoryConfigMigration.test.ts
    ├── clickToCopy.test.ts
    ├── constants/
    ├── csvParser.test.ts
    ├── encryption.test.ts
    ├── featureFlags.test.ts
    ├── fileStorageErrorReporter.test.ts
    ├── performanceTracker.test.ts
    └── withToast.test.ts
```

---

## Appendix: Quick Reference

### New Adapter Mock Pattern

```typescript
// __tests__/__mocks__/localStorage.ts
import { vi } from "vitest";

export const mockLocalStorageAdapter = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  hasLocalStorage: vi.fn().mockReturnValue(true),
};

vi.mock("@/utils/localStorage", () => ({
  createLocalStorageAdapter: () => mockLocalStorageAdapter,
  hasLocalStorage: () => true,
}));
```

### Strict Assertion Patterns

```typescript
// Instead of toBeDefined()
expect(result).toEqual(expect.objectContaining({ ... }));
expect(result).toHaveProperty("key", expectedValue);

// Instead of toBeTruthy()
expect(result).toBe(true);
expect(result).toMatch(/pattern/);
expect(typeof result).toBe("string");
```
