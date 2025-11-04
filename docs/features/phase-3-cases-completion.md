# Feature Plan: Complete Phase 3 Cases Domain Refactor

**Created:** November 2, 2025  
**Branch:** `phase-3-step-4-hook-simplification`  
**Estimated Effort:** 2-3 hours  
**Claude Review Required:** Yes

---

## 🎯 Objective

Complete the Cases domain migration to the new architecture by reducing `useCaseManagement.ts` from 165 LOC to ~50 LOC through state externalization and removing redundant logic now handled by the service layer.

---

## 📊 Current State (80% Complete)

### ✅ What's Done:

- ✅ 4 use cases implemented with 16 tests (CreateCase, UpdateCase, DeleteCase, GetAllCases)
- ✅ `CaseManagementService` with 11 tests
- ✅ `CaseServiceFactory` (166 LOC) providing facade pattern
- ✅ Hybrid architecture active via feature flags
- ✅ `useCaseManagement` hook integrated with service (165 LOC)
- ✅ Zero breaking changes to components
- ✅ All 353 tests passing

### 🎯 What's Left:

- 🔲 Reduce `useCaseManagement.ts` from 165 → ~50 LOC
- 🔲 Move state management to `ApplicationState` selectors
- 🔲 Remove redundant error handling (service layer handles this)
- 🔲 Clean up exposed state setters (`setCases`, `setError`, `setHasLoadedData`)
- 🔲 Verify all 353 tests still pass
- 🔲 Update hook tests if needed

---

## 🏗️ Implementation Plan

### Task 1: Analyze Current Hook Structure

**File:** `hooks/useCaseManagement.ts` (165 lines)

**Current Responsibilities (to audit):**

1. Local state: `cases`, `loading`, `error`, `hasLoadedData`
2. Service delegation: `loadCases`, `saveCase`, `deleteCase`, `saveNote`, `importCases`, `updateCaseStatus`
3. Error handling (possibly redundant with service layer)
4. State setters exposed to components

**Goal:** Identify which responsibilities should move to `ApplicationState` and which should stay.

### Task 2: Create ApplicationState Selectors

**File:** `application/ApplicationState.ts`

**Add selectors for:**

```typescript
// Example selectors to add or verify exist:
getCases(): Case[]
getCaseById(id: string): Case | undefined
getCasesLoading(): boolean
getCasesError(): string | null
getHasLoadedCases(): boolean
```

**If selectors already exist, document them. If not, add them.**

### Task 3: Refactor Hook to Use Selectors

**File:** `hooks/useCaseManagement.ts`

**Target Structure (~50 lines):**

```typescript
import { useCallback } from "react";
import { useCaseService } from "@/contexts/CaseServiceContext";
import { useApplicationState } from "@/application/hooks/useApplicationState";

interface UseCaseManagementReturn {
  // State from ApplicationState selectors
  cases: CaseDisplay[];
  loading: boolean;
  error: string | null;
  hasLoadedData: boolean;

  // Actions delegated to service
  loadCases: () => Promise<CaseDisplay[]>;
  saveCase: (caseData, editingCase?) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;
  saveNote: (noteData, caseId, editingNote?) => Promise<CaseDisplay | null>;
  importCases: (importedCases: CaseDisplay[]) => Promise<void>;
  updateCaseStatus: (caseId, status) => Promise<CaseDisplay | null>;
}

export function useCaseManagement(): UseCaseManagementReturn {
  const service = useCaseService();

  // Get state from ApplicationState (no local state)
  const cases = useApplicationState((state) => state.getCases());
  const loading = useApplicationState((state) => state.getCasesLoading());
  const error = useApplicationState((state) => state.getCasesError());
  const hasLoadedData = useApplicationState((state) =>
    state.getHasLoadedCases()
  );

  // Simple delegations to service (no error handling - service does it)
  const loadCases = useCallback(async () => {
    return await service.loadCases();
  }, [service]);

  const saveCase = useCallback(
    async (caseData, editingCase = null) => {
      const result = await service.saveCase(caseData, editingCase);
      // Service handles toasts and errors
    },
    [service]
  );

  const deleteCase = useCallback(
    async (caseId: string) => {
      await service.deleteCase(caseId);
      // Service handles toasts and errors
    },
    [service]
  );

  const saveNote = useCallback(
    async (noteData, caseId, editingNote = null) => {
      return await service.saveNote(noteData, caseId, editingNote);
    },
    [service]
  );

  const importCases = useCallback(
    async (importedCases) => {
      await service.importCases(importedCases);
    },
    [service]
  );

  const updateCaseStatus = useCallback(
    async (caseId, status) => {
      return await service.updateCaseStatus(caseId, status);
    },
    [service]
  );

  return {
    cases,
    loading,
    error,
    hasLoadedData,
    loadCases,
    saveCase,
    deleteCase,
    saveNote,
    importCases,
    updateCaseStatus,
  };
}
```

**Key Changes:**

