# Phase 1: Foundation - Agent Prompt

**Context:** You are implementing Phase 1 of the architecture refactor for CMSNext, a local-first case management application. This phase establishes the domain-driven architecture foundation.

**Reference:** See `docs/development/architecture-refactor-plan.md` for full context.

---

## Objective

Establish domain structure and repository pattern, proving the pattern with the Cases domain.

---

## Current Architecture (Read These Files First)

### Key Files to Understand:

- `utils/DataManager.ts` (2,704 lines) - Monolithic data manager (will coexist during migration)
- `utils/AutosaveFileService.ts` (1,228 lines) - **DO NOT MODIFY** - File I/O layer
- `contexts/FileStorageContext.tsx` - **DO NOT MODIFY** - Connection/permission layer
- `hooks/useCaseManagement.ts` (329 lines) - Contains business logic to extract
- `types/case.ts` - Existing type definitions

### Current Data Flow:

```
React Hook → DataManager → AutosaveFileService → File System Access API
```

### Target Data Flow:

```
React Hook → Use Case → ApplicationState → StorageRepository → AutosaveFileService
                ↓
         (optimistic update)
```

---

## Tasks

### 1. Create Domain Structure

Create the following folder structure:

```
domain/
├── common/
│   ├── errors/
│   │   ├── DomainError.ts
│   │   └── ValidationError.ts
│   └── repositories/
│       ├── IRepository.ts (base interface)
│       ├── ICaseRepository.ts
│       ├── IFinancialRepository.ts
│       ├── INoteRepository.ts
│       ├── IAlertRepository.ts
│       ├── IActivityRepository.ts
│       └── index.ts
├── cases/
│   ├── entities/
│   │   ├── Case.ts (aggregate root)
│   │   └── Person.ts (value object)
│   └── use-cases/
│       └── CreateCase.ts
├── financials/
│   └── entities/
│       └── FinancialItem.ts
├── notes/
│   └── entities/
│       └── Note.ts
├── alerts/
│   └── entities/
│       └── Alert.ts
└── activity/
    └── entities/
        └── ActivityEvent.ts

application/
└── ApplicationState.ts

infrastructure/
└── storage/
    └── StorageRepository.ts
```

### 2. Define Repository Interfaces

**File:** `domain/common/repositories/IRepository.ts` (base interface)

```typescript
export interface IRepository<T, TId> {
  getById(id: TId): Promise<T | null>;
  getAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: TId): Promise<void>;
}
```

**File:** `domain/common/repositories/ICaseRepository.ts`

```typescript
import type { Case } from "@/domain/cases/entities/Case";
import type { IRepository } from "./IRepository";

export interface ICaseRepository extends IRepository<Case, string> {
  findByMCN(mcn: string): Promise<Case | null>;
  searchCases(query: string): Promise<Case[]>;
}
```

**File:** `domain/common/repositories/IFinancialRepository.ts`

```typescript
import type { FinancialItem } from "@/domain/financials/entities/FinancialItem";
import type { IRepository } from "./IRepository";

export interface IFinancialRepository
  extends IRepository<FinancialItem, string> {
  getByCaseId(caseId: string): Promise<FinancialItem[]>;
  getByCategory(category: string): Promise<FinancialItem[]>;
}
```

**File:** `domain/common/repositories/index.ts`

```typescript
export * from "./IRepository";
export * from "./ICaseRepository";
export * from "./IFinancialRepository";
export * from "./INoteRepository";
export * from "./IAlertRepository";
export * from "./IActivityRepository";
```

### 3. Create Domain Entities

**File:** `domain/cases/entities/Case.ts` (aggregate root)

