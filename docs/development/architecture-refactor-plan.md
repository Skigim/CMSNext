# CMSNext Architecture Refactor Plan

**Created:** October 16, 2025  
**Status:** Planning Phase  
**Target Execution:** November 1-30, 2025  
**Prerequisites:** 85% Complete (Phase 4 telemetry captures pending)

---

## Executive Summary

Transform CMSNext from a monolithic React application into a **clean, domain-driven architecture** with clear boundaries, worker-ready interfaces, and predictable data flow. This refactor builds on recent infrastructure wins (shadcn migration, telemetry, accessibility) to establish sustainable patterns for future growth.

### Goals

1. **Eliminate Race Conditions** - Single source of truth for data
2. **Improve Maintainability** - Clear domain boundaries and dependencies
3. **Enable Scalability** - Worker-ready architecture for performance
4. **Enhance Testability** - Isolated domains with dependency injection
5. **Preserve Privacy** - Maintain 100% local-first architecture

### Non-Goals

- ❌ Introduce network dependencies or cloud services
- ❌ Add authentication or user accounts
- ❌ Change user-facing features or UI
- ❌ Break backward compatibility with existing data files

---

## Current Architecture Problems

### 🚨 Critical Issues

1. **Multiple Sources of Truth**
   - React state (`AppContent cases[]`)
   - `FileStorageAPI` internal cache
   - `FileDataProvider` wrapper
   - Actual file system data
   - **Impact:** Data inconsistency, race conditions, difficult debugging

2. **Complex State Orchestration**
   - Window globals for tracking operations
   - Manual `safeNotifyFileStorageChange()` calls
   - Flag-based coordination between components
   - **Impact:** Unpredictable behavior, hard to test

3. **Tangled Dependencies**
   - Components directly import utilities
   - Business logic mixed with UI logic
   - No clear domain boundaries
   - **Impact:** Tight coupling, fragile changes

4. **Error Handling Gaps**
   - Silent failures in save operations
   - Inconsistent recovery strategies
   - Error states not surfaced to users
   - **Impact:** Data loss without awareness

### 📊 Architecture Debt Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Sources of Truth | 4+ | 1 |
| Manual Sync Points | 12+ | 0 |
| Window Globals | 3 | 0 |
| Domain Boundaries | None | 5 |
| Test Coverage (Domain Logic) | ~40% | 85%+ |

---

## Proposed Architecture

### Clean Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   React UI   │  │    Themes    │  │  Accessibility   │  │
│  │  Components  │  │   Context    │  │    Patterns      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Use Cases   │  │   Workflows  │  │  Orchestration   │  │
│  │   (Hooks)    │  │  (Commands)  │  │   (Navigation)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │    Cases     │  │  Financials  │  │      Notes       │  │
│  │   Domain     │  │   Domain     │  │     Domain       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │   Alerts     │  │   Activity   │                        │
│  │   Domain     │  │     Log      │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Storage    │  │   Telemetry  │  │   Performance    │  │
│  │  Repository  │  │   Collector  │  │     Tracker      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │   File API   │  │    Logger    │                        │
│  │   Adapter    │  │   Service    │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Domain Boundaries

#### 1. **Cases Domain** (`domain/cases/`)
**Responsibility:** Case lifecycle, person records, status management

```typescript
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
```

#### 2. **Financials Domain** (`domain/financials/`)
**Responsibility:** Resources, income, expenses, verification

```typescript
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
```

#### 3. **Notes Domain** (`domain/notes/`)
**Responsibility:** Case notes, categories, timestamps

```typescript
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
```

#### 4. **Alerts Domain** (`domain/alerts/`)
**Responsibility:** Alert matching, status tracking, MCN linking

```typescript
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
```

#### 5. **Activity Log Domain** (`domain/activity/`)
**Responsibility:** Event tracking, audit trail, reporting

