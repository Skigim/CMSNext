# Codex Implementation Prompt: Complete Phase 3 Cases Domain

## 📋 Task Summary

Reduce `useCaseManagement.ts` from 165 lines to ~50 lines by externalizing state to `ApplicationState` and simplifying the hook to a thin wrapper over the service layer. This completes the Cases domain migration (currently 80% done).

## 📄 Feature Plan

**Full details:** `docs/features/phase-3-cases-completion.md`

Please read the feature plan document first for complete context. Key points below:

## 🎯 What You Need to Do

### 1. Setup

- Create branch: `phase-3-step-4-hook-simplification` from `main`
- Read current state of these files:
  - `hooks/useCaseManagement.ts` (165 lines - needs reduction)
  - `application/ApplicationState.ts` (check for case-related state)
  - `application/services/CaseManagementService.ts` (may need state updates)
  - `__tests__/hooks/useCaseManagement.test.tsx` (3 tests - may need updates)

### 2. Add/Verify ApplicationState Selectors

In `application/ApplicationState.ts`, ensure these exist:

```typescript
// State fields
private cases: Case[] = [];
private casesLoading: boolean = false;
private casesError: string | null = null;
private hasLoadedCases: boolean = false;

// Getters (for selectors)
getCases(): Case[] { return structuredClone(this.cases); }
getCasesLoading(): boolean { return this.casesLoading; }
getCasesError(): string | null { return this.casesError; }
getHasLoadedCases(): boolean { return this.hasLoadedCases; }

// Setters (for service layer)
setCases(cases: Case[]): void {
  this.cases = cases;
  this.notify();
}
setCasesLoading(loading: boolean): void {
  this.casesLoading = loading;
  this.notify();
}
setCasesError(error: string | null): void {
  this.casesError = error;
  this.notify();
}
setHasLoadedCases(loaded: boolean): void {
  this.hasLoadedCases = loaded;
  this.notify();
}
```

### 3. Update CaseManagementService

Ensure all service methods update ApplicationState. Example for `loadCases()`:

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

Repeat this pattern for:

- `createCaseWithFeedback()`
- `updateCaseWithFeedback()`
- `deleteCaseWithFeedback()`
- `updateCaseStatus()`

### 4. Refactor useCaseManagement Hook

**Target: ~50 lines**

Replace current implementation with:

```typescript
import { useCallback } from "react";
import { useCaseService } from "@/contexts/CaseServiceContext";
import { useApplicationState } from "@/application/hooks/useApplicationState";

export function useCaseManagement() {
  const service = useCaseService();

  // Get all state from ApplicationState (NO local state)
  const cases = useApplicationState((state) => state.getCases());
  const loading = useApplicationState((state) => state.getCasesLoading());
  const error = useApplicationState((state) => state.getCasesError());
  const hasLoadedData = useApplicationState((state) =>
    state.getHasLoadedCases()
  );

  // Thin delegations to service (no error handling)
  const loadCases = useCallback(async () => {
    return await service.loadCases();
  }, [service]);

  const saveCase = useCallback(
    async (caseData, editingCase = null) => {
      await service.saveCase(caseData, editingCase);
    },
    [service]
  );

  const deleteCase = useCallback(
    async (caseId: string) => {
      await service.deleteCase(caseId);
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

**Critical:**

- ❌ NO `useState` - all state from ApplicationState
- ❌ NO try/catch - service handles errors
- ❌ NO state setters exported (`setCases`, etc.)
- ✅ Keep exact same return interface for components

### 5. Update Tests

In `__tests__/hooks/useCaseManagement.test.tsx`:

- Mock `useApplicationState` to return test state
- Mock `useCaseService` to return mock service
- Verify hook delegates correctly to service
- Remove tests for removed state setters
- Ensure 3+ tests still pass

### 6. Run All Tests

```bash
npm test -- --run
```

**Must pass:** All 353 tests with zero regressions.

## ✅ Acceptance Criteria

- [ ] `useCaseManagement.ts` is ≤ 50 lines
- [ ] No local state in hook (no `useState`)
- [ ] State comes from `ApplicationState` selectors
- [ ] Service layer updates `ApplicationState` on all operations
- [ ] All 353 tests pass
- [ ] Zero breaking changes to components
- [ ] Run linter: `npm run lint` (should pass)

## 🧪 Test Commands

```bash
# Individual test suites
npm test -- useCaseManagement.test.tsx
npm test -- CaseManagementService.test.ts
npm test -- domain/cases/use-cases

# Integration tests
npm test -- connectionFlow.test.tsx

# Full suite
npm test -- --run
```

## 📊 Success Metrics

Report final metrics:

- Line count of `useCaseManagement.ts`: **[actual]** (target: ≤50)
- Tests passing: **[X/353]** (target: 353/353)
- Breaking changes: **[count]** (target: 0)

## 📝 Post-Implementation

After successful implementation:

1. Update `docs/development/agent-prompts/phase-3-use-case-extraction.md`:

   - Mark Cases domain as ✅ 100% complete
   - Update hook LOC in table
   - Add completion timestamp

2. Create a summary comment with:
   - Final LOC count
   - Test results
   - Any challenges encountered
   - Patterns to reuse for Financial/Notes domains

## 🚨 Important Notes

- **DO NOT** change component interfaces - components must work without changes
- **DO NOT** skip tests - all 353 must pass
- **DO** follow existing `ApplicationState` patterns (check how other state is managed)
- **DO** ensure service layer updates state before returning to hook
- **DO** preserve toast notifications (service layer handles them)

## 📚 Reference Files to Read

**Must Read:**

- `docs/features/phase-3-cases-completion.md` (full feature plan)
- `hooks/useCaseManagement.ts` (current 165-line implementation)
- `application/ApplicationState.ts` (state container)
- `application/services/CaseManagementService.ts` (service implementation)

**Reference:**

- `__tests__/hooks/useCaseManagement.test.tsx` (current tests)
- `docs/development/agent-prompts/phase-3-use-case-extraction.md` (architecture context)

---

**Ready for implementation. Please proceed with the refactor following the feature plan.**

All 353 tests must pass before considering this complete. Report any blockers immediately.
