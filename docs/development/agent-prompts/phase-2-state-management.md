# Phase 2: State Management - Agent Prompt

**Status:** ✅ COMPLETE (PR #54 merged October 27, 2025)

**Context:** Phase 2 of the architecture refactor established the DomainEventBus, ActivityLogger, and event-driven state synchronization. This document is preserved for historical reference.

**Reference:** See `docs/development/phase-2-completion-summary.md` for implementation details and `docs/development/architecture-refactor-plan.md` for overall progress.

---

## Objective (Achieved)

✅ Complete the event-driven state management system by adding domain event bus and integrating React components with ApplicationState.

---

## Completed Deliverables

### 1. Domain Event Bus

**File:** `application/DomainEventBus.ts` (✅ Implemented)

- Type-safe event publishing with generic event types
- Subscription management with automatic cleanup
- Support for: CaseCreated, CaseUpdated, CaseDeleted, FinancialItem events, Note events, Alert events, ActivityRecorded
- Singleton pattern with `getInstance()`

### 2. Activity Logger Service

**File:** `application/ActivityLogger.ts` (✅ Implemented)

- Centralized activity tracking with automatic persistence
- Rollback support for failed storage operations
- Event-driven architecture preventing state/storage divergence
- Integration with DomainEventBus for all domain events

### 3. Rich Domain Entities

**Files:** (✅ All Implemented)
- `domain/cases/entities/Case.ts` (Phase 1)
- `domain/cases/entities/Person.ts` (Phase 1)
- `domain/financials/entities/FinancialItem.ts` (Phase 2)
- `domain/notes/entities/Note.ts` (Phase 2)
- `domain/alerts/entities/Alert.ts` (Phase 2)
- `domain/activity/entities/ActivityEvent.ts` (Phase 2)

### 4. Use Cases Expanded

**Files:** (✅ All Implemented)
- `domain/cases/use-cases/CreateCase.ts` (Phase 1)
- `domain/cases/use-cases/UpdateCase.ts` (Phase 2)
- `domain/cases/use-cases/DeleteCase.ts` (Phase 2)

### 5. Testing Infrastructure

**Achievements:**
- +79 new tests across domain, application, and infrastructure layers
- 290 total tests passing (0 regressions)
- Enhanced test helpers: `toSnapshot()`, `sortSnapshots()` for reliable comparisons
- Comprehensive integration test coverage

---

## Historical Context (Pre-Phase 2)

### Existing Architecture:

- ✅ Domain structure created (`domain/cases/`, `domain/financials/`, etc.)
- ✅ Unified StorageRepository with domain adapters
- ✅ ApplicationState singleton with Map-based storage
- ✅ Rich domain entities (Case, Person, FinancialItem, etc.)
- ✅ Use cases with optimistic updates + rollback
- ✅ `ApplicationState.hydrate(storage)` pattern established
- ❌ Still using manual `safeNotifyFileStorageChange()` calls
- ❌ Domain events not yet implemented
- ❌ React components not yet using ApplicationState
- ❌ Activity logging not integrated with domain events

### Files to Read:

- `application/ApplicationState.ts` (326 lines) - **Your singleton state manager from Phase 1**
- `infrastructure/storage/StorageRepository.ts` (423 lines) - **Unified repository with adapters**
- `domain/cases/use-cases/CreateCase.ts` - **Pattern: optimistic update + rollback**
- `domain/cases/entities/Case.ts` (302 lines) - **Rich domain entity with factory methods**
- `utils/safeNotifyFileStorageChange.ts` - **Will be eliminated**
- `hooks/useCaseManagement.ts` (329 lines) - React integration point
- `components/app/AppContent.tsx` - Has scattered React state

---

## Tasks

### 1. Create Domain Event Bus

**File:** `application/DomainEventBus.ts`

```typescript
import { createLogger } from "@/utils/logger";

const logger = createLogger("DomainEventBus");

export type DomainEventType =
  | "CaseCreated"
  | "CaseUpdated"
  | "CaseDeleted"
  | "CaseStatusChanged"
  | "FinancialItemAdded"
  | "FinancialItemUpdated"
  | "FinancialItemDeleted"
  | "NoteCreated"
  | "NoteUpdated"
  | "NoteDeleted"
  | "AlertCreated"
  | "AlertStatusChanged"
  | "AlertResolved"
  | "ActivityRecorded";

export interface DomainEvent<TPayload = unknown> {
  type: DomainEventType;
  payload: TPayload;
  timestamp: string;
  aggregateId?: string;
  metadata?: Record<string, unknown>;
}

type EventHandler<TPayload = unknown> = (
  event: DomainEvent<TPayload>
) => void | Promise<void>;

/**
 * Singleton event bus for domain events.
 * Decouples domain operations from state updates.
 */
export class DomainEventBus {
  private static instance: DomainEventBus | null = null;
  private handlers: Map<DomainEventType, Set<EventHandler>> = new Map();

  private constructor() {}

  static getInstance(): DomainEventBus {
    if (!DomainEventBus.instance) {
      DomainEventBus.instance = new DomainEventBus();
    }
    return DomainEventBus.instance;
  }

  /**
   * Subscribe to a domain event type.
   * Returns unsubscribe function.
   */
  subscribe<TPayload = unknown>(
    eventType: DomainEventType,
    handler: EventHandler<TPayload>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    this.handlers.get(eventType)!.add(handler);

    logger.debug("Handler subscribed", { eventType });

    return () => {
      this.handlers.get(eventType)?.delete(handler);
      logger.debug("Handler unsubscribed", { eventType });
    };
  }

  /**
   * Publish a domain event to all subscribers.
   */
  async publish<TPayload = unknown>(
    type: DomainEventType,
    payload: TPayload,
    options?: {
      aggregateId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    const event: DomainEvent<TPayload> = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      aggregateId: options?.aggregateId,
      metadata: options?.metadata,
    };

    logger.info("Event published", {
      type,
      aggregateId: event.aggregateId,
      hasMetadata: !!event.metadata,
    });

    const handlers = this.handlers.get(type);
    if (!handlers || handlers.size === 0) {
      logger.debug("No handlers for event", { type });
      return;
    }

    // Execute all handlers in parallel
    const promises = Array.from(handlers).map((handler) =>
      Promise.resolve(handler(event)).catch((error) => {
        logger.error("Event handler failed", { type, error });
      })
    );

    await Promise.all(promises);
  }

  /**
   * Clear all handlers (for testing).
   */
  clear(): void {
    this.handlers.clear();
    logger.debug("All handlers cleared");
  }

  /**
   * Reset singleton (for testing).
   */
  static resetForTesting(): void {
    DomainEventBus.instance = null;
  }
}

export default DomainEventBus;
```

### 2. Update Use Cases to Emit Events

**File:** `domain/cases/use-cases/CreateCase.ts` (update existing)

Add event emission after successful persistence:

```typescript
import { DomainEventBus } from "@/application/DomainEventBus";

export class CreateCaseUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly storage: StorageRepository,
    private readonly eventBus: DomainEventBus = DomainEventBus.getInstance()
  ) {}

  async execute(input: CreateCaseInput): Promise<Case> {
    // ... existing validation and creation logic ...

    // Optimistic update
    this.appState.addCase(caseEntity);

    try {
      // Persist to storage
      await this.storage.cases.save(caseEntity);

      // Emit domain event AFTER successful persistence
      await this.eventBus.publish("CaseCreated", caseEntity.toJSON(), {
        aggregateId: caseEntity.id,
        metadata: { mcn: caseEntity.mcn },
      });

      logger.info("Case created and event emitted", { caseId: caseEntity.id });

      return caseEntity.clone();
    } catch (error) {
      // Rollback on error
      this.appState.removeCase(caseEntity.id);
      throw new DomainError("Failed to create case", { cause: error });
    }
  }
}
```

**Apply same pattern to:**

- `UpdateCase.ts` → emit `'CaseUpdated'`
- `DeleteCase.ts` → emit `'CaseDeleted'`
- Financial use cases → emit `'FinancialItemAdded'`, etc.
- Note use cases → emit `'NoteCreated'`, etc.

### 3. Subscribe to Events for Activity Logging

**File:** `application/ActivityLogger.ts` (new)

```typescript
import { DomainEventBus } from "./DomainEventBus";
import { ApplicationState } from "./ApplicationState";
import { ActivityEvent } from "@/domain/activity/entities/ActivityEvent";
import type { StorageRepository } from "@/infrastructure/storage/StorageRepository";
import { createLogger } from "@/utils/logger";

const logger = createLogger("ActivityLogger");

/**
 * Subscribes to domain events and creates activity log entries.
 * Decouples activity logging from business operations.
 */
export class ActivityLogger {
  private unsubscribers: Array<() => void> = [];

  constructor(
    private readonly appState: ApplicationState,
    private readonly storage: StorageRepository,
    private readonly eventBus: DomainEventBus = DomainEventBus.getInstance()
  ) {}

  /**
   * Start listening to domain events.
   */
  start(): void {
    logger.info("Starting activity logger");

    // Subscribe to case events
    this.unsubscribers.push(
      this.eventBus.subscribe("CaseCreated", async (event) => {
        const activity = ActivityEvent.create({
          type: "case_created",
          entityType: "case",
          entityId: event.aggregateId!,
          description: `Case created: ${event.payload.name}`,
          metadata: { mcn: event.payload.mcn },
        });

        this.appState.addActivity(activity);
        await this.storage.activities.save(activity);
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe("CaseUpdated", async (event) => {
        const activity = ActivityEvent.create({
          type: "case_updated",
          entityType: "case",
          entityId: event.aggregateId!,
          description: `Case updated: ${event.payload.name}`,
        });

        this.appState.addActivity(activity);
        await this.storage.activities.save(activity);
      })
    );

    // Add more subscriptions for financials, notes, alerts...

    logger.info("Activity logger started", {
      subscriptions: this.unsubscribers.length,
    });
  }

  /**
   * Stop listening and cleanup.
   */
  stop(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    logger.info("Activity logger stopped");
  }
}

export default ActivityLogger;
```

### 4. Integrate ApplicationState with React

**File:** `hooks/useAppState.ts` (new helper hook)

```typescript
import { ApplicationState } from "@/application/ApplicationState";
import { useEffect, useState } from "react";
import type { ApplicationStateSnapshot } from "@/application/ApplicationState";

/**
 * React hook for subscribing to ApplicationState changes.
 * Provides snapshot-based reactivity.
 */
export function useAppState(): ApplicationStateSnapshot {
  const appState = ApplicationState.getInstance();
  const [snapshot, setSnapshot] = useState<ApplicationStateSnapshot>(
    appState.getSnapshot()
  );

  useEffect(() => {
    const unsubscribe = appState.subscribe((newSnapshot) => {
      setSnapshot(newSnapshot);
    });

    return unsubscribe;
  }, [appState]);

  return snapshot;
}

/**
 * Selector-based hook for specific state slices.
 */
export function useAppStateSelector<T>(
  selector: (snapshot: ApplicationStateSnapshot) => T
): T {
  const snapshot = useAppState();
  return selector(snapshot);
}

// Convenience hooks
export function useCases() {
  return useAppStateSelector((s) => Array.from(s.cases.values()));
}

export function useCase(id: string | null) {
  return useAppStateSelector((s) => (id ? s.cases.get(id) : undefined));
}

export function useActivities() {
  return useAppStateSelector((s) => Array.from(s.activities.values()));
}
```

### 5. Update React Components

**File:** `components/app/AppContent.tsx` (refactor)

Replace local React state with ApplicationState:

```typescript
import { useCases } from "@/hooks/useAppState";
import { ApplicationState } from "@/application/ApplicationState";

function AppContent() {
  // BEFORE: Local state
  // const [cases, setCases] = useState<CaseDisplay[]>([]);

  // AFTER: Use ApplicationState
  const cases = useCases();
  const appState = ApplicationState.getInstance();

  // Components can still call use case methods
  const handleCreateCase = async (input: CreateCaseInput) => {
    const useCase = new CreateCaseUseCase(appState, storage);
    const newCase = await useCase.execute(input);
    // No manual state update needed - event bus handles it!
  };

  return (
    <div>
      <CaseList cases={cases} />
    </div>
  );
}
```

**File:** `hooks/useCaseManagement.ts` (refactor)

```typescript
import { ApplicationState } from "@/application/ApplicationState";
import { StorageRepository } from "@/infrastructure/storage/StorageRepository";
import { CreateCaseUseCase } from "@/domain/cases/use-cases/CreateCase";
import { useCallback } from "react";

export function useCaseManagement() {
  const appState = ApplicationState.getInstance();
  const storage = new StorageRepository(fileService); // Get from context

  const createCase = useCallback(
    async (input: CreateCaseInput) => {
      const useCase = new CreateCaseUseCase(appState, storage);
      return await useCase.execute(input);
      // State update happens automatically via event bus
    },
    [appState, storage]
  );

  return { createCase };
}
```

### 6. Remove safeNotifyFileStorageChange Calls

The domain event bus replaces all manual synchronization:

```bash
# Search for calls
grep -r "safeNotifyFileStorageChange" --include="*.ts" --include="*.tsx"

# Delete the file after confirming no usage
rm utils/safeNotifyFileStorageChange.ts
```

**Why this works:**

- Use cases emit events after successful persistence
- ApplicationState subscribes to events and updates Maps
- React components subscribe to ApplicationState snapshots
- Activity logging happens via event subscriptions
- No manual sync calls needed!

---

## Testing

**File:** `application/__tests__/DomainEventBus.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DomainEventBus } from "../DomainEventBus";

describe("DomainEventBus", () => {
  let bus: DomainEventBus;

  beforeEach(() => {
    DomainEventBus.resetForTesting();
    bus = DomainEventBus.getInstance();
  });

  it("should publish and receive events", async () => {
    const handler = vi.fn();
    bus.subscribe("CaseCreated", handler);

    await bus.publish(
      "CaseCreated",
      { id: "test-id", name: "Test Case" },
      {
        aggregateId: "test-id",
      }
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CaseCreated",
        payload: { id: "test-id", name: "Test Case" },
        aggregateId: "test-id",
        timestamp: expect.any(String),
      })
    );
  });

  it("should support multiple handlers for same event", async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.subscribe("CaseCreated", handler1);
    bus.subscribe("CaseCreated", handler2);

    await bus.publish("CaseCreated", { id: "test-id" });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it("should unsubscribe handlers", async () => {
    const handler = vi.fn();
    const unsubscribe = bus.subscribe("CaseCreated", handler);

    unsubscribe();

    await bus.publish("CaseCreated", { id: "test-id" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("should handle handler errors gracefully", async () => {
    const errorHandler = vi.fn().mockRejectedValue(new Error("Handler error"));
    const successHandler = vi.fn();

    bus.subscribe("CaseCreated", errorHandler);
    bus.subscribe("CaseCreated", successHandler);

    await bus.publish("CaseCreated", { id: "test-id" });

    // Both handlers called despite error
    expect(errorHandler).toHaveBeenCalledOnce();
    expect(successHandler).toHaveBeenCalledOnce();
  });
});
```

**File:** `application/__tests__/ActivityLogger.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActivityLogger } from "../ActivityLogger";
import { ApplicationState } from "../ApplicationState";
import { DomainEventBus } from "../DomainEventBus";
import type { StorageRepository } from "@/infrastructure/storage/StorageRepository";

describe("ActivityLogger", () => {
  let appState: ApplicationState;
  let eventBus: DomainEventBus;
  let mockStorage: StorageRepository;
  let logger: ActivityLogger;

  beforeEach(() => {
    ApplicationState.resetForTesting();
    DomainEventBus.resetForTesting();

    appState = ApplicationState.getInstance();
    eventBus = DomainEventBus.getInstance();

    mockStorage = {
      activities: {
        save: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as StorageRepository;

    logger = new ActivityLogger(appState, mockStorage, eventBus);
  });

  it("should create activity log on CaseCreated event", async () => {
    logger.start();

    await eventBus.publish(
      "CaseCreated",
      {
        id: "case-1",
        name: "Test Case",
        mcn: "MCN-001",
      },
      { aggregateId: "case-1" }
    );

    const activities = appState.getActivities();
    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe("case_created");
    expect(mockStorage.activities.save).toHaveBeenCalledOnce();
  });

  it("should cleanup subscriptions on stop", async () => {
    logger.start();
    logger.stop();

    await eventBus.publish("CaseCreated", { id: "case-1" });

    const activities = appState.getActivities();
    expect(activities).toHaveLength(0);
  });
});
```

---

## Critical Constraints

### DO NOT:

- ❌ Modify `AutosaveFileService` or `FileStorageContext`
- ❌ Replace ApplicationState singleton with Zustand
- ❌ Emit events BEFORE persistence (must be after successful save)
- ❌ Make ApplicationState a React hook (it's a singleton class)

### DO:

- ✅ Use singleton pattern for ApplicationState and DomainEventBus
- ✅ Emit events in use cases AFTER successful persistence
- ✅ Use optimistic update + event emission pattern
- ✅ Subscribe to events for cross-cutting concerns (activity logging)
- ✅ Create React hooks that wrap ApplicationState subscriptions
- ✅ Remove all `safeNotifyFileStorageChange()` calls
- ✅ Keep Map-based storage in ApplicationState
- ✅ Use `getSnapshot()` for React integration

---

## Verification Checklist

- [ ] DomainEventBus singleton implemented
- [ ] ActivityLogger subscribes to events
- [ ] Use cases emit events after successful persistence
- [ ] React hooks (`useAppState`, `useCases`) created
- [ ] Components use ApplicationState instead of local state
- [ ] Zero `safeNotifyFileStorageChange()` calls remain
- [ ] Activity logging decoupled from use cases
- [ ] All 250+ tests passing
- [ ] No performance regressions
- [ ] ApplicationState.hydrate() called on app startup

---

## Success Criteria

✅ Event-driven state synchronization  
✅ Decoupled activity logging  
✅ Zero manual sync calls  
✅ React components use singleton state  
✅ All tests passing  
✅ No regressions

---

## Integration Flow

```
User Action
    ↓
React Component
    ↓
Use Case (CreateCase)
    ↓
1. Optimistic Update (ApplicationState.addCase)
    ↓
2. Persist (StorageRepository.save)
    ↓
3. Emit Event (EventBus.publish)
    ↓
4. Activity Logger subscribes → creates activity log
    ↓
React Component re-renders (ApplicationState snapshot changed)
```

---

_Reference Phase 1 artifacts: `application/ApplicationState.ts`, `infrastructure/storage/StorageRepository.ts`, `domain/cases/use-cases/CreateCase.ts`_
