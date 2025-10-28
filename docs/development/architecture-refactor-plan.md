CMSNext Architecture Refactor Plan (Current Status)

Last Updated: October 27, 2025
Status: Planning Phase (Phase 2 Complete, Phase 3 Next)
Target Execution: November 1-30, 2025
Prerequisites: ✅ Phase 1 & Phase 2 Complete

Executive Summary

Transform CMSNext from a monolithic React application into a clean, domain-driven architecture with clear boundaries, worker-ready interfaces, and predictable data flow. This refactor builds on recent infrastructure wins (shadcn migration, telemetry, accessibility) and the completed Phase 1 & Phase 2 foundations (domain entities, event bus, activity logging) to establish sustainable patterns for future growth.

**Recent Progress:**

- ✅ Phase 1 (Foundation): Domain structure, rich entities, unified repository pattern
- ✅ Phase 2 (Event Bus): DomainEventBus, ActivityLogger, decoupled state management
- 🔄 Phase 3 (Next): Hooks migration, use case expansion, event-driven patterns

Goals

Eliminate Race Conditions - Single source of truth for data

Improve Maintainability - Clear domain boundaries and dependencies

Enable Scalability - Worker-ready architecture for performance

Enhance Testability - Isolated domains with dependency injection

Preserve Privacy - Maintain 100% local-first architecture

Non-Goals

❌ Introduce network dependencies or cloud services

❌ Add authentication or user accounts

❌ Change user-facing features or UI

❌ Break backward compatibility with existing data files

Current Architecture Problems

Note: This section reflects the state of the codebase after the initial DataManager refactor (documented in the now-superseded state-management-refactor-plan.md). That refactor successfully consolidated data access into DataManager.ts and standardized error handling, solving our worst "Multiple Sources of Truth" and "Error Handling Gaps" issues.

This new plan is designed to solve the remaining problems.

🚨 Critical Issues

Tangled Dependencies & Monolithic Hooks

Business logic is still heavily coupled to the React layer, living inside large hooks (useCaseManagement, useFinancialItemFlow, useNoteFlow).

The DataManager is a large utility class rather than a true repository, mixing all data concerns (cases, alerts, notes) into one file.

UI components and hooks directly access data utilities, bypassing clear application boundaries.

Impact: Difficult to test business logic in isolation; changes remain fragile and can have wide-ranging side effects.

Complex State Orchestration

The system still relies on manual synchronization calls (e.g., safeNotifyFileStorageChange(), fileService.notifyDataChange()) to manage race conditions.

Global, flag-based logic is still used to coordinate state transitions (e.g., clearFileStorageFlags in AppContent.tsx).

Impact: Unpredictable behavior in edge cases; hard to debug; code is declarative in some places but imperative in others.

Current Architecture State (Actual Codebase)

The following reflects the precise current state of the codebase:

**Data Flow Architecture:**

- File System (primary source of truth)
  - Managed via: AutosaveFileService (1,228+ lines) with write queue, retry logic, permission state machine
- DataManager (2,704 lines, stateless pattern)
  - Pattern: read file → modify → write file (no in-memory caching)
  - Manages all concerns: cases, financials, notes, alerts, activity log, category config
  - All operations go: DataManager → AutosaveFileService → File System Access API
- React State (UI ephemeral state + navigation)
  - Managed via: FileStorageContext (state machine), DataManagerContext, ThemeContext
- fileStorageFlags (localStorage, persistent session flags)
  - Manages: dataBaseline, sessionHadData, inSetupPhase, inConnectionFlow, caseListView

**Sync Mechanisms:**

1. Primary: `safeNotifyFileStorageChange()` - called after data mutations to trigger file writes
2. Secondary: `fileStorageFlags` mutations - used to coordinate state transitions imperatively
3. Supporting: FileStorageContext reducer for lifecycle state management

**Key Infrastructure:**

- FileStorageContext: Encapsulates file system access, permissions, connection state
- AutosaveFileService: Handles file I/O, write queuing, retry logic, directory handle persistence
- Error reporting: fileStorageErrorReporter with telemetry integration
- Logging: createLogger utility for structured logging across domains