```typescript
import { DomainError } from "@/domain/common/errors/DomainError";
import { ValidationError } from "@/domain/common/errors/ValidationError";
import { CASE_STATUS, type CaseStatus } from "@/types/case";
import { Person, type PersonProps, type PersonSnapshot } from "./Person";

export type CaseMetadata = Record<string, unknown>;

export interface CaseSnapshot {
  id: string;
  mcn: string;
  name: string;
  status: CaseStatus;
  personId: string;
  createdAt: string;
  updatedAt: string;
  metadata: CaseMetadata;
  person?: PersonSnapshot;
}

export interface CaseCreateInput {
  id?: string;
  mcn: string;
  name: string;
  personId: string;
  metadata?: CaseMetadata;
  status?: CaseStatus;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  person?: Person | PersonProps;
}

/**
 * Aggregate root representing a case within the CMS domain.
 * Encapsulates validation and business rules for status transitions.
 */
export class Case {
  private props: CaseSnapshot & { person?: Person };

  private constructor(props: CaseSnapshot & { person?: Person }) {
    this.props = { ...props };
    this.validate();
  }

  /**
   * Factory for creating a new case with generated identifiers and timestamps.
   */
  static create(input: CaseCreateInput): Case {
    const now = new Date();
    return new Case({
      id: input.id?.trim() || crypto.randomUUID(),
      mcn: input.mcn.trim(),
      name: input.name.trim(),
      status: input.status ?? CASE_STATUS.Active,
      personId: input.personId.trim(),
      createdAt: (input.createdAt ?? now).toISOString(),
      updatedAt: (input.updatedAt ?? now).toISOString(),
      metadata: { ...(input.metadata ?? {}) },
      person: input.person
        ? input.person instanceof Person
          ? input.person
          : Person.create(input.person)
        : undefined,
    });
  }

  /**
   * Reconstruct an existing case from persisted storage.
   */
  static rehydrate(snapshot: CaseSnapshot): Case {
    return new Case({
      ...snapshot,
      person: snapshot.person ? Person.rehydrate(snapshot.person) : undefined,
    });
  }

  /**
   * Clone the aggregate root to maintain immutability guarantees for callers.
   */
  clone(): Case {
    return Case.rehydrate(this.toJSON());
  }

  /**
   * Serialize the aggregate to a plain snapshot suitable for persistence.
   */
  toJSON(): CaseSnapshot {
    return {
      id: this.id,
      mcn: this.mcn,
      name: this.name,
      status: this.status,
      personId: this.personId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: { ...this.metadata },
      person: this.props.person?.toJSON(),
    };
  }

  private validate(): void {
    if (!this.props.id?.trim()) {
      throw new ValidationError("Case ID is required");
    }
    if (!this.props.mcn?.trim()) {
      throw new ValidationError("Case MCN is required");
    }
    if (!this.props.name?.trim()) {
      throw new ValidationError("Case name is required");
    }
  }

  // Getters
  get id(): string {
    return this.props.id;
  }
  get mcn(): string {
    return this.props.mcn;
  }
  get name(): string {
    return this.props.name;
  }
  get status(): CaseStatus {
    return this.props.status;
  }
  get personId(): string {
    return this.props.personId;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get updatedAt(): string {
    return this.props.updatedAt;
  }
  get metadata(): CaseMetadata {
    return this.props.metadata;
  }
  get person(): Person | undefined {
    return this.props.person;
  }
}
```

### 4. Implement StorageRepository

**File:** `infrastructure/storage/StorageRepository.ts`

