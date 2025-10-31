# Phase 3: Use Case Extraction - Agent Prompt

**Context:** You are implementing Phase 3 of the architecture refactor. Phase 1 created repositories, Phase 2 unified state. Now you'll extract business logic from hooks into use cases and services.

**Reference:** See `docs/development/architecture-refactor-plan.md` for full context.

---

## ⚠️ Phase 3 Complexity Assessment

**Scale Comparison:**

- **Phase 1:** +9,670 LOC, 59 files (greenfield architecture) - 10 days
- **Phase 2:** +846 LOC, 23 files (event system addition) - 11 days
- **Phase 3:** ~+600 net LOC, 30-35 files (refactoring-heavy) - **5-7 days estimated**

**Key Differences from Phase 1 & 2:**

| Aspect               | Phase 1         | Phase 2        | **Phase 3**          |
| -------------------- | --------------- | -------------- | -------------------- |
| Greenfield Work      | ⭐⭐⭐⭐⭐ High | ⭐⭐ Low       | ⭐⭐ Low             |
| Refactoring Risk     | ⭐ Low          | ⭐⭐⭐ Medium  | **⭐⭐⭐⭐ HIGH**    |
| Component Changes    | Minimal         | Minimal        | **MANY**             |
| Breaking Change Risk | Low             | Low            | **Medium-High**      |
| Testing Burden       | New tests       | Enhanced tests | **Regression-heavy** |

**⚠️ CRITICAL DIFFERENCES:**

1. **More deletion than addition** - You'll be removing ~600 lines from hooks, not just adding code
2. **Component updates required** - Unlike P1/P2, this phase touches many React components
3. **Higher regression risk** - Working functionality must be preserved during migration
4. **Incremental migration mandatory** - Cannot do all domains at once (Cases → Financials → Notes)
5. **Cross-cutting changes** - Hooks, services, components, and use cases all change together

**Success Strategy:**