**Current Strengths (Foundation for Refactor):**

- ✅ Stateless DataManager pattern = good foundation for repository pattern
- ✅ FileStorageContext isolation = clean Infrastructure layer
- ✅ Structured error handling and logging already in place
- ✅ No in-memory caching to eliminate

📊 Architecture Debt Metrics (Current Status)

Metric

Current

Target

Sources of Truth

3 (File system, React state, fileStorageFlags)

1 (Unified App State)

Manual Sync Points

2 (safeNotifyFileStorageChange + fileStorageFlags mutations)

0 (replaced by domain events)

Window Globals

5+ (localStorage, location.hash, matchMedia, document, window)

0

Domain Boundaries

None (Monolithic utils/)

5

Monolithic Classes

DataManager (2,704 lines)

Multiple domain-specific repositories

Tangled Hooks

683 lines (useCaseManagement: 329, useFinancialItemFlow: 171, useNoteFlow: 183)

Thin orchestration layers

Test Coverage (Domain Logic)

~40% (to be verified via npm run test:coverage)

85%+

Proposed Architecture

Clean Architecture Layers

┌─────────────────────────────────────────────────────────────┐
│ Presentation Layer │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│ │ React UI │ │ Themes │ │ Accessibility │ │
│ │ Components │ │ Context │ │ Patterns │ │
│ └──────────────┘ └──────────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────────┐
│ Application Layer │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│ │ Use Cases │ │ Workflows │ │ Orchestration │ │
│ │ (Hooks) │ │ (Commands) │ │ (Navigation) │ │
│ └──────────────┘ └──────────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────────┐
│ Domain Layer │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│ │ Cases │ │ Financials │ │ Notes │ │
│ │ Domain │ │ Domain │ │ Domain │ │
│ └──────────────┘ └──────────────┘ └──────────────────┘ │
│ ┌──────────────┐ ┌──────────────┐ │
│ │ Alerts │ │ Activity │ │
│ │ Domain │ │ Log │ │
│ └──────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────────┐
│ Infrastructure Layer │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│ │ Storage │ │ Telemetry │ │ Performance │ │
│ │ Repository │ │ Collector │ │ Tracker │ │
│ └──────────────┘ └──────────────┘ └──────────────────┘ │
│ ┌──────────────┐ ┌──────────────┐ │
│ │ File API │ │ Logger │ │
│ │ Adapter │ │ Service │ │
│ └──────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────┘

Domain Boundaries

1. Cases Domain (domain/cases/)

Responsibility: Case lifecycle, person records, status management

// Entities

- Case (aggregate root)
- Person (value object)
- CaseStatus (value object)

// Use Cases

- CreateCase
- UpdateCase
- ArchiveCase
- SearchCases

// Repository Interface

- ICaseRepository

2. Financials Domain (domain/financials/)

Responsibility: Resources, income, expenses, verification

// Entities

- FinancialItem (aggregate root)
- VerificationStatus (value object)
- Frequency (value object)

// Use Cases

- AddFinancialItem
- UpdateFinancialItem
- VerifyFinancialItem
- CalculateTotals

// Repository Interface

- IFinancialRepository

3. Notes Domain (domain/notes/)

Responsibility: Case notes, categories, timestamps

// Entities

- Note (aggregate root)
- NoteCategory (value object)

// Use Cases

- CreateNote
- UpdateNote
- DeleteNote
- FilterNotesByCategory

// Repository Interface

- INoteRepository

4. Alerts Domain (domain/alerts/)

Responsibility: Alert matching, status tracking, MCN linking

// Entities

- Alert (aggregate root)
- AlertMatchStatus (value object)

// Use Cases

- LoadAlerts
- MatchAlertToCase
- UpdateAlertStatus
- ResolveAlert

// Repository Interface

- IAlertRepository

5. Activity Log Domain (domain/activity/)

Responsibility: Event tracking, audit trail, reporting

// Entities

