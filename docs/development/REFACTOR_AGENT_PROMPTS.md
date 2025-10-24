# Architecture Refactor - Sequential Implementation Guide

**Created:** October 23, 2025  
**Branch:** `feat/architecture-refactor`  
**Execution:** Single agent, sequential phases  
**Duration:** 4 weeks (November 1-30, 2025)

---

## Current Progress

- Phase 1 Progress

Added ApplicationState.ts to hold in-memory maps for cases, financials, notes, alerts, and activity, with versioned notifications, clone-safe accessors, and hydrate/persist paths that sync through StorageRepository.
Introduced useApplicationState.ts, leveraging useSyncExternalStore so selectors (plus useCases/useCase) react to state updates without leaking listeners.
Built coverage in ApplicationState.test.ts for singleton reuse, listener firing, hydration cloning, and repository synchronization (including deletions), plus useApplicationState.test.ts to confirm the React hook wiring.

## 🎯 Mission Overview

Transform CMSNext from a monolithic React application into a clean, domain-driven architecture with:
- **Single source of truth** (eliminate 2 data stores → 1 unified ApplicationState)
- **Domain boundaries** (5 independent domains with clear responsibilities)
- **Worker-ready interfaces** (prepare for performance offloading)
- **Zero manual syncs** (eliminate all `safeNotifyFileStorageChange()` calls)
- **85%+ test coverage** for domain logic (up from ~40%)

**Critical Constraints:**
- ✅ All 211 existing tests MUST pass after each phase
- ✅ No breaking changes to user-facing features
- ✅ Maintain 100% local-first architecture (no network deps)
- ✅ No performance regressions >10% on any baseline
- ✅ Backward compatibility with existing data files

---

## 📋 Git Workflow & Commit Standards

### Commit Message Format

**Phase start commits:**
```
refactor(phase-N): START - <phase name>

Starting Phase N: <description>
Target deliverables:
- Deliverable 1
- Deliverable 2

Baseline: <current test count>/<total>
```

**Progress commits:**
```
refactor(phase-N): <task description>

- Detailed change 1
- Detailed change 2
- Detailed change 3

Phase: <phase-number>
Tests: <passing/total>
Files changed: <count>
```

**Phase completion commits:**
```
refactor(phase-N): COMPLETE - <phase name>

Phase N deliverables:
✅ Deliverable 1: <summary>
✅ Deliverable 2: <summary>
✅ Deliverable 3: <summary>

Tests: <passing/total>
Performance: <benchmark results if applicable>
Ready for: Phase <N+1>
```

### Workflow Rules

1. **Run tests** before every commit (`npm run test:run`)
2. **Commit frequently** - small, focused changes
3. **Document ADRs** when making architectural decisions
4. **Update progress** in WORK_STATUS.md after each phase
5. **Benchmark performance** at end of each phase

---

## 🏗️ Phase 1: Foundation (Week 1, Nov 1-7)

**Goal:** Establish domain structure and repository pattern

**Prerequisites:**
- ✅ All telemetry baselines captured (Phase 4 complete)
- ✅ 211/211 tests passing
- ✅ Performance benchmarks documented

### Day 1-2: Repository Interfaces & Folder Structure

### Day 1-2: Repository Interfaces & Folder Structure

**Goal:** Create the foundation for domain-driven architecture.

**Tasks:**

1. **Create folder structure:**
   ```
   domain/
     common/
       repositories/
       events/
     cases/
       entities/
       use-cases/
     financials/
       entities/
       use-cases/
     notes/
       entities/
       use-cases/
     alerts/
       entities/
       use-cases/
     activity/
       entities/
       use-cases/
   
   infrastructure/
     storage/
     repositories/
   
   application/
     hooks/
     services/
     migration/
     compatibility/
   ```

2. **Define repository interfaces** (`domain/common/repositories/`):
   ```typescript
   // IRepository.ts - Base interface
   export interface IRepository<T, TId> {
     getById(id: TId): Promise<T | null>;
     getAll(): Promise<T[]>;
     save(entity: T): Promise<void>;
     delete(id: TId): Promise<void>;
   }

   // ICaseRepository.ts
   export interface ICaseRepository extends IRepository<Case, string> {
     findByMCN(mcn: string): Promise<Case | null>;
     searchCases(query: string): Promise<Case[]>;
   }

   // IFinancialRepository.ts
   export interface IFinancialRepository extends IRepository<FinancialItem, string> {
     getByCaseId(caseId: string): Promise<FinancialItem[]>;
     getByCategory(category: FinancialCategory): Promise<FinancialItem[]>;
   }

   // INoteRepository.ts
   export interface INoteRepository extends IRepository<Note, string> {
     getByCaseId(caseId: string): Promise<Note[]>;
     filterByCategory(caseId: string, category: NoteCategory): Promise<Note[]>;
   }

   // IAlertRepository.ts
   export interface IAlertRepository extends IRepository<Alert, string> {
     findByMCN(mcn: string): Promise<Alert[]>;
     getUnmatched(): Promise<Alert[]>;
   }

   // IActivityRepository.ts
   export interface IActivityRepository extends IRepository<ActivityEvent, string> {
     getByAggregateId(aggregateId: string): Promise<ActivityEvent[]>;
     getRecent(limit: number): Promise<ActivityEvent[]>;
   }
   ```

