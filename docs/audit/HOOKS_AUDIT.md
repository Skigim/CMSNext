# Hooks Layer Zombie Code Audit

**Date:** January 12, 2026  
**Scope:** `/workspaces/CMSNext/hooks/` (34 files)  
**Status:** Complete

---

## Summary

| Category                                   | Count | Severity     |
| ------------------------------------------ | ----- | ------------ |
| console.log statements (in code)           | 0     | -            |
| console.log statements (in JSDoc examples) | 3     | Info         |
| console.error statements                   | 21    | 🔴 Violation |
| console.warn statements                    | 5     | 🔴 Violation |
| Unused imports                             | 0     | -            |
| Unused variables                           | 0     | -            |
| Commented-out code blocks                  | 0     | -            |
| Dead code                                  | 0     | -            |

---

## 🔴 console.error Statements (21 occurrences)

Per project guidelines, production code should use the logger utility instead of console statements.

### useAVSImportFlow.ts

| Line | Code                                                                           |
| ---- | ------------------------------------------------------------------------------ |
| 156  | `console.error('Failed to fetch existing items for duplicate detection:', e);` |
| 271  | `console.error("Failed to import account:", account, itemError);`              |
| 307  | `console.error("AVS import failed:", error);`                                  |

### useAlertsCsvImport.ts

| Line | Code                                                         |
| ---- | ------------------------------------------------------------ |
| 142  | `console.error("Failed to import alerts from CSV:", error);` |

### useFinancialItems.ts

| Line | Code                                                      |
| ---- | --------------------------------------------------------- |
| 213  | `console.error('Failed to fetch financial items:', err);` |

### useCaseActivityLog.ts

| Line | Code                                                    |
| ---- | ------------------------------------------------------- |
| 145  | `console.error("Failed to load activity log", err);`    |
| 160  | `console.error("Failed to refresh activity log", err);` |

### useNotes.ts

| Line | Code                                            |
| ---- | ----------------------------------------------- |
| 175  | `console.error('Failed to fetch notes:', err);` |
| 215  | `console.error('Failed to add note:', e);`      |
| 231  | `console.error('Failed to update note:', e);`   |
| 263  | `console.error('Failed to save note:', err);`   |
| 289  | `console.error('Failed to delete note:', err);` |

### useNoteFlow.ts

| Line | Code                                                       |
| ---- | ---------------------------------------------------------- |
| 100  | `console.error("[NoteFlow] Failed to save note:", err);`   |
| 117  | `console.error("[NoteFlow] Failed to delete note:", err);` |
| 139  | `console.error("[NoteFlow] Failed to update note:", err);` |
| 165  | `console.error("[NoteFlow] Failed to create note:", err);` |

### useFinancialItemFlow.ts

| Line | Code                                                              |
| ---- | ----------------------------------------------------------------- |
| 266  | `console.error("❌ Case not found in data manager:", {...});`     |
| 275  | `console.error("❌ Error checking case existence:", checkError);` |
| 317  | `console.error("Failed to save financial item:", error);`         |
| 348  | `console.error("Failed to delete item:", err);`                   |
| 371  | `console.error("Failed to update item:", err);`                   |
| 409  | `console.error("Failed to create item:", err);`                   |

### useNavigationActions.ts

| Line | Code                                            |
| ---- | ----------------------------------------------- |
| 159  | `console.error("Failed to save case:", err);`   |
| 180  | `console.error("Failed to delete case:", err);` |

---

## 🔴 console.warn Statements (5 occurrences)

### useAlertListPreferences.ts

| Line | Code                                                            |
| ---- | --------------------------------------------------------------- |
| 111  | `console.warn("Failed to load alert list preferences", error);` |
| 137  | `console.warn("Failed to save alert list preferences", error);` |

### useCaseListPreferences.ts

| Line | Code                                                           |
| ---- | -------------------------------------------------------------- |
| 138  | `console.warn("Failed to load case list preferences", error);` |
| 171  | `console.warn("Failed to save case list preferences", error);` |

### useNoteFlow.ts

| Line | Code                                                                                    |
| ---- | --------------------------------------------------------------------------------------- |
| 89   | `console.warn("handleEditNote in useNoteFlow is not fully supported with StoredCase");` |