- ActivityEvent (aggregate root)
- EventType (value object)

// Use Cases

- RecordActivity
- QueryActivityLog
- GenerateReport

// Repository Interface

- IActivityRepository

Implementation Plan

Phase 1: Foundation (Week 1, Nov 1-7)

Goal: Establish domain structure and repository pattern

Tasks:

Create domain/ and infrastructure/ folder structure.

Define repository interfaces (ICaseRepository, INoteRepository, etc.).

Build a unified StorageRepository that implements all domain interfaces and uses the existing AutosaveFileService for storage.

Begin migrating logic from DataManager.ts into the new StorageRepository and new domain-specific use case files (e.g., domain/cases/use-cases/CreateCase.ts).

Add comprehensive unit tests for new domain logic, isolated from React.

**Establish performance and test coverage baseline** (before making changes).

Deliverables:

domain/ folder with 5 domain modules (prioritize Cases first).

infrastructure/StorageRepository.ts.

Repository interfaces for each domain.

50+ new domain-level tests.

Performance baseline report.

Success Criteria:

All existing tests still passing.

Domain logic is isolated from the UI.

The repository pattern is proven with at least one domain (e.g., "Cases").

Test coverage baseline established.

**⚠️ Important Notes for Phase 1:**

- **Priority: Start with Cases domain** - It's simpler and will validate the repository pattern before tackling more complex domains
- **Alert domain complexity** - Alerts are significantly more complex than other domains:
  - Separate alerts.json versioning (ALERTS_STORAGE_VERSION = 3)
  - CSV import/parse logic with sophisticated matching
  - Legacy format migration handling
  - MCN matching with case linking
  - Consider deferring alert use case extraction to Phase 2-3, focusing only on alert repository pattern in Phase 1
- **AutosaveFileService is immutable** - Do NOT refactor AutosaveFileService; it's infrastructure boundary. All domain code works through StorageRepository which delegates to AutosaveFileService
- **FileStorageContext remains untouched** - This is the connection/permission management layer; does not change in this phase

Phase 2: State Management (Week 2, Nov 8-14)

Goal: Replace React state sprawl and manual sync with domain-driven state.

Tasks:

Create a lightweight ApplicationState store (e.g., using Zustand or React Context) that will hold the single source of truth.

Implement a simple domain event bus for cross-domain communication (e.g., "CaseUpdated" event).

Refactor the StorageRepository and DataManager to use the event bus, removing all manual safeNotifyFileStorageChange() calls.

Migrate AppContent.tsx to read from the new ApplicationState store.

Remove fileStorageFlags mutations, replacing them with state from the FileStorageContext state machine.

Deliverables:

application/ApplicationState.ts

application/DomainEventBus.ts

Refactored AppContent using the new state store.

Zero window globals or manual sync calls.

Success Criteria:

A single source of truth for all application data.

No manual sync calls.

All 250+ tests passing.

Phase 3: Use Case Extraction (Week 3, Nov 15-21)

Goal: Move all business logic from hooks into domain use cases.

Tasks:

Extract all case management logic from useCaseManagement.ts into domain/cases/use-cases/.

Extract all financial logic from useFinancialItemFlow.ts into domain/financials/use-cases/.

Extract all note logic from useNoteFlow.ts into domain/notes/use-cases/.

Create application-level orchestration hooks (e.g., useCaseService) that call the domain use cases.

Update components to use the new, thinner service hooks.

Deliverables:

15+ domain use case classes/functions.

Simplified hooks that act as thin wrappers to the domain.

Updated components (no logic changes).

Success Criteria:

Business logic is 100% testable without React.

React hooks are reduced to simple state selection and orchestration.

100% backward compatibility.

Phase 4: Worker Preparation (Week 4, Nov 22-30)

Goal: Prepare architecture for Web Worker offloading.

Tasks:

Identify worker-eligible operations (import, export, validation, alert parsing).

Create worker-ready message contracts (serializable inputs/outputs) for the use cases.

Build a WorkerBridge abstraction (which can be a no-op pass-through initially).