- ❌ Remove all `useState` declarations
- ❌ Remove all `setCases`, `setError`, `setHasLoadedData` logic
- ❌ Remove try/catch blocks (service handles errors)
- ❌ Remove state setter exports
- ✅ Use `useApplicationState` selectors for all state
- ✅ Keep service delegations simple and thin
- ✅ Preserve the exact same interface for components

### Task 4: Verify ApplicationState Has Required State

**Files to Check:**

- `application/ApplicationState.ts`
- `application/hooks/useApplicationState.ts`

**Required State in ApplicationState:**

```typescript
class ApplicationState {
  private cases: Case[] = [];
  private casesLoading: boolean = false;
  private casesError: string | null = null;
  private hasLoadedCases: boolean = false;

  // Getters
  getCases(): Case[] { ... }
  getCasesLoading(): boolean { ... }
  getCasesError(): string | null { ... }
  getHasLoadedCases(): boolean { ... }

  // Setters (called by service layer)
  setCases(cases: Case[]): void { ... }
  setCasesLoading(loading: boolean): void { ... }
  setCasesError(error: string | null): void { ... }
  setHasLoadedCases(loaded: boolean): void { ... }
}
```

**If missing, add these to ApplicationState.**

### Task 5: Update Service Layer to Manage State

**File:** `application/services/CaseManagementService.ts`

**Ensure service methods update ApplicationState:**

```typescript
async loadCases(): Promise<CaseDisplay[]> {
  this.appState.setCasesLoading(true);
  this.appState.setCasesError(null);

  try {
    const cases = await this.getAllCasesUseCase.execute();
    const displays = cases.map(caseToLegacyCaseDisplay);

    this.appState.setCases(cases);
    this.appState.setHasLoadedCases(true);

    return displays;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to load cases';
    this.appState.setCasesError(msg);
    throw error;
  } finally {
    this.appState.setCasesLoading(false);
  }
}
```

**Verify all service methods (create, update, delete, updateStatus) update ApplicationState appropriately.**

### Task 6: Update or Verify Hook Tests

**File:** `__tests__/hooks/useCaseManagement.test.tsx` (3 tests currently)

**Test Coverage Required:**

1. ✅ Hook delegates to service correctly
2. ✅ State comes from ApplicationState selectors
3. ✅ Error handling works (via service layer)
4. 🔲 **NEW:** Verify no local state exists
5. 🔲 **NEW:** Verify state updates when ApplicationState changes

**Update tests to:**

- Mock `useApplicationState` selector
- Mock `useCaseService` return value
- Assert hook returns correct state from ApplicationState
- Assert hook calls service methods correctly
- Remove any tests for removed state setters

### Task 7: Verify Zero Breaking Changes

**Files to Check:**

- `components/case/CaseForm.tsx`
- `components/case/CaseList.tsx`
- Any component using `useCaseManagement`

**Verification:**

1. Components still import and call `useCaseManagement()` the same way
2. Return interface matches exactly (same properties)
3. All async operations still work
4. Toast notifications still appear (service layer handles)

**Run integration tests to confirm:**

```bash
npm test -- connectionFlow.test.tsx
npm test -- useCaseManagement.test.tsx
```

---

## ✅ Acceptance Criteria

### Code Quality:

- [ ] `useCaseManagement.ts` is ≤ 50 lines
- [ ] No local state (`useState`) in the hook
- [ ] No state setters exposed (`setCases`, etc.)
- [ ] No try/catch blocks in hook (service handles errors)
- [ ] All state comes from `ApplicationState` via selectors

### Functionality:

- [ ] All 353 tests still pass
- [ ] Zero breaking changes to components
- [ ] Case CRUD operations work identically
- [ ] Toast notifications still appear
- [ ] Error handling still works

### Architecture:

- [ ] Hook is a thin wrapper over service
- [ ] State management fully in `ApplicationState`
- [ ] Service layer updates state correctly
- [ ] Selectors properly typed and memoized (if needed)

### Documentation:

- [ ] Hook JSDoc updated to reflect new architecture
- [ ] Phase 3 doc updated: Cases domain 100% complete ✅

---

## 🧪 Testing Strategy

### Unit Tests:

```bash
# Hook tests
npm test -- useCaseManagement.test.tsx

# Service tests (should still pass)
npm test -- CaseManagementService.test.ts

# Use case tests (should still pass)
npm test -- domain/cases/use-cases
```

### Integration Tests:

```bash
# Full connection flow
npm test -- connectionFlow.test.tsx

# Component integration
npm test -- CaseList.test.tsx
npm test -- CaseDetails.test.tsx
```

### Full Suite:

```bash
npm test -- --run
```

**Target:** All 353 tests passing with no regressions.

---

## 🚨 Edge Cases to Handle

1. **Service Unavailable:**

   - Hook should handle when `service.isAvailable()` returns false
   - Return empty state gracefully

2. **Loading States:**

   - Ensure loading state prevents double-clicks
   - Service should set loading before/after operations

