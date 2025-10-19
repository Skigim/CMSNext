# Architecture Refactor - Multi-Agent Coordination Prompts

**Created:** October 19, 2025  
**Branch:** `feat/architecture-refactor`  
**Agents:** 3 (expandable to 6 if needed)  
**Coordination:** Git commit messages at breakpoints  
**Duration:** 4 weeks (November 1-30, 2025)

---

## 🎯 Mission Overview

Transform CMSNext from a monolithic React application into a clean, domain-driven architecture with:
- **Single source of truth** (eliminate 4+ data stores → 1)
- **Domain boundaries** (5 independent domains)
- **Worker-ready interfaces** (prepare for performance offloading)
- **Zero manual syncs** (eliminate `safeNotifyFileStorageChange()` calls)
- **85%+ test coverage** for domain logic

**Critical Constraints:**
- ✅ All 211 existing tests MUST pass after each phase
- ✅ No breaking changes to user-facing features
- ✅ Maintain 100% local-first architecture (no network deps)
- ✅ No performance regressions >10% on any baseline
- ✅ Backward compatibility with existing data files

---

## 📋 Agent Coordination Protocol

### Git Commit Message Format

**Breakpoint commits** (when waiting for another agent):
```
refactor(track-N): BREAKPOINT - <description>

Agent N waiting for: <specific dependency>
Next step requires: <what's needed>
Resume when: <condition>

Track: <track-name>
Phase: <phase-number>
```

**Progress commits** (normal work):
```
refactor(track-N): <phase> - <description>

- Detailed change 1
- Detailed change 2

Track: <track-name>
Phase: <phase-number>
Tests: <passing/total>
```

**Completion commits**:
```
refactor(track-N): COMPLETE - <track-name>

All phases complete:
- Phase 1: ✅ <summary>
- Phase 2: ✅ <summary>
...

Track: <track-name>
Tests: <passing/total>
Ready for: <next track or integration>
```

### Coordination Rules

1. **Check git log** before starting each phase
2. **Pull latest** from branch before committing
3. **Run tests** before every commit (`npm run test:run`)
4. **Update progress** in commit messages
5. **Signal breakpoints** clearly when blocked
6. **Validate integration** when resuming after breakpoint

---

## 🔧 Track 1: Infrastructure & State Management

**Agent Role:** Foundation Builder  
**Priority:** HIGHEST (other tracks depend on this)  
**Estimated Time:** Week 1-2

### Prerequisites
- ✅ All telemetry baselines captured
- ✅ 211/211 tests passing
- ✅ Performance benchmarks documented

### Phase 1.1: Repository Pattern Foundation (Days 1-2)

**Goal:** Create storage abstraction layer that all domains will use.

**Tasks:**

1. **Create repository interfaces** (`src/domain/common/repositories/`):
   ```typescript
   // IRepository.ts - Base interface
   export interface IRepository<T, TId> {
     getById(id: TId): Promise<T | null>;
     getAll(): Promise<T[]>;
     save(entity: T): Promise<void>;
     delete(id: TId): Promise<void>;
   }

   // ITransactional.ts - For multi-entity operations
   export interface ITransactional {
     beginTransaction(): Promise<void>;
     commit(): Promise<void>;
     rollback(): Promise<void>;
   }
   ```

2. **Create FileSystemStorage adapter** (`src/infrastructure/storage/FileSystemStorage.ts`):
   - Wraps existing `AutosaveFileService`
   - Implements transaction-like semantics
   - Provides JSON read/write operations
   - Error handling with telemetry integration

3. **Create ApplicationState singleton** (`src/application/ApplicationState.ts`):
   ```typescript
   class ApplicationState {
     private cases: Map<string, Case> = new Map();
     private financials: Map<string, FinancialItem> = new Map();
     // ... other domains
     
     // Event bus for cross-domain communication
     private eventBus: EventBus;
     
     // Hydration from file system
     async hydrate(storage: IStorage): Promise<void>;
     
     // Serialization for persistence
     async persist(storage: IStorage): Promise<void>;
   }
   ```

