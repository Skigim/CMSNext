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

## Current State (Phase 3 progress – Nov 2 2025)

### Existing Architecture:

- ✅ Domain repositories (`infrastructure/storage/StorageRepository.ts`) powering case persistence
- ✅ `ApplicationState` with domain events and shared selectors
- ✅ `DomainEventBus` publishes case lifecycle events
- ✅ Case use cases implemented (`CreateCaseUseCase`, `UpdateCaseUseCase`, `DeleteCaseUseCase`, `GetAllCasesUseCase`) with 16 dedicated tests
- ✅ **NEW:** `CaseServiceFactory` (166 LOC) implements facade pattern with feature flag support
- ✅ **NEW:** `CaseManagementService` fully tested (11 test cases) with toast feedback and error handling
- ✅ **NEW:** Hybrid architecture active with feature flags (`utils/featureFlags.ts` enabled)
- ⚠️ `useCaseManagement.ts` reduced to 165 LOC (target: ~50) - still needs final refactor to thin wrapper
- ❌ Financial and Note domains remain on legacy DataManager hooks (170-182 LOC) with no service orchestration

### **Hooks to Refactor (Current Line Counts):**

| Hook                      | Current LOC | Target LOC | Reduction | Complexity                | Status         |
| ------------------------- | ----------- | ---------- | --------- | ------------------------- | -------------- |
| `useCaseManagement.ts`    | 165         | ~50        | -115      | High - many operations    | 🟡 In Progress |
| `useFinancialItemFlow.ts` | 170         | ~40        | -130      | Medium - CRUD flows       | ⚪ Not Started |
| `useFinancialItems.ts`    | 172         | ~40        | -132      | Medium - state management | ⚪ Not Started |
| `useNoteFlow.ts`          | 182         | ~40        | -142      | Low - simple operations   | ⚪ Not Started |
| **TOTAL**                 | **689**     | **~170**   | **-519**  | **Significant refactor**  | **25% Done**   |

### Files to Read:

- `hooks/useCaseManagement.ts` – 165 lines, hybrid service facade integration
- `hooks/useFinancialItemFlow.ts` – 170 lines, DataManager-centric
- `hooks/useFinancialItems.ts` – 172 lines, DataManager-centric
- `hooks/useNoteFlow.ts` – 182 lines, DataManager-centric
- `infrastructure/storage/StorageRepository.ts` – Phase 1 repository implementation
- `application/ApplicationState.ts` – Phase 2 state + selectors
- `application/services/CaseServiceFactory.ts` – **NEW:** 166 lines, facade pattern with legacy/new service switching
- `application/services/CaseManagementAdapter.ts` – legacy adapter (still active via factory)
- `application/services/CaseManagementService.ts` – new domain-oriented service (11 tests passing)
- `application/services/caseLegacyMapper.ts` – CaseDisplay ↔ domain conversion helpers
- `contexts/CaseServiceContext.tsx` – provides service instance via factory

### **Estimated Work Breakdown:**

```
CASES DOMAIN (80% Complete):
Completed:
├─ Use cases                  ✅ ~600 lines (4 use cases + 16 tests)
├─ Service layer              ✅ ~500 lines (service + factory + 37 tests)
├─ Hook integration           ✅ 165 lines (reduced from 178, -7%)
└─ Zero breaking changes      ✅ Facade pattern implementation

Remaining:
├─ Hook simplification        🟡 ~115 lines to reduce (165 → ~50)
└─ State externalization      🟡 Move to ApplicationState selectors

FINANCIAL DOMAIN (Not Started):
├─ Use cases                  ⚪ ~400 lines (4 use cases for add/update/delete/get)
├─ Service + Factory          ⚪ ~350 lines (replicate case pattern)
└─ Hook refactor              ⚪ -260 lines reduction (170+172 → 80)

NOTES DOMAIN (Not Started):
├─ Use cases                  ⚪ ~200 lines (3 use cases for create/update/delete)
├─ Service + Factory          ⚪ ~250 lines (simplest domain)
└─ Hook refactor              ⚪ -142 lines reduction (182 → ~40)

Net Impact to Date:           ~+666 lines (use cases + service + factory - hook reduction)
Projected Final Impact:       ~+800 lines total
Files Touched:                ~35 files (estimated)
Test Coverage:                353 tests (was 290, +22%)
```

---

## Recent Progress (Oct 31 - Nov 2, 2025)

### Commits Summary

**ebb749e - Oct 31:** Implement hybrid case service architecture

- Added `CaseServiceFactory.ts` (166 LOC) with facade pattern
- Updated `CaseServiceContext.tsx` to use factory for service instantiation
- Integrated service delegation in `useCaseManagement.ts`
- Added test coverage for hybrid architecture
- **Result:** Zero breaking changes, feature flag controlled migration path

**81f0e91 - Oct 31:** Enable feature flags for architecture refactor

