CMSNext Architecture Refactor Plan (Current Status)

Last Updated: October 23, 2025
Status: Planning Phase
Target Execution: November 1-30, 2025
Prerequisites: 85% Complete (Phase 4 telemetry captures pending)

Executive Summary

Transform CMSNext from a monolithic React application into a clean, domain-driven architecture with clear boundaries, worker-ready interfaces, and predictable data flow. This refactor builds on recent infrastructure wins (shadcn migration, telemetry, accessibility) to establish sustainable patterns for future growth.

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

📊 Architecture Debt Metrics (Current Status)

Metric

Current

Target

Sources of Truth

2 (DataManager, React State)

1 (Unified App State)

Manual Sync Points

Multiple (in DataManager, etc.)

0

Window Globals

2+ (via fileStorageFlags)

0

Domain Boundaries

None (Monolithic utils/)

5

Test Coverage (Domain Logic)

~40%

85%+

Proposed Architecture

Clean Architecture Layers

┌─────────────────────────────────────────────────────────────┐
│                       Presentation Layer                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   React UI   │  │    Themes    │  │  Accessibility   │  │
│  │  Components  │  │   Context    │  │    Patterns      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Use Cases   │  │   Workflows  │  │  Orchestration   │  │
│  │   (Hooks)    │  │  (Commands)  │  │   (Navigation)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                         Domain Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │    Cases     │  │  Financials  │  │      Notes       │  │
│  │   Domain     │  │   Domain     │  │     Domain       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │    Alerts    │  │   Activity   │                       │
│  │   Domain     │  │    Log       │                       │
│  └──────────────┘  └──────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Storage    │  │   Telemetry  │  │   Performance    │  │
│  │  Repository  │  │   Collector  │  │    Tracker       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │   File API   │  │    Logger    │                       │
│  │   Adapter    │  │   Service    │                       │
│  └──────────────┘  └──────────────┘                       │
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

Deliverables:

domain/ folder with 5 domain modules.

infrastructure/StorageRepository.ts.

Repository interfaces for each domain.

50+ new domain-level tests.

Success Criteria:

All existing tests still passing.

Domain logic is isolated from the UI.

The repository pattern is proven with at least one domain (e.g., "Cases").

Phase 2: State Management (Week 2, Nov 8-14)

Goal: Replace React state sprawl and manual sync with domain-driven state.

Tasks:

Create a lightweight ApplicationState store (e.g., using Zustand or React Context) that will hold the single source of truth.

Implement a simple domain event bus for cross-domain communication (e.g., "CaseUpdated" event).

Refactor the StorageRepository and DataManager to use the event bus, removing all manual safeNotifyFileStorageChange() calls.

Migrate AppContent.tsx to read from the new ApplicationState store.

Remove all window globals and fileStorageFlags logic, replacing it with state from the FileStorageContext state machine.

Deliverables:

application/ApplicationState.ts

application/DomainEventBus.ts

Refactored AppContent using the new state store.

Zero window globals or manual sync calls.

Success Criteria:

A single source of truth for all application data.

No manual sync calls.

All 211+ tests passing.

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

$$$$

 Single Source of Truth: 1 data store (vs. 2)

$$$$

 Zero Manual Syncs: No safeNotifyFileStorageChange() calls

$$$$

 Domain Isolation: 5 independent domain modules

$$$$

 Test Coverage: 85%+ for domain logic (vs. ~40%)

$$$$

 Bundle Size: <600 kB raw / <160 kB gzipped

$$$$

 Performance: No >10% regression on any baseline

Quality Metrics

$$$$

 All Tests Passing: 250+ tests green

$$$$

 Zero TypeScript Errors: Strict mode compliance

$$$$

 Documentation Complete: ADRs for major decisions

$$$$

 Accessibility Maintained: No jest-axe regressions

$$$$

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

References

Clean Architecture Principles

Domain-Driven Design

Repository Pattern

Next Steps:

Complete Phase 4 telemetry captures (by Oct 30)

Review this plan with stakeholders (Oct 23-30)

Kick off Phase 1: Foundation (Nov 1)