4. **Add feature flags** (`utils/featureFlags.ts`):
   ```typescript
   export const REFACTOR_FLAGS = {
     USE_NEW_ARCHITECTURE: false, // Master toggle
     USE_CASES_DOMAIN: false,
     USE_FINANCIALS_DOMAIN: false,
     USE_NOTES_DOMAIN: false,
     USE_ALERTS_DOMAIN: false,
     USE_ACTIVITY_DOMAIN: false,
   };
   ```

**Tests:**
- Repository interface contracts
- FileSystemStorage adapter operations
- ApplicationState hydration/persistence
- Feature flag toggling

**BREAKPOINT:** Commit with "BREAKPOINT - Foundation ready for domain implementation"  
**Waiting for:** Tracks 2 & 3 to start domain implementations

---

### Phase 1.2: Event Bus & Domain Events (Days 3-4)

**Goal:** Enable domains to communicate without tight coupling.

**Tasks:**

1. **Create EventBus** (`src/application/EventBus.ts`):
   ```typescript
   type EventHandler<T = unknown> = (event: T) => void | Promise<void>;
   
   class EventBus {
     private handlers: Map<string, Set<EventHandler>> = new Map();
     
     subscribe<T>(eventType: string, handler: EventHandler<T>): () => void;
     publish<T>(eventType: string, event: T): Promise<void>;
     publishSync<T>(eventType: string, event: T): void;
   }
   ```

2. **Define domain events** (`src/domain/common/events/`):
   ```typescript
   // DomainEvent.ts
   export interface DomainEvent {
     eventId: string;
     eventType: string;
     aggregateId: string;
     timestamp: Date;
     metadata?: Record<string, unknown>;
   }

   // CaseEvents.ts
   export type CaseCreatedEvent = DomainEvent & { case: Case };
   export type CaseUpdatedEvent = DomainEvent & { case: Case; changes: Partial<Case> };
   
   // FinancialEvents.ts
   export type FinancialItemAddedEvent = DomainEvent & { item: FinancialItem; caseId: string };
   // ... etc
   ```

3. **Integrate telemetry** with event bus:
   - Log all domain events to telemetry collector
   - Track event processing durations
   - Monitor cross-domain event flows

**Tests:**
- Event subscription/unsubscription
- Event publishing (sync & async)
- Event handler error handling
- Telemetry integration

**BREAKPOINT:** Commit with "BREAKPOINT - Event system ready for domain integration"  
**Waiting for:** Tracks 2 & 3 to integrate events into domains

---

### Phase 1.3: Migration Orchestration (Days 5-7)

**Goal:** Provide utilities for gradual migration from old → new architecture.

**Tasks:**

1. **Create DataMigrator** (`src/application/migration/DataMigrator.ts`):
   ```typescript
   class DataMigrator {
     // Convert old DataManager format to new domain models
     async migrateFromDataManager(
       dataManager: DataManager,
       appState: ApplicationState
     ): Promise<void>;
     
     // Dual-write: sync changes to both old and new stores
     async syncToLegacyStore(event: DomainEvent): Promise<void>;
   }
   ```

2. **Create compatibility layer** (`src/application/compatibility/`):
   - `LegacyCaseAdapter`: Maps `Case` domain model ↔ old format
   - `LegacyFinancialAdapter`: Maps `FinancialItem` ↔ old format
   - Ensures existing hooks/components keep working during migration

3. **Update `useConnectionFlow`** to hydrate ApplicationState:
   ```typescript
   // After loading from DataManager
   if (REFACTOR_FLAGS.USE_NEW_ARCHITECTURE) {
     await ApplicationState.getInstance().hydrate(fileSystemStorage);
   }
   ```

**Tests:**
- Data migration from DataManager
- Dual-write synchronization
- Compatibility adapters (old ↔ new format)
- Feature flag-based routing

**COMPLETION:** Commit "refactor(track-1): COMPLETE - Infrastructure & State Management"

**Success Criteria:**
- ✅ Repository pattern implemented
- ✅ Event bus functional
- ✅ ApplicationState singleton ready
- ✅ Migration utilities complete
- ✅ All 211 tests still passing
- ✅ Feature flags control refactor rollout

---

## 🏢 Track 2: Cases & Financials Domains