- Activated architecture refactor flags in `utils/featureFlags.ts`
- Enhanced logging in development mode (`utils/logger.ts`)
- Improved telemetry instrumentation for production monitoring
- **Result:** Hybrid architecture now active, can A/B test legacy vs modern

**5088323 - Nov 1:** Enhance logging in loadCases and adjust log levels

- Added detailed logging to `CaseManagementAdapter.loadCases()`
- Adjusted default log level for smoke testing visibility
- **Result:** Better observability during migration

**c1c48af - Nov 2:** Enhance performance tracking in test environment

- Improved performance tracking behavior during tests
- Better handling of test vs production telemetry
- **Result:** Cleaner test output, accurate production metrics

### Test Status

- **Total Tests:** 353 (up from 290 baseline, 59 test files)
- **Passing:** 353 ✅ (100%)
- **Coverage Areas:**
  - Domain use cases: 16 tests (CreateCase, UpdateCase, DeleteCase, GetAllCases)
  - Service layer: 11 tests (CaseManagementService)
  - Legacy adapter: 26 tests (CaseManagementAdapter)
  - Hook integration: 3 tests (useCaseManagement)
  - Full integration flows: 2 tests (connection flow)

### Architecture Metrics

| Component               | Lines of Code | Status    | Change     |
| ----------------------- | ------------- | --------- | ---------- |
| `CaseServiceFactory`    | 166           | ✅ New    | +166       |
| `CaseManagementService` | ~100          | ✅ Tested | No change  |
| `useCaseManagement`     | 165           | 🟡 Active | -13 (-7%)  |
| **Use Cases (4 files)** | ~400          | ✅ Stable | No change  |
| **Test Coverage**       | 353 tests     | ✅ Pass   | +63 (+22%) |

### Key Architectural Decisions

**1. Facade Pattern with Factory**

- Created `CaseServiceFactory` to provide uniform `CaseServiceContract` interface
- Enables runtime switching between legacy (`CaseManagementAdapter`) and modern (`CaseManagementService`) implementations
- **Benefit:** Zero breaking changes during migration, can A/B test implementations

**2. Feature Flag Controlled Migration**

- Hybrid architecture activated via `utils/featureFlags.ts`
- Can toggle individual domains or entire refactor
- **Benefit:** Safe rollback path, gradual production rollout

**3. Service Layer Abstraction**

- `CaseManagementService` coordinates use cases + provides toast feedback
- Separate from React hooks - pure TypeScript orchestration
- **Benefit:** Testable in isolation, no React dependencies in business logic

**4. Optimistic Updates with Rollback**

- All use cases follow: optimistic state update → persist → event publish → rollback on error
- ApplicationState handles state management, DomainEventBus handles cross-domain communication
- **Benefit:** Responsive UI, consistent error recovery

### Lessons Learned from Cases Domain

**What Worked Well:**

1. **Facade Pattern:** `CaseServiceFactory` eliminated all breaking changes - components don't care which implementation they use
2. **Test-First Integration:** 37 service/adapter tests caught edge cases before production
3. **Feature Flags:** Can toggle between legacy/modern implementations for A/B testing
4. **Incremental Reduction:** Hook went 178 → 165 lines without breaking changes (still in progress)

**Challenges Encountered:**

1. **Hook LOC Target:** Reducing to ~50 lines harder than expected - state management still mixed with delegation
2. **Test Count Growth:** Adding architecture increased tests from 290 → 353 (good but unexpected)
3. **Factory Complexity:** 166 lines for factory was more than anticipated (but worth it for zero breaking changes)

**Adjustments for Financial/Notes:**

1. **State-First Approach:** Move state to `ApplicationState` selectors BEFORE hook refactor (not during)
2. **Factory Template:** Reuse `CaseServiceFactory` pattern - proven to work well
3. **Parallel Development:** Can build use cases + service while legacy code still running (facade pattern benefit)

---

## Tasks

### 1. Extract Case Use Cases _(Status: ✅ Complete - 16 tests passing)_

### Current implementation

- ✅ `domain/cases/use-cases/CreateCase.ts`, `UpdateCase.ts`, `DeleteCase.ts`, and `GetAllCases.ts` implemented and tested
- ✅ Use cases follow pattern: validate → optimistic update via `ApplicationState` → persist with `StorageRepository` → publish via `DomainEventBus` → rollback on failure
- ✅ Inputs are strongly typed (`CreateCaseInput`, `UpdateCaseInput`) with full metadata support
- ✅ Test coverage complete: 16 tests across 4 use case files covering happy paths, rollback scenarios, and edge cases
- ✅ `caseLegacyMapper` integration confirmed for round-trip compatibility

### Verification Complete

- ✅ All optimistic updates verified with rollback tests
- ✅ Event publishing confirmed (`CaseCreated`, `CaseUpdated`, `CaseDeleted`)
- ✅ AbortError propagation tested (especially in `UpdateCaseUseCase`)
- ✅ Custom identifiers and timestamps handled for import flows

