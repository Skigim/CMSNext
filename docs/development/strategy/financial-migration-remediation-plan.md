# Financial Domain Migration: Remediation Plan (PR #80)

**Date:** November 19, 2025
**Status:** ✅ Completed
**Target Audience:** Senior Architect / External LLM Reviewer
**Related PR:** [feat: Financial Domain Migration Phase D (#80)](https://github.com/Skigim/CMSNext/pull/80)

## 1. Executive Summary & Context

We have submitted PR #80, which implements Phase D of the Financial Domain Migration. This phase introduces a new Domain Layer (Entities, Use Cases) and an Infrastructure Layer (`StorageRepository`) for managing Financial Items, running in parallel with the legacy system via a "Strangler Fig" pattern.

An automated code review (CodeRabbit) has flagged **7 actionable items**, ranging from critical logic bugs to minor documentation inconsistencies. This document outlines our strategy to address these issues to ensure data integrity and type safety before merging.

**Update (Nov 19):** This plan has been reviewed by the Senior Architect and approved with specific conditions regarding fault tolerance and partial updates. All remediation steps have been implemented and verified.

---

## 2. Identified Issues & Severity

### A. Critical & Major (Must Fix)

1.  **Data Loss in `FinancialItem.applyUpdates`** (Critical)

    - **Location:** `domain/financials/entities/FinancialItem.ts`
    - **Issue:** The `applyUpdates` method spreads the `updates` object directly. Since the request DTO contains optional fields, passing `undefined` for a field (which happens when a field isn't updated) will overwrite the existing value with `undefined`, effectively erasing data.
    - **Risk:** High. Partial updates will corrupt entity state.

2.  **Unsafe Type Casting & State Management in Hooks** (Major)
    - **Location:** `hooks/useFinancialItemFlow.ts`
    - **Issue:** The hook uses `as any` to force the new Domain Entity snapshot into the Legacy UI state. It also manually reconstructs the nested `financials` object in the local state, which is brittle and duplicates logic found in `DataManager`.
    - **Risk:** Medium/High. Runtime errors if the shape mismatches; maintenance burden.

### B. Medium (Robustness & Integrity)

3.  **Silent Data Drop in Storage** (Medium)

    - **Location:** `infrastructure/storage/StorageRepository.ts`
    - **Issue:** When reading legacy data, the code casts `f.category` to a union type. If the category string doesn't match (e.g., "unknown"), the item is silently ignored and dropped from the in-memory list (and subsequently lost on save).
    - **Risk:** Medium. Potential data loss for malformed legacy data.

4.  **Unsafe Entity Reconstruction** (Medium)

    - **Location:** `infrastructure/storage/StorageRepository.ts`
    - **Issue:** The repository uses `as FinancialItem` casting when reading from storage, bypassing validation logic.
    - **Risk:** Low/Medium. Invalid data could propagate into the domain.

5.  **Missing Defensive Checks** (Medium)
    - **Location:** `infrastructure/storage/StorageRepository.ts`
    - **Issue:** Assumes `c.caseRecord.financials` and its sub-arrays always exist.
    - **Risk:** Medium. Runtime crash on malformed data.

### C. Minor (Documentation & Nitpicks)

6.  **Roadmap Inconsistency** (Minor)

    - **Location:** `docs/development/ROADMAP_STATUS_NOV_2025.md`
    - **Issue:** Status text conflicts slightly with the review packet.

7.  **Type Casting in Write Path** (Minor)
    - **Location:** `infrastructure/storage/StorageRepository.ts`
    - **Issue:** Casting to `any` when reconstructing the legacy case record.

---

## 3. Proposed Remediation Strategy

We will address these issues in the following order:

### Step 1: Fix Critical Domain Logic (Issue #1) ✅ Completed

We will modify `FinancialItem.applyUpdates` to explicitly filter out `undefined` values from the `updates` object before merging.

**Reviewer Condition (The "Partial Update" Trap):**
We must ensure that the UI sends an empty string `""` (not `undefined`) when a user clears a text field. If `undefined` is used for clearing, this filter would prevent the deletion.

- **Action:** We will verify that the form library sends `""` for cleared inputs.
- **Implementation:**

```typescript
// Proposed Fix
applyUpdates(updates: Partial<Omit<FinancialItemSnapshot, 'id' | 'caseId' | 'createdAt'>>): FinancialItem {
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, value]) => value !== undefined)
  );
  return FinancialItem.rehydrate({
    ...this.toJSON(),
    ...cleanUpdates,
    updatedAt: new Date().toISOString(),
  });
}
```

### Step 2: Harden Storage Repository (Issues #3, #4, #5) ✅ Completed

We will refactor the `readStorage` method in `StorageRepository.ts` to be defensive and type-safe.

1.  **Use `rehydrate` with Fault Tolerance:** Replace `as FinancialItem` with `FinancialItem.rehydrate(...)`.
    - **Reviewer Condition (Corruption Barrier):** We must wrap `rehydrate` in a `try-catch` block. If a single legacy item is malformed, we will log the error and skip the item rather than crashing the entire application load.
2.  **Defensive Access:** Use `const { resources = [], ... } = c.caseRecord.financials || {};` to handle missing structures.
3.  **Category Validation:** Add a check for valid categories. If a category is invalid, we will either:
    - Log a warning and skip (if strict).
    - Or map it to a default/misc category to preserve data (preferred for migration).

### Step 3: Refactor UI Hooks (Issue #2) ✅ Completed

We will clean up `useFinancialItemFlow.ts`.

1.  **Remove `as any`:** Ensure `FinancialManagementService` returns a type compatible with the UI, or map the `FinancialItem` to the legacy interface explicitly.
2.  **Simplify State Update:** Instead of manually splicing arrays, we will verify if we can simply re-fetch the specific case or use a cleaner immutable update pattern that respects the type system.

### Step 4: Documentation Updates (Issue #6) ✅ Completed

Align the Roadmap document with the current status.

---

## 4. Implementation Plan

1.  **Apply Fixes:** Implement the code changes described above.
2.  **Verify Tests:** Run `npm test` to ensure no regressions, specifically `__tests__/infrastructure/StorageRepository.test.ts` and `domain/financials/useCases`.
3.  **Manual Verification:** Verify the fix for `applyUpdates` by running a targeted test case.
4.  **Commit & Push:** Update PR #80.

## 5. Request for Review

Does this remediation plan adequately address the risks identified in the code review? Are there any other edge cases in the "Partial Update" pattern we should consider?