**Agent Role:** Core Domain Builder  
**Priority:** HIGH (depends on Track 1 Phase 1.1)  
**Estimated Time:** Week 2-3

### Phase 2.1: Cases Domain (Days 1-4)

**Goal:** Extract case logic into isolated domain with clean interfaces.

**DEPENDENCY:** Wait for Track 1 Phase 1.1 (Repository interfaces)

**Tasks:**

1. **Define domain entities** (`src/domain/cases/entities/`):
   ```typescript
   // Case.ts (Aggregate Root)
   export class Case {
     constructor(
       public readonly id: string,
       public person: Person,
       public status: CaseStatus,
       public createdAt: Date,
       public updatedAt: Date,
       private domainEvents: DomainEvent[] = []
     ) {}
     
     // Domain logic methods
     updateStatus(newStatus: CaseStatus): void {
       this.status = newStatus;
       this.updatedAt = new Date();
       this.addDomainEvent(new CaseStatusChangedEvent({ ... }));
     }
     
     archive(): void {
       if (this.status !== CaseStatus.Closed) {
         throw new DomainError('Cannot archive non-closed case');
       }
       this.addDomainEvent(new CaseArchivedEvent({ ... }));
     }
     
     private addDomainEvent(event: DomainEvent): void {
       this.domainEvents.push(event);
     }
     
     getUncommittedEvents(): DomainEvent[] {
       return [...this.domainEvents];
     }
     
     clearEvents(): void {
       this.domainEvents = [];
     }
   }

   // Person.ts (Value Object)
   export class Person {
     constructor(
       public firstName: string,
       public lastName: string,
       public dateOfBirth: Date,
       public mcn: string,
       public address: Address,
       public contact: ContactInfo
     ) {
       this.validate();
     }
     
     private validate(): void {
       if (!this.mcn.match(/^MC\d{4,}$/)) {
         throw new ValidationError('Invalid MCN format');
       }
     }
   }
   ```

2. **Create use cases** (`src/domain/cases/useCases/`):
   ```typescript
   // CreateCase.ts
   export class CreateCaseUseCase {
     constructor(
       private caseRepo: ICaseRepository,
       private eventBus: EventBus
     ) {}
     
     async execute(input: CreateCaseInput): Promise<Case> {
       // Business logic
       const person = new Person({ ...input });
       const caseEntity = new Case(
         generateId(),
         person,
         CaseStatus.Active,
         new Date(),
         new Date()
       );
       
       // Save
       await this.caseRepo.save(caseEntity);
       
       // Publish events
       const events = caseEntity.getUncommittedEvents();
       for (const event of events) {
         await this.eventBus.publish(event.eventType, event);
       }
       caseEntity.clearEvents();
       
       return caseEntity;
     }
   }
   
   // UpdateCase.ts, ArchiveCase.ts, SearchCases.ts...
   ```

3. **Implement CaseRepository** (`src/infrastructure/repositories/CaseRepository.ts`):
   ```typescript
   export class CaseRepository implements ICaseRepository {
     constructor(private storage: IStorage) {}
     
     async getById(id: string): Promise<Case | null> {
       const data = await this.storage.read(`cases/${id}.json`);
       return data ? this.mapToDomain(data) : null;
     }
     
     async save(caseEntity: Case): Promise<void> {
       const data = this.mapToData(caseEntity);
       await this.storage.write(`cases/${caseEntity.id}.json`, data);
     }
     
     private mapToDomain(data: unknown): Case { /* ... */ }
     private mapToData(entity: Case): unknown { /* ... */ }
   }
   ```

4. **Create React hook wrapper** (`src/application/hooks/useCases.ts`):
   ```typescript
   export function useCases() {
     const appState = ApplicationState.getInstance();
     const eventBus = appState.eventBus;
     const caseRepo = new CaseRepository(appState.storage);
     
     const createCase = useCallback(async (input: CreateCaseInput) => {
       const useCase = new CreateCaseUseCase(caseRepo, eventBus);
       return await useCase.execute(input);
     }, []);
     
     return { createCase, /* ... */ };
   }
   ```