### 2. Create Service Layer _(Status: ✅ Complete with hybrid architecture - 11 tests passing)_

- ✅ `application/services/CaseManagementService.ts` coordinates all four case use cases with Sonner toast feedback
- ✅ Service methods: `loadCases`, `createCaseWithFeedback`, `updateCaseWithFeedback`, `updateCaseStatus`, `deleteCaseWithFeedback`
- ✅ **NEW:** `application/services/CaseServiceFactory.ts` (166 LOC) implements facade pattern:
  - Provides `CaseServiceContract` interface for uniform API
  - `LegacyCaseService` wraps `CaseManagementAdapter` (DataManager path)
  - `ModernCaseService` wraps `CaseManagementService` (use case path)
  - Feature flag controlled switching between implementations
- ✅ Factory integrated into `CaseServiceContext` - single point of instantiation
- ✅ Full test coverage: 11 tests for service layer + 26 tests for adapter
- ✅ AbortError handling verified with toast dismissal behavior
- ✅ `caseLegacyMapper` bridges `CaseDisplay` ↔ domain `Case` conversions

### Architecture Benefits

- Zero breaking changes: components use same interface regardless of backend
- A/B testing ready: can toggle between legacy/modern via feature flags
- Gradual migration: factory allows partial rollout domain-by-domain
- Clean rollback: disable feature flag to revert to legacy adapter

### Next actions

- Complete final hook refactor to remove remaining business logic (165 → ~50 lines)
- Monitor feature flag telemetry once deployed to production
- Replicate pattern for Financial and Note domains

### 3. Refactor useCaseManagement Hook _(Status: 🟡 In Progress - 165/175 LOC, target ~50)_

- ✅ `hooks/useCaseManagement.ts` refactored to delegate to `CaseServiceContract` via `useCaseService()` hook
- ✅ Service facade abstraction complete - hook doesn't know if it's calling legacy or modern implementation
- ✅ Test coverage maintained: 3 tests passing including error handling scenarios
- ⚠️ Still at 165 LOC (reduced from 178) - needs final simplification to reach ~50 line target
- ⚠️ Hook still manages local React state (`cases`, `loading`, `error`, `hasLoadedData`)

### Remaining work

- Move state management from hook to `ApplicationState` selectors where appropriate
- Eliminate redundant error handling now covered by service layer
- Remove state setters exposed to external components (`setCases`, `setError`, `setHasLoadedData`)
- Consider if note operations should remain here or move to dedicated note service

### Target structure (~50 lines)

```typescript
export function useCaseManagement() {
  const service = useCaseService();
  const cases = useApplicationState(state => state.cases);

  const loadCases = useCallback(async () => {
    return await service.loadCases();
  }, [service]);

  // Similar simple delegations for other operations...

  return { cases, loadCases, saveCase, deleteCase, ... };
}
```

### 4. Repeat Pattern for Financial Items _(Status: not started)_

- Hooks `useFinancialItemFlow.ts` and `useFinancialItems.ts` still depend directly on `DataManager` and `AutosaveFileService` (170 and 172 LOC respectively).
- No domain use cases or services exist for financial items yet.

### Next actions

- Define domain use cases (`AddFinancialItemUseCase`, `UpdateFinancialItemUseCase`, `DeleteFinancialItemUseCase`, `GetFinancialItemsUseCase`) mirroring the case pattern.
- Create `FinancialManagementService` plus tests, then refactor both hooks to delegate.

### 5. Repeat Pattern for Notes _(Status: not started)_

- `useNoteFlow.ts` remains 182 LOC with direct `DataManager` access.
- Note use cases/services are not yet defined.

### Next actions

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
- [x] CaseManagementService orchestrates flows (hybrid architecture implemented)
- [x] CaseServiceFactory provides facade pattern with feature flag support
- [x] useCaseManagement hook integrated with service (165 LOC, needs final reduction to ~50)
- [x] Components maintain compatibility (zero breaking changes via facade)
- [x] **All 353 tests passing** (59 test files) - increased from 290 baseline
- [x] **No performance regressions** (smoke test verified)
- [ ] **Final hook simplification** (165 → ~50 LOC via state externalization)
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

✅ Business logic in use cases (not in hooks) - **ACHIEVED**  
✅ Services orchestrate complex flows - **ACHIEVED with facade pattern**  
🟡 Hooks are thin wrappers (<50 lines each) - **IN PROGRESS (165/50 for cases)**  
✅ Components only call hooks (never services directly) - **ACHIEVED**  
✅ **All 353 tests passing with 0 regressions** - **ACHIEVED (up from 290)**  
✅ No circular dependencies - **ACHIEVED**  
✅ **Feature flag controlled rollout** - **ACHIEVED**  
⚪ **3 separate PRs merged (one per domain)** - **0/3 complete**  
✅ No performance degradation vs. Phase 2 baseline - **ACHIEVED**

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
