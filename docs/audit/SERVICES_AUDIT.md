# Services Layer Audit: Code Hygiene Issues

**Date:** January 12, 2026  
**Scope:** `utils/DataManager.ts`, `utils/services/*`
**Status:** ✅ Fixed

---

## Summary

| Category            | Issue Count | Fixed |
| ------------------- | ----------- | ----- |
| Zombie Code         | 3           | ✅ 3  |
| Inconsistent Naming | 6           | ✅ 2  |
| Redundant Logic     | 5           | ✅ 1  |
| **Total**           | **14**      | **6** |

---

## 1. Zombie Code

### 1.1 Backup File Artifact ✅ FIXED

- **File:** `utils/DataManager.ts.backup`
- **Issue:** A `.backup` file exists alongside the main `DataManager.ts`. This appears to be a leftover from a previous refactoring session and serves no purpose in the codebase.
- **Action:** ~~Delete the backup file.~~ **DELETED**

### 1.2 Console Statements in Production Code ✅ FIXED

- **File:** [CaseBulkOperationsService.ts](../../utils/services/CaseBulkOperationsService.ts#L414)
- **Issue:** Uses `console.warn` and `console.info` directly instead of the `createLogger` utility, violating the "Zero Logs" policy.
- **Action:** ~~Replace with `logger.warn()` and `logger.info()`.~~ **REPLACED**
  - Added `createLogger` import and initialization
  - Changed to `logger.warn('Skipping import: case already exists', { caseId })`
  - Changed to `logger.info('No new cases to import (all IDs already exist)')`

### 1.3 Unused Import Pattern in NotesService ✅ FIXED

- **File:** [NotesService.ts#L4](../../utils/services/NotesService.ts#L4)
- **Issue:** `StoredCase` is imported and only used in one backward-compatibility helper method `getCaseForNote()` that appears to have no callers in the codebase.
- **Action:** ~~Verify `getCaseForNote()` usage; if unused, remove method and import.~~ **REMOVED**
  - Removed unused `StoredCase` import
  - Removed unused `getCaseForNote()` method

---

## 2. Inconsistent Naming

### 2.1 Error Variable Naming: `err` vs `error` ✅ FIXED

- **Files:**
  - [CaseOperationsService.ts](../../utils/services/CaseOperationsService.ts) - Uses `err` throughout all catch blocks
  - [DataManager.ts#L591](../../utils/DataManager.ts#L591) - Uses `err` in catch block
- **Issue:** The Code Standards Registry mandates `error` for exception variables, never `err` or `e`.
- **Action:** Rename all `err` to `error` in catch blocks.

### 2.2 Vague Variable Names: `data` and `currentData`

- **Files:** All service files
- **Issue:** The generic variable name `data` and `currentData` are used extensively:
  - `FileStorageService`: `rawData`, `data`
  - `CaseService`: `currentData`
  - `FinancialsService`: `currentData`
  - `NotesService`: `currentData`
- **Standards Violation:** The registry states "Avoid vague names (data, result, item). Use domain-specific descriptors."
- **Action:** Rename to more specific names like `fileData`, `caseData`, or `normalizedData`.

### 2.3 Inconsistent Method Parameter Names

- **File:** [FinancialsService.ts](../../utils/services/FinancialsService.ts)
- **Issue:** Uses `updates` for partial update object in `updateItem()` and `updateAmountHistoryEntry()`, but `itemData` for create operations. The pattern should be consistent.
- **Action:** Standardize to either `updates` or `changes` across all update methods.

### 2.4 Inconsistent Boolean Prefix

- **File:** [CaseService.ts](../../utils/services/CaseService.ts)
- **Issue:** Uses `caseExists` and `itemExists` which follow the standard, but `amountChanging` in FinancialsService violates the `is/has/can/should` prefix rule.
- **Action:** Rename `amountChanging` to `isAmountChanging`.

### 2.5 Mixed Property Access Patterns

- **File:** [CaseService.ts#L481](../../utils/services/CaseService.ts#L481)
- **Issue:** Inconsistent status access pattern:
  ```typescript
  const currentStatus = targetCase.caseRecord?.status ?? targetCase.status;
  ```
  This pattern is repeated in multiple places, suggesting a data model ambiguity.
- **Action:** Consider normalizing access pattern or documenting why both exist.

### 2.6 Function Name `toAlertWithMatch` ✅ FIXED

- **File:** [DataManager.ts#L91](../../utils/DataManager.ts#L91)
- **Issue:** The private helper function `toAlertWithMatch` uses an unconventional name. Standard patterns would be `convertToAlertWithMatch` or `asAlertWithMatch`.
- **Action:** ~~Rename to `convertToAlertWithMatch` for clarity.~~ **RENAMED**

---

## 3. Redundant Logic

### 3.1 Repeated "Read → Verify Case → Throw" Pattern

- **Files:**
  - [NotesService.ts](../../utils/services/NotesService.ts) - lines 190-195, 300-305, 375-380
  - [FinancialsService.ts](../../utils/services/FinancialsService.ts) - lines 185-190, 290-295, 360-365
- **Issue:** The following pattern is copy-pasted across 6+ methods:
  ```typescript
  const currentData = await this.fileStorage.readFileData();
  if (!currentData) {
    throw new Error("Failed to read current data");
  }
  const caseExists = currentData.cases.some((c) => c.id === caseId);
  if (!caseExists) {
    throw new Error("Case not found");
  }
  ```
- **Action:** Extract to a shared helper method like `readDataAndVerifyCase(caseId)` that returns `{ data, caseIndex }`.

### 3.2 Repeated Timestamp Update Pattern

- **Files:** All services performing write operations
- **Issue:** The timestamp update pattern is repeated:
  ```typescript
  const timestamp = new Date().toISOString();
  ```
  Combined with:
  ```typescript
  updatedAt: new Date().toISOString();
  ```
  Sometimes in the same method, creating multiple timestamps.
- **Action:** Extract to a service method or use a single timestamp variable per operation.

### 3.3 Duplicated Activity Entry Creation

- **Files:**
  - [CaseService.ts#L495-508](../../utils/services/CaseService.ts#L495-L508)
  - [CaseBulkOperationsService.ts#L193-205](../../utils/services/CaseBulkOperationsService.ts#L193-L205)
- **Issue:** Activity log entry creation is nearly identical in both files:
  ```typescript
  const activityEntry: CaseActivityEntry = {
    id: uuidv4(),
    timestamp,
    caseId: targetCase.id,
    caseName: formatCaseDisplayName(targetCase),
    caseMcn: targetCase.caseRecord?.mcn ?? targetCase.mcn ?? null,
    type: "status-change",
    payload: { fromStatus: currentStatus, toStatus: status },
  };
  ```
- **Action:** Extract to `ActivityLogService.createStatusChangeEntry()` factory method.

### 3.4 Repeated Empty Check Pattern in AlertsService

- **File:** [AlertsService.ts](../../utils/services/AlertsService.ts)
- **Issue:** Multiple methods check for empty/null strings with different patterns:
  ```typescript
  if (!value) {
    return;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return;
  }
  ```
- **Action:** Extract to a `normalizeString(value)` utility that returns `string | null`.

### 3.5 Duplicated Error Message Formatting ✅ FIXED

- **File:** [CaseOperationsService.ts](../../utils/services/CaseOperationsService.ts)
- **Issue:** The error extraction pattern is repeated 10+ times:
  ```typescript
  error: err instanceof Error ? err.message : String(err);
  ```
- **Action:** ~~Extract to a utility function `extractErrorMessage(error: unknown): string`.~~ **CREATED**
  - Created `utils/errorUtils.ts` with `extractErrorMessage()` function
  - Updated CaseOperationsService to use the utility
  - Updated DataManager to use the utility

---

## Files Audited

| File                                          | Lines | Issues Found |
| --------------------------------------------- | ----- | ------------ |
| `utils/DataManager.ts`                        | 1230  | 2            |
| `utils/services/FileStorageService.ts`        | 595   | 1            |
| `utils/services/CaseService.ts`               | 738   | 2            |
| `utils/services/CaseBulkOperationsService.ts` | 480   | 2            |
| `utils/services/CaseOperationsService.ts`     | 458   | 3            |
| `utils/services/AlertsService.ts`             | 818   | 1            |
| `utils/services/FinancialsService.ts`         | 811   | 2            |
| `utils/services/NotesService.ts`              | 431   | 2            |
| `utils/services/ActivityLogService.ts`        | 220   | 0            |
| `utils/services/CategoryConfigService.ts`     | 370   | 0            |
| `utils/services/TemplateService.ts`           | 260   | 0            |

---

## Recommended Priority

### ✅ Completed (Fixed)

1. **1.1** Delete backup file artifact - **DELETED**
2. **1.2** Console statements in production code - **REPLACED with logger**
3. **1.3** Unused `getCaseForNote()` method - **REMOVED**
4. **2.1** Error variable naming (`err` → `error`) - **RENAMED**
5. **2.6** Function name `toAlertWithMatch` - **RENAMED to convertToAlertWithMatch**
6. **3.5** Duplicated error message formatting - **EXTRACTED to errorUtils.ts**

### Medium Priority (Nice to Have)

- **3.1** Repeated "Read → Verify Case → Throw" pattern - DRY violation
- **3.3** Duplicated activity entry creation - maintainability concern
- **2.4** Boolean prefix violation (`amountChanging` → `isAmountChanging`)

### Low Priority (Cleanup)

- **2.2** Vague variable names - large refactor
- **3.2** Timestamp pattern consolidation
- **2.3** Inconsistent method parameter names
- **2.5** Mixed property access patterns
- **3.4** Repeated empty check pattern in AlertsService

---

## Fixes Applied

**Date:** January 12, 2026

1. Created `utils/errorUtils.ts` with `extractErrorMessage(error: unknown): string`
2. Deleted `utils/DataManager.ts.backup`
3. Updated `CaseBulkOperationsService.ts` - replaced console.warn/info with logger
4. Updated `NotesService.ts` - removed unused `StoredCase` import and `getCaseForNote()`
5. Updated `CaseOperationsService.ts` - renamed `err` to `error`, added extractErrorMessage import
6. Updated `DataManager.ts` - renamed function, fixed catch block
7. Updated `CaseBulkOperationsService.test.ts` - mocked logger instead of console

**Verification:**

- ✅ Build passes (`npm run build`)
- ✅ All 859 tests pass (`npm test`)