**Tests:**
- Case entity domain logic
- Person value object validation
- Use case execution
- Repository CRUD operations
- Hook integration with components

**BREAKPOINT:** Commit "BREAKPOINT - Cases domain ready for financials integration"  
**Waiting for:** Track 2 Phase 2.2 to handle financials

---

### Phase 2.2: Financials Domain (Days 5-7)

**Goal:** Extract financial logic with case relationship handling.

**DEPENDENCY:** Track 2 Phase 2.1 (Cases domain)

**Tasks:**

1. **Define domain entities** (`src/domain/financials/entities/`):
   ```typescript
   // FinancialItem.ts (Aggregate Root)
   export class FinancialItem {
     constructor(
       public readonly id: string,
       public readonly caseId: string, // Foreign key to Cases domain
       public category: FinancialCategory,
       public description: string,
       public amount: number,
       public frequency: Frequency,
       public verificationStatus: VerificationStatus,
       private domainEvents: DomainEvent[] = []
     ) {
       this.validate();
     }
     
     verify(status: VerificationStatus): void {
       this.verificationStatus = status;
       this.addDomainEvent(new FinancialItemVerifiedEvent({ ... }));
     }
     
     updateAmount(newAmount: number): void {
       if (newAmount < 0 && this.category !== FinancialCategory.Expense) {
         throw new DomainError('Only expenses can have negative amounts');
       }
       this.amount = newAmount;
       this.addDomainEvent(new FinancialItemUpdatedEvent({ ... }));
     }
     
     private validate(): void {
       if (this.amount === 0) {
         throw new ValidationError('Amount cannot be zero');
       }
     }
   }
   ```

2. **Create use cases** with cross-domain coordination:
   ```typescript
   // AddFinancialItem.ts
   export class AddFinancialItemUseCase {
     constructor(
       private financialRepo: IFinancialRepository,
       private caseRepo: ICaseRepository, // Verify case exists
       private eventBus: EventBus
     ) {}
     
     async execute(input: AddFinancialItemInput): Promise<FinancialItem> {
       // Verify case exists
       const caseEntity = await this.caseRepo.getById(input.caseId);
       if (!caseEntity) {
         throw new NotFoundError(`Case ${input.caseId} not found`);
       }
       
       // Create item
       const item = new FinancialItem({ ...input });
       await this.financialRepo.save(item);
       
       // Publish events
       const events = item.getUncommittedEvents();
       for (const event of events) {
         await this.eventBus.publish(event.eventType, event);
       }
       item.clearEvents();
       
       return item;
     }
   }
   ```

3. **Implement FinancialRepository**:
   - Store financials grouped by case ID
   - Efficient queries for totals calculation
   - Support filtering by category/verification status

4. **Update components** to use new hooks:
   ```typescript
   // In FinancialItemCard or similar
   const { addFinancialItem, updateFinancialItem } = useFinancials();
   
   const handleSave = async () => {
     if (REFACTOR_FLAGS.USE_FINANCIALS_DOMAIN) {
       await addFinancialItem(formData);
     } else {
       // Old DataManager path
       await dataManager.addFinancialItem(formData);
     }
   };
   ```

**Tests:**
- FinancialItem entity validation
- Use case execution with case verification
- Repository operations
- Cross-domain event handling
- Component integration

**COMPLETION:** Commit "refactor(track-2): COMPLETE - Cases & Financials Domains"

**Success Criteria:**
- ✅ Cases domain fully implemented
- ✅ Financials domain fully implemented
- ✅ Cross-domain relationships working
- ✅ All 211+ tests passing
- ✅ Feature flags enable gradual rollout

---

## 📝 Track 3: Notes, Alerts & Activity Domains

**Agent Role:** Supporting Domain Builder  
**Priority:** MEDIUM (can work parallel to Track 2)  
**Estimated Time:** Week 2-3

### Phase 3.1: Notes Domain (Days 1-3)

**Goal:** Simple domain for case notes with category filtering.

**DEPENDENCY:** Track 1 Phase 1.1 (Repository interfaces)

**Tasks:**

