# Storage Layer Audit Report

**Date:** January 13, 2026  
**Scope:** `contexts/FileStorageContext.tsx`, `utils/encryption.ts`, `types/encryption.ts`, and all direct `localStorage` usages  
**Status:** Pending fixes

---

## Executive Summary

The storage layer is generally well-architected with a clear separation between File System Access API (for case data) and localStorage (for UI preferences). However, the audit identified **15 issues** across four categories:

| Category                           | Count | Severity |
| ---------------------------------- | ----- | -------- |
| Zombie Code                        | 3     | Low      |
| Inconsistent Naming / Weak Types   | 3     | Medium   |
| Redundant Logic / Code Duplication | 3     | Medium   |
| Storage Anti-Patterns              | 4     | High     |
| Encryption-Specific Issues         | 2     | Medium   |

---

## Issues

### 🧟 Zombie Code / Unused Elements

#### 1. `useMemo` imported but underutilized in FileStorageContext.tsx

**Location:** [contexts/FileStorageContext.tsx#L1](../../contexts/FileStorageContext.tsx#L1)

**Description:** `useMemo` is imported but only used in the `useFileStorageLifecycleSelectors()` hook at the end of the file. The provider's `contextValue` object is recreated on every render.

**Impact:** Minor performance overhead; could cause unnecessary re-renders in consumers.

**Recommendation:** Wrap `contextValue` in `useMemo`.

---

#### 2. `UserProfile` type is a dead stub

**Location:** [types/encryption.ts#L8-L13](../../types/encryption.ts#L8-L13)

**Description:** `UserProfile` is defined and passed through encryption functions, but the multi-user feature it was designed for is not implemented. The profile is never persisted or used meaningfully.

**Impact:** Dead code; confuses new developers about feature scope.

**Recommendation:** Either implement multi-user or remove `UserProfile` and `users` field from `EncryptedPayload`.

---

#### 3. `PERSISTENT_FLAG_KEYS` is an empty array

**Location:** [utils/fileStorageFlags.ts#L24](../../utils/fileStorageFlags.ts#L24)

**Description:**

```typescript
const PERSISTENT_FLAG_KEYS = [] as const;
```

This makes all persistence logic in `loadPersistentFlags()` and `persistPersistentFlags()` dead code that never executes.

**Impact:** ~50 lines of code that does nothing.

**Recommendation:** Either add flags to persist or remove the persistence mechanism entirely.

---

### 🏷️ Inconsistent Naming / Weak Types

#### 4. Inconsistent return type `Promise<any>`

**Location:** [contexts/FileStorageContext.tsx#L87-91](../../contexts/FileStorageContext.tsx#L87-L91)

**Description:** Three methods use `Promise<any>`:

- `readNamedFile: (fileName: string) => Promise<any>`
- `loadExistingData: () => Promise<any>`
- `loadDataFromFile: (fileName: string) => Promise<any>`

**Impact:** Loss of type safety; consumers can't rely on TypeScript for correct usage.

**Recommendation:** Replace with `Promise<NormalizedFileData | null>` or appropriate generic.

---

#### 5. Inconsistent STORAGE_KEY naming conventions

**Locations:** Multiple files

| File                       | Key                              | Format               |
| -------------------------- | -------------------------------- | -------------------- |
| usePinnedCases.ts          | `cmsnext-pinned-cases`           | prefix-kebab         |
| useRecentCases.ts          | `cmsnext-recent-cases`           | prefix-kebab         |
| useAlertListPreferences.ts | `cmsnext-alert-list-preferences` | prefix-kebab         |
| useCaseListPreferences.ts  | `cmsnext-case-list-preferences`  | prefix-kebab         |
| shortcutStorage.ts         | `keyboard-shortcuts`             | no prefix            |
| paperCutStorage.ts         | `papercuts`                      | no prefix, no hyphen |
| fileStorageFlags.ts        | `cmsnext.fileStorageFlags`       | dot-notation         |
| ThemeContext.tsx           | `theme`                          | bare string          |

**Recommendation:** Standardize on `cmsnext-<feature-name>` format.

---

#### 6. Vague handler parameter name

**Location:** [contexts/FileStorageContext.tsx#L287](../../contexts/FileStorageContext.tsx#L287)

**Description:**

```typescript
registerDataLoadHandler(handler: (data: unknown) => void)
```

The parameter `data` is vague.

**Recommendation:** Rename to `fileData` or `loadedFileData`.

---

### 🔄 Redundant Logic / Code Duplication

#### 7. Duplicated localStorage guard pattern

**Locations:**

- [hooks/usePinnedCases.ts#L15,27](../../hooks/usePinnedCases.ts#L15)
- [hooks/useRecentCases.ts#L13,25](../../hooks/useRecentCases.ts#L13)
- [hooks/useAlertListPreferences.ts#L67,120,142](../../hooks/useAlertListPreferences.ts#L67)
- [hooks/useCaseListPreferences.ts#L85,148,176](../../hooks/useCaseListPreferences.ts#L85)
- [utils/shortcutStorage.ts#L22](../../utils/shortcutStorage.ts#L22)
- [utils/paperCutStorage.ts#L21](../../utils/paperCutStorage.ts#L21)

**Description:** The pattern below is repeated 12+ times:

```typescript
if (typeof window === "undefined" || !window.localStorage) {
  return;
}
```

**Recommendation:** Extract to shared `hasLocalStorage()` utility in `utils/localStorage.ts`.

---

#### 8. Near-identical load/save helper pairs

**Locations:**

- [hooks/usePinnedCases.ts#L14-35](../../hooks/usePinnedCases.ts#L14-L35)
- [hooks/useRecentCases.ts#L12-33](../../hooks/useRecentCases.ts#L12-L33)

**Description:** Both files have structurally identical `loadFromStorage` and `saveToStorage` functions with only the key and parsing logic differing.

**Recommendation:** Create generic `createLocalStorageAdapter<T>(key, parse, serialize)` factory.

---

#### 9. Repeated debounce-write pattern

**Locations:**

- [hooks/useAlertListPreferences.ts#L225-243](../../hooks/useAlertListPreferences.ts#L225-L243)
- [hooks/useCaseListPreferences.ts#L291-309](../../hooks/useCaseListPreferences.ts#L291-L309)

**Description:** Both hooks implement identical 300ms debounced localStorage write patterns using `useEffect` + `setTimeout`.

**Recommendation:** Extract to `useDebouncedLocalStorage(key, value, delay)` hook.

---

### ⚠️ Storage Anti-Patterns

#### 10. Direct `localStorage` access scattered across codebase

**Locations:** 10+ files

**Description:** Despite project guidelines stating "❌ No localStorage/sessionStorage", multiple files directly call `window.localStorage.getItem/setItem`:

| File                       | Purpose                |
| -------------------------- | ---------------------- |
| ThemeContext.tsx           | Theme preference       |
| usePinnedCases.ts          | Pinned case IDs        |
| useRecentCases.ts          | Recent case history    |
| useAlertListPreferences.ts | Alert list sort/filter |
| useCaseListPreferences.ts  | Case list sort/filter  |
| shortcutStorage.ts         | Keyboard shortcuts     |
| paperCutStorage.ts         | Paper cuts             |
| fileStorageFlags.ts        | UI state flags         |

**Note:** The guideline specifically prohibits localStorage for **case data**. UI preferences are acceptable, but implementation lacks a unified adapter.

**Recommendation:** Create `utils/localStorageAdapter.ts` with:

- Unified safety checks
- Consistent error handling
- Centralized key management

---

#### 11. Potential race condition in preferences hooks

**Location:** [hooks/useCaseListPreferences.ts#L313-330](../../hooks/useCaseListPreferences.ts#L313-L330)

**Description:** Multiple `setSortConfigs` calls in quick succession could result in stale state because `prev` captures state at callback creation, not execution.

**Example:**

```typescript
const setSortKey = useCallback(
  (key: CaseListSortKey) => {
    setSortKeyState(key);
    setSortConfigsState((prev) => {
      // 'prev' may be stale
      const updated = [...prev];
      // ...
    });
  },
  [sortDirection]
);
```

**Recommendation:** Use a single combined state object or `useReducer`.

---

#### 12. No batching for multiple state updates

**Location:** [hooks/useCaseListPreferences.ts#L313-330](../../hooks/useCaseListPreferences.ts#L313-L330)

**Description:** `setSortKey` updates `sortKeyState` and `sortConfigsState` separately. While React 18 auto-batches, this pattern is fragile.

**Recommendation:** Combine related state into single object or use `useReducer`.

---

#### 13. `showCompleted` filter not persisted

**Location:** [hooks/useCaseListPreferences.ts#L160-170](../../hooks/useCaseListPreferences.ts#L160-L170)

**Description:** Serialization of `filters` omits `showCompleted`:

```typescript
const serialized: SerializedPreferences = {
  sortConfigs,
  segment,
  filters: {
    statuses: filters.statuses,
    // ... other fields
    alertDescription: filters.alertDescription,
    // showCompleted is missing!
  },
};
```

**Impact:** Filter resets to default on page reload.

**Recommendation:** Add `showCompleted: filters.showCompleted` to serialization.

---

### 🔒 Encryption-Specific Issues

#### 14. Pending password stored in React state

**Location:** [contexts/EncryptionContext.tsx#L163](../../contexts/EncryptionContext.tsx#L163)

**Description:** `pendingPassword` is stored in React state. While cleared after use, it remains visible in React DevTools and memory during the session.

```typescript
const [pendingPassword, setPendingPasswordState] = useState<string | null>(
  null
);
```

**Recommendation:** Use `useRef` instead, which won't appear in DevTools and can be explicitly nullified:

```typescript
const pendingPasswordRef = useRef<string | null>(null);
```

---

#### 15. `getCurrentUser()` creates new object on every call

**Location:** [contexts/EncryptionContext.tsx#L333-339](../../contexts/EncryptionContext.tsx#L333-L339)

**Description:**

```typescript
const getCurrentUser = useCallback((): UserProfile | null => {
  if (!state.isAuthenticated) return null;
  return {
    id: state.username,
    name: state.username,
    createdAt: new Date().toISOString(), // New timestamp every call!
  };
}, [state.isAuthenticated, state.username]);
```

**Impact:** Defeats memoization; causes unnecessary re-renders if used in dependency arrays.

**Recommendation:** Cache the user profile object and only recreate when `username` changes.

---

## Recommendations Summary

### Quick Wins (Low Effort, High Value)

1. Fix `showCompleted` persistence (Issue #13)
2. Standardize STORAGE_KEY naming (Issue #5)
3. Fix `Promise<any>` return types (Issue #4)

### Medium Effort

4. Extract shared `hasLocalStorage()` utility (Issue #7)
5. Create localStorage adapter (Issue #10)
6. Use `useRef` for pending password (Issue #14)

### Larger Refactors

7. Create `useDebouncedLocalStorage` hook (Issue #9)
8. Implement or remove `UserProfile` (Issue #2)
9. Clean up `fileStorageFlags.ts` dead code (Issue #3)

---

## Files Reviewed

| File                             | Lines | Status       |
| -------------------------------- | ----- | ------------ |
| contexts/FileStorageContext.tsx  | 672   | Issues found |
| contexts/EncryptionContext.tsx   | 445   | Issues found |
| contexts/fileStorageMachine.ts   | 246   | Clean        |
| types/encryption.ts              | 119   | Issues found |
| utils/encryption.ts              | 330   | Clean        |
| utils/fileStorageFlags.ts        | 181   | Issues found |
| utils/shortcutStorage.ts         | 123   | Issues found |
| utils/paperCutStorage.ts         | 129   | Issues found |
| hooks/usePinnedCases.ts          | 91    | Issues found |
| hooks/useRecentCases.ts          | 70    | Issues found |
| hooks/useAlertListPreferences.ts | 282   | Issues found |
| hooks/useCaseListPreferences.ts  | 377   | Issues found |
| contexts/ThemeContext.tsx        | 232   | Issues found |

---

## Next Steps

1. Prioritize fixes based on severity and effort
2. Create tracking issues for each recommendation
3. Schedule fixes as part of weekly refactoring phase