---

## ℹ️ console.log in JSDoc Examples (3 occurrences)

These are in documentation examples and not actual code execution, but noted for completeness:

| File                       | Line   | Context                                                                      |
| -------------------------- | ------ | ---------------------------------------------------------------------------- |
| useAlertListPreferences.ts | 189    | JSDoc example: `console.log("Filtered alerts displayed");`                   |
| useCaseActivityLog.ts      | 103    | JSDoc example: `console.log(\`Deleted ${deletedCount} entries\`);`           |
| useEncryptionFileHooks.ts  | 73, 77 | JSDoc example: `console.log("Encryption enabled");` and `console.error(...)` |

---

## ✅ Clean Categories

### Unused Imports

No unused imports detected. TypeScript compiler reports no errors.

### Unused Variables/Constants

No unused variables detected.

### Commented-Out Code Blocks

No significant commented-out code blocks found. A few short explanatory comments exist but no legacy/dead code blocks.

### Dead Code

No unreachable code detected (no code after return statements, no impossible conditions).

---

## Recommendations

### High Priority

1. **Replace all console.error/warn with logger utility**
   - Import `createLogger` from `@/utils/logger`
   - Use `logger.error()` and `logger.warn()` instead
   - This affects 10 files with 26 total occurrences

### Example Fix Pattern

```typescript
// Before
console.error("Failed to save note:", err);

// After
import { createLogger } from "@/utils/logger";
const logger = createLogger("useNotes");
// ...
logger.error("Failed to save note", {
  error: err instanceof Error ? err.message : String(err),
});
```

### Files Requiring Changes

| File                       | console.error | console.warn | Total  |
| -------------------------- | ------------- | ------------ | ------ |
| useAVSImportFlow.ts        | 3             | 0            | 3      |
| useAlertsCsvImport.ts      | 1             | 0            | 1      |
| useFinancialItems.ts       | 1             | 0            | 1      |
| useCaseActivityLog.ts      | 2             | 0            | 2      |
| useNotes.ts                | 5             | 0            | 5      |
| useNoteFlow.ts             | 4             | 1            | 5      |
| useFinancialItemFlow.ts    | 6             | 0            | 6      |
| useNavigationActions.ts    | 2             | 0            | 2      |
| useAlertListPreferences.ts | 0             | 2            | 2      |
| useCaseListPreferences.ts  | 0             | 2            | 2      |
| **Total**                  | **24**        | **5**        | **29** |

---

## Audit Methodology

1. Listed all files in `/workspaces/CMSNext/hooks/`
2. Used grep to search for `console.(log|error|warn|info|debug)` patterns
3. Read each file to verify import usage and check for dead code
4. Ran TypeScript error checker to validate no unused imports
5. Checked for large commented-out code blocks
6. Verified no unreachable code after return statements

---

## 🟡 Inconsistent Naming Conventions

**Date Added:** January 12, 2026

### Summary

| Category                                           | Count | Severity      |
| -------------------------------------------------- | ----- | ------------- |
| `err` instead of `error` in catch blocks           | 19    | 🟡 Medium     |
| Boolean variables without `is`/`has` prefix        | 7     | 🟡 Medium     |
| Vague variable names (`result`, `data`, `entries`) | 16    | 🟠 Low-Medium |
| Mixed naming (snake_case parameters)               | 2     | 🟢 Low        |

---

### 🟡 `err` Instead of `error` in Catch Blocks (19 occurrences)

Standard: Errors must be named `error`, NOT `err`.