1. **Define domain entities** (`src/domain/notes/entities/`):
   ```typescript
   // Note.ts
   export class Note {
     constructor(
       public readonly id: string,
       public readonly caseId: string,
       public category: NoteCategory,
       public content: string,
       public createdAt: Date,
       public updatedAt: Date,
       private domainEvents: DomainEvent[] = []
     ) {
       this.validate();
     }
     
     updateContent(newContent: string): void {
       this.content = newContent;
       this.updatedAt = new Date();
       this.addDomainEvent(new NoteUpdatedEvent({ ... }));
     }
     
     private validate(): void {
       if (!this.content.trim()) {
         throw new ValidationError('Note content cannot be empty');
       }
     }
   }
   ```

2. **Create use cases**:
   - `CreateNoteUseCase`
   - `UpdateNoteUseCase`
   - `DeleteNoteUseCase`
   - `FilterNotesByCategoryUseCase`

3. **Implement NoteRepository**:
   - Store notes grouped by case ID
   - Efficient filtering by category
   - Chronological ordering

4. **Integrate with NotesSection component**:
   ```typescript
   const { createNote, updateNote, deleteNote } = useNotes();
   ```

**Tests:**
- Note entity validation
- Use case execution
- Repository filtering
- Component integration

---

### Phase 3.2: Alerts Domain (Days 4-5)

**Goal:** Alert matching and status tracking.

**DEPENDENCY:** Track 2 Phase 2.1 (Cases domain for MCN matching)

**Tasks:**

1. **Define domain entities** (`src/domain/alerts/entities/`):
   ```typescript
   // Alert.ts
   export class Alert {
     constructor(
       public readonly id: string,
       public mcn: string,
       public alertType: AlertType,
       public linkedCaseId: string | null,
       public matchStatus: AlertMatchStatus,
       public rawData: unknown,
       private domainEvents: DomainEvent[] = []
     ) {}
     
     linkToCase(caseId: string): void {
       if (this.matchStatus === AlertMatchStatus.Resolved) {
         throw new DomainError('Alert already resolved');
       }
       this.linkedCaseId = caseId;
       this.matchStatus = AlertMatchStatus.Matched;
       this.addDomainEvent(new AlertLinkedEvent({ ... }));
     }
     
     resolve(): void {
       if (!this.linkedCaseId) {
         throw new DomainError('Cannot resolve unlinked alert');
       }
       this.matchStatus = AlertMatchStatus.Resolved;
       this.addDomainEvent(new AlertResolvedEvent({ ... }));
     }
   }
   ```

2. **Create use cases**:
   - `LoadAlertsUseCase`: Import from CSV
   - `MatchAlertToCaseUseCase`: Auto-match by MCN
   - `LinkAlertUseCase`: Manual linking
   - `ResolveAlertUseCase`: Mark as complete

3. **Implement AlertRepository**:
   - Store alerts separately from cases
   - Index by MCN for fast matching
   - Filter by status

4. **Update alert components**:
   ```typescript
   const { matchAlerts, linkAlert, resolveAlert } = useAlerts();
   ```

**Tests:**
- Alert entity state transitions
- Use case MCN matching logic
- Repository queries
- Component integration

**BREAKPOINT:** Commit "BREAKPOINT - Alerts domain ready for activity logging"  
**Waiting for:** Track 3 Phase 3.3

---

### Phase 3.3: Activity Log Domain (Days 6-7)

**Goal:** Audit trail for all domain events.

**DEPENDENCY:** Track 1 Phase 1.2 (Event bus)

**Tasks:**

1. **Define domain entities** (`src/domain/activity/entities/`):
   ```typescript
   // ActivityEvent.ts
   export class ActivityEvent {
     constructor(
       public readonly id: string,
       public eventType: EventType,
       public aggregateId: string,
       public aggregateType: string, // 'case', 'financial', etc.
       public changes: Record<string, unknown>,
       public timestamp: Date,
       public metadata: Record<string, unknown>
     ) {}
   }
   ```