3. **Create StorageRepository** (`infrastructure/storage/StorageRepository.ts`):
   ```typescript
   /**
    * Unified storage implementation that wraps AutosaveFileService
    * and implements all domain repository interfaces.
    * 
    * This is the ONLY class that directly interacts with the file system.
    */
   export class StorageRepository implements 
     ICaseRepository, 
     IFinancialRepository, 
     INoteRepository, 
     IAlertRepository, 
     IActivityRepository 
   {
     constructor(private fileService: AutosaveFileService) {}
     
     // Cases
     async getById(id: string): Promise<Case | null> {
       const data = await this.fileService.loadData();
       return data.cases.find(c => c.id === id) || null;
     }
     
     async save(entity: Case): Promise<void> {
       const data = await this.fileService.loadData();
       const index = data.cases.findIndex(c => c.id === entity.id);
       if (index >= 0) {
         data.cases[index] = entity;
       } else {
         data.cases.push(entity);
       }
       await this.fileService.saveData(data);
     }
     
     // ... implement all interface methods
   }
   ```

**Tests:**
```typescript
// __tests__/infrastructure/StorageRepository.test.ts
describe('StorageRepository', () => {
  it('should save and retrieve cases', async () => {
    const repo = new StorageRepository(mockFileService);
    const testCase = createTestCase();
    
    await repo.save(testCase);
    const retrieved = await repo.getById(testCase.id);
    
    expect(retrieved).toEqual(testCase);
  });
  
  // ... more tests
});
```

**Commit:** `refactor(phase-1): Create repository interfaces and StorageRepository`

---

### Day 3-4: ApplicationState Singleton

**Goal:** Single source of truth for all application data.

**Tasks:**

1. **Create ApplicationState** (`application/ApplicationState.ts`):
   ```typescript
   /**
    * Singleton application state that holds all domain data in memory.
    * Provides subscription mechanism for React components.
    */
   export class ApplicationState {
     private static instance: ApplicationState | null = null;
     
     // Domain data
     private cases: Map<string, Case> = new Map();
     private financials: Map<string, FinancialItem> = new Map();
     private notes: Map<string, Note> = new Map();
     private alerts: Map<string, Alert> = new Map();
     private activityLog: ActivityEvent[] = [];
     
     // Subscription mechanism
     private listeners: Set<() => void> = new Set();
     
     private constructor() {}
     
     static getInstance(): ApplicationState {
       if (!ApplicationState.instance) {
         ApplicationState.instance = new ApplicationState();
       }
       return ApplicationState.instance;
     }
     
     // Hydration from storage
     async hydrate(storage: StorageRepository): Promise<void> {
       const allCases = await storage.getAll();
       this.cases.clear();
       allCases.forEach(c => this.cases.set(c.id, c));
       
       // ... hydrate other domains
       
       this.notifyListeners();
     }
     
     // Persistence to storage
     async persist(storage: StorageRepository): Promise<void> {
       for (const caseEntity of this.cases.values()) {
         await storage.save(caseEntity);
       }
       // ... persist other domains
     }
     
     // Getters (return copies to prevent mutation)
     getCases(): Case[] {
       return Array.from(this.cases.values());
     }
     
     getCase(id: string): Case | null {
       return this.cases.get(id) || null;
     }
     
     // Mutations
     addCase(caseEntity: Case): void {
       this.cases.set(caseEntity.id, caseEntity);
       this.notifyListeners();
     }
     
     updateCase(id: string, updates: Partial<Case>): void {
       const existing = this.cases.get(id);
       if (existing) {
         this.cases.set(id, { ...existing, ...updates });
         this.notifyListeners();
       }
     }
     
     // Subscription for React
     subscribe(listener: () => void): () => void {
       this.listeners.add(listener);
       return () => this.listeners.delete(listener);
     }
     
     private notifyListeners(): void {
       this.listeners.forEach(listener => listener());
     }
     
     // Testing helper
     static resetInstance(): void {
       ApplicationState.instance = null;
     }
   }
   ```

2. **Create React integration hook** (`application/hooks/useApplicationState.ts`):
   ```typescript
   /**
    * Custom hook to subscribe to ApplicationState changes.
    * Components using this hook will re-render when selected data changes.
    */
   export function useApplicationState<T>(
     selector: (state: ApplicationState) => T
   ): T {
     const [, forceUpdate] = useReducer(x => x + 1, 0);
     
     useEffect(() => {
       const appState = ApplicationState.getInstance();
       const unsubscribe = appState.subscribe(forceUpdate);
       return unsubscribe;
     }, []);
     
     return selector(ApplicationState.getInstance());
   }
   
   // Convenience hooks
   export function useCases(): Case[] {
     return useApplicationState(state => state.getCases());
   }
   
   export function useCase(id: string): Case | null {
     return useApplicationState(state => state.getCase(id));
   }
   ```