3. **Error Recovery:**

   - Service handles errors and updates ApplicationState error field
   - Hook doesn't need additional error handling

4. **Note Operations:**
   - `saveNote` might need special handling if notes aren't in ApplicationState yet
   - Consider if notes should be in ApplicationState or remain in service layer

---

## 📝 Implementation Checklist

### Phase 1: Setup (15 minutes)

- [ ] Create branch `phase-3-step-4-hook-simplification`
- [ ] Read current `useCaseManagement.ts` (165 lines)
- [ ] Read current `ApplicationState.ts`
- [ ] Document current state management approach

### Phase 2: ApplicationState Updates (30 minutes)

- [ ] Add/verify case-related state fields
- [ ] Add/verify case-related getters
- [ ] Add/verify case-related setters
- [ ] Add/verify `useApplicationState` hook works with new selectors

### Phase 3: Service Layer Updates (30 minutes)

- [ ] Update `CaseManagementService.loadCases()` to manage ApplicationState
- [ ] Update `CaseManagementService.createCaseWithFeedback()` to manage ApplicationState
- [ ] Update `CaseManagementService.updateCaseWithFeedback()` to manage ApplicationState
- [ ] Update `CaseManagementService.deleteCaseWithFeedback()` to manage ApplicationState
- [ ] Update `CaseManagementService.updateCaseStatus()` to manage ApplicationState

### Phase 4: Hook Refactor (45 minutes)

- [ ] Remove all `useState` declarations
- [ ] Replace with `useApplicationState` selectors
- [ ] Simplify all service delegations (remove error handling)
- [ ] Remove state setter exports
- [ ] Verify return interface matches original
- [ ] Count lines - should be ~50 or less

### Phase 5: Testing (45 minutes)

- [ ] Update `useCaseManagement.test.tsx` for new architecture
- [ ] Run hook tests - verify passing
- [ ] Run service tests - verify still passing
- [ ] Run use case tests - verify still passing
- [ ] Run integration tests - verify still passing
- [ ] Run full test suite - verify 353/353 passing

### Phase 6: Verification (15 minutes)

- [ ] Check components still work (no breaking changes)
- [ ] Verify toast notifications still appear
- [ ] Verify error handling still works
- [ ] Verify loading states work correctly
- [ ] Count final LOC in `useCaseManagement.ts`

---

## 🎯 Success Metrics

| Metric                     | Current | Target  | Status |
| -------------------------- | ------- | ------- | ------ |
| `useCaseManagement.ts` LOC | 165     | ≤ 50    | 🔲     |
| Local state in hook        | Yes     | No      | 🔲     |
| Tests passing              | 353/353 | 353/353 | 🔲     |
| Breaking changes           | 0       | 0       | 🔲     |
| Cases domain completion    | 80%     | 100%    | 🔲     |

---

## 📚 Reference Files

**Primary Files:**

- `hooks/useCaseManagement.ts` - Hook to refactor (165 → ~50 lines)
- `application/ApplicationState.ts` - State container to extend
- `application/services/CaseManagementService.ts` - Service to update
- `application/hooks/useApplicationState.ts` - Selector hook

**Test Files:**

- `__tests__/hooks/useCaseManagement.test.tsx` - Hook tests to update
- `__tests__/application/ApplicationState.test.ts` - State tests
- `__tests__/application/services/CaseManagementService.test.ts` - Service tests

**Documentation:**

- `docs/development/agent-prompts/phase-3-use-case-extraction.md` - Update when complete
- `docs/development/architecture-refactor-plan.md` - Reference for patterns

---

## 🔄 Post-Implementation

### Update Documentation:

1. Update Phase 3 doc: Cases domain ✅ 100% complete
2. Update hook LOC in comparison table: 165 → actual final count
3. Add completion timestamp
4. Update "Next actions" section to remove completed items

### Prepare for Financial Domain:

1. Document lessons learned from hook refactor
2. Note any ApplicationState patterns to reuse
3. Identify if same approach works for Financial/Notes
4. Update timeline estimates if effort was more/less than expected

---

## ⚠️ Known Risks

1. **State Synchronization:** ApplicationState updates must be synchronous with service operations
2. **React Rendering:** Multiple state updates might cause extra renders - use selectors wisely
3. **Note Operations:** Notes might not be in ApplicationState yet - may need temporary solution
4. **Test Mocking:** `useApplicationState` mocking might be tricky - check existing patterns

---

## 💡 Tips for Implementation

1. **Start with ApplicationState:** Get state management right first, then refactor hook
2. **One Method at a Time:** Refactor `loadCases` first, test, then move to others
3. **Keep Components Working:** Don't break the interface - components shouldn't know about changes
4. **Run Tests Frequently:** After each change, run relevant tests to catch issues early
5. **Use Existing Patterns:** Check how other hooks use `useApplicationState` for examples

---

**End of Feature Plan**

_Generated by Claude Sonnet 4.5 on November 2, 2025_  
_Ready for Codex implementation_