2. **Create ActivityLogger subscriber**:
   ```typescript
   // Subscribe to ALL domain events and log them
   export class ActivityLogger {
     constructor(
       private eventBus: EventBus,
       private activityRepo: IActivityRepository
     ) {
       this.subscribeToAllEvents();
     }
     
     private subscribeToAllEvents(): void {
       eventBus.subscribe('*', async (event: DomainEvent) => {
         const activityEvent = new ActivityEvent({
           id: generateId(),
           eventType: event.eventType,
           aggregateId: event.aggregateId,
           // ...
         });
         await this.activityRepo.save(activityEvent);
       });
     }
   }
   ```

3. **Create use cases**:
   - `GetCaseActivityUseCase`: All events for a case
   - `GetRecentActivityUseCase`: Last N events
   - `GenerateActivityReportUseCase`: Reporting

4. **Implement ActivityRepository**:
   - Append-only event log
   - Index by aggregate ID and timestamp
   - Efficient time-range queries

**Tests:**
- Activity event creation
- Event bus subscription
- Repository queries
- Report generation

**COMPLETION:** Commit "refactor(track-3): COMPLETE - Notes, Alerts & Activity Domains"

**Success Criteria:**
- ✅ Notes domain complete
- ✅ Alerts domain complete
- ✅ Activity logging complete
- ✅ All cross-domain events logged
- ✅ All 211+ tests passing

---

## 🔗 Integration & Cleanup Phase (All Agents)

**Timeline:** Week 4 (After all tracks complete)  
**Coordination:** All agents work together

### Tasks

1. **Enable feature flags progressively**:
   ```typescript
   // Day 1-2: Cases only
   USE_CASES_DOMAIN: true,
   
   // Day 3-4: Cases + Financials
   USE_FINANCIALS_DOMAIN: true,
   
   // Day 5-6: All domains
   USE_NEW_ARCHITECTURE: true,
   ```

2. **Run full test suite** after each flag toggle

3. **Compare performance baselines**:
   ```bash
   npm run bench:autosave
   npm run bench:dashboard
   # Compare to pre-refactor baselines
   ```

4. **Remove old code paths** once all flags enabled:
   - Delete DataManager (keep as backup file)
   - Remove compatibility adapters
   - Clean up dual-write logic

5. **Update documentation**:
   - Architecture diagrams
   - Developer guide for new patterns
   - ADRs for major decisions

6. **Final validation**:
   - All 250+ tests passing
   - No performance regressions
   - Bundle size <600 kB
   - Accessibility checks pass

---

## 📊 Success Checklist

### Infrastructure (Track 1)
- [ ] Repository pattern implemented
- [ ] Event bus functional
- [ ] ApplicationState singleton
- [ ] Migration utilities complete
- [ ] Feature flags working

### Core Domains (Track 2)
- [ ] Cases domain complete
- [ ] Financials domain complete
- [ ] Cross-domain relationships working
- [ ] Hooks integrated with components

### Supporting Domains (Track 3)
- [ ] Notes domain complete
- [ ] Alerts domain complete
- [ ] Activity logging functional
- [ ] All events captured

### Integration
- [ ] All feature flags enabled
- [ ] Old code paths removed
- [ ] Performance baselines met
- [ ] Documentation updated
- [ ] 250+ tests passing

---

## 🚨 Red Flags - Stop Work Immediately

1. **Test failures** that can't be fixed in 30 minutes
2. **Performance regression** >10% on any baseline
3. **Data corruption** in file storage
4. **Merge conflicts** that affect core files
5. **Circular dependencies** between domains

**Protocol:** Commit current work with "RED FLAG" prefix, notify team, regroup

---

## 📞 Communication Channels

**Git commits:** Primary coordination mechanism  
**Branch:** `feat/architecture-refactor`  
**Pull requests:** One per completed track  
**Issues:** Tag critical blockers with `refactor-blocker` label

---

## 🎉 Definition of Done

**Per Track:**
- All phases complete
- Tests passing
- Performance validated
- Documentation updated
- Code reviewed (by other agents via commits)

**Overall Refactor:**
- All 3 tracks complete
- Integration phase successful
- Old code removed
- Team aligned on new patterns
- Ready for production deployment

---

**Start Date:** November 1, 2025  
**Target Completion:** November 30, 2025  
**Review Cadence:** Check git log daily for blockers

Good luck, agents! 🚀