Document the worker integration strategy.

Performance baseline before/after refactor.

Deliverables:

infrastructure/WorkerBridge.ts

Worker message type definitions.

Performance comparison report.

Worker integration guide.

Success Criteria:

Worker-ready interfaces are defined.

No performance regressions.

Documentation complete.

Migration Strategy

Gradual Rollout (Strangler Fig Pattern)

Keep Old Code Working

New architecture will be built alongside existing code.

We will use feature flags (if needed) or dependency injection to toggle between the old DataManager logic and the new StorageRepository + Domain Use Cases.

A dual-write period may be used for data safety during migration.

Migrate Domain-by-Domain

Week 1: Cases domain

Week 2: Financials domain

Week 3: Notes & Alerts domains

Week 4: Activity log & cleanup

Test Everything

Existing tests must pass after each migration.

New domain tests added continuously.

Integration tests for cross-domain flows.

Monitor Telemetry

Track error rates during migration.

Compare performance metrics.

Watch for data consistency issues.

Risk Mitigation

High-Risk Areas

Risk

Mitigation

Data Loss

Automatic backups before each phase; dual-write period

Performance Regression

Continuous benchmarking; profiler sessions

Breaking Changes

Feature flags; backward compatibility layer

Test Failures

No merge without green tests; comprehensive coverage

Developer Confusion

Architecture Decision Records (ADRs); pair programming

Rollback Strategy

Each phase has a rollback plan:

Feature flag toggle to disable new code paths.

Revert commits if critical issues are found.

Data backups allow restoration to pre-refactor state.

Success Metrics

Technical Metrics

$$

 Single Source of Truth: 1 data store (vs. 2)


$$

Zero Manual Syncs: No safeNotifyFileStorageChange() calls

$$

 Domain Isolation: 5 independent domain modules


$$

Test Coverage: 85%+ for domain logic (vs. ~40%)

$$

 Bundle Size: <600 kB raw / <160 kB gzipped


$$

Performance: No >10% regression on any baseline

Quality Metrics

$$

 All Tests Passing: 250+ tests green


$$

Zero TypeScript Errors: Strict mode compliance

$$

 Documentation Complete: ADRs for major decisions


$$

Accessibility Maintained: No jest-axe regressions

$$

 Telemetry Healthy: Error rates <1%

Post-Refactor Opportunities

With clean architecture in place, we can:

Web Workers - Offload heavy operations (import/export, alert parsing)

Advanced Caching - Domain-level cache strategies

Optimistic UI - Predictable rollback with domain events

Better Testing - Domain logic tested in isolation

Feature Velocity - New features ship faster with clear boundaries

Architecture Decision Records (ADRs)

ADR-001: Repository Pattern Over Direct File Access

Decision: All data access goes through repository interfaces
Rationale: Testability, worker-readiness, future storage options
Consequences: Slightly more boilerplate, but cleaner boundaries

ADR-002: Domain Events Over Direct Calls

Decision: Use event bus for cross-domain communication
Rationale: Decoupling, easier testing, observability
Consequences: Async communication patterns, event versioning

ADR-003: No Redux or Complex State Libraries

Decision: Lightweight ApplicationState (e.g., Zustand) with domain events
Rationale: Simplicity, no external deps, fits local-first model
Consequences: Custom state management, learning curve

ADR-004: Gradual Rollout with Feature Flags

Decision: New architecture alongside old, toggle per domain
Rationale: Risk mitigation, continuous delivery
Consequences: Temporary code duplication, cleanup required

Timeline

Week

Phase

Deliverables

Nov 1-7

Foundation

Domain structure, repository pattern

Nov 8-14

State Management

Single source of truth, event bus

Nov 15-21

Use Cases

Business logic extraction

Nov 22-30

Worker Prep

Worker-ready interfaces

Total Duration: 4 weeks
Team Size: 3 developers (coordinated via this plan)
Review Cadence: Daily standups, weekly demos

Important Architectural Notes

**Infrastructure Boundaries (Do Not Refactor)**