**Tests:**
```typescript
// __tests__/application/ApplicationState.test.ts
describe('ApplicationState', () => {
  afterEach(() => {
    ApplicationState.resetInstance();
  });
  
  it('should be a singleton', () => {
    const instance1 = ApplicationState.getInstance();
    const instance2 = ApplicationState.getInstance();
    expect(instance1).toBe(instance2);
  });
  
  it('should notify listeners on data changes', () => {
    const appState = ApplicationState.getInstance();
    const listener = jest.fn();
    
    appState.subscribe(listener);
    appState.addCase(createTestCase());
    
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

**Commit:** `refactor(phase-1): Create ApplicationState singleton with React integration`

---

### Day 5-7: Feature Flags & Basic Domain

**Goal:** Enable gradual migration with Cases domain as proof of concept.

**Tasks:**

1. **Add feature flags** (`utils/featureFlags.ts`):
   ```typescript
   export const REFACTOR_FLAGS = {
     USE_NEW_ARCHITECTURE: false, // Master toggle
     USE_CASES_DOMAIN: false,
     USE_FINANCIALS_DOMAIN: false,
     USE_NOTES_DOMAIN: false,
     USE_ALERTS_DOMAIN: false,
     USE_ACTIVITY_DOMAIN: false,
   };
   
   // Helper to check if new architecture is active
   export function useNewArchitecture(): boolean {
     return REFACTOR_FLAGS.USE_NEW_ARCHITECTURE;
   }
   ```

2. **Create Case domain entities** (`domain/cases/entities/Case.ts`):
   ```typescript
   /**
    * Case aggregate root.
    * Contains all business logic for case management.
    */
   export class Case {
     constructor(
       public readonly id: string,
       public person: Person,
       public status: CaseStatus,
       public createdAt: Date,
       public updatedAt: Date
     ) {}
     
     // Domain logic
     updateStatus(newStatus: CaseStatus): void {
       this.status = newStatus;
       this.updatedAt = new Date();
     }
     
     archive(): void {
       if (this.status !== CaseStatus.Closed) {
         throw new DomainError('Cannot archive non-closed case');
       }
       this.status = CaseStatus.Archived;
       this.updatedAt = new Date();
     }
     
     // Factory method
     static create(input: CreateCaseInput): Case {
       return new Case(
         generateId(),
         new Person(input),
         CaseStatus.Active,
         new Date(),
         new Date()
       );
     }
   }
   ```

3. **Create simple use case** (`domain/cases/use-cases/CreateCase.ts`):
   ```typescript
   /**
    * Use case: Create a new case
    */
   export class CreateCaseUseCase {
     constructor(
       private repository: ICaseRepository,
       private appState: ApplicationState
     ) {}
     
     async execute(input: CreateCaseInput): Promise<Case> {
       // Business logic
       const caseEntity = Case.create(input);
       
       // Save to repository
       await this.repository.save(caseEntity);
       
       // Update in-memory state
       this.appState.addCase(caseEntity);
       
       return caseEntity;
     }
   }
   ```

4. **Update useConnectionFlow** to hydrate state:
   ```typescript
   // In hooks/useConnectionFlow.ts
   const handleConnect = async (directoryHandle: FileSystemDirectoryHandle) => {
     // ... existing connection logic
     
     if (REFACTOR_FLAGS.USE_NEW_ARCHITECTURE) {
       const storage = new StorageRepository(fileService);
       const appState = ApplicationState.getInstance();
       await appState.hydrate(storage);
     }
   };
   ```

**Tests:**
- Case entity creation and methods
- CreateCaseUseCase execution
- Feature flag toggling
- ApplicationState hydration

**Commit:** `refactor(phase-1): Add feature flags and Cases domain proof of concept`

---

### Phase 1 Completion Checklist

- [ ] Domain folder structure created
- [ ] Repository interfaces defined for all 5 domains
- [ ] StorageRepository implements all interfaces
- [ ] ApplicationState singleton with subscription mechanism
- [ ] useApplicationState hook for React integration
- [ ] Feature flags added and documented
- [ ] Cases domain entities and one use case
- [ ] 50+ new tests added
- [ ] All 211+ tests passing
- [ ] Documentation updated (ADR-001, ADR-003)

---

## 🔄 Phase 2: State Management & Event Bus (Week 2, Nov 8-14)

**Goal:** Replace React state sprawl and manual sync with domain-driven state.

### Day 1-3: Domain Event Bus

**Goal:** Enable cross-domain communication without tight coupling.

**Tasks:**

1. **Create EventBus** (`application/EventBus.ts`):
   ```typescript
   type EventHandler<T = unknown> = (event: T) => void | Promise<void>;
   
   /**
    * Simple event bus for domain event publishing and subscription.
    * Enables decoupled cross-domain communication.
    */
   export class EventBus {
     private handlers: Map<string, Set<EventHandler>> = new Map();
     
     subscribe<T>(eventType: string, handler: EventHandler<T>): () => void {
       if (!this.handlers.has(eventType)) {
         this.handlers.set(eventType, new Set());
       }
       this.handlers.get(eventType)!.add(handler);
       
       // Return unsubscribe function
       return () => {
         this.handlers.get(eventType)?.delete(handler);
       };
     }
     
     async publish<T>(eventType: string, event: T): Promise<void> {
       const handlers = this.handlers.get(eventType) || new Set();
       await Promise.all(
         Array.from(handlers).map(handler => handler(event))
       );
     }
     
     publishSync<T>(eventType: string, event: T): void {
       const handlers = this.handlers.get(eventType) || new Set();
       handlers.forEach(handler => handler(event));
     }
   }
   ```

2. **Define domain events** (`domain/common/events/`):
   ```typescript
   // DomainEvent.ts
   export interface DomainEvent {
     eventId: string;
     eventType: string;
     aggregateId: string;
     aggregateType: 'case' | 'financial' | 'note' | 'alert' | 'activity';
     timestamp: Date;
     metadata?: Record<string, unknown>;
   }

   // CaseEvents.ts
   export type CaseCreatedEvent = DomainEvent & { 
     case: Case;
   };
   
   export type CaseUpdatedEvent = DomainEvent & { 
     case: Case; 
     changes: Partial<Case>;
   };
   
   export type CaseArchivedEvent = DomainEvent & {
     caseId: string;
   };
   
   // FinancialEvents.ts
   export type FinancialItemAddedEvent = DomainEvent & { 
     item: FinancialItem; 
     caseId: string;
   };
   
   export type FinancialItemVerifiedEvent = DomainEvent & {
     itemId: string;
     status: VerificationStatus;
   };
   
   // ... other domain events
   ```

3. **Integrate EventBus into ApplicationState**:
   ```typescript
   // Update ApplicationState.ts
   export class ApplicationState {
     private eventBus: EventBus = new EventBus();
     
     getEventBus(): EventBus {
       return this.eventBus;
     }
     
     // Mutations now publish events
     addCase(caseEntity: Case): void {
       this.cases.set(caseEntity.id, caseEntity);
       this.notifyListeners();
       
       // Publish domain event
       this.eventBus.publishSync('case:created', {
         eventId: generateId(),
         eventType: 'case:created',
         aggregateId: caseEntity.id,
         aggregateType: 'case',
         timestamp: new Date(),
         case: caseEntity
       });
     }
   }
   ```

4. **Integrate telemetry with event bus**:
   ```typescript
   // application/services/TelemetryEventLogger.ts
   export class TelemetryEventLogger {
     constructor(private eventBus: EventBus) {
       this.subscribeToAllEvents();
     }
     
     private subscribeToAllEvents(): void {
       const eventTypes = [
         'case:created', 'case:updated', 'case:archived',
         'financial:added', 'financial:updated', 'financial:verified',
         // ... all event types
       ];
       
       eventTypes.forEach(eventType => {
         this.eventBus.subscribe(eventType, (event: DomainEvent) => {
           console.log(`[Domain Event] ${event.eventType}`, event);
           // Could integrate with performance tracker here
         });
       });
     }
   }
   ```

**Tests:**
```typescript
describe('EventBus', () => {
  it('should publish events to subscribers', async () => {
    const bus = new EventBus();
    const handler = jest.fn();
    
    bus.subscribe('test:event', handler);
    await bus.publish('test:event', { data: 'test' });
    
    expect(handler).toHaveBeenCalledWith({ data: 'test' });
  });
  
  it('should unsubscribe handlers', async () => {
    const bus = new EventBus();
    const handler = jest.fn();
    
    const unsubscribe = bus.subscribe('test:event', handler);
    unsubscribe();
    await bus.publish('test:event', { data: 'test' });
    
    expect(handler).not.toHaveBeenCalled();
  });
});
```

**Commit:** `refactor(phase-2): Implement EventBus and domain events`

---

### Day 4-5: Remove Manual Sync Points

**Goal:** Eliminate all `safeNotifyFileStorageChange()` calls.

**Tasks:**

1. **Audit manual sync calls**:
   ```bash
   # Find all manual sync calls
   grep -r "safeNotifyFileStorageChange" --include="*.ts" --include="*.tsx"
   grep -r "notifyDataChange" --include="*.ts" --include="*.tsx"
   grep -r "clearFileStorageFlags" --include="*.ts" --include="*.tsx"
   ```

2. **Replace with event-driven updates**:
   ```typescript
   // OLD: Manual sync
   await dataManager.updateCase(id, updates);
   safeNotifyFileStorageChange();
   
   // NEW: Event-driven (automatic via ApplicationState)
   const appState = ApplicationState.getInstance();
   appState.updateCase(id, updates); // Publishes event automatically
   ```

3. **Remove window globals from fileStorageFlags**:
   ```typescript
   // OLD: utils/fileStorageFlags.ts
   export const fileStorageFlags = {
     hasChanges: false,
     lastSync: null,
     // ...
   };
   
   // NEW: State machine in FileStorageContext handles this
   // (No changes needed - already event-driven via XState)
   ```

4. **Update AppContent.tsx**:
   ```typescript
   // Remove clearFileStorageFlags logic
   // FileStorageContext state machine handles state transitions
   ```

**Tests:**
- Verify no `safeNotifyFileStorageChange` calls remain
- Test that updates propagate via events
- Confirm FileStorageContext state machine works independently

**Commit:** `refactor(phase-2): Remove all manual sync points`

---

### Day 6-7: Refactor AppContent State

**Goal:** AppContent reads from ApplicationState instead of multiple sources.

**Tasks:**

1. **Update AppContent.tsx** to use ApplicationState:
   ```typescript
   function AppContent() {
     // OLD: Multiple data sources
     // const { cases } = useDataManager();
     // const { alerts } = useAlerts();
     
     // NEW: Single source of truth
     const cases = useApplicationState(state => state.getCases());
     const currentCase = useApplicationState(state => 
       state.getCase(currentCaseId)
     );
     
     // Feature flag control
     if (!REFACTOR_FLAGS.USE_NEW_ARCHITECTURE) {
       // Fall back to old DataManager path
       return <LegacyAppContent />;
     }
     
     // ... rest of component
   }
   ```

2. **Create compatibility layer** for gradual migration:
   ```typescript
   // application/compatibility/LegacyCaseAdapter.ts
   export class LegacyCaseAdapter {
     /**
      * Convert old DataManager case format to new domain Case entity
      */
     static toDomain(legacyCase: any): Case {
       return new Case(
         legacyCase.id,
         new Person(legacyCase.person),
         legacyCase.status,
         new Date(legacyCase.createdAt),
         new Date(legacyCase.updatedAt)
       );
     }
     
     /**
      * Convert domain Case entity to old format
      */
     static fromDomain(domainCase: Case): any {
       return {
         id: domainCase.id,
         person: { ...domainCase.person },
         status: domainCase.status,
         createdAt: domainCase.createdAt.toISOString(),
         updatedAt: domainCase.updatedAt.toISOString()
       };
     }
   }
   ```

3. **Add dual-write during migration** (temporary):
   ```typescript
   // application/migration/DualWriteManager.ts
   export class DualWriteManager {
     constructor(
       private appState: ApplicationState,
       private dataManager: DataManager,
       private eventBus: EventBus
     ) {
       this.setupEventHandlers();
     }
     
     private setupEventHandlers(): void {
       // Listen to new architecture events and sync to old DataManager
       this.eventBus.subscribe('case:updated', async (event) => {
         const legacyCase = LegacyCaseAdapter.fromDomain(event.case);
         await this.dataManager.updateCase(legacyCase.id, legacyCase);
       });
     }
   }
   ```

**Tests:**
- AppContent renders with ApplicationState
- Compatibility adapters convert correctly
- Dual-write keeps both stores in sync

**Commit:** `refactor(phase-2): Refactor AppContent to use ApplicationState`

---

### Phase 2 Completion Checklist

- [ ] EventBus implemented and tested
- [ ] All domain events defined
- [ ] Telemetry integrated with event bus
- [ ] All manual sync points removed (0 `safeNotifyFileStorageChange` calls)
- [ ] All window globals removed
- [ ] AppContent uses ApplicationState
- [ ] Compatibility adapters for gradual migration
- [ ] Dual-write manager (temporary safety net)
- [ ] All 211+ tests passing
- [ ] Documentation updated (ADR-002)

**Success Metrics:**
- ✅ Single source of truth confirmed
- ✅ Zero manual sync calls
- ✅ Event-driven architecture validated

---

## 🏗️ Phase 3: Use Case Extraction (Week 3, Nov 15-21)

**Goal:** Move all business logic from hooks into domain use cases.

### Day 1-2: Cases Domain Complete

**Goal:** Extract all case management logic into domain layer.

**Tasks:**

1. **Complete Case entity** with all business logic (`domain/cases/entities/Case.ts`):
   ```typescript
   export class Case {
     constructor(
       public readonly id: string,
       public person: Person,
       public status: CaseStatus,
       public createdAt: Date,
       public updatedAt: Date
     ) {}
     
     // Domain methods (all business rules here)
     updatePerson(person: Person): void {
       this.person = person;
       this.updatedAt = new Date();
     }
     
     updateStatus(newStatus: CaseStatus): void {
       if (!this.canTransitionTo(newStatus)) {
         throw new DomainError(`Cannot transition from ${this.status} to ${newStatus}`);
       }
       this.status = newStatus;
       this.updatedAt = new Date();
     }
     
     archive(): void {
       if (this.status !== CaseStatus.Closed) {
         throw new DomainError('Cannot archive non-closed case');
       }
       this.status = CaseStatus.Archived;
       this.updatedAt = new Date();
     }
     
     close(): void {
       if (this.status === CaseStatus.Archived) {
         throw new DomainError('Cannot close archived case');
       }
       this.status = CaseStatus.Closed;
       this.updatedAt = new Date();
     }
     
     private canTransitionTo(newStatus: CaseStatus): boolean {
       const validTransitions: Record<CaseStatus, CaseStatus[]> = {
         [CaseStatus.Active]: [CaseStatus.Pending, CaseStatus.Closed],
         [CaseStatus.Pending]: [CaseStatus.Active, CaseStatus.Closed],
         [CaseStatus.Closed]: [CaseStatus.Archived],
         [CaseStatus.Archived]: []
       };
       return validTransitions[this.status].includes(newStatus);
     }
   }
   ```

2. **Create all use cases** (`domain/cases/use-cases/`):
   ```typescript
   // CreateCase.ts
   export class CreateCaseUseCase {
     constructor(
       private repository: ICaseRepository,
       private appState: ApplicationState
     ) {}
     
     async execute(input: CreateCaseInput): Promise<Case> {
       const caseEntity = Case.create(input);
       await this.repository.save(caseEntity);
       this.appState.addCase(caseEntity);
       return caseEntity;
     }
   }
   
   // UpdateCase.ts
   export class UpdateCaseUseCase {
     async execute(id: string, updates: UpdateCaseInput): Promise<Case> {
       const caseEntity = await this.repository.getById(id);
       if (!caseEntity) {
         throw new NotFoundError(`Case ${id} not found`);
       }
       
       if (updates.person) caseEntity.updatePerson(updates.person);
       if (updates.status) caseEntity.updateStatus(updates.status);
       
       await this.repository.save(caseEntity);
       this.appState.updateCase(id, caseEntity);
       return caseEntity;
     }
   }
   
   // ArchiveCase.ts
   export class ArchiveCaseUseCase {
     async execute(id: string): Promise<void> {
       const caseEntity = await this.repository.getById(id);
       if (!caseEntity) {
         throw new NotFoundError(`Case ${id} not found`);
       }
       
       caseEntity.archive(); // Business logic in entity
       await this.repository.save(caseEntity);
       this.appState.updateCase(id, caseEntity);
     }
   }
   
   // SearchCases.ts
   export class SearchCasesUseCase {
     async execute(query: string): Promise<Case[]> {
       return await this.repository.searchCases(query);
     }
   }
   ```

3. **Create thin hook wrapper** (`application/hooks/useCases.ts`):
   ```typescript
   /**
    * Application-level hook that exposes case use cases to React components.
    * This is a THIN wrapper - all business logic is in use case classes.
    */
   export function useCaseService() {
     const appState = ApplicationState.getInstance();
     const storage = new StorageRepository(/* ... */);
     
     const createCase = useCallback(async (input: CreateCaseInput) => {
       const useCase = new CreateCaseUseCase(storage, appState);
       return await useCase.execute(input);
     }, []);
     
     const updateCase = useCallback(async (id: string, updates: UpdateCaseInput) => {
       const useCase = new UpdateCaseUseCase(storage, appState);
       return await useCase.execute(id, updates);
     }, []);
     
     const archiveCase = useCallback(async (id: string) => {
       const useCase = new ArchiveCaseUseCase(storage, appState);
       return await useCase.execute(id);
     }, []);
     
     const searchCases = useCallback(async (query: string) => {
       const useCase = new SearchCasesUseCase(storage, appState);
       return await useCase.execute(query);
     }, []);
     
     return { createCase, updateCase, archiveCase, searchCases };
   }
   ```

4. **Migrate useCaseManagement.ts** logic to new architecture:
   ```typescript
   // OLD: useCaseManagement.ts (hundreds of lines of business logic)
   
   // NEW: Components use useCaseService hook
   function CaseForm() {
     const { createCase, updateCase } = useCaseService();
     
     const handleSubmit = async (data: CaseFormData) => {
       if (editing) {
         await updateCase(caseId, data);
       } else {
         await createCase(data);
       }
     };
   }
   ```

**Tests:**
```typescript
describe('Case Use Cases', () => {
  it('CreateCaseUseCase should create and save case', async () => {
    const mockRepo = createMockRepository();
    const mockState = createMockApplicationState();
    const useCase = new CreateCaseUseCase(mockRepo, mockState);
    
    const result = await useCase.execute(testInput);
    
    expect(mockRepo.save).toHaveBeenCalledWith(expect.any(Case));
    expect(mockState.addCase).toHaveBeenCalled();
  });
  
  // ... test all use cases
});
```

**Commit:** `refactor(phase-3): Extract Cases domain use cases from hooks`

---

### Day 3-4: Financials Domain

**Goal:** Extract financial logic with case relationship handling.

**Tasks:**

1. **Complete FinancialItem entity** (`domain/financials/entities/FinancialItem.ts`):
   ```typescript
   export class FinancialItem {
     constructor(
       public readonly id: string,
       public readonly caseId: string, // Foreign key to Cases domain
       public category: FinancialCategory,
       public description: string,
       public amount: number,
       public frequency: Frequency,
       public verificationStatus: VerificationStatus,
       public createdAt: Date,
       public updatedAt: Date
     ) {
       this.validate();
     }
     
     verify(status: VerificationStatus): void {
       this.verificationStatus = status;
       this.updatedAt = new Date();
     }
     
     updateAmount(newAmount: number): void {
       if (newAmount === 0) {
         throw new DomainError('Amount cannot be zero');
       }
       if (newAmount < 0 && this.category !== FinancialCategory.Expense) {
         throw new DomainError('Only expenses can have negative amounts');
       }
       this.amount = newAmount;
       this.updatedAt = new Date();
     }
     
     private validate(): void {
       if (this.amount === 0) {
         throw new ValidationError('Amount cannot be zero');
       }
       if (!this.caseId) {
         throw new ValidationError('Financial item must be linked to a case');
       }
     }
     
     static create(input: CreateFinancialItemInput): FinancialItem {
       return new FinancialItem(
         generateId(),
         input.caseId,
         input.category,
         input.description,
         input.amount,
         input.frequency,
         VerificationStatus.Unverified,
         new Date(),
         new Date()
       );
     }
   }
   ```

2. **Create financial use cases** with cross-domain validation:
   ```typescript
   // AddFinancialItem.ts
   export class AddFinancialItemUseCase {
     constructor(
       private financialRepo: IFinancialRepository,
       private caseRepo: ICaseRepository, // Cross-domain dependency
       private appState: ApplicationState
     ) {}
     
     async execute(input: CreateFinancialItemInput): Promise<FinancialItem> {
       // Verify case exists (cross-domain check)
       const caseEntity = await this.caseRepo.getById(input.caseId);
       if (!caseEntity) {
         throw new NotFoundError(`Case ${input.caseId} not found`);
       }
       
       // Create item
       const item = FinancialItem.create(input);
       await this.financialRepo.save(item);
       this.appState.addFinancialItem(item);
       
       return item;
     }
   }
   
   // UpdateFinancialItem.ts, VerifyFinancialItem.ts, etc.
   ```

3. **Create financial service hook** (`application/hooks/useFinancials.ts`):
   ```typescript
   export function useFinancialService() {
     const appState = ApplicationState.getInstance();
     const storage = new StorageRepository(/* ... */);
     
     const addFinancialItem = useCallback(async (input: CreateFinancialItemInput) => {
       const useCase = new AddFinancialItemUseCase(storage, storage, appState);
       return await useCase.execute(input);
     }, []);
     
     // ... other methods
     
     return { addFinancialItem, updateFinancialItem, verifyFinancialItem };
   }
   ```

4. **Migrate useFinancialItemFlow.ts** to new architecture.

**Tests:**
- FinancialItem entity validation
- Cross-domain case verification
- Use case execution
- Hook integration

**Commit:** `refactor(phase-3): Extract Financials domain use cases`

---

### Day 5: Notes & Alerts Domains

**Goal:** Extract simpler domain logic for notes and alerts.

**Tasks:**

1. **Notes domain** (`domain/notes/`):
   - Note entity with validation
   - CreateNote, UpdateNote, DeleteNote, FilterNotesByCategory use cases
   - useNoteService hook
   - Migrate useNoteFlow.ts

2. **Alerts domain** (`domain/alerts/`):
   - Alert entity with MCN matching logic
   - LoadAlerts, MatchAlertToCase, LinkAlert, ResolveAlert use cases
   - useAlertService hook
   - Migrate alert-related hooks

**Commit:** `refactor(phase-3): Extract Notes and Alerts domain use cases`

---

### Day 6-7: Activity Log Domain

**Goal:** Event-driven audit trail for all domain events.

**Tasks:**

1. **Activity domain** (`domain/activity/entities/ActivityEvent.ts`):
   ```typescript
   export class ActivityEvent {
     constructor(
       public readonly id: string,
       public eventType: string,
       public aggregateId: string,
       public aggregateType: string,
       public changes: Record<string, unknown>,
       public timestamp: Date,
       public metadata: Record<string, unknown>
     ) {}
     
     static fromDomainEvent(event: DomainEvent): ActivityEvent {
       return new ActivityEvent(
         generateId(),
         event.eventType,
         event.aggregateId,
         event.aggregateType,
         event.metadata || {},
         event.timestamp,
         {}
       );
     }
   }
   ```

2. **Activity logger** that subscribes to all events:
   ```typescript
   // application/services/ActivityLogger.ts
   export class ActivityLogger {
     constructor(
       private eventBus: EventBus,
       private activityRepo: IActivityRepository
     ) {
       this.subscribeToAllEvents();
     }
     
     private subscribeToAllEvents(): void {
       const eventTypes = [
         'case:created', 'case:updated', 'case:archived',
         'financial:added', 'financial:updated',
         'note:created', 'note:updated',
         'alert:matched', 'alert:resolved'
       ];
       
       eventTypes.forEach(eventType => {
         this.eventBus.subscribe(eventType, async (event: DomainEvent) => {
           const activityEvent = ActivityEvent.fromDomainEvent(event);
           await this.activityRepo.save(activityEvent);
         });
       });
     }
   }
   ```

3. **Activity use cases**:
   - GetCaseActivity, GetRecentActivity, GenerateActivityReport

4. **Initialize ActivityLogger** in app startup:
   ```typescript
   // In App.tsx or useConnectionFlow
   const appState = ApplicationState.getInstance();
   const eventBus = appState.getEventBus();
   const activityLogger = new ActivityLogger(eventBus, storage);
   ```

**Tests:**
- ActivityEvent creation from domain events
- Logger captures all event types
- Activity queries work correctly

**Commit:** `refactor(phase-3): Implement Activity Log domain with event capture`

---

### Phase 3 Completion Checklist

- [ ] All 5 domains have complete entities
- [ ] 15+ use cases implemented
- [ ] All business logic extracted from hooks
- [ ] Hooks are thin wrappers around use cases
- [ ] Components updated to use new service hooks
- [ ] Activity logging captures all domain events
- [ ] 100+ new domain tests added
- [ ] All 211+ tests passing
- [ ] 100% backward compatibility maintained
- [ ] Documentation updated

**Success Metrics:**
- ✅ Business logic is 100% testable without React
- ✅ Hooks reduced to < 50 lines each
- ✅ Domain test coverage > 80%
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

---

## 🚀 Phase 4: Worker Preparation & Cleanup (Week 4, Nov 22-30)

**Goal:** Prepare architecture for Web Worker offloading and finalize refactor.

### Day 1-2: Worker-Ready Interfaces

**Goal:** Define worker message contracts for heavy operations.

**Tasks:**

1. **Identify worker-eligible operations**:
   - Alert CSV import/parsing
   - Case data export (JSON/CSV)
   - Financial totals calculation (large datasets)
   - Activity log report generation
   - Case search across large datasets

2. **Create worker message contracts** (`infrastructure/worker/messages.ts`):
   ```typescript
   // Base message types
   export type WorkerMessage = 
     | ImportAlertsMessage
     | ExportCasesMessage
     | CalculateFinancialsMessage
     | GenerateReportMessage;
   
   export interface WorkerRequest<T = unknown> {
     id: string;
     type: string;
     payload: T;
   }
   
   export interface WorkerResponse<T = unknown> {
     id: string;
     success: boolean;
     data?: T;
     error?: string;
   }
   
   // Specific message types
   export interface ImportAlertsMessage extends WorkerRequest<{
     csvContent: string;
   }> {
     type: 'import:alerts';
   }
   
   export interface ExportCasesMessage extends WorkerRequest<{
     cases: Case[];
     format: 'json' | 'csv';
   }> {
     type: 'export:cases';
   }
   ```

3. **Create WorkerBridge abstraction** (`infrastructure/worker/WorkerBridge.ts`):
   ```typescript
   /**
    * Abstraction for offloading work to Web Workers.
    * Currently a pass-through (no-op), but ready for worker integration.
    */
   export class WorkerBridge {
     private useWorkers: boolean = false; // Feature flag
     
     async execute<TRequest, TResponse>(
       operation: string,
       payload: TRequest
     ): Promise<TResponse> {
       if (this.useWorkers && this.isWorkerEligible(operation)) {
         return await this.executeInWorker(operation, payload);
       } else {
         return await this.executeInMainThread(operation, payload);
       }
     }
     
     private isWorkerEligible(operation: string): boolean {
       const workerOps = ['import:alerts', 'export:cases', 'calculate:totals'];
       return workerOps.includes(operation);
     }
     
     private async executeInWorker<TRequest, TResponse>(
       operation: string,
       payload: TRequest
     ): Promise<TResponse> {
       // Future: Post message to worker and await response
       throw new Error('Worker execution not yet implemented');
     }
     
     private async executeInMainThread<TRequest, TResponse>(
       operation: string,
       payload: TRequest
     ): Promise<TResponse> {
       // Execute synchronously in main thread (current behavior)
       switch (operation) {
         case 'import:alerts':
           return await this.importAlerts(payload as any) as TResponse;
         // ... other operations
         default:
           throw new Error(`Unknown operation: ${operation}`);
       }
     }
   }
   ```

**Commit:** `refactor(phase-4): Add worker-ready interfaces and WorkerBridge`

---

### Day 3-4: Performance Validation

**Goal:** Ensure no performance regressions from refactor.

**Tasks:**

1. **Run performance benchmarks**:
   ```bash
   npm run bench:autosave
   npm run bench:dashboard
   ```

2. **Compare to pre-refactor baselines**:
   - Compare autosave timings (should be < 5ms for all payload sizes)
   - Compare dashboard load (should be < 5ms for all case counts)
   - Flag any regression > 10%

3. **Profile render performance** with React DevTools Profiler

4. **Check bundle size**: Should be < 600 kB raw, < 160 kB gzipped

**Commit:** `refactor(phase-4): Validate performance baselines`

---

### Day 5-6: Enable Feature Flags & Remove Old Code

**Goal:** Turn on new architecture and remove legacy code.

**Tasks:**

1. **Progressive flag enablement** (test after each):
   - Enable Cases domain
   - Enable Financials domain
   - Enable Notes/Alerts/Activity domains
   - Enable master toggle

2. **Remove old code paths**:
   - Archive DataManager.ts
   - Remove manual sync utilities
   - Remove dual-write manager
   - Remove compatibility adapters
   - Archive old hooks

**Commit:** `refactor(phase-4): Enable all feature flags and remove legacy code`

---

### Day 7: Documentation & Finalization

**Goal:** Complete documentation and prepare for production.

**Tasks:**

1. **Update architecture diagrams**
2. **Write ADRs** for key decisions
3. **Create developer guide** for domain patterns
4. **Update WORK_STATUS.md**
5. **Final validation checklist**

**Commit:** `refactor(phase-4): COMPLETE - Architecture refactor finalized`

---

## 📊 Overall Success Checklist

### Phase 1: Foundation
- [ ] Repository pattern implemented
- [ ] ApplicationState singleton
- [ ] Feature flags working
- [ ] Cases domain proof of concept

### Phase 2: State Management
- [ ] EventBus functional
- [ ] All manual sync points removed
- [ ] AppContent uses ApplicationState
- [ ] Zero window globals

### Phase 3: Use Cases
- [ ] All 5 domains complete
- [ ] 15+ use cases implemented
- [ ] Hooks are thin wrappers
- [ ] Activity logging functional

### Phase 4: Worker Prep & Cleanup
- [ ] Worker interfaces defined
- [ ] Performance validated
- [ ] All flags enabled
- [ ] Old code removed
- [ ] Documentation complete

### Final Validation
- [ ] 250+ tests passing
- [ ] No TypeScript errors
- [ ] Performance within 10% of baseline
- [ ] Bundle size < 600 kB
- [ ] Accessibility checks pass
- [ ] Production build verified

---

## 🚨 Red Flags - Stop Work Immediately

1. **Test failures** that can't be fixed in 30 minutes
2. **Performance regression** >10% on any baseline
3. **Data corruption** in file storage
4. **TypeScript errors** in production build
5. **Circular dependencies** between domains

**Protocol:** Commit current work with "RED FLAG" prefix, document issue, regroup

---

## 📚 Additional Resources

**Architecture References:**
- Clean Architecture Principles
- Domain-Driven Design patterns
- Repository Pattern
- Event-Driven Architecture

**Project Docs:**
- `docs/development/architecture-refactor-plan.md` - Strategic plan
- `docs/development/PROJECT_STRUCTURE.md` - Folder organization
- `docs/development/testing-infrastructure.md` - Testing strategy

**Performance:**
- `reports/performance/` - Baseline benchmarks
- `scripts/autosaveBenchmark.ts` - Performance testing
- `scripts/dashboardLoadBenchmark.ts` - Dashboard metrics

---

## 🎉 Definition of Done

**Per Phase:**
- All tasks complete
- Tests passing
- Performance validated (if applicable)
- Documentation updated
- Code committed

**Overall Refactor:**
- All 4 phases complete
- Single source of truth established
- Zero manual syncs
- Worker-ready architecture
- Clean codebase (old code archived)
- Team aligned on new patterns
- Ready for production deployment

---

**Start Date:** November 1, 2025  
**Target Completion:** November 30, 2025  
**Execution:** Sequential, single agent  
**Review Cadence:** End of each phase

Good luck! 🚀