```typescript
import AutosaveFileService from "@/utils/AutosaveFileService";
import { Case, type CaseSnapshot } from "@/domain/cases/entities/Case";
import type {
  ICaseRepository,
  IFinancialRepository,
  INoteRepository,
  IAlertRepository,
  IActivityRepository,
} from "@/domain/common/repositories";

type DomainScope = "cases" | "financials" | "notes" | "alerts" | "activities";

type StorageFile = {
  cases: CaseSnapshot[];
  financials: unknown[];
  notes: unknown[];
  alerts: unknown[];
  activities: unknown[];
  version: number;
  [key: string]: unknown;
};

/**
 * Unified storage repository implementing all domain repository interfaces.
 * Uses domain scope hints to route operations to correct collections.
 */
export class StorageRepository
  implements
    ICaseRepository,
    IFinancialRepository,
    INoteRepository,
    IAlertRepository,
    IActivityRepository
{
  private static readonly CURRENT_VERSION = 1;
  private domainHint: DomainScope = "cases";

  private readonly caseAdapter: ICaseRepository;

  constructor(private readonly fileService: AutosaveFileService) {
    // Create domain-specific adapters that set scope hints
    this.caseAdapter = {
      getById: (id) => this.runWithDomain("cases", () => this.getById(id)),
      getAll: () => this.runWithDomain("cases", () => this.getAll()),
      save: (entity) => this.runWithDomain("cases", () => this.save(entity)),
      delete: (id) => this.runWithDomain("cases", () => this.delete(id)),
      findByMCN: (mcn) =>
        this.runWithDomain("cases", () => this.findByMCN(mcn)),
      searchCases: (query) =>
        this.runWithDomain("cases", () => this.searchCases(query)),
    };
  }

  get cases(): ICaseRepository {
    return this.caseAdapter;
  }

  // Private helper to run operations with domain scope
  private async runWithDomain<T>(
    scope: DomainScope,
    fn: () => Promise<T>
  ): Promise<T> {
    const previousScope = this.domainHint;
    this.domainHint = scope;
    try {
      return await fn();
    } finally {
      this.domainHint = previousScope;
    }
  }

  // Generic CRUD operations
  private async getById(id: string): Promise<Case | null> {
    const data = await this.readFile();
    const collection = data.cases;
    const snapshot = collection.find((item) => item.id === id);
    return snapshot ? Case.rehydrate(snapshot) : null;
  }

  private async getAll(): Promise<Case[]> {
    const data = await this.readFile();
    return data.cases.map((snapshot) => Case.rehydrate(snapshot));
  }

  private async save(entity: Case): Promise<void> {
    const data = await this.readFile();
    const snapshot = entity.toJSON();
    const index = data.cases.findIndex((item) => item.id === snapshot.id);

    if (index >= 0) {
      data.cases[index] = snapshot;
    } else {
      data.cases.push(snapshot);
    }

    await this.writeFile(data);
  }

  private async delete(id: string): Promise<void> {
    const data = await this.readFile();
    data.cases = data.cases.filter((item) => item.id !== id);
    await this.writeFile(data);
  }

  // Case-specific methods
  private async findByMCN(mcn: string): Promise<Case | null> {
    const data = await this.readFile();
    const snapshot = data.cases.find((item) => item.mcn === mcn);
    return snapshot ? Case.rehydrate(snapshot) : null;
  }

  private async searchCases(query: string): Promise<Case[]> {
    const data = await this.readFile();
    const lowerQuery = query.toLowerCase();
    return data.cases
      .filter(
        (item) =>
          item.name.toLowerCase().includes(lowerQuery) ||
          item.mcn.toLowerCase().includes(lowerQuery)
      )
      .map((snapshot) => Case.rehydrate(snapshot));
  }

  // File I/O
  private async readFile(): Promise<StorageFile> {
    const data = await this.fileService.readFile();
    return (data as StorageFile) || this.createEmptyFile();
  }

  private async writeFile(data: StorageFile): Promise<void> {
    await this.fileService.writeFile(data);
  }

  private createEmptyFile(): StorageFile {
    return {
      version: StorageRepository.CURRENT_VERSION,
      cases: [],
      financials: [],
      notes: [],
      alerts: [],
      activities: [],
    };
  }
}

export default StorageRepository;
```

### 5. Create ApplicationState (Singleton)

**File:** `application/ApplicationState.ts`

