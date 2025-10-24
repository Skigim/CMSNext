# Architecture Refactor - Phase Issue Templates

This document contains detailed issue templates for each phase of the architecture refactor. Copy the relevant template when creating issues for tracking work.

---

## Phase 1: Foundation (Week 1, Nov 1-7)

### Issue Template: Phase 1 - Establish Domain Structure and Repository Pattern

**Goal:** Establish domain structure and repository pattern

**Labels:** `refactor`, `phase-1`, `architecture`, `foundation`

**Assignees:** [Team members]

**Milestone:** Phase 1 - Foundation

#### Description

Establish the foundational domain-driven architecture by creating domain boundaries, repository interfaces, and proving the pattern with the Cases domain.

#### Tasks

**Pre-Phase Baselines:**

- [ ] Run `npm run test:coverage` and document baseline coverage percentage
- [ ] Run performance baseline script and capture metrics
- [ ] Document current DataManager method count and LOC
- [ ] Create baseline metrics document in `docs/development/baseline-metrics.md`

**Domain Structure:**

- [ ] Create `domain/` folder structure with 5 domain modules:
  - [ ] `domain/cases/`
  - [ ] `domain/financials/`
  - [ ] `domain/notes/`
  - [ ] `domain/alerts/`
  - [ ] `domain/activity/`
- [ ] Create `domain/cases/entities/` (Case, Person, CaseStatus)
- [ ] Create `domain/cases/use-cases/` folder structure
- [ ] Create `domain/cases/repositories/` folder structure

**Repository Interfaces:**

- [ ] Define `ICaseRepository` interface with all required methods
- [ ] Define `IFinancialRepository` interface
- [ ] Define `INoteRepository` interface
- [ ] Define `IAlertRepository` interface (basic only)
- [ ] Define `IActivityRepository` interface
- [ ] Document repository contracts in ADR

**Infrastructure Layer:**

- [ ] Create `infrastructure/` folder
- [ ] Create `infrastructure/StorageRepository.ts` class
- [ ] Implement `ICaseRepository` in StorageRepository
- [ ] Wire StorageRepository to use existing AutosaveFileService
- [ ] Add error handling and logging to repository methods

**Cases Domain Migration (Priority):**

- [ ] Extract `CreateCase` use case from DataManager
- [ ] Extract `UpdateCase` use case from DataManager
- [ ] Extract `ArchiveCase` use case from DataManager
- [ ] Extract `SearchCases` use case from DataManager
- [ ] Create `domain/cases/use-cases/CreateCase.ts` with tests
- [ ] Create `domain/cases/use-cases/UpdateCase.ts` with tests
- [ ] Create `domain/cases/use-cases/ArchiveCase.ts` with tests
- [ ] Create `domain/cases/use-cases/SearchCases.ts` with tests

**Testing:**

- [ ] Set up domain test infrastructure (vitest config)
- [ ] Add 50+ domain-level unit tests for Cases use cases
- [ ] Ensure all tests are isolated from React
- [ ] Add integration tests for StorageRepository → AutosaveFileService flow
- [ ] Verify all existing tests still passing (250+ tests)

**Documentation:**

- [ ] Create ADR-001: Repository Pattern Over Direct File Access
- [ ] Document StorageRepository architecture
- [ ] Update project structure documentation
- [ ] Document how to add new use cases

#### Success Criteria

- [ ] Domain folder structure exists with all 5 modules
- [ ] Repository interfaces defined for all domains
- [ ] StorageRepository implements at least ICaseRepository
- [ ] Cases domain has 4+ use cases extracted and tested
- [ ] 50+ new domain tests passing
- [ ] All existing 250+ tests still passing
- [ ] Zero changes to AutosaveFileService or FileStorageContext
- [ ] Performance baseline captured
- [ ] Test coverage baseline documented

#### Important Notes

**DO NOT REFACTOR:**