1. AutosaveFileService (1,228+ lines)
   - Complex write queue, retry logic, IndexedDB persistence
   - File I/O abstraction layer
   - Keep as-is; domain code accesses only through StorageRepository

2. FileStorageContext & FileStorageProvider
   - Permission state machine and connection lifecycle management
   - Remains the connection/auth boundary
   - Do not merge into ApplicationState or domain event bus

3. FileStorageFlags & localStorage
   - Persists caseListView preference and session flags
   - Will be migrated incrementally to ApplicationState in Phase 2
   - Do not eliminate in Phase 1

**State Management Architecture (Post-Refactor)**

The refactored architecture will have 3 distinct state layers:

1. **File System State** (Primary source of truth)
   - Managed by: StorageRepository → AutosaveFileService → FileSystemAccessAPI
   - Not held in memory; always read fresh on demand

2. **Application State** (Post-Phase 2)
   - Managed by: ApplicationState (Zustand or React Context)
   - Holds: Active cases, selected case, UI form state, navigation state
   - Single source for UI consistency

3. **Infrastructure State** (Unchanged)
   - Managed by: FileStorageContext state machine
   - Holds: Connection status, permissions, lifecycle state

**React State Post-Refactor**

React components will only hold:
- UI ephemeral state (form inputs, modals, temporary selections)
- Navigation state (current view, breadcrumbs)
- Subscription to ApplicationState changes

**Alert Domain Special Considerations**

The Alert domain requires special handling due to complexity:
- Separate alerts.json versioning and migration logic
- CSV parsing and alert matching algorithms
- MCN normalization and cross-case linking
- Workflow state persistence and hydration

**Phase 1 approach:** Create alert repository interface only; defer use case extraction.
**Phase 2-3:** Extract alert-specific use cases after pattern proven with simpler domains.

---

## References

- [Clean Architecture Principles](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)

---

## Completed Phases

### ✅ Phase 1: Foundation (October 15-24, 2025)

**Status:** Complete - PR #50 merged

**Deliverables:**
- Domain structure with rich entities (Case, Person)
- Unified StorageRepository implementing all domain repository interfaces
- ApplicationState singleton with Map-based storage
- CreateCase use case with optimistic update + rollback pattern
- Comprehensive test coverage (211 tests passing)

**Key Learnings:**
- Optimistic update + rollback pattern prevents state/storage divergence
- Rich domain entities with factory methods simplify validation
- Unified repository pattern reduces code duplication
- ApplicationState singleton provides single source of truth for in-memory state

**Documentation:** `docs/development/phase-1-completion-summary.md`

---

### ✅ Phase 2: Event Bus (October 16-27, 2025)

**Status:** Complete - PR #54 ready to merge

**Deliverables:**
- DomainEventBus for decoupled event publishing
- ActivityLogger service with automatic persistence and rollback
- UpdateCase and DeleteCase use cases
- Rich domain entities for FinancialItem, Note, Alert
- 79 additional tests (290 total passing, 0 regressions)

**Key Learnings:**
- Event-driven architecture enables future extensibility (alerts, telemetry, offline sync)
- Centralized ActivityLogger prevents duplicate tracking logic
- Rollback support in ActivityLogger prevents audit trail corruption
- Enhanced test helpers improve test reliability

**Documentation:**
- `docs/development/state-management-strategy.md`
- `docs/development/phase-2-completion-summary.md`
- `docs/development/phase-3-completion-checklist.md`

---

## Next Steps:

1. ✅ ~~Complete Phase 4 telemetry captures (by Oct 30)~~ - Completed in PR #29, #30
2. ✅ ~~Review this plan with stakeholders (Oct 23-30)~~ - Documented in phase summaries
3. ✅ ~~Kick off Phase 1: Foundation (Nov 1)~~ - Completed October 24
4. ✅ ~~Complete Phase 2: Event Bus~~ - Completed October 27, ready to merge
5. 🔄 **Begin Phase 3: Hooks Migration** - Target: November 1-15, 2025
$$