```typescript
import { Case } from "@/domain/cases/entities/Case";
import { FinancialItem } from "@/domain/financials/entities/FinancialItem";
import type { StorageRepository } from "@/infrastructure/storage/StorageRepository";
import { createLogger } from "@/utils/logger";

const logger = createLogger("ApplicationState");

export type StateChangeListener = (snapshot: ApplicationStateSnapshot) => void;

export interface ApplicationStateSnapshot {
  cases: Map<string, Case>;
  financials: Map<string, FinancialItem>;
  notes: Map<string, unknown>;
  alerts: Map<string, unknown>;
  activities: Map<string, unknown>;
  version: number;
  lastHydrated?: Date;
}

/**
 * Singleton managing in-memory application state.
 * Provides optimistic updates and change notifications.
 */
export class ApplicationState {
  private static instance: ApplicationState | null = null;

  private cases: Map<string, Case> = new Map();
  private financials: Map<string, FinancialItem> = new Map();
  private notes: Map<string, unknown> = new Map();
  private alerts: Map<string, unknown> = new Map();
  private activities: Map<string, unknown> = new Map();

  private version = 0;
  private lastHydrated?: Date;
  private listeners: Set<StateChangeListener> = new Set();

  private constructor() {}

  static getInstance(): ApplicationState {
    if (!ApplicationState.instance) {
      ApplicationState.instance = new ApplicationState();
    }
    return ApplicationState.instance;
  }

  /**
   * Load initial state from storage repository.
   */
  async hydrate(storage: StorageRepository): Promise<void> {
    logger.info("Hydrating application state from storage");

    const [cases] = await Promise.all([
      storage.cases.getAll(),
      // storage.financials.getAll(), // TODO: Phase 2
    ]);

    this.cases.clear();
    cases.forEach((c) => this.cases.set(c.id, c));

    this.lastHydrated = new Date();
    this.version++;
    this.notifyListeners();

    logger.info("Application state hydrated", {
      casesCount: this.cases.size,
      version: this.version,
    });
  }

  getSnapshot(): ApplicationStateSnapshot {
    return {
      cases: new Map(this.cases),
      financials: new Map(this.financials),
      notes: new Map(this.notes),
      alerts: new Map(this.alerts),
      activities: new Map(this.activities),
      version: this.version,
      lastHydrated: this.lastHydrated,
    };
  }

  // Cases
  getCases(): Case[] {
    return Array.from(this.cases.values());
  }

  getCase(id: string): Case | undefined {
    return this.cases.get(id);
  }

  addCase(caseEntity: Case): void {
    this.cases.set(caseEntity.id, caseEntity.clone());
    this.version++;
    this.notifyListeners();
  }

  updateCase(caseEntity: Case): void {
    this.cases.set(caseEntity.id, caseEntity.clone());
    this.version++;
    this.notifyListeners();
  }

  removeCase(id: string): void {
    this.cases.delete(id);
    this.version++;
    this.notifyListeners();
  }

  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        logger.error("Listener error", { error });
      }
    });
  }

  static resetForTesting(): void {
    ApplicationState.instance = null;
  }
}
```

### 6. Create Use Cases with Optimistic Updates

**File:** `domain/cases/use-cases/CreateCase.ts`