- ❌ AutosaveFileService (1,228+ lines) - use as black box
- ❌ FileStorageContext - connection layer stays untouched
- ❌ FileStorageFlags - will migrate in Phase 2

**Priority:**

- ✅ Start with Cases domain (simplest)
- ✅ Alert domain: repository interface only, defer use cases to Phase 2-3
- ✅ Validate repository pattern before moving to complex domains

**Dependencies:**

- AutosaveFileService (existing)
- DataManager (will gradually replace)
- Existing test infrastructure

**Estimated Effort:** 40 hours (1 week, 3 developers)

---

## Phase 2: State Management (Week 2, Nov 8-14)

### Issue Template: Phase 2 - Replace Manual Sync with Domain-Driven State

**Goal:** Replace React state sprawl and manual sync with domain-driven state

**Labels:** `refactor`, `phase-2`, `architecture`, `state-management`

**Assignees:** [Team members]

**Milestone:** Phase 2 - State Management

#### Description

Eliminate manual synchronization calls and create a single source of truth for application state using a lightweight state store and domain event bus.

#### Tasks

**Application State Store:**

- [ ] Choose state management solution (Zustand or React Context)
- [ ] Create `application/` folder
- [ ] Create `application/ApplicationState.ts`
- [ ] Define state shape (cases, selectedCase, navigation, etc.)
- [ ] Implement state getters and setters
- [ ] Add state persistence strategy (if needed)

**Domain Event Bus:**

- [ ] Create `application/DomainEventBus.ts`
- [ ] Implement event subscription/unsubscription
- [ ] Define core domain events:
  - [ ] `CaseCreated`
  - [ ] `CaseUpdated`
  - [ ] `CaseDeleted`
  - [ ] `FinancialItemAdded`
  - [ ] `NoteCreated`
  - [ ] `AlertStatusChanged`
  - [ ] `ActivityLogUpdated`
- [ ] Add event logging for debugging
- [ ] Create event type definitions

**Repository Integration:**

- [ ] Refactor StorageRepository to emit domain events after writes
- [ ] Remove all `safeNotifyFileStorageChange()` calls from repository
- [ ] Add event emission to each repository method
- [ ] Test event emission with unit tests

**AppContent Migration:**

- [ ] Refactor `AppContent.tsx` to use ApplicationState
- [ ] Replace direct state variables with state store subscriptions
- [ ] Update all state setters to use ApplicationState
- [ ] Test component renders with new state

**FileStorageFlags Migration:**

- [ ] Audit all `fileStorageFlags` usage
- [ ] Migrate `dataBaseline` to ApplicationState
- [ ] Migrate `sessionHadData` to ApplicationState
- [ ] Migrate `inSetupPhase` to ApplicationState
- [ ] Migrate `inConnectionFlow` to ApplicationState
- [ ] Keep `caseListView` in localStorage (user preference)
- [ ] Remove `clearFileStorageFlags()` calls from AppContent
- [ ] Update `useConnectionFlow` to use ApplicationState

**Testing:**

- [ ] Add unit tests for ApplicationState
- [ ] Add unit tests for DomainEventBus
- [ ] Add integration tests for event flow (use case → event → state update)
- [ ] Verify all 250+ tests still passing
- [ ] Add tests for state persistence (if applicable)

**Documentation:**

- [ ] Create ADR-002: Domain Events Over Direct Calls
- [ ] Create ADR-003: Lightweight ApplicationState Over Redux
- [ ] Document state management architecture
- [ ] Update state flow diagrams

#### Success Criteria

- [ ] ApplicationState store exists with single source of truth
- [ ] DomainEventBus handles all cross-domain communication
- [ ] Zero `safeNotifyFileStorageChange()` calls remaining
- [ ] Zero `fileStorageFlags` mutations for state coordination
- [ ] AppContent uses ApplicationState instead of local state
- [ ] All 250+ tests passing
- [ ] No performance regressions (compare to baseline)

#### Important Notes

**State Layers (Post-Phase 2):**