```typescript
// Entities
- ActivityEvent (aggregate root)
- EventType (value object)

// Use Cases
- RecordActivity
- QueryActivityLog
- GenerateReport

// Repository Interface
- IActivityRepository
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1, Nov 1-7)
**Goal:** Establish domain structure and repository pattern

**Tasks:**
1. Create domain folder structure
2. Define repository interfaces
3. Build unified `StorageRepository` implementing all domain interfaces
4. Migrate `DataManager` logic into domain use cases
5. Add comprehensive unit tests for domain logic

**Deliverables:**
- `domain/` folder with 5 domain modules
- `infrastructure/StorageRepository.ts`
- Repository interfaces for each domain
- 50+ new domain-level tests

**Success Criteria:**
- All existing tests still passing
- Domain logic isolated from UI
- Repository pattern proven with 1 domain

### Phase 2: State Management (Week 2, Nov 8-14)
**Goal:** Replace React state sprawl with domain-driven state

**Tasks:**
1. Create `ApplicationState` store (lightweight, no Redux)
2. Implement domain event bus for cross-domain communication
3. Replace manual sync notifications with automatic events
4. Migrate `AppContent` to use domain use cases
5. Remove window globals and flag-based coordination

**Deliverables:**
- `application/ApplicationState.ts`
- `application/DomainEventBus.ts`
- Refactored `AppContent` using domain hooks
- Zero window globals

**Success Criteria:**
- Single source of truth for all data
- No manual sync calls
- All 211+ tests passing

### Phase 3: Use Case Extraction (Week 3, Nov 15-21)
**Goal:** Move business logic from hooks into domain use cases

**Tasks:**
1. Extract case management logic from `useCaseManagement`
2. Extract financial logic from `useFinancialItemFlow`
3. Extract note logic from `useNoteFlow`
4. Create application-level orchestration hooks
5. Update components to use new hook signatures

**Deliverables:**
- 15+ domain use case classes
- Simplified hooks as thin wrappers
- Updated components (no logic changes)

**Success Criteria:**
- Business logic testable without React
- Hooks reduced to <50 lines each
- 100% backward compatibility

### Phase 4: Worker Preparation (Week 4, Nov 22-30)
**Goal:** Prepare architecture for Web Worker offloading

**Tasks:**
1. Identify worker-eligible operations (import, export, validation)
2. Create worker-ready message contracts
3. Build `WorkerBridge` abstraction (no-op initially)
4. Document worker integration strategy
5. Performance baseline before/after refactor

**Deliverables:**
- `infrastructure/WorkerBridge.ts`
- Worker message type definitions
- Performance comparison report
- Worker integration guide

**Success Criteria:**
- Worker-ready interfaces defined
- No performance regressions
- Documentation complete

---

## Migration Strategy

### Gradual Rollout (Strangler Fig Pattern)

1. **Keep Old Code Working**
   - New architecture alongside existing code
   - Feature flags for domain-by-domain migration
   - Dual-write period for data safety

2. **Migrate Domain-by-Domain**
   - Week 1: Cases domain
   - Week 2: Financials domain
   - Week 3: Notes & Alerts domains
   - Week 4: Activity log & cleanup

3. **Test Everything**
   - Existing tests must pass after each migration
   - New domain tests added continuously
   - Integration tests for cross-domain flows

4. **Monitor Telemetry**
   - Track error rates during migration
   - Compare performance metrics
   - Watch for data consistency issues

---

## Risk Mitigation

### High-Risk Areas

| Risk | Mitigation |
|------|------------|
| **Data Loss** | Automatic backups before each phase; dual-write period |
| **Performance Regression** | Continuous benchmarking; profiler sessions |
| **Breaking Changes** | Feature flags; backward compatibility layer |
| **Test Failures** | No merge without green tests; comprehensive coverage |
| **Developer Confusion** | Architecture Decision Records (ADRs); pair programming |

### Rollback Strategy

Each phase has a rollback plan:
1. Feature flag toggle to disable new code paths
2. Revert commits if critical issues found
3. Data backups allow restoration to pre-refactor state

---

## Success Metrics

### Technical Metrics

- [ ] **Single Source of Truth:** 1 data store (vs. 4+)
- [ ] **Zero Manual Syncs:** No `safeNotifyFileStorageChange()` calls
- [ ] **Domain Isolation:** 5 independent domain modules
- [ ] **Test Coverage:** 85%+ for domain logic (vs. ~40%)
- [ ] **Bundle Size:** <600 kB raw / <160 kB gzipped
- [ ] **Performance:** No >10% regression on any baseline

### Quality Metrics

- [ ] **All Tests Passing:** 250+ tests green
- [ ] **Zero TypeScript Errors:** Strict mode compliance
- [ ] **Documentation Complete:** ADRs for major decisions
- [ ] **Accessibility Maintained:** No jest-axe regressions
- [ ] **Telemetry Healthy:** Error rates <1%

---

## Post-Refactor Opportunities

With clean architecture in place, we can:

1. **Web Workers** - Offload heavy operations (import/export)
2. **Advanced Caching** - Domain-level cache strategies
3. **Optimistic UI** - Predictable rollback with domain events
4. **Better Testing** - Domain logic tested in isolation
5. **Feature Velocity** - New features ship faster with clear boundaries

---

## Architecture Decision Records (ADRs)

### ADR-001: Repository Pattern Over Direct File Access
**Decision:** All data access goes through repository interfaces  
**Rationale:** Testability, worker-readiness, future storage options  
**Consequences:** Slightly more boilerplate, but cleaner boundaries

### ADR-002: Domain Events Over Direct Calls
**Decision:** Use event bus for cross-domain communication  
**Rationale:** Decoupling, easier testing, observability  
**Consequences:** Async communication patterns, event versioning

### ADR-003: No Redux or Complex State Libraries
**Decision:** Lightweight `ApplicationState` with domain events  
**Rationale:** Simplicity, no external deps, fits local-first model  
**Consequences:** Custom state management, learning curve

### ADR-004: Gradual Migration with Feature Flags
**Decision:** New architecture alongside old, toggle per domain  
**Rationale:** Risk mitigation, continuous delivery  
**Consequences:** Temporary code duplication, cleanup required

---

## Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| Nov 1-7 | Foundation | Domain structure, repository pattern |
| Nov 8-14 | State Management | Single source of truth, event bus |
| Nov 15-21 | Use Cases | Business logic extraction |
| Nov 22-30 | Worker Prep | Worker-ready interfaces |

**Total Duration:** 4 weeks  
**Team Size:** 3 developers (coordinated via this plan)  
**Review Cadence:** Daily standups, weekly demos

---

## References

- [State Management Refactor Plan](./state-management-refactor-plan.md)
- [Clean Architecture Principles](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design](https://martinfowler.com/tags/domain%20driven%20design.html)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)

---

**Next Steps:**
1. Complete Phase 4 telemetry captures (by Oct 30)
2. Review this plan with stakeholders (Oct 23-30)
3. Kick off Phase 1: Foundation (Nov 1)