```typescript
import { Case, type CaseCreateInput } from "@/domain/cases/entities/Case";
import { Person, type PersonProps } from "@/domain/cases/entities/Person";
import { ApplicationState } from "@/application/ApplicationState";
import type { StorageRepository } from "@/infrastructure/storage/StorageRepository";
import { createLogger } from "@/utils/logger";
import { DomainError } from "@/domain/common/errors/DomainError";

const logger = createLogger("CreateCase");

export interface CreateCaseInput {
  mcn: string;
  name: string;
  person: PersonProps;
  metadata?: Record<string, unknown>;
}

/**
 * Use Case: Create a new case
 * Pattern: Validate → Create Entity → Optimistic Update → Persist → Rollback on Error
 */
export class CreateCaseUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly storage: StorageRepository
  ) {}

  async execute(input: CreateCaseInput): Promise<Case> {
    // 1. Validate input
    this.validateInput(input);

    // 2. Create domain entity
    const person = Person.create(input.person);
    const caseEntity = Case.create({
      mcn: input.mcn,
      name: input.name,
      personId: person.id,
      metadata: input.metadata,
      person,
    });

    logger.info("Creating case", {
      caseId: caseEntity.id,
      mcn: caseEntity.mcn,
      name: caseEntity.name,
    });

    // 3. Optimistic update (add to in-memory state immediately)
    this.appState.addCase(caseEntity);

    try {
      // 4. Persist to storage
      await this.storage.cases.save(caseEntity);

      logger.info("Case persisted successfully", { caseId: caseEntity.id });

      return caseEntity.clone();
    } catch (error) {
      // 5. Rollback on error
      logger.error("Failed to persist case, rolling back", {
        error,
        caseId: caseEntity.id,
      });
      this.appState.removeCase(caseEntity.id);
      throw new DomainError("Failed to create case", { cause: error });
    }
  }

  private validateInput(input: CreateCaseInput): void {
    if (!input.mcn?.trim()) {
      throw new DomainError("MCN is required");
    }
    if (!input.name?.trim()) {
      throw new DomainError("Case name is required");
    }
    if (!input.person?.firstName?.trim()) {
      throw new DomainError("Person first name is required");
    }
    if (!input.person?.lastName?.trim()) {
      throw new DomainError("Person last name is required");
    }
  }
}
```

### 7. Write Tests

**File:** `domain/cases/__tests__/CreateCase.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateCaseUseCase } from "../use-cases/CreateCase";
import { ApplicationState } from "@/application/ApplicationState";
import type { StorageRepository } from "@/infrastructure/storage/StorageRepository";
import type { ICaseRepository } from "@/domain/common/repositories";

describe("CreateCaseUseCase", () => {
  let appState: ApplicationState;
  let mockStorage: StorageRepository;

  beforeEach(() => {
    ApplicationState.resetForTesting();
    appState = ApplicationState.getInstance();

    mockStorage = {
      cases: {
        save: vi.fn().mockResolvedValue(undefined),
        getAll: vi.fn().mockResolvedValue([]),
        getById: vi.fn(),
        delete: vi.fn(),
        findByMCN: vi.fn(),
        searchCases: vi.fn(),
      } as unknown as ICaseRepository,
    } as unknown as StorageRepository;
  });

  it("should create case with optimistic update", async () => {
    const useCase = new CreateCaseUseCase(appState, mockStorage);

    const result = await useCase.execute({
      mcn: "MCN-001",
      name: "John Doe Case",
      person: {
        firstName: "John",
        lastName: "Doe",
        dateOfBirth: new Date("1990-01-01"),
      },
    });

    expect(result).toBeDefined();
    expect(result.mcn).toBe("MCN-001");
    expect(result.name).toBe("John Doe Case");

    // Verify optimistic update happened
    const cases = appState.getCases();
    expect(cases).toHaveLength(1);
    expect(cases[0].id).toBe(result.id);

    // Verify persistence was attempted
    expect(mockStorage.cases.save).toHaveBeenCalledOnce();
  });

  it("should rollback on persistence failure", async () => {
    mockStorage.cases.save = vi
      .fn()
      .mockRejectedValue(new Error("Storage error"));

    const useCase = new CreateCaseUseCase(appState, mockStorage);

    await expect(
      useCase.execute({
        mcn: "MCN-002",
        name: "Jane Doe Case",
        person: {
          firstName: "Jane",
          lastName: "Doe",
          dateOfBirth: new Date("1985-05-15"),
        },
      })
    ).rejects.toThrow("Failed to create case");

    // Verify rollback occurred - state should be empty
    const cases = appState.getCases();
    expect(cases).toHaveLength(0);
  });

  it("should validate required fields", async () => {
    const useCase = new CreateCaseUseCase(appState, mockStorage);

    await expect(
      useCase.execute({
        mcn: "",
        name: "Test",
        person: { firstName: "John", lastName: "Doe", dateOfBirth: new Date() },
      })
    ).rejects.toThrow("MCN is required");

    await expect(
      useCase.execute({
        mcn: "MCN-003",
        name: "",
        person: { firstName: "John", lastName: "Doe", dateOfBirth: new Date() },
      })
    ).rejects.toThrow("Case name is required");
  });
});
```