1. **File System State** - Primary source of truth (AutosaveFileService)
2. **Application State** - Single source for UI consistency (new)
3. **Infrastructure State** - Connection/permissions (FileStorageContext - unchanged)

**DO NOT:**

- ❌ Merge FileStorageContext into ApplicationState
- ❌ Eliminate all localStorage (keep caseListView preference)
- ❌ Change AutosaveFileService

**Dependencies:**

- Phase 1 (repository pattern established)
- StorageRepository from Phase 1
- FileStorageContext (existing)

**Estimated Effort:** 40 hours (1 week, 3 developers)

---

## Phase 3: Use Case Extraction (Week 3, Nov 15-21)

### Issue Template: Phase 3 - Extract Business Logic from Hooks

**Goal:** Move all business logic from hooks into domain use cases

**Labels:** `refactor`, `phase-3`, `architecture`, `domain-logic`

**Assignees:** [Team members]

**Milestone:** Phase 3 - Use Case Extraction

#### Description

Extract all business logic from React hooks into testable domain use cases, making hooks thin orchestration layers.

#### Tasks

**Cases Domain Extraction:**

- [ ] Extract logic from `useCaseManagement.ts` (329 lines total):
  - [ ] `loadCases` → `domain/cases/use-cases/LoadCases.ts`
  - [ ] `saveCase` → `domain/cases/use-cases/SaveCase.ts`
  - [ ] `deleteCase` → `domain/cases/use-cases/DeleteCase.ts`
  - [ ] `updateCaseStatus` → `domain/cases/use-cases/UpdateCaseStatus.ts`
  - [ ] `importCases` → `domain/cases/use-cases/ImportCases.ts`
- [ ] Add unit tests for each use case (isolated from React)
- [ ] Refactor `useCaseManagement` to call use cases
- [ ] Verify hook is now <50 lines (thin orchestration)

**Financials Domain Extraction:**

- [ ] Extract logic from `useFinancialItemFlow.ts` (171 lines total):
  - [ ] `handleCreateItem` → `domain/financials/use-cases/CreateFinancialItem.ts`
  - [ ] `handleDeleteItem` → `domain/financials/use-cases/DeleteFinancialItem.ts`
  - [ ] `handleBatchUpdateItem` → `domain/financials/use-cases/UpdateFinancialItem.ts`
  - [ ] `calculateTotals` (if exists) → `domain/financials/use-cases/CalculateTotals.ts`
- [ ] Add unit tests for each use case
- [ ] Refactor `useFinancialItemFlow` to call use cases
- [ ] Verify hook is now <50 lines

**Notes Domain Extraction:**

- [ ] Extract logic from `useNoteFlow.ts` (183 lines total):
  - [ ] `handleSaveNote` → `domain/notes/use-cases/SaveNote.ts`
  - [ ] `handleDeleteNote` → `domain/notes/use-cases/DeleteNote.ts`
  - [ ] `handleBatchCreateNote` → `domain/notes/use-cases/CreateNote.ts`
  - [ ] `handleBatchUpdateNote` → `domain/notes/use-cases/UpdateNote.ts`
  - [ ] Filtering logic → `domain/notes/use-cases/FilterNotesByCategory.ts`
- [ ] Add unit tests for each use case
- [ ] Refactor `useNoteFlow` to call use cases
- [ ] Verify hook is now <50 lines

**Alerts Domain Extraction (Deferred from Phase 1):**

- [ ] Extract alert matching logic → `domain/alerts/use-cases/MatchAlertToCase.ts`
- [ ] Extract status update logic → `domain/alerts/use-cases/UpdateAlertStatus.ts`
- [ ] Extract resolution logic → `domain/alerts/use-cases/ResolveAlert.ts`
- [ ] Extract CSV import → `domain/alerts/use-cases/ImportAlertsFromCSV.ts`
- [ ] Handle alerts.json versioning in repository layer
- [ ] Add unit tests for alert use cases
- [ ] Refactor `useAlertsFlow` to call use cases

