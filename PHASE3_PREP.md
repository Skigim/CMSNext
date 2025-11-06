# Phase 3: Use Case Extraction - Preparation Summary

**Date:** October 29, 2025  
**Status:** ✅ READY TO START  
**Timeline:** 5-7 days (November 1-7, 2025)

---

## 🎯 Executive Summary

Phase 3 will extract business logic from React hooks into testable use cases and service layers, reducing hook complexity from **784 total lines → ~170 lines** (78% reduction). This is a **refactoring-heavy phase** with higher regression risk than Phases 1 & 2.

### Key Differences from Phase 1 & 2

| Aspect               | Phase 1     | Phase 2   | **Phase 3**        |
| -------------------- | ----------- | --------- | ------------------ |
| Greenfield Work      | ⭐⭐⭐⭐⭐  | ⭐⭐      | **⭐⭐**           |
| Refactoring Risk     | ⭐          | ⭐⭐⭐    | **⭐⭐⭐⭐**       |
| Component Changes    | Minimal     | Minimal   | **MANY**           |
| Breaking Change Risk | Low         | Low       | **Medium-High**    |
| Test Count           | 294 passing | 306 total | **306 → maintain** |

---

## 📊 Current State Assessment

### ✅ Prerequisites Complete

- ✅ Phase 1: Domain entities, repositories, StorageRepository (9,670 LOC)
- ✅ Phase 2: ApplicationState, DomainEventBus, activity logging (846 LOC)
- ✅ Shadcn migration 100% complete (PR #28)
- ✅ Telemetry infrastructure ready (PR #29)
- ✅ Accessibility testing with jest-axe (PR #29)
- ✅ Widget framework production-ready (PR #29)

### 🔴 Test Suite Status

**Current:** 294 passing / 12 failing (306 total)

**Failing Tests (Pre-Phase 3):**

1. `App.alertResolution.test.tsx` - 1 failure (alert storage key)
2. `CaseDetails.test.tsx` - 1 failure (rendering/interactions)
3. `CaseListFiltering.test.tsx` - 3 failures (filtering UI)
4. `Dashboard.test.tsx` - 1 failure (unlinked alerts badge)
5. `connectionFlow.test.tsx` - 2 failures (integration flow)
6. `featureFlagFlow.test.tsx` - 3 failures (widget visibility)
7. `Dashboard.widgets.test.tsx` - 1 failure (widget rendering)

**⚠️ CRITICAL:** Fix these 12 failures BEFORE starting Phase 3 to establish clean baseline.

### 📝 Hooks to Refactor

| Hook                      | Current LOC | Target LOC | Reduction | Complexity             |
| ------------------------- | ----------- | ---------- | --------- | ---------------------- |
| `useCaseManagement.ts`    | 309         | ~50        | -259      | High - many operations |
| `useFinancialItemFlow.ts` | 150         | ~40        | -110      | Medium - CRUD flows    |
| `useFinancialItems.ts`    | 161         | ~40        | -121      | Medium - state mgmt    |
| `useNoteFlow.ts`          | 164         | ~40        | -124      | Low - simple ops       |
| **TOTAL**                 | **784**     | **~170**   | **-614**  | **Significant**        |

---

## 🗺️ Migration Strategy

### **CRITICAL: One Domain at a Time**

```
Week 1 (Nov 1-3): Cases Domain
  ├─ Day 1: Create use cases + service (don't touch hooks)
  ├─ Day 2: Refactor useCaseManagement hook + update components
  └─ Day 3: Test, fix regressions, commit & merge
  ⚠️ STOP - Verify fully working before proceeding

Week 2 (Nov 4-5): Financial Items Domain
  ├─ Day 4: Create use cases + service
  └─ Day 5: Refactor both financial hooks, test & merge
  ⚠️ STOP - Verify fully working before proceeding

Week 3 (Nov 6-7): Notes Domain
  ├─ Day 6: Create use cases + service
  └─ Day 7: Refactor useNoteFlow, test & merge
  ✅ Phase 3 Complete
```

### Why Incremental Migration is Mandatory

- ❌ **Big-bang approach will fail** - Too many moving parts, impossible to debug
- ✅ **One domain = isolated blast radius** - If Cases break, Financials/Notes still work
- ✅ **Proven pattern before replication** - Don't replicate a flawed design 3x
- ✅ **Easier code review** - 3 smaller PRs vs 1 massive PR
- ✅ **Rollback safety** - Can revert one domain without losing all work

---

## 📦 Architecture Overview

### Current Flow (Phase 2)

```
Component → Hook (business logic) → DataManager → AutosaveFileService → File System
                                  → ApplicationState
```

### Target Flow (Phase 3)

```
Component → Hook (thin wrapper) → Service Layer → Use Cases → Repository → ApplicationState
                                                                         → StorageRepository
```

### Key Architectural Components

**1. Use Cases** (`domain/{domain}/use-cases/`)

- Single responsibility per file
- Example: `CreateCase.ts`, `UpdateCase.ts`, `DeleteCase.ts`
- Pure business logic, framework-agnostic
- Easy to test without React

**2. Service Layer** (`application/services/`)

- Orchestrates multiple use cases
- Manages complex workflows (create + navigate, update + return to list)
- Handles ApplicationState updates
- Example: `CaseManagementService.ts`

**3. Thin Hooks** (`hooks/`)

- Max 50 lines each
- Simple wrappers over service layer
- No business logic
- Example: `useCaseManagement.ts` (309 → ~50 lines)

---

## 🏗️ Work Breakdown

### New Code to Write: ~1,200 lines

```
Use Cases                        ~600 lines
├─ Cases domain
│  ├─ CreateCase.ts              ~80 lines
│  ├─ UpdateCase.ts              ~80 lines
│  ├─ DeleteCase.ts              ~70 lines
│  ├─ GetAllCases.ts             ~50 lines
│  └─ GetCaseById.ts             ~50 lines
│
├─ Financials domain
│  ├─ AddFinancialItem.ts        ~70 lines
│  ├─ UpdateFinancialItem.ts     ~70 lines
│  ├─ DeleteFinancialItem.ts     ~60 lines
│  └─ GetFinancialItems.ts       ~50 lines
│
└─ Notes domain
   ├─ CreateNote.ts              ~60 lines
   ├─ UpdateNote.ts              ~60 lines
   └─ DeleteNote.ts              ~50 lines

Service Layer                    ~400 lines
├─ CaseManagementService.ts      ~150 lines
├─ FinancialManagementService.ts ~150 lines
└─ NoteManagementService.ts      ~100 lines

Tests                            ~200 lines
├─ Use case tests                ~150 lines
└─ Service tests                 ~50 lines
```

### Existing Code to Refactor: ~1,400 lines

```
Hook Simplification              -614 lines (784 → 170)
Component Updates                ~200 lines (remove inline logic)
Integration Points               ~100 lines (hook → service wiring)
```

### Net Impact

```
Total Lines Added:    ~1,200
Total Lines Modified: ~1,400
Net Change:           ~+600 lines
Files Touched:        ~30-35 files
Test Updates:         ~15-20 test files
```

---

## 🎯 Per-Domain Checklists

### Domain 1: Cases (Days 1-3)

**Use Cases to Create:**

- [ ] `domain/cases/use-cases/CreateCase.ts`
- [ ] `domain/cases/use-cases/UpdateCase.ts`
- [ ] `domain/cases/use-cases/DeleteCase.ts`
- [ ] `domain/cases/use-cases/GetAllCases.ts`
- [ ] `domain/cases/use-cases/GetCaseById.ts`
- [ ] `domain/cases/use-cases/UpdateCaseStatus.ts`
- [ ] `domain/cases/use-cases/ImportCases.ts`

**Service to Create:**

- [ ] `application/services/CaseManagementService.ts`
  - [ ] `createAndNavigateToCase()`
  - [ ] `updateAndReturnToList()`
  - [ ] `deleteAndReturnToList()`
  - [ ] `loadAllCases()`
  - [ ] `updateCaseStatus()`

**Hook to Refactor:**

- [ ] `hooks/useCaseManagement.ts` (309 → ~50 lines)
  - [ ] Extract `loadCases` logic → `GetAllCases` use case
  - [ ] Extract `saveCase` logic → `CreateCase`/`UpdateCase` use cases
  - [ ] Extract `deleteCase` logic → `DeleteCase` use case
  - [ ] Extract `updateCaseStatus` logic → `UpdateCaseStatus` use case
  - [ ] Simplify to thin wrapper over `CaseManagementService`

**Components to Update:**

- [ ] `components/case/CaseForm.tsx` - Use simplified hook
- [ ] `components/case/CaseDetails.tsx` - Use simplified hook
- [ ] `components/app/CaseWorkspace.tsx` - Update to new patterns

**Tests:**

- [ ] Write use case tests (5-7 new test files)
- [ ] Update `useCaseManagement.test.ts`
- [ ] Run full test suite (target: 306 passing)
- [ ] Fix any regressions

**Commit & Merge:**

- [ ] PR #1: Cases Domain Migration
- [ ] Code review & approval
- [ ] Merge to main
- [ ] **STOP - Verify before proceeding**

---

### Domain 2: Financial Items (Days 4-5)

**Use Cases to Create:**

- [ ] `domain/financials/use-cases/AddFinancialItem.ts`
- [ ] `domain/financials/use-cases/UpdateFinancialItem.ts`
- [ ] `domain/financials/use-cases/DeleteFinancialItem.ts`
- [ ] `domain/financials/use-cases/GetFinancialItems.ts`
- [ ] `domain/financials/use-cases/GetFinancialItemsByCaseId.ts`

**Service to Create:**

- [ ] `application/services/FinancialManagementService.ts`
  - [ ] `addFinancialItem()`
  - [ ] `updateFinancialItem()`
  - [ ] `deleteFinancialItem()`
  - [ ] `getFinancialItems()`

**Hooks to Refactor:**

- [ ] `hooks/useFinancialItemFlow.ts` (150 → ~40 lines)
- [ ] `hooks/useFinancialItems.ts` (161 → ~40 lines)

**Components to Update:**

- [ ] `components/financial/FinancialItemCard.tsx`
- [ ] `components/financial/FinancialItemList.tsx`
- [ ] Update any other financial components

**Tests:**

- [ ] Write use case tests (4-5 new test files)
- [ ] Update financial hook tests
- [ ] Run full test suite (target: 306+ passing)

**Commit & Merge:**

- [ ] PR #2: Financial Items Domain Migration
- [ ] **STOP - Verify before proceeding**

---

### Domain 3: Notes (Days 6-7)

**Use Cases to Create:**

- [ ] `domain/notes/use-cases/CreateNote.ts`
- [ ] `domain/notes/use-cases/UpdateNote.ts`
- [ ] `domain/notes/use-cases/DeleteNote.ts`
- [ ] `domain/notes/use-cases/GetNotesByCaseId.ts`
- [ ] `domain/notes/use-cases/FilterNotesByCategory.ts`

**Service to Create:**

- [ ] `application/services/NoteManagementService.ts`
  - [ ] `createNote()`
  - [ ] `updateNote()`
  - [ ] `deleteNote()`
  - [ ] `getNotesByCaseId()`
  - [ ] `filterByCategory()`

**Hook to Refactor:**

- [ ] `hooks/useNoteFlow.ts` (164 → ~40 lines)

**Components to Update:**

- [ ] `components/case/NotesSection.tsx`
- [ ] Update note-related components

**Tests:**

- [ ] Write use case tests (3-5 new test files)
- [ ] Update `useNoteFlow.test.ts`
- [ ] Run full test suite (target: 306+ passing)

**Commit & Merge:**

- [ ] PR #3: Notes Domain Migration
- [ ] **Phase 3 Complete! 🎉**

---

## ⚠️ Critical Constraints

### DO NOT:

- ❌ **Migrate all 3 domains in one PR** (highest risk failure mode)
- ❌ Refactor a hook before its use cases/services exist and are tested
- ❌ Put business logic in React components
- ❌ Call repositories directly from hooks
- ❌ Modify AutosaveFileService or FileStorageContext
- ❌ Create circular dependencies (hook → service → hook)
- ❌ Skip running full test suite between domain migrations

### DO:

- ✅ **One domain per PR** (Cases → Financials → Notes)
- ✅ **Run full test suite (306 tests) after each domain migration**
- ✅ One use case per file (single responsibility)
- ✅ Services orchestrate multiple use cases
- ✅ Hooks are thin wrappers (max 50 lines)
- ✅ Components only call hooks, never services
- ✅ Use ApplicationState for state updates
- ✅ Use event bus for cross-domain communication

---

## 🧪 Testing Strategy

### Pre-Phase 3: Fix Failing Tests

**MANDATORY:** Get to 306/306 passing before starting Phase 3.

**Known Failures to Fix:**

1. Alert resolution test - Fix storage key usage
2. CaseDetails rendering - Update component expectations
3. CaseList filtering - Fix UI interaction tests
4. Dashboard unlinked alerts - Fix badge logic
5. Connection flow integration - Fix mock setup
6. Feature flag flow - Fix widget visibility logic
7. Dashboard widgets - Fix rendering expectations

### During Phase 3: Per-Domain Testing

**After each use case creation:**

```bash
npm test -- domain/{domain}/use-cases
```

**After hook refactor:**

```bash
npm test -- hooks/use{Domain}*.test.ts
```

**After component updates:**

```bash
npm test -- components/{domain}
```

**Before domain PR:**

```bash
npm test -- --run  # Full suite, must be 306/306 passing
```

### Test Patterns

**Use Case Test Example:**

```typescript
describe("CreateCase", () => {
  it("should create a case successfully", async () => {
    const mockRepository = createMockRepository();
    const useCase = new CreateCase(mockRepository);

    const response = await useCase.execute({ formData });

    expect(response.success).toBe(true);
    expect(mockRepository.save).toHaveBeenCalled();
  });
});
```

**Service Test Example:**

```typescript
describe("CaseManagementService", () => {
  it("should create case and navigate", async () => {
    const service = new CaseManagementService(repository);

    await service.createAndNavigateToCase(formData);

    expect(appState.setSelectedCase).toHaveBeenCalled();
    expect(appState.setNavigation).toHaveBeenCalled();
  });
});
```

---

## 📚 Reference Files

### Existing Architecture (Don't Modify)

- `infrastructure/storage/StorageRepository.ts` - Repository from Phase 1
- `application/ApplicationState.ts` - State management from Phase 2
- `application/DomainEventBus.ts` - Event bus from Phase 2
- `utils/AutosaveFileService.ts` - File persistence layer
- `contexts/FileStorageContext.tsx` - Storage lifecycle

### Hooks to Refactor (Will Modify)

- `hooks/useCaseManagement.ts` - 309 lines → ~50 lines
- `hooks/useFinancialItemFlow.ts` - 150 lines → ~40 lines
- `hooks/useFinancialItems.ts` - 161 lines → ~40 lines
- `hooks/useNoteFlow.ts` - 164 lines → ~40 lines

### Domain Entities (Already Exist)

- `domain/cases/entities/Case.ts` - Case entity with business logic
- `domain/cases/entities/Person.ts` - Person value object
- `domain/financials/entities/FinancialItem.ts` - Financial item entity
- `domain/notes/entities/Note.ts` - Note entity
- `domain/alerts/entities/Alert.ts` - Alert entity
- `domain/activity/entities/ActivityEvent.ts` - Activity event

### Repositories (Already Exist)

- `domain/common/repositories.ts` - Repository interfaces
- `infrastructure/storage/StorageRepository.ts` - Implementation

---

## 🚀 Success Criteria

### Phase 3 Complete When:

- ✅ All business logic extracted from hooks into use cases
- ✅ 3 service classes orchestrate complex workflows
- ✅ All 4 hooks reduced to <50 lines each (thin wrappers)
- ✅ Components updated to use simplified hooks
- ✅ **All 306+ tests passing with 0 regressions**
- ✅ No circular dependencies
- ✅ **3 separate PRs merged** (Cases, Financials, Notes)
- ✅ No performance degradation vs Phase 2 baseline
- ✅ Documentation updated with new patterns

### Quality Gates

**Per-Domain PR:**

- All new use cases have unit tests
- All refactored hooks have updated tests
- Full test suite passing (306+)
- Code review approved
- No TypeScript errors
- No ESLint warnings

**Phase 3 Complete:**

- Hook complexity reduced 78% (784 → 170 lines)
- ~15-20 new use case files created
- 3 new service files created
- ~200 new test lines added
- Zero regressions introduced

---

## 🎉 Phase 3 Completion Vision

**Before Phase 3:**

```typescript
// useCaseManagement.ts (309 lines)
export function useCaseManagement() {
  // 50+ lines of business logic
  const loadCases = async () => {
    /* ... */
  };
  const saveCase = async () => {
    /* ... */
  };
  const deleteCase = async () => {
    /* ... */
  };
  // More business logic...
}
```

**After Phase 3:**

```typescript
// useCaseManagement.ts (~50 lines)
export function useCaseManagement() {
  const service = useMemo(() => new CaseManagementService(repository), []);

  return {
    loadCases: () => service.loadAllCases(),
    saveCase: (data) => service.createCase(data),
    deleteCase: (id) => service.deleteCase(id),
  };
}
```

**Business Logic Now Testable:**

```typescript
// domain/cases/use-cases/CreateCase.test.ts
describe("CreateCase", () => {
  it("creates case without React", async () => {
    const useCase = new CreateCase(mockRepo);
    const result = await useCase.execute(input);
    expect(result.success).toBe(true);
  });
});
```

---

## 📅 Timeline

**Week of November 1, 2025:**

- **Nov 1 (Fri):** Fix 12 failing tests → establish clean baseline
- **Nov 2-3 (Sat-Sun):** Cases domain migration (PR #1)
- **Nov 4-5 (Mon-Tue):** Financial items domain migration (PR #2)
- **Nov 6-7 (Wed-Thu):** Notes domain migration (PR #3)
- **Nov 8 (Fri):** Buffer day, documentation updates, celebration 🎉

**Total Duration:** 5-7 working days

---

## 🔗 Related Documentation

- **Phase 3 Agent Prompt:** `docs/development/agent-prompts/phase-3-use-case-extraction.md`
- **Architecture Refactor Plan:** `docs/development/architecture-refactor-plan.md`
- **Actionable Roadmap:** `docs/development/actionable-roadmap.md`
- **Feature Catalogue:** `docs/development/feature-catalogue.md`
- **Testing Infrastructure:** `docs/development/testing-infrastructure.md`

---

## ✅ Pre-Flight Checklist

### Before Starting Phase 3:

- [ ] All 306 tests passing (currently 294/306)
- [ ] Fix 12 failing tests identified above
- [ ] Read Phase 3 agent prompt thoroughly
- [ ] Understand incremental migration strategy
- [ ] Review existing hooks to understand current patterns
- [ ] Review StorageRepository and ApplicationState APIs
- [ ] Set up test watch mode: `npm run test:watch`
- [ ] Create feature branch: `git checkout -b phase-3/cases-domain`

### Day 1 Kickoff (Cases Domain):

- [ ] Create `domain/cases/use-cases/` directory
- [ ] Start with `CreateCase.ts` use case
- [ ] Write tests FIRST (TDD approach)
- [ ] Verify use case works in isolation
- [ ] Proceed to other use cases

---

**Status:** ✅ READY TO BEGIN  
**Next Step:** Fix 12 failing tests to establish clean baseline  
**Target Start Date:** November 1, 2025  
**Target Completion:** November 7, 2025

---

_This document will be updated as Phase 3 progresses. Track progress by checking off items in the domain checklists above._