constructor(private repository: ICaseRepository) {}

async execute(input: CreateCaseInput): Promise<CreateCaseResult> {
try {
// Validation
if (!input.person.firstName || !input.person.lastName) {
return {
success: false,
error: "First name and last name are required",
};
}

      // Business logic
      const newCase = await this.repository.createCase(
        input.person,
        input.caseRecord
      );

      return {
        success: true,
        case: newCase,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

}
}

````

**File:** `domain/cases/use-cases/UpdateCase.ts`

```typescript
import type { ICaseRepository } from "../repositories/ICaseRepository";
import type { CaseDisplay } from "@/types/case";

export interface UpdateCaseInput {
  caseId: string;
  updates: Partial<CaseDisplay>;
}

export interface UpdateCaseResult {
  success: boolean;
  case?: CaseDisplay;
  error?: string;
}

export class UpdateCase {
  constructor(private repository: ICaseRepository) {}

  async execute(input: UpdateCaseInput): Promise<UpdateCaseResult> {
    try {
      const updatedCase = await this.repository.updateCase(
        input.caseId,
        input.updates
      );

      return {
        success: true,
        case: updatedCase,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
````

### 5. Write Tests

**File:** `domain/cases/__tests__/CreateCase.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest";
import { CreateCase } from "../use-cases/CreateCase";
import type { ICaseRepository } from "../repositories/ICaseRepository";

describe("CreateCase", () => {
  it("should create a case successfully", async () => {
    // Mock repository
    const mockRepository: ICaseRepository = {
      createCase: vi.fn().mockResolvedValue({
        id: "test-id",
        name: "John Doe",
        status: "active",
      }),
      // ... other methods
    } as any;

    const useCase = new CreateCase(mockRepository);

    const result = await useCase.execute({
      person: {
        firstName: "John",
        lastName: "Doe",
        ssn: "123-45-6789",
        dateOfBirth: "1990-01-01",
      },
      caseRecord: {
        status: "active",
        category: "general",
        dateOpened: "2025-10-23",
      },
    });

    expect(result.success).toBe(true);
    expect(result.case).toBeDefined();
    expect(mockRepository.createCase).toHaveBeenCalledOnce();
  });

  it("should fail when required fields are missing", async () => {
    const mockRepository = {} as ICaseRepository;
    const useCase = new CreateCase(mockRepository);

    const result = await useCase.execute({
      person: {
        firstName: "",
        lastName: "",
        ssn: "",
        dateOfBirth: "",
      },
      caseRecord: {
        status: "active",
        category: "general",
        dateOpened: "2025-10-23",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("required");
  });
});
```

---

## Critical Constraints

### DO NOT MODIFY:

- ❌ `utils/AutosaveFileService.ts` - Use as black box for file I/O
- ❌ `contexts/FileStorageContext.tsx` - Connection/permission layer

### Architectural Patterns:

**Unified Repository:**

```typescript
// ONE repository class implementing ALL domain interfaces
export class StorageRepository
  implements
    ICaseRepository,
    IFinancialRepository,
    INoteRepository,
    IAlertRepository,
    IActivityRepository
{
  // Domain adapters route operations to correct collections
  get cases(): ICaseRepository {
    return this.caseAdapter;
  }
}
```

**Rich Domain Entities:**

```typescript
// Entities have factory methods and validation
export class Case {
  static create(input: CaseCreateInput): Case {
    /* ... */
  }
  static rehydrate(snapshot: CaseSnapshot): Case {
    /* ... */
  }
  clone(): Case {
    /* ... */
  }
  toJSON(): CaseSnapshot {
    /* ... */
  }
}
```

**Optimistic Updates + Rollback:**

```typescript
// 1. Optimistic update
this.appState.addCase(caseEntity);

try {
  // 2. Persist
  await this.storage.cases.save(caseEntity);
  return caseEntity.clone();
} catch (error) {
  // 3. Rollback on failure
  this.appState.removeCase(caseEntity.id);
  throw error;
}
```

**Singleton ApplicationState:**

```typescript
// Get singleton instance
const appState = ApplicationState.getInstance();

// Hydrate from storage on startup
await appState.hydrate(storage);

// Subscribe to changes
appState.subscribe((snapshot) => {
  // React to state changes
});
```

---

## Testing Requirements

1. **Unit Tests:** Test use cases with mocked ApplicationState and StorageRepository
2. **Test Optimistic Updates:** Verify state changes before persistence
3. **Test Rollback:** Verify state rollback on persistence failure
4. **Mock Pattern:**

```typescript
let appState: ApplicationState;
let mockStorage: StorageRepository;

beforeEach(() => {
  ApplicationState.resetForTesting();
  appState = ApplicationState.getInstance();

  mockStorage = {
    cases: {
      save: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue([]),
    } as unknown as ICaseRepository,
  } as unknown as StorageRepository;
});
```

---

## Verification Checklist

**Status: ✅ PHASE 1 COMPLETE** (Verified November 5, 2025)

- [x] Domain folder structure created (common/, cases/, financials/, notes/, alerts/, activity/)
- [x] Repository interfaces centralized in `domain/common/repositories/`
- [x] `StorageRepository` implements ALL repository interfaces via adapters
- [x] `ApplicationState` singleton with Map-based storage
- [x] Rich domain entities with `create()`, `rehydrate()`, `clone()` methods
- [x] Use cases inject BOTH `ApplicationState` AND `StorageRepository`
- [x] Optimistic update + rollback pattern implemented
- [x] Tests cover optimistic updates, rollback, and validation
- [x] Zero changes to `AutosaveFileService`
- [x] Zero changes to `FileStorageContext`
- [x] All tests passing (16/16 use case tests, 347 total)

---

## Success Criteria

✅ Unified repository with domain adapters  
✅ Rich domain entities with factory methods  
✅ ApplicationState singleton with Maps  
✅ Optimistic update pattern proven  
✅ All tests passing (347 total, 16 use case tests)  
✅ No regressions

---

## Implementation Summary

**Completion Date:** October-November 2025  
**Test Results:** 347/347 passing (100%)  
**Files Created:** 25+ domain/service/test files  
**Architecture:** Production-ready domain-driven design

### Key Achievements

1. **Domain Layer Complete**

   - `Case` and `Person` entities with full validation
   - 4 use cases: CreateCase, UpdateCase, DeleteCase, GetAllCases
   - Repository interfaces for all 5 domains
   - Domain errors (DomainError, ValidationError)

2. **Infrastructure Layer Complete**

   - `StorageRepository` with unified adapter pattern
   - 5 domain adapters (cases, financials, notes, alerts, activities)
   - File I/O integration via `AutosaveFileService` (no modifications)

3. **Application Layer Complete**

   - `ApplicationState` singleton with Map-based storage
   - Optimistic update + rollback pattern proven
   - Event bus integration (`DomainEventBus`)
   - Subscription-based state notifications

4. **Testing Infrastructure**
   - 16 use case tests with 100% pass rate
   - Optimistic update scenarios covered
   - Rollback on failure scenarios covered
   - Validation error handling tested
   - Mock patterns established for future phases

### Architectural Patterns Established

- **Optimistic Updates:** Immediate UI updates with automatic rollback on failure
- **Domain Events:** Event publishing for cross-domain coordination
- **Repository Adapters:** Single repository class with domain-scoped interfaces
- **Rich Entities:** Factory methods, validation, immutability via cloning
- **Singleton State:** Centralized ApplicationState with reactive notifications

### Next Phase

Phase 2 (State Management) builds on this foundation by:

- Adding `DomainEventBus` for cross-domain communication
- Enhancing ApplicationState with domain-specific state slices
- Implementing event-driven workflows

---

_Reference the main refactor plan for full context and dependencies._