**Activity Log Domain Extraction:**

- [ ] Extract activity recording → `domain/activity/use-cases/RecordActivity.ts`
- [ ] Extract log querying → `domain/activity/use-cases/QueryActivityLog.ts`
- [ ] Extract report generation → `domain/activity/use-cases/GenerateActivityReport.ts`
- [ ] Add unit tests for activity use cases
- [ ] Refactor `useCaseActivityLog` to call use cases

**Application-Level Orchestration:**

- [ ] Create `application/services/CaseService.ts` (orchestrates case use cases)
- [ ] Create `application/services/FinancialService.ts`
- [ ] Create `application/services/NoteService.ts`
- [ ] Create `application/services/AlertService.ts`
- [ ] Create `application/services/ActivityService.ts`
- [ ] Update hooks to use services instead of direct use case calls

**Component Updates:**

- [ ] Update `CaseList` to use new hook signatures
- [ ] Update `CaseDetails` to use new hook signatures
- [ ] Update `FinancialItemCard` to use new hook signatures
- [ ] Update `NotesSection` to use new hook signatures
- [ ] Update `AlertsPreviewPanel` to use new hook signatures
- [ ] Verify no logic in components (display only)

**Testing:**

- [ ] Add 15+ domain use case unit tests
- [ ] Verify all use cases testable without React
- [ ] Add integration tests for service orchestration
- [ ] Verify all 250+ tests still passing
- [ ] Test backward compatibility (same user-facing behavior)

**Documentation:**

- [ ] Document use case pattern
- [ ] Document service orchestration pattern
- [ ] Update architecture diagrams
- [ ] Create guide: "How to Add a New Use Case"

#### Success Criteria

- [ ] All business logic extracted from hooks
- [ ] 15+ new domain use case classes/functions
- [ ] All hooks are <50 lines (thin wrappers)
- [ ] All use cases have unit tests (isolated from React)
- [ ] All 250+ tests passing
- [ ] 100% backward compatibility (no user-facing changes)
- [ ] Test coverage increased to 70%+

#### Important Notes

**Hook Transformation:**

```javascript
// BEFORE (business logic in hook):
const saveCase = async (data) => {
  const validated = validateCase(data);
  const transformed = transformData(validated);
  await dataManager.saveCase(transformed);
  toast.success("Saved!");
};

// AFTER (thin orchestration):
const saveCase = async (data) => {
  const result = await caseService.saveCase(data);
  if (result.success) toast.success("Saved!");
};
```

**Alert Complexity:**

- Alert domain is most complex (defer if needed)
- Focus on Cases/Financials/Notes first
- Alerts can be completed early in Phase 3 or deferred to end

**Dependencies:**

- Phase 1 (domain structure)
- Phase 2 (ApplicationState & DomainEventBus)
- All repository interfaces from Phase 1

**Estimated Effort:** 40 hours (1 week, 3 developers)

---

## Phase 4: Worker Preparation (Week 4, Nov 22-30)

### Issue Template: Phase 4 - Prepare Architecture for Web Workers

**Goal:** Prepare architecture for Web Worker offloading

**Labels:** `refactor`, `phase-4`, `architecture`, `performance`, `workers`

**Assignees:** [Team members]

**Milestone:** Phase 4 - Worker Preparation

#### Description

Define worker-ready interfaces and create the foundation for offloading heavy operations to Web Workers without actually implementing workers yet.

#### Tasks

**Worker-Eligible Operations Analysis:**

- [ ] Identify CPU-intensive operations:
  - [ ] CSV import/parsing (alerts, cases)
  - [ ] Data validation (case data, financial items)
  - [ ] Alert matching algorithm
  - [ ] Activity report generation
  - [ ] Data transformation (legacy format conversion)
- [ ] Profile operations to measure impact (>50ms = candidate)
- [ ] Prioritize operations by performance impact
- [ ] Document findings in `docs/development/worker-candidates.md`

**Message Contracts (Serialization):**