| File                                                          | Line | Current         | Suggested Fix     |
| ------------------------------------------------------------- | ---- | --------------- | ----------------- |
| [useFinancialItemFlow.ts](hooks/useFinancialItemFlow.ts#L347) | 347  | `catch (err)`   | `catch (error)`   |
| [useFinancialItemFlow.ts](hooks/useFinancialItemFlow.ts#L370) | 370  | `catch (err)`   | `catch (error)`   |
| [useFinancialItemFlow.ts](hooks/useFinancialItemFlow.ts#L408) | 408  | `catch (err)`   | `catch (error)`   |
| [useWidgetData.ts](hooks/useWidgetData.ts#L150)               | 150  | `catch (err)`   | `catch (error)`   |
| [useConnectionFlow.ts](hooks/useConnectionFlow.ts#L131)       | 131  | `catch (err)`   | `catch (error)`   |
| [useFinancialItems.ts](hooks/useFinancialItems.ts#L212)       | 212  | `catch (err)`   | `catch (error)`   |
| [useCaseActivityLog.ts](hooks/useCaseActivityLog.ts#L139)     | 139  | `catch (err)`   | `catch (error)`   |
| [useFileDataSync.ts](hooks/useFileDataSync.ts#L127)           | 127  | `catch (err)`   | `catch (error)`   |
| [useNoteFlow.ts](hooks/useNoteFlow.ts#L99)                    | 99   | `catch (err)`   | `catch (error)`   |
| [useNoteFlow.ts](hooks/useNoteFlow.ts#L116)                   | 116  | `catch (err)`   | `catch (error)`   |
| [useNoteFlow.ts](hooks/useNoteFlow.ts#L138)                   | 138  | `catch (err)`   | `catch (error)`   |
| [useNoteFlow.ts](hooks/useNoteFlow.ts#L164)                   | 164  | `catch (err)`   | `catch (error)`   |
| [useNavigationActions.ts](hooks/useNavigationActions.ts#L158) | 158  | `catch (err)`   | `catch (error)`   |
| [useNavigationActions.ts](hooks/useNavigationActions.ts#L179) | 179  | `catch (err)`   | `catch (error)`   |
| [useNotes.ts](hooks/useNotes.ts#L174)                         | 174  | `catch (err)`   | `catch (error)`   |
| [useNotes.ts](hooks/useNotes.ts#L262)                         | 262  | `catch (err)`   | `catch (error)`   |
| [useNotes.ts](hooks/useNotes.ts#L288)                         | 288  | `catch (err)`   | `catch (error)`   |
| [useAlertsFlow.ts](hooks/useAlertsFlow.ts#L160)               | 160  | `.catch(err =>` | `.catch(error =>` |
| [useCaseActivityLog.ts](hooks/useCaseActivityLog.ts#L159)     | 159  | `.catch(err =>` | `.catch(error =>` |

---

### 🟡 Boolean Variables Without Proper Prefixes (7 occurrences)

Standard: Booleans must use `is`/`has`/`should`/`can` prefixes.

| File                                                      | Line | Current                               | Type               | Suggested Fix                             |
| --------------------------------------------------------- | ---- | ------------------------------------- | ------------------ | ----------------------------------------- |
| [useCaseManagement.ts](hooks/useCaseManagement.ts#L16)    | 16   | `loading: boolean`                    | Interface property | `isLoading: boolean`                      |
| [useCaseManagement.ts](hooks/useCaseManagement.ts#L145)   | 145  | `const [loading, setLoading]`         | useState           | `const [isLoading, setIsLoading]`         |
| [useWidgetData.ts](hooks/useWidgetData.ts#L79)            | 79   | `const [loading, setLoading]`         | useState           | `const [isLoading, setIsLoading]`         |
| [useCaseActivityLog.ts](hooks/useCaseActivityLog.ts#L29)  | 29   | `loading: boolean`                    | Interface property | `isLoading: boolean`                      |
| [useCaseActivityLog.ts](hooks/useCaseActivityLog.ts#L121) | 121  | `const [loading, setLoading]`         | useState           | `const [isLoading, setIsLoading]`         |
| [useNavigationLock.ts](hooks/useNavigationLock.ts#L9)     | 9    | `locked: boolean`                     | Interface property | `isLocked: boolean`                       |
| [useNavigationFlow.ts](hooks/useNavigationFlow.ts#L93)    | 93   | `const [sidebarOpen, setSidebarOpen]` | useState           | `const [isSidebarOpen, setIsSidebarOpen]` |

**Note:** `showConnectModal` and `showNewCaseModal` are acceptable as they describe visibility state with the `show` prefix which implies boolean.

---

### 🟠 Vague Variable Names (16 occurrences)

Standard: Avoid `data`, `result`, `item`, `temp`, `val`, `obj` - use specific descriptors.

#### `result` Without Context

| File                                                              | Line | Current Usage                                                     | Suggested Fix                                           |
| ----------------------------------------------------------------- | ---- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| [useWidgetData.ts](hooks/useWidgetData.ts#L130)                   | 130  | `const result = await dataFetcherRef.current()`                   | `const widgetData = ...`                                |
| [useAlertsCsvImport.ts](hooks/useAlertsCsvImport.ts#L119)         | 119  | `const result = await dataManager.mergeAlertsFromCsvContent(...)` | `const importResult = ...` or `const mergeResult = ...` |
| [useAutosaveStatus.ts](hooks/useAutosaveStatus.ts#L203)           | 203  | `const result = useMemo(...)`                                     | `const autosaveState = ...`                             |
| [useEncryptionFileHooks.ts](hooks/useEncryptionFileHooks.ts#L132) | 132  | `const result = await encryption.initializeEncryption(...)`       | `const initResult = ...`                                |
| [useEncryptionFileHooks.ts](hooks/useEncryptionFileHooks.ts#L159) | 159  | `const result = await encryptWithKey(...)`                        | `const encryptedData = ...`                             |
| [useEncryptionFileHooks.ts](hooks/useEncryptionFileHooks.ts#L203) | 203  | `const result = await decryptWithKey(...)`                        | `const decryptedData = ...`                             |
| [useFinancialItemFlow.ts](hooks/useFinancialItemFlow.ts#L229)     | 229  | `const result = validateFinancialItem(...)`                       | `const validationResult = ...`                          |
| [useCaseOperations.ts](hooks/useCaseOperations.ts#L80)            | 80   | `const result = await service!.loadCases()`                       | `const loadedCases = ...`                               |
| [useCaseOperations.ts](hooks/useCaseOperations.ts#L116)           | 116  | `const result = await service!.saveCase(...)`                     | `const savedCase = ...`                                 |
| [useCaseOperations.ts](hooks/useCaseOperations.ts#L144)           | 144  | `const result = await service!.deleteCase(...)`                   | `const deleteSuccess = ...`                             |
| [useCaseOperations.ts](hooks/useCaseOperations.ts#L166)           | 166  | `const result = await service!.saveNote(...)`                     | `const savedNote = ...`                                 |
| [useCaseOperations.ts](hooks/useCaseOperations.ts#L187)           | 187  | `const result = await service!.updateCaseStatus(...)`             | `const updatedCase = ...`                               |
| [useCaseOperations.ts](hooks/useCaseOperations.ts#L210)           | 210  | `const result = await service!.importCases(...)`                  | `const importedCases = ...`                             |
| [useCaseOperations.ts](hooks/useCaseOperations.ts#L230)           | 230  | `const result = await service!.deleteCases(...)`                  | `const deletedCount = ...`                              |
| [useCaseOperations.ts](hooks/useCaseOperations.ts#L254)           | 254  | `const result = await service!.updateCasesStatus(...)`            | `const updatedCount = ...`                              |
| [useCaseOperations.ts](hooks/useCaseOperations.ts#L279)           | 279  | `const result = await service!.updateCasesPriority(...)`          | `const updatedCount = ...`                              |

**Note:** `useFormValidation.ts` uses `result` in JSDoc examples (acceptable) and within validation functions where `result` is immediately destructured or returned (acceptable for temporary scope).

---

### 🟢 Interface Property Naming (Acceptable but Notable)

These are in interface/type definitions and follow common React patterns:

| File                                                 | Property            | Context                        | Assessment                         |
| ---------------------------------------------------- | ------------------- | ------------------------------ | ---------------------------------- |
| [useVRGenerator.ts](hooks/useVRGenerator.ts#L60)     | `selected: boolean` | `SelectedItem` interface       | ✅ Acceptable - part of item shape |
| [useAVSImportFlow.ts](hooks/useAVSImportFlow.ts#L17) | `selected: boolean` | `AVSAccountWithMeta` interface | ✅ Acceptable - part of item shape |

These describe the selection state of domain objects, not standalone boolean variables.

---

### Files Requiring Naming Convention Fixes

| File                      | `err` → `error` | Boolean Prefix | Vague Names | Total  |
| ------------------------- | --------------- | -------------- | ----------- | ------ |
| useFinancialItemFlow.ts   | 3               | 0              | 1           | **4**  |
| useNoteFlow.ts            | 4               | 0              | 0           | **4**  |
| useNotes.ts               | 3               | 0              | 0           | **3**  |
| useCaseOperations.ts      | 0               | 0              | 10          | **10** |
| useNavigationActions.ts   | 2               | 0              | 0           | **2**  |
| useWidgetData.ts          | 1               | 1              | 1           | **3**  |
| useCaseActivityLog.ts     | 2               | 2              | 0           | **4**  |
| useCaseManagement.ts      | 0               | 2              | 0           | **2**  |
| useConnectionFlow.ts      | 1               | 0              | 0           | **1**  |
| useFinancialItems.ts      | 1               | 0              | 0           | **1**  |
| useFileDataSync.ts        | 1               | 0              | 0           | **1**  |
| useNavigationLock.ts      | 0               | 1              | 0           | **1**  |
| useNavigationFlow.ts      | 0               | 1              | 0           | **1**  |
| useAlertsFlow.ts          | 1               | 0              | 0           | **1**  |
| useAlertsCsvImport.ts     | 0               | 0              | 1           | **1**  |
| useAutosaveStatus.ts      | 0               | 0              | 1           | **1**  |
| useEncryptionFileHooks.ts | 0               | 0              | 3           | **3**  |
| **Total**                 | **19**          | **7**          | **17**      | **43** |

---

### Example Fix Patterns

#### Error Variable Renaming

```typescript
// Before
} catch (err) {
  console.error("Failed to save:", err);
  const message = err instanceof Error ? err.message : String(err);
}

// After
} catch (error) {
  logger.error("Failed to save", { error: error instanceof Error ? error.message : String(error) });
  const message = error instanceof Error ? error.message : String(error);
}
```

#### Boolean State Renaming

```typescript
// Before
const [loading, setLoading] = useState(false);

// After
const [isLoading, setIsLoading] = useState(false);
```

#### Vague Variable Renaming

```typescript
// Before
const result = await service!.loadCases();

// After
const loadedCases = await service!.loadCases();
```

---

## 🔴 Redundant Logic Issues

**Date Added:** January 12, 2026

This section identifies duplicated code, repeated patterns, and violations of the DRY principle across the hooks layer.

---

### Summary

| Category                                    | Count | Severity       |
| ------------------------------------------- | ----- | -------------- |
| Duplicated localStorage persistence pattern | 4     | 🔴 High        |
| Repeated dataManager guard pattern          | 10+   | 🔴 High        |
| Inline business logic (formatRelativeTime)  | 1     | 🔴 High        |
| Oversized hooks (>50 lines)                 | 15    | 🟠 Medium-High |
| Duplicate toast error handling patterns     | 6     | 🟠 Medium      |
| Duplicate data refresh + sync patterns      | 5     | 🟠 Medium      |
| Redundant modal state management            | 3     | 🟡 Low-Medium  |

---

### 🔴 Duplicated localStorage Persistence Pattern (4 hooks)

**Issue:** Identical localStorage load/save/clear patterns are copy-pasted across multiple hooks.

**Files affected:**
| File | Lines | Storage Key |
|------|-------|-------------|
| [useAlertListPreferences.ts](hooks/useAlertListPreferences.ts#L62-L148) | ~90 | `cmsnext-alert-list-preferences` |
| [useCaseListPreferences.ts](hooks/useCaseListPreferences.ts#L78-L183) | ~105 | `cmsnext-case-list-preferences` |
| [usePinnedCases.ts](hooks/usePinnedCases.ts#L13-L34) | ~22 | `cmsnext-pinned-cases` |
| [useRecentCases.ts](hooks/useRecentCases.ts#L11-L32) | ~22 | `cmsnext-recent-cases` |

**Pattern duplicated:**

```typescript
// Repeated in each file:
function loadFromStorage(): T | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveToStorage(data: T): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silently fail
  }
}
```

**Consolidation approach:**

1. Create shared utility in `utils/localStorage.ts`:

```typescript
export function createLocalStorageAdapter<T>(key: string, validator?: (data: unknown) => T | null) {
  return {
    load: (): T | null => { ... },
    save: (data: T): void => { ... },
    clear: (): void => { ... },
  };
}
```

2. Use in hooks:

```typescript
const storage = createLocalStorageAdapter<AlertSortConfig>(
  "cmsnext-alert-list-preferences"
);
```

---

### 🔴 Repeated DataManager Guard Pattern (10+ occurrences)

**Issue:** The "check if dataManager is available, show error toast if not" pattern appears in nearly every hook.

**Files affected:**

| File                                                               | Line(s) | Pattern                                                    |
| ------------------------------------------------------------------ | ------- | ---------------------------------------------------------- |
| [useAVSImportFlow.ts](hooks/useAVSImportFlow.ts#L213-L225)         | 213-225 | Two separate "if (!dataManager)" blocks with toast.error   |
| [useFinancialItemFlow.ts](hooks/useFinancialItemFlow.ts#L180-L188) | 180-188 | `ensureCaseAndManager()` guard                             |
| [useFinancialItemFlow.ts](hooks/useFinancialItemFlow.ts#L247-L251) | 247-251 | Inline dataManager null check with `setFormErrors`         |
| [useFinancialItems.ts](hooks/useFinancialItems.ts#L243-L248)       | 243-248 | Repeated in 6 operations                                   |
| [useNoteFlow.ts](hooks/useNoteFlow.ts#L127-L132)                   | 127-132 | Same pattern: check null → setError → toast.error → return |
| [useNotes.ts](hooks/useNotes.ts#L207-L210)                         | 207-210 | Repeated in addNote, updateNote, deleteNote                |
| [useCaseOperations.ts](hooks/useCaseOperations.ts#L67-L73)         | 67-73   | `guardService()` pattern (good abstraction!)               |
| [useAlertsCsvImport.ts](hooks/useAlertsCsvImport.ts#L83-L86)       | 83-86   | Inline check                                               |
| [useCaseActivityLog.ts](hooks/useCaseActivityLog.ts#L205-L207)     | 205-207 | Inline check in clearReportForDate                         |
| [useFinancialItems.ts](hooks/useFinancialItems.ts#L325-L330)       | 325-330 | Amount history operations (3x same pattern)                |

**Duplicated pattern:**

```typescript
if (!dataManager) {
  const errorMsg =
    "Data storage is not available. Please check your connection.";
  setError(errorMsg);
  toast.error(errorMsg);
  return;
}
```

**Consolidation approach:**

1. `useCaseOperations.ts` already has good pattern with `guardService()`. Extract to shared utility:

```typescript
// utils/guards.ts
export function createDataManagerGuard(
  dataManager: DataManager | null,
  setError?: (msg: string) => void
): { isReady: boolean; guard: () => boolean } {
  const message =
    "Data storage is not available. Please connect to a folder first.";
  return {
    isReady: !!dataManager,
    guard: () => {
      if (!dataManager) {
        setError?.(message);
        toast.error(message);
        return false;
      }
      return true;
    },
  };
}
```

2. Refactor all hooks to use shared guard.

---

### 🔴 Inline Business Logic: formatRelativeTime

**Issue:** `formatRelativeTime()` is implemented inline in `useAutosaveStatus.ts` but this is date formatting logic that belongs in `@/domain/common`.

**File:** [useAutosaveStatus.ts](hooks/useAutosaveStatus.ts#L63-L89)

**Current inline implementation:**

```typescript
function formatRelativeTime(timestamp: number | null): string | null {
  if (!timestamp) return null;
  const diffMs = Date.now() - timestamp;
  const diffSeconds = Math.round(diffMs / 1000);
  if (diffSeconds < 10) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  // ... continues for minutes, hours, days
}
```

**Consolidation approach:**

1. Move to `domain/common/dates.ts` or create new `domain/common/formatRelativeTime.ts`
2. Export from `domain/common/index.ts`
3. Import and use in hook

**Note:** The domain layer already exports date utilities from `domain/common/dates.ts` but `formatRelativeTime` (for "Xmin ago" style) is missing.

---

### 🟠 Oversized Hooks (>50 lines) — 15 hooks

**Issue:** Per project guidelines, hooks should be 40-50 lines max. These hooks exceed that and should be split.

| Hook                                                           | Lines | Recommendation                                                  |
| -------------------------------------------------------------- | ----- | --------------------------------------------------------------- |
| [useAlertListPreferences.ts](hooks/useAlertListPreferences.ts) | 282   | Extract localStorage logic; split filter/sort state             |
| [useAlertResolve.ts](hooks/useAlertResolve.ts)                 | 214   | Already well-scoped; JSDoc is ~100 lines                        |
| [useCaseListPreferences.ts](hooks/useCaseListPreferences.ts)   | 377   | Extract localStorage logic; split into useSort + useFilter      |
| [useCaseOperations.ts](hooks/useCaseOperations.ts)             | 296   | Split by operation type (CRUD, bulk, status)                    |
| [useAVSImportFlow.ts](hooks/useAVSImportFlow.ts)               | 337   | Extract import logic to service; keep only modal state          |
| [useFinancialItemFlow.ts](hooks/useFinancialItemFlow.ts)       | 448   | Extract form validation; split modal state from CRUD            |
| [useFinancialItems.ts](hooks/useFinancialItems.ts)             | 476   | Split: useFinancialCRUD + useAmountHistory + useFinancialModal  |
| [useCategoryEditorState.ts](hooks/useCategoryEditorState.ts)   | 324   | Generic hook; acceptable size for reusability                   |
| [useAutosaveStatus.ts](hooks/useAutosaveStatus.ts)             | 318   | Extract formatRelativeTime; move status mapping to domain       |
| [useKeyboardShortcuts.ts](hooks/useKeyboardShortcuts.ts)       | 371   | Extract binding matchers to utils; chord logic to separate hook |
| [useFormValidation.ts](hooks/useFormValidation.ts)             | 320   | Generic hook; acceptable but could extract convenience hooks    |
| [useNotes.ts](hooks/useNotes.ts)                               | 319   | Split: useNoteForm (modal state) + useNoteCRUD (operations)     |
| [useCaseActivityLog.ts](hooks/useCaseActivityLog.ts)           | 248   | Extract report generation to domain (already uses domain funcs) |
| [useConnectionFlow.ts](hooks/useConnectionFlow.ts)             | 200   | Right at limit; effects could be extracted                      |
| [useNavigationFlow.ts](hooks/useNavigationFlow.ts)             | 200   | Already delegates to useNavigationActions; acceptable           |

**Priority order for refactoring:**

1. **useFinancialItems.ts** (476 lines) — Split into 3 hooks
2. **useFinancialItemFlow.ts** (448 lines) — Extract form logic
3. **useCaseListPreferences.ts** (377 lines) — Extract localStorage
4. **useKeyboardShortcuts.ts** (371 lines) — Extract utilities
5. **useAVSImportFlow.ts** (337 lines) — Move import to service

---

### 🟠 Duplicate Toast Error Handling Patterns (6 occurrences)

**Issue:** Same error → toast → setError → throw/return pattern repeated.

**Pattern appearing in:**

| File                                                               | Pattern                                      |
| ------------------------------------------------------------------ | -------------------------------------------- |
| [useFinancialItemFlow.ts](hooks/useFinancialItemFlow.ts#L316-L320) | `toast.error(errorMsg); return false;`       |
| [useFinancialItemFlow.ts](hooks/useFinancialItemFlow.ts#L348-L352) | `setError(errorMsg); toast.error(errorMsg);` |
| [useNoteFlow.ts](hooks/useNoteFlow.ts#L127-L132)                   | Same pattern                                 |
| [useNotes.ts](hooks/useNotes.ts#L209-L213)                         | `toast.error('..'); return null;`            |
| [useFinancialItems.ts](hooks/useFinancialItems.ts#L244-L248)       | Same pattern repeated 6x                     |
| [useAVSImportFlow.ts](hooks/useAVSImportFlow.ts#L213-L225)         | Same pattern with different messages         |

**Consolidation approach:**
The codebase already has `withToast()` utility in `utils/withToast.ts`. Hooks should consistently use it:

```typescript
// Already exists:
import { withToast } from "@/utils/withToast";

// Use instead of manual toast handling:
const result = await withToast(
  () => dataManager.addItem(caseId, category, data),
  {
    loading: "Adding item...",
    success: "Item added",
    error: "Failed to add item",
    setError,
    setLoading,
  }
);
```

**`useFinancialItems.ts` already uses `withToast` — good pattern. Other hooks should follow.**

---

### 🟠 Duplicate Data Refresh + Sync Patterns (5 hooks)

**Issue:** Same pattern of "watch dataChangeCount from context → refresh data" repeated.

**Pattern:**

```typescript
const dataChangeCount = useFileStorageDataChange();

useEffect(() => {
  refreshData();
}, [refreshData, dataChangeCount]);
```

**Files:**

| File                                                      | Line(s)     |
| --------------------------------------------------------- | ----------- |
| [useFinancialItems.ts](hooks/useFinancialItems.ts#L220)   | 220-222     |
| [useNotes.ts](hooks/useNotes.ts#L168-L170)                | 168-170     |
| [useCaseActivityLog.ts](hooks/useCaseActivityLog.ts#L155) | 155-159     |
| [useAlertsFlow.ts](hooks/useAlertsFlow.ts#L158-L163)      | 158-163     |
| [useWidgetData.ts](hooks/useWidgetData.ts#L101)           | 101 (usage) |

**Consolidation approach:**
Create a shared hook:

```typescript
// hooks/useDataSyncEffect.ts
export function useDataSyncEffect(refreshFn: () => Promise<void>) {
  const dataChangeCount = useFileStorageDataChange();
  useEffect(() => {
    refreshFn().catch(() => {});
  }, [refreshFn, dataChangeCount]);
}
```

---

### 🟡 Redundant Modal State Management (3 hooks)

**Issue:** Similar modal open/close + form reset patterns across hooks.

**Files:**

| File                                                            | Modal State Pattern                                        |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| [useFinancialItemFlow.ts](hooks/useFinancialItemFlow.ts#L175-L) | `itemForm: { isOpen, category, item }` + open/close        |
| [useNotes.ts](hooks/useNotes.ts#L25-L)                          | `noteForm: { isOpen, editingNote, caseId }` + open/close   |
| [useFinancialItems.ts](hooks/useFinancialItems.ts#L183-L)       | `financialModalOpen` + `editingFinancialItem` + `category` |
| [useVRGenerator.ts](hooks/useVRGenerator.ts#L86-L)              | `isOpen` + `selectedTemplateId` + open/close               |

**Consolidation approach:**
Create a generic modal state hook:

```typescript
// hooks/useModalState.ts
export function useModalState<TData = undefined>() {
  const [state, setState] = useState<{
    isOpen: boolean;
    data?: TData;
  }>({ isOpen: false });

  const open = useCallback((data?: TData) => {
    setState({ isOpen: true, data });
  }, []);

  const close = useCallback(() => {
    setState({ isOpen: false, data: undefined });
  }, []);

  return { isOpen: state.isOpen, data: state.data, open, close };
}
```

---

### 🟢 Good Patterns Already in Place

These patterns are well-implemented and should be followed by other hooks:

1. **`useCaseOperations.ts`** — Uses `guardService()` for dataManager checks
2. **`useFinancialItems.ts`** — Uses `withToast()` for operation feedback
3. **`usePinnedCases.ts` / `useRecentCases.ts`** — Delegate to domain functions for business logic
4. **`useTodaysWork.ts`** — Minimal hook, delegates to domain function (32 lines!)
5. **`useIsMounted.ts`** — Clean, reusable utility hook

---

### Priority Remediation Plan

| Priority | Issue                             | Files     | Effort |
| -------- | --------------------------------- | --------- | ------ |
| 1        | Extract localStorage adapter      | 4 hooks   | Medium |
| 2        | Create shared dataManager guard   | 10+ hooks | Medium |
| 3        | Move formatRelativeTime to domain | 1 hook    | Low    |
| 4        | Split oversized hooks (top 5)     | 5 hooks   | High   |
| 5        | Standardize on withToast()        | 6 hooks   | Low    |
| 6        | Create useDataSyncEffect          | 5 hooks   | Low    |
| 7        | Create useModalState              | 4 hooks   | Low    |

---

_Audit completed by GitHub Copilot_