- ✅ Migrate ONE domain at a time (don't touch all 3 simultaneously)
- ✅ Run full test suite after EACH domain migration
- ✅ Keep components working throughout (no big-bang rewrite)
- ✅ Expect more tedious work than Phase 1's greenfield building

---

## Objective

Transform fat hooks (309-164 lines each) into thin wrappers (~40-50 lines) over use cases and service layer orchestration, while preserving all existing functionality.

---

## Current State (Phase 3 progress – Oct 31 2025)

### Existing Architecture:

- ✅ Domain repositories (`infrastructure/storage/StorageRepository.ts`) powering case persistence
- ✅ `ApplicationState` with domain events and shared selectors
- ✅ `DomainEventBus` publishes case lifecycle events
- ✅ Case use cases implemented (`CreateCaseUseCase`, `UpdateCaseUseCase`, `DeleteCaseUseCase`, `GetAllCasesUseCase`) with dedicated tests
- ⚠️ React hooks still consume `CaseManagementAdapter` (DataManager + CaseDisplay bridge)
- ⚠️ `useCaseManagement.ts` trimmed but still manages legacy state (178 LOC)
- ❌ Financial and Note domains remain on legacy DataManager hooks (170-182 LOC) with no service orchestration

### **Hooks to Refactor (Current Line Counts):**

| Hook                      | Current LOC | Target LOC | Reduction | Complexity                |
| ------------------------- | ----------- | ---------- | --------- | ------------------------- |
| `useCaseManagement.ts`    | 178         | ~50        | -128      | High - many operations    |
| `useFinancialItemFlow.ts` | 170         | ~40        | -130      | Medium - CRUD flows       |
| `useFinancialItems.ts`    | 172         | ~40        | -132      | Medium - state management |
| `useNoteFlow.ts`          | 182         | ~40        | -142      | Low - simple operations   |
| **TOTAL**                 | **702**     | **~170**   | **-532**  | **Significant refactor**  |

### Files to Read:

- `hooks/useCaseManagement.ts` – 178 lines, legacy adapter orchestration
- `hooks/useFinancialItemFlow.ts` – 170 lines, DataManager-centric
- `hooks/useFinancialItems.ts` – 172 lines, DataManager-centric
- `hooks/useNoteFlow.ts` – 182 lines, DataManager-centric
- `infrastructure/storage/StorageRepository.ts` – Phase 1 repository implementation
- `application/ApplicationState.ts` – Phase 2 state + selectors
- `application/services/CaseManagementAdapter.ts` – current bridge hooked into UI
- `application/services/CaseManagementService.ts` – new domain-oriented service (not yet wired)
- `application/services/caseLegacyMapper.ts` – CaseDisplay ↔ domain conversion helpers

### **Estimated Work Breakdown:**

```
New Code to Write:           ~1,200 lines
├─ Use cases                  ~600 lines (3 domains × 3-5 use cases each)
├─ Service layer              ~400 lines (3 service classes)
└─ Tests                      ~200 lines (use case + service tests)

Existing Code to Refactor:   ~1,400 lines
├─ Hook simplification        -614 lines (784 → 170)
├─ Component updates          ~200 lines (remove inline logic)
└─ Integration points         ~100 lines (hook → service wiring)

Net Impact:                   ~+600 lines
Files Touched:                ~30-35 files
Test Updates Required:        ~15-20 test files
```

---

## Tasks

### 1. Extract Case Use Cases _(Status: core use cases implemented ✅ – integration + polish pending)_

**Current implementation**

- `domain/cases/use-cases/CreateCase.ts`, `UpdateCase.ts`, `DeleteCase.ts`, and `GetAllCases.ts` now exist and follow the pattern: validate → optimistic update via `ApplicationState` → persist with `StorageRepository` → publish via `DomainEventBus` → rollback on failure.
- Inputs are strongly typed (`CreateCaseInput`, `UpdateCaseInput`) and support optional metadata, IDs, and timestamps to preserve legacy records through `caseLegacyMapper`.
- Test coverage lives in `__tests__/domain/cases/use-cases/*.test.ts` and exercises happy-path + rollback/error scenarios.

**Gaps to address**

- Ensure metadata from `caseLegacyMapper` round-trips through each use case (add regression tests for encoded alerts/notes once service wiring lands).
- Confirm `DeleteCaseUseCase` publishes appropriate events and clears optimistic state for downstream dashboards (currently limited to state + storage).
- Document the emitted domain events (`CaseCreated`, `CaseUpdated`, `CaseDeleted`) so service telemetry remains aligned with Phase 4 plans.

**Next actions for the team**

- Extend tests to cover AbortError propagation and storage failures (mock rejected promises with typed errors).
- Decide whether `CreateCaseUseCase` should accept fully-hydrated `Case` instances for import flows or stay at DTO level with mapper conversions.

### 2. Create Service Layer _(Status: CaseManagementService drafted ⚠️ – not wired into UI yet)_

- `application/services/CaseManagementService.ts` coordinates the four case use cases, provides Sonner toast feedback, and exposes helpers such as `createCaseWithFeedback`, `updateCaseWithFeedback`, and `deleteCaseWithFeedback`.
- The service is constructed with an `ApplicationState` singleton and a `StorageRepository` instance. It still needs a composition root to supply these dependencies outside of tests.
- UI continues to resolve `CaseManagementAdapter`, which wraps `DataManager` and operates on `CaseDisplay` structures. The adapter remains the live code path in `CaseServiceContext`.

**Next actions**

- Introduce a provider that instantiates `CaseManagementService` once `fileDataProvider.getAPI()` succeeds; wire it into `CaseServiceContext` under a feature flag while keeping the adapter as fallback.
- Bridge `CaseDisplay` ↔ domain `Case` conversion via `caseLegacyMapper.ts` inside the service so hooks/components keep their existing props until the UI migration completes.
- Add unit tests for `CaseManagementService` (mock use cases, assert toast + logging behaviour, verify AbortError path in `updateCaseStatus`).

### 3. Refactor useCaseManagement Hook _(Status: pending service integration)_

- `hooks/useCaseManagement.ts` currently spans 178 lines. It has already dropped most business rules but still owns local state management, error handling, and calls into `CaseManagementAdapter` (DataManager).
- Hook exposes case CRUD, note operations, import pipeline, and status updates. Once the new service is wired, most of this logic should collapse into simple delegations with minimal state (loading/error can move into ApplicationState selectors).

**Next actions**

- After `CaseManagementService` is available through context, replace adapter calls (`saveCase`, `deleteCase`, etc.) with service equivalents and move React state to selectors or `ApplicationState` subscription helpers.
- Confirm note flows either remain here temporarily or move into a dedicated note service to avoid mixed responsibilities.
- Target line count remains ~50 once state is externalised; track reduction progress as part of the Case domain PR.

### 4. Repeat Pattern for Financial Items _(Status: not started)_

- Hooks `useFinancialItemFlow.ts` and `useFinancialItems.ts` still depend directly on `DataManager` and `AutosaveFileService` (170 and 172 LOC respectively).
- No domain use cases or services exist for financial items yet.

**Next actions**

- Define domain use cases (`AddFinancialItemUseCase`, `UpdateFinancialItemUseCase`, `DeleteFinancialItemUseCase`, `GetFinancialItemsUseCase`) mirroring the case pattern.
- Create `FinancialManagementService` plus tests, then refactor both hooks to delegate.

### 5. Repeat Pattern for Notes _(Status: not started)_

- `useNoteFlow.ts` remains 182 LOC with direct `DataManager` access.
- Note use cases/services are not yet defined.

**Next actions**

- Implement note CRUD use cases, a `NoteManagementService`, and migrate the hook once case and financial migrations are stable.

### 6. Update Components _(Status: pending hook migration)_

- Components such as `components/case/CaseForm.tsx` still rely on thick hook contracts that return `CaseDisplay` objects.
- When hooks expose service-driven APIs, adjust component handlers to delegate (`createCase`, `updateCase`, etc.) without reimplementing business logic.
- Track component updates domain by domain to avoid a big-bang UI rewrite.

---

## Testing

- Domain-level tests already exist for the case use cases: see `__tests__/domain/cases/use-cases/*.test.ts`.
- Adapter/service tests are still missing. Add suites for `CaseManagementService`, upcoming financial/note services, and hook integration tests once they delegate to the new layer.
- Continue to run `npm test` + `npm run lint` after each domain migration; add focused suites (e.g., `npm test -- CreateCase`) while iterating quickly.

---

## Critical Constraints

### DO NOT:

- ❌ Put business logic in React components
- ❌ Call repositories directly from hooks
- ❌ Modify AutosaveFileService or FileStorageContext
- ❌ Create circular dependencies (hook → service → hook)

### DO:

- ✅ One use case per file (single responsibility)
- ✅ Services orchestrate multiple use cases
- ✅ Hooks are thin wrappers (max 50 lines)
- ✅ Components only call hooks, never services
- ✅ Use ApplicationState for state updates
- ✅ Use event bus for cross-domain communication

---

## Migration Priority & Strategy

**⚠️ INCREMENTAL MIGRATION REQUIRED - Do NOT attempt all domains simultaneously**

### **Recommended Order:**

1. **Cases domain FIRST** (Days 1-3)
   - Highest impact, most dependencies
   - Largest hook currently 178 lines and still adapter-bound
   - Once Cases service is live, pattern is proven for remaining domains
   - **STOP and test thoroughly before proceeding**
2. **Financial Items domain SECOND** (Days 4-5)
   - Complex validation, many operations
   - Two related hooks to refactor (170 + 172 lines)
   - Benefits from proven Cases pattern
   - **STOP and test thoroughly before proceeding**
3. **Notes domain THIRD** (Days 6-7)
   - Simpler, fewer edge cases
   - Hook still 182 lines but operations are straightforward once services exist
   - Should be straightforward after 2 successful migrations
4. **Defer Alerts domain** (Phase 4 or later)
   - Will be redesigned in future phase
   - Keep minimal changes for now

### **Migration Steps Per Domain:**

```
For Each Domain (e.g., Cases):
  1. Create use cases (don't touch hooks yet)           [~2 hours]
  2. Create service layer (don't touch hooks yet)       [~1 hour]
  3. Write use case tests                               [~2 hours]
  4. Run tests - ensure new code works in isolation     [~30 min]
  5. Refactor hook to use service                       [~1 hour]
  6. Update components to use simplified hook           [~2 hours]
  7. Run FULL test suite (290 tests)                    [~30 min]
  8. Fix any regressions                                [~1 hour]
  9. Commit and push domain migration                   [~15 min]
  ⚠️ PAUSE - Verify domain fully working before next    [~1 day buffer]
```

### **Why Incremental Migration is Critical:**

- ❌ **Big-bang approach will fail** - Too many moving parts, impossible to debug
- ✅ **One domain = isolated blast radius** - If Cases break, Financials/Notes still work
- ✅ **Proven pattern before replication** - Don't replicate a flawed design 3x
- ✅ **Easier code review** - 3 smaller PRs vs 1 massive PR
- ✅ **Rollback safety** - Can revert one domain without losing all work

---

## Critical Constraints

### **DO NOT:**

- ❌ **Migrate all 3 domains in one PR** (highest risk failure mode)
- ❌ Refactor a hook before its use cases/services exist and are tested
- ❌ Put business logic in React components
- ❌ Call repositories directly from hooks
- ❌ Modify AutosaveFileService or FileStorageContext
- ❌ Create circular dependencies (hook → service → hook)
- ❌ Skip running full test suite between domain migrations

### **DO:**

- ✅ **One domain per PR** (Cases PR → merge → Financials PR → merge → Notes PR)
- ✅ **Run full test suite (290 tests) after each domain migration**
- ✅ One use case per file (single responsibility)
- ✅ Services orchestrate multiple use cases
- ✅ Hooks are thin wrappers (max 50 lines)
- ✅ Components only call hooks, never services
- ✅ Use ApplicationState for state updates
- ✅ Use event bus for cross-domain communication

---

## Verification Checklist

### **Per-Domain Checklist (repeat for each domain):**

**Cases Domain (PR #1):**

- [x] Use cases created (Create, Update, Delete, GetAll) with tests
- [ ] CaseManagementService orchestrates flows (draft exists; needs wiring + tests)
- [ ] useCaseManagement hook refactored (178 → ~50 lines target)
- [ ] Components updated to use simplified hook
- [ ] **All 290 tests passing**
- [ ] **No performance regressions**
- [ ] **Merged to main before starting Financials**

**Financial Items Domain (PR #2):**

- [ ] Use cases created (AddFinancialItem, UpdateFinancialItem, DeleteFinancialItem, GetFinancialItems)
- [ ] FinancialManagementService created
- [ ] useFinancialItemFlow refactored (170 → ~40 lines)
- [ ] useFinancialItems refactored (172 → ~40 lines)
- [ ] Components updated to use simplified hooks
- [ ] **All 290+ tests passing**
- [ ] **No performance regressions**
- [ ] **Merged to main before starting Notes**

**Notes Domain (PR #3):**

- [ ] Use cases created (CreateNote, UpdateNote, DeleteNote)
- [ ] NoteManagementService created
- [ ] useNoteFlow refactored (182 → ~40 lines)
- [ ] Components updated to use simplified hook
- [ ] **All 290+ tests passing**
- [ ] **No performance regressions**
- [ ] **Phase 3 complete**

---

## Success Criteria

✅ Business logic in use cases (not in hooks)  
✅ Services orchestrate complex flows  
✅ Hooks are thin wrappers (<50 lines each)  
✅ Components only call hooks (never services directly)  
✅ **All 290+ tests passing with 0 regressions**  
✅ No circular dependencies  
✅ **3 separate PRs merged (one per domain)**  
✅ No performance degradation vs. Phase 2 baseline

---

## Timeline & Effort Estimation

**Total Duration:** 5-7 days (assuming sequential domain migration)

| Domain        | Estimated Days | Risk Level | Notes                                 |
| ------------- | -------------- | ---------- | ------------------------------------- |
| Cases         | 2-3 days       | ⚠️ High    | Largest hook, most components touched |
| Financials    | 1.5-2 days     | ⚠️ Medium  | Two hooks, proven pattern from Cases  |
| Notes         | 1-1.5 days     | ✅ Low     | Simplest domain, pattern proven 2x    |
| Buffer/Review | 0.5-1 day      | -          | Code review, regression testing       |

**Comparison to Previous Phases:**

- Phase 1: 10 days (greenfield architecture)
- Phase 2: 11 days (event system addition)
- **Phase 3: 5-7 days** (refactoring-heavy, less net code)

---

_Reference Phase 1-2 artifacts: `infrastructure/StorageRepository.ts`, `application/ApplicationState.ts`, `application/DomainEventBus.ts`_