- [ ] Define worker message types in `infrastructure/workers/types.ts`:
  - [ ] `ImportCasesMessage` (input/output)
  - [ ] `ImportAlertsMessage` (input/output)
  - [ ] `MatchAlertsMessage` (input/output)
  - [ ] `GenerateReportMessage` (input/output)
  - [ ] `ValidateDataMessage` (input/output)
- [ ] Ensure all message types are serializable (no functions, no class instances)
- [ ] Add TypeScript validation for message contracts
- [ ] Document serialization constraints

**WorkerBridge Abstraction:**

- [ ] Create `infrastructure/workers/WorkerBridge.ts`
- [ ] Implement pass-through mode (no-op, runs in main thread)
- [ ] Add `execute<T>(message: WorkerMessage): Promise<T>` method
- [ ] Add worker pool management (stubs for future)
- [ ] Add error handling and timeout logic
- [ ] Make it easy to toggle worker vs. main thread execution

**Use Case Worker Preparation:**

- [ ] Refactor `ImportAlertsFromCSV` to be worker-compatible:
  - [ ] Extract pure logic functions (no dependencies)
  - [ ] Ensure all inputs/outputs are serializable
  - [ ] Add WorkerBridge wrapper (pass-through mode)
- [ ] Refactor `ImportCases` to be worker-compatible
- [ ] Refactor `MatchAlertToCase` to be worker-compatible
- [ ] Refactor `GenerateActivityReport` to be worker-compatible
- [ ] Add unit tests for worker-compatible use cases

**Infrastructure Boundary:**

- [ ] Document what stays in main thread:
  - [ ] AutosaveFileService (File System Access API not available in workers)
  - [ ] FileStorageContext (same reason)
  - [ ] React state management
  - [ ] DOM operations
- [ ] Document what can move to workers:
  - [ ] Pure data processing
  - [ ] Validation logic
  - [ ] Parsing/transformation
  - [ ] Report generation
- [ ] Create architecture diagram showing worker boundary

**Performance Baseline & Comparison:**

- [ ] Run performance baseline from Phase 1 again
- [ ] Run benchmarks on worker-eligible operations (main thread)
- [ ] Document current performance metrics:
  - [ ] Alert import time (1000 alerts)
  - [ ] Case import time (1000 cases)
  - [ ] Report generation time
  - [ ] Alert matching time
- [ ] Create performance comparison report (before/after refactor)
- [ ] Verify no regressions (must be within 10% of baseline)

**Testing:**

- [ ] Add tests for WorkerBridge (pass-through mode)
- [ ] Add tests for serializable message contracts
- [ ] Add integration tests for worker-compatible use cases
- [ ] Verify all 250+ tests still passing
- [ ] Test error handling in WorkerBridge

**Documentation:**

- [ ] Create ADR-005: Worker-Ready Architecture
- [ ] Create `docs/development/worker-integration-guide.md`:
  - [ ] How to make a use case worker-compatible
  - [ ] Message contract guidelines
  - [ ] When to use workers vs. main thread
  - [ ] How to implement actual workers (future)
- [ ] Document WorkerBridge API
- [ ] Update architecture diagrams with worker boundary

#### Success Criteria

- [ ] Worker-eligible operations identified and documented
- [ ] Message contracts defined for all worker candidates
- [ ] WorkerBridge abstraction exists (pass-through mode working)
- [ ] 4+ use cases refactored to be worker-compatible
- [ ] Performance comparison report shows no regressions (within 10%)
- [ ] All 250+ tests passing
- [ ] Documentation complete for future worker implementation
- [ ] Clear path to enable actual workers in future

#### Important Notes

**What This Phase IS:**

- ✅ Identify worker candidates
- ✅ Create serializable interfaces
- ✅ Build abstraction layer (pass-through mode)
- ✅ Refactor use cases to be worker-ready
- ✅ Document future implementation path

**What This Phase IS NOT:**

- ❌ Implementing actual Web Workers
- ❌ Moving code to worker threads
- ❌ Performance optimization through parallelization
- ❌ Adding Comlink or worker libraries

**Future Implementation (Post-Refactor):**
When ready to enable workers, you'll:

1. Implement actual worker files (e.g., `workers/import.worker.ts`)
2. Update WorkerBridge to spawn real workers
3. Test performance improvement
4. Roll out gradually with feature flags

**Performance Target:**

- No regressions: All operations within 10% of Phase 1 baseline
- Future worker gains: Expect 2-5x speedup on heavy operations

**Dependencies:**

- Phase 1 (repository pattern)
- Phase 2 (ApplicationState)
- Phase 3 (use cases extracted)
- Performance baseline from Phase 1

**Estimated Effort:** 40 hours (1 week, 3 developers)

---

## Post-Refactor: Cleanup & Documentation

### Issue Template: Post-Refactor Cleanup

**Goal:** Remove old code and finalize documentation

**Labels:** `refactor`, `cleanup`, `documentation`

**Assignees:** [Team members]

**Milestone:** Refactor Complete

#### Description

Complete the refactor by removing deprecated code, updating all documentation, and celebrating the win.

#### Tasks

**Code Cleanup:**

- [ ] Remove old DataManager methods that are fully replaced
- [ ] Remove deprecated hooks (if fully replaced)
- [ ] Remove `safeNotifyFileStorageChange.ts` (if no longer used)
- [ ] Clean up any feature flags or dual-write code
- [ ] Remove temporary compatibility layers
- [ ] Run linter and fix all issues
- [ ] Update all imports to use new paths

**Documentation:**

- [ ] Update `README.md` with new architecture
- [ ] Update `docs/PROJECT_STRUCTURE.md`
- [ ] Finalize all ADRs
- [ ] Create architecture overview diagram
- [ ] Document all domain boundaries
- [ ] Update onboarding documentation
- [ ] Create video/presentation of new architecture

**Testing:**

- [ ] Run full test suite (all 250+ tests)
- [ ] Run coverage report (target: 85%+)
- [ ] Run performance benchmarks (compare to baseline)
- [ ] Test all user flows end-to-end
- [ ] Test in multiple browsers (Chrome, Firefox, Safari, Edge)

**Metrics & Reporting:**

- [ ] Measure final metrics:
  - [ ] Sources of truth: 1 (Application State) ✓
  - [ ] Manual sync points: 0 ✓
  - [ ] Window globals: 0 (or minimal) ✓
  - [ ] Domain boundaries: 5 ✓
  - [ ] Test coverage: 85%+ ✓
- [ ] Create before/after comparison report
- [ ] Document lessons learned
- [ ] Share success story with team

**Celebration:**

- [ ] Team retrospective
- [ ] Document wins and challenges
- [ ] Plan next improvements

#### Success Criteria

- [ ] All old code removed
- [ ] All documentation updated
- [ ] All tests passing (250+)
- [ ] Test coverage 85%+
- [ ] Performance at or better than baseline
- [ ] Architecture goals achieved
- [ ] Team understands new architecture

**Estimated Effort:** 16 hours (2 days, 3 developers)

---

## Notes for Issue Creation

**Labels to use:**

- `refactor` - All refactor-related work
- `phase-1`, `phase-2`, `phase-3`, `phase-4` - Phase-specific
- `architecture` - Architectural changes
- `testing` - Test-related work
- `documentation` - Documentation work
- `priority: high` - Must complete for phase success

**Milestones:**

- Phase 1 - Foundation (Nov 1-7)
- Phase 2 - State Management (Nov 8-14)
- Phase 3 - Use Case Extraction (Nov 15-21)
- Phase 4 - Worker Preparation (Nov 22-30)

**Team Size:** 3 developers per phase
**Review Cadence:** Daily standups, weekly demos
**Blocking Policy:** No phase starts until previous phase success criteria met

---

_Last Updated: October 23, 2025_
