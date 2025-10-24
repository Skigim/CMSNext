# Phase 4: Worker Preparation - Agent Prompt

**Context:** You are implementing Phase 4 of the architecture refactor. Phase 1-3 established clean architecture. Now you'll prepare for future worker migration by creating the WorkerBridge abstraction with pass-through implementation.

**Reference:** See `docs/development/architecture-refactor-plan.md` for full context.

---

## Objective

Create worker-compatible abstractions that enable future background thread migration without changing business logic.

---

## Current State (Post-Phase 3)

### Existing Architecture:

- ✅ Domain repositories (ICaseRepository, IFinancialRepository, INoteRepository)
- ✅ ApplicationState with domain events
- ✅ Use cases extracted (CreateCase, UpdateCase, etc.)
- ✅ Services orchestrate flows (CaseManagementService, etc.)
- ✅ Thin hooks wrap services
- ❌ No worker abstraction layer
- ❌ Use cases not serializable (dependency injection in constructors)
- ❌ No message contracts for worker communication

### Files to Read:

- `domain/cases/use-cases/CreateCase.ts` - Your use case from Phase 3
- `application/services/CaseManagementService.ts` - Your service from Phase 3
- `infrastructure/StorageRepository.ts` - Your repository from Phase 1
- `utils/AutosaveFileService.ts` - **DO NOT MODIFY** (infrastructure boundary)

---

## Tasks

### 1. Define Worker Message Contracts

**File:** `infrastructure/workers/types.ts`

```typescript
/**
 * Message types for worker communication
 */
export type WorkerMessageType =
  | "CreateCase"
  | "UpdateCase"
  | "DeleteCase"
  | "GetAllCases"
  | "AddFinancialItem"
  | "UpdateFinancialItem"
  | "DeleteFinancialItem"
  | "CreateNote"
  | "UpdateNote"
  | "DeleteNote";

/**
 * Request message sent to worker
 */
export interface WorkerRequest<TPayload = any> {
  id: string; // Unique request ID
  type: WorkerMessageType;
  payload: TPayload;
  timestamp: number;
}

/**
 * Response message from worker
 */
export interface WorkerResponse<TResult = any> {
  id: string; // Matches request ID
  success: boolean;
  result?: TResult;
  error?: string;
  timestamp: number;
}

/**
 * Case-specific message payloads
 */
export interface CreateCasePayload {
  formData: {
    name: string;
    status: "open" | "closed" | "pending";
    category?: string;
    [key: string]: any;
  };
}

export interface UpdateCasePayload {
  caseId: string;
  updates: {
    name?: string;
    status?: "open" | "closed" | "pending";
    [key: string]: any;
  };
}

export interface DeleteCasePayload {
  caseId: string;
}

export interface CreateCaseResult {
  caseId: string;
}

export interface UpdateCaseResult {
  success: boolean;
}

export interface DeleteCaseResult {
  success: boolean;
}

/**
 * Financial item payloads
 */
export interface AddFinancialItemPayload {
  caseId: string;
  itemData: {
    category: string;
    description: string;
    amount: number;
    [key: string]: any;
  };
}

export interface UpdateFinancialItemPayload {
  caseId: string;
  itemId: string;
  updates: {
    category?: string;
    description?: string;
    amount?: number;
    [key: string]: any;
  };
}

export interface DeleteFinancialItemPayload {
  caseId: string;
  itemId: string;
}

/**
 * Note payloads
 */
export interface CreateNotePayload {
  caseId: string;
  noteData: {
    content: string;
    [key: string]: any;
  };
}

export interface UpdateNotePayload {
  caseId: string;
  noteId: string;
  updates: {
    content?: string;
    [key: string]: any;
  };
}

export interface DeleteNotePayload {
  caseId: string;
  noteId: string;
}
```

### 2. Create WorkerBridge Interface

**File:** `infrastructure/workers/IWorkerBridge.ts`

```typescript
import type {
  WorkerRequest,
  WorkerResponse,
  CreateCasePayload,
  CreateCaseResult,
  UpdateCasePayload,
  UpdateCaseResult,
  DeleteCasePayload,
  DeleteCaseResult,
  AddFinancialItemPayload,
  UpdateFinancialItemPayload,
  DeleteFinancialItemPayload,
  CreateNotePayload,
  UpdateNotePayload,
  DeleteNotePayload,
} from "./types";

/**
 * Abstract bridge for worker communication.
 * Enables future migration to Web Workers without changing business logic.
 */
export interface IWorkerBridge {
  // Case operations
  createCase(payload: CreateCasePayload): Promise<CreateCaseResult>;
  updateCase(payload: UpdateCasePayload): Promise<UpdateCaseResult>;
  deleteCase(payload: DeleteCasePayload): Promise<DeleteCaseResult>;
  getAllCases(): Promise<any[]>;

  // Financial item operations
  addFinancialItem(payload: AddFinancialItemPayload): Promise<any>;
  updateFinancialItem(payload: UpdateFinancialItemPayload): Promise<any>;
  deleteFinancialItem(payload: DeleteFinancialItemPayload): Promise<any>;

  // Note operations
  createNote(payload: CreateNotePayload): Promise<any>;
  updateNote(payload: UpdateNotePayload): Promise<any>;
  deleteNote(payload: DeleteNotePayload): Promise<any>;

  // Lifecycle
  isReady(): boolean;
  terminate(): void;
}
```

### 3. Implement Pass-Through Bridge

**File:** `infrastructure/workers/PassThroughWorkerBridge.ts`

```typescript
import type { IWorkerBridge } from "./IWorkerBridge";
import type {
  CreateCasePayload,
  CreateCaseResult,
  UpdateCasePayload,
  UpdateCaseResult,
  DeleteCasePayload,
  DeleteCaseResult,
  AddFinancialItemPayload,
  UpdateFinancialItemPayload,
  DeleteFinancialItemPayload,
  CreateNotePayload,
  UpdateNotePayload,
  DeleteNotePayload,
} from "./types";
import { StorageRepository } from "../StorageRepository";
import { CreateCase } from "@/domain/cases/use-cases/CreateCase";
import { UpdateCase } from "@/domain/cases/use-cases/UpdateCase";
import { DeleteCase } from "@/domain/cases/use-cases/DeleteCase";
import { GetAllCases } from "@/domain/cases/use-cases/GetAllCases";
import { createLogger } from "@/utils/logger";

const logger = createLogger("PassThroughWorkerBridge");

/**
 * Pass-through implementation that runs use cases on main thread.
 * Future: Replace with WebWorkerBridge that posts messages to worker.
 */
export class PassThroughWorkerBridge implements IWorkerBridge {
  private repository: StorageRepository;
  private ready: boolean = false;

  constructor() {
    this.repository = new StorageRepository();
    this.ready = true;
    logger.info("PassThroughWorkerBridge initialized");
  }

  isReady(): boolean {
    return this.ready;
  }

  terminate(): void {
    this.ready = false;
    logger.info("PassThroughWorkerBridge terminated");
  }

  // Case operations
  async createCase(payload: CreateCasePayload): Promise<CreateCaseResult> {
    logger.debug("createCase called", { payload });

    const useCase = new CreateCase(this.repository);
    const response = await useCase.execute({ formData: payload.formData });

    if (!response.success) {
      throw new Error(response.error || "Failed to create case");
    }

    return { caseId: response.caseId };
  }

  async updateCase(payload: UpdateCasePayload): Promise<UpdateCaseResult> {
    logger.debug("updateCase called", { payload });

    const useCase = new UpdateCase(this.repository);
    const response = await useCase.execute({
      caseId: payload.caseId,
      updates: payload.updates,
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to update case");
    }

    return { success: true };
  }

  async deleteCase(payload: DeleteCasePayload): Promise<DeleteCaseResult> {
    logger.debug("deleteCase called", { payload });

    const useCase = new DeleteCase(this.repository);
    const response = await useCase.execute({ caseId: payload.caseId });

    if (!response.success) {
      throw new Error(response.error || "Failed to delete case");
    }

    return { success: true };
  }

  async getAllCases(): Promise<any[]> {
    logger.debug("getAllCases called");

    const useCase = new GetAllCases(this.repository);
    const response = await useCase.execute();

    if (!response.success) {
      throw new Error(response.error || "Failed to get cases");
    }

    return response.cases;
  }

  // Financial item operations (stub implementations)
  async addFinancialItem(payload: AddFinancialItemPayload): Promise<any> {
    logger.debug("addFinancialItem called", { payload });
    // TODO: Implement with FinancialRepository
    throw new Error("Not implemented");
  }

  async updateFinancialItem(payload: UpdateFinancialItemPayload): Promise<any> {
    logger.debug("updateFinancialItem called", { payload });
    // TODO: Implement with FinancialRepository
    throw new Error("Not implemented");
  }

  async deleteFinancialItem(payload: DeleteFinancialItemPayload): Promise<any> {
    logger.debug("deleteFinancialItem called", { payload });
    // TODO: Implement with FinancialRepository
    throw new Error("Not implemented");
  }

  // Note operations (stub implementations)
  async createNote(payload: CreateNotePayload): Promise<any> {
    logger.debug("createNote called", { payload });
    // TODO: Implement with NoteRepository
    throw new Error("Not implemented");
  }

  async updateNote(payload: UpdateNotePayload): Promise<any> {
    logger.debug("updateNote called", { payload });
    // TODO: Implement with NoteRepository
    throw new Error("Not implemented");
  }

  async deleteNote(payload: DeleteNotePayload): Promise<any> {
    logger.debug("deleteNote called", { payload });
    // TODO: Implement with NoteRepository
    throw new Error("Not implemented");
  }
}
```

### 4. Update Services to Use WorkerBridge

**File:** `application/services/CaseManagementService.ts` (refactor)

```typescript
import type { IWorkerBridge } from "@/infrastructure/workers/IWorkerBridge";
import type { CaseFormData } from "@/types/case";
import { useApplicationState } from "@/application/ApplicationState";
import { createLogger } from "@/utils/logger";

const logger = createLogger("CaseManagementService");

export class CaseManagementService {
  constructor(private workerBridge: IWorkerBridge) {}

  /**
   * Create a new case and navigate to it
   */
  async createAndNavigateToCase(formData: CaseFormData): Promise<void> {
    const { setLoading, setError, setSelectedCase, setNavigation } =
      useApplicationState.getState();

    setLoading(true);
    setError(null);

    try {
      // Call through worker bridge (currently pass-through, future: real worker)
      const result = await this.workerBridge.createCase({ formData });

      // Navigate to new case
      setSelectedCase(result.caseId);
      setNavigation({ currentView: "details" });

      logger.info("Case created and navigated", { caseId: result.caseId });
    } catch (error) {
      logger.error("Failed to create and navigate", { error });
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Update case and return to list view
   */
  async updateAndReturnToList(
    caseId: string,
    updates: Partial<CaseFormData>
  ): Promise<void> {
    const { setLoading, setError, setNavigation } =
      useApplicationState.getState();

    setLoading(true);
    setError(null);

    try {
      await this.workerBridge.updateCase({ caseId, updates });

      // Return to list
      setNavigation({ currentView: "list", editingCaseId: null });

      logger.info("Case updated and returned to list", { caseId });
    } catch (error) {
      logger.error("Failed to update and return", { caseId, error });
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Delete case and return to list view
   */
  async deleteAndReturnToList(caseId: string): Promise<void> {
    const { setLoading, setError, setNavigation, setSelectedCase } =
      useApplicationState.getState();

    setLoading(true);
    setError(null);

    try {
      await this.workerBridge.deleteCase({ caseId });

      // Return to list
      setSelectedCase(null);
      setNavigation({ currentView: "list" });

      logger.info("Case deleted and returned to list", { caseId });
    } catch (error) {
      logger.error("Failed to delete and return", { caseId, error });
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Load all cases into ApplicationState
   */
  async loadAllCases(): Promise<void> {
    const { setLoading, setError, setCases } = useApplicationState.getState();

    setLoading(true);
    setError(null);

    try {
      const cases = await this.workerBridge.getAllCases();

      setCases(cases);

      logger.info("Cases loaded", { count: cases.length });
    } catch (error) {
      logger.error("Failed to load cases", { error });
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }
}
```

### 5. Update Hooks to Inject WorkerBridge

**File:** `hooks/useCaseManagement.ts` (update)

```typescript
import { useMemo } from "react";
import { CaseManagementService } from "@/application/services/CaseManagementService";
import { PassThroughWorkerBridge } from "@/infrastructure/workers/PassThroughWorkerBridge";
import type { CaseFormData } from "@/types/case";

/**
 * Thin wrapper hook over CaseManagementService with WorkerBridge
 */
export function useCaseManagement() {
  // Create service instance with worker bridge (memoized)
  const service = useMemo(() => {
    const workerBridge = new PassThroughWorkerBridge();
    return new CaseManagementService(workerBridge);
  }, []);

  return {
    createCase: (formData: CaseFormData) =>
      service.createAndNavigateToCase(formData),
    updateCase: (caseId: string, updates: Partial<CaseFormData>) =>
      service.updateAndReturnToList(caseId, updates),
    deleteCase: (caseId: string) => service.deleteAndReturnToList(caseId),
    loadCases: () => service.loadAllCases(),
  };
}
```

### 6. Create Stub for Future Real Worker

**File:** `infrastructure/workers/WebWorkerBridge.ts` (stub only)

```typescript
import type { IWorkerBridge } from "./IWorkerBridge";
import { createLogger } from "@/utils/logger";

const logger = createLogger("WebWorkerBridge");

/**
 * STUB: Future implementation will spawn a real Web Worker
 * and communicate via postMessage/onmessage.
 *
 * Implementation steps (post-refactor):
 * 1. Create worker.ts entry point
 * 2. Setup message routing in worker context
 * 3. Implement request/response correlation
 * 4. Add error handling and timeouts
 * 5. Swap PassThroughWorkerBridge → WebWorkerBridge
 */
export class WebWorkerBridge implements IWorkerBridge {
  constructor() {
    logger.warn("WebWorkerBridge is not implemented yet");
    throw new Error(
      "WebWorkerBridge not implemented - use PassThroughWorkerBridge"
    );
  }

  isReady(): boolean {
    return false;
  }

  terminate(): void {
    // no-op
  }

  async createCase(): Promise<any> {
    throw new Error("Not implemented");
  }

  async updateCase(): Promise<any> {
    throw new Error("Not implemented");
  }

  async deleteCase(): Promise<any> {
    throw new Error("Not implemented");
  }

  async getAllCases(): Promise<any[]> {
    throw new Error("Not implemented");
  }

  async addFinancialItem(): Promise<any> {
    throw new Error("Not implemented");
  }

  async updateFinancialItem(): Promise<any> {
    throw new Error("Not implemented");
  }

  async deleteFinancialItem(): Promise<any> {
    throw new Error("Not implemented");
  }

  async createNote(): Promise<any> {
    throw new Error("Not implemented");
  }

  async updateNote(): Promise<any> {
    throw new Error("Not implemented");
  }

  async deleteNote(): Promise<any> {
    throw new Error("Not implemented");
  }
}
```

---

## Testing

**File:** `infrastructure/workers/__tests__/PassThroughWorkerBridge.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PassThroughWorkerBridge } from "../PassThroughWorkerBridge";

// Mock AutosaveFileService to prevent real file writes
vi.mock("@/utils/AutosaveFileService", () => ({
  AutosaveFileService: {
    getInstance: vi.fn(() => ({
      writeJSON: vi.fn().mockResolvedValue(undefined),
      readJSON: vi.fn().mockResolvedValue({ cases: [] }),
    })),
  },
}));

describe("PassThroughWorkerBridge", () => {
  let bridge: PassThroughWorkerBridge;

  beforeEach(() => {
    bridge = new PassThroughWorkerBridge();
  });

  it("should be ready after construction", () => {
    expect(bridge.isReady()).toBe(true);
  });

  it("should create a case", async () => {
    const payload = {
      formData: { name: "Test Case", status: "open" as const },
    };

    const result = await bridge.createCase(payload);

    expect(result.caseId).toBeDefined();
    expect(typeof result.caseId).toBe("string");
  });

  it("should update a case", async () => {
    // First create a case
    const createPayload = {
      formData: { name: "Test Case", status: "open" as const },
    };
    const { caseId } = await bridge.createCase(createPayload);

    // Then update it
    const updatePayload = {
      caseId,
      updates: { name: "Updated Case" },
    };

    const result = await bridge.updateCase(updatePayload);

    expect(result.success).toBe(true);
  });

  it("should delete a case", async () => {
    // First create a case
    const createPayload = {
      formData: { name: "Test Case", status: "open" as const },
    };
    const { caseId } = await bridge.createCase(createPayload);

    // Then delete it
    const deletePayload = { caseId };

    const result = await bridge.deleteCase(deletePayload);

    expect(result.success).toBe(true);
  });

  it("should get all cases", async () => {
    const cases = await bridge.getAllCases();

    expect(Array.isArray(cases)).toBe(true);
  });

  it("should terminate", () => {
    bridge.terminate();
    expect(bridge.isReady()).toBe(false);
  });
});
```

---

## Critical Constraints

### DO NOT:

- ❌ Implement real Web Worker (out of scope)
- ❌ Modify AutosaveFileService or FileStorageContext
- ❌ Change use case logic (already correct from Phase 3)
- ❌ Add async serialization complexity (keep simple)

### DO:

- ✅ Define message contracts (types.ts)
- ✅ Create IWorkerBridge interface
- ✅ Implement pass-through bridge (main thread)
- ✅ Update services to accept IWorkerBridge
- ✅ Update hooks to inject PassThroughWorkerBridge
- ✅ Create stub for WebWorkerBridge (future)

---

## Future Migration Path (Post-Refactor)

When ready to implement real workers:

1. Create `infrastructure/workers/worker.ts` entry point
2. Implement `WebWorkerBridge` with message routing
3. Add request/response correlation (request ID matching)
4. Handle errors and timeouts
5. Swap `PassThroughWorkerBridge` → `WebWorkerBridge` in hooks
6. Test with worker-compatible serialization

**No business logic changes required.**

---

## Verification Checklist

- [ ] Message contracts defined (types.ts)
- [ ] IWorkerBridge interface created
- [ ] PassThroughWorkerBridge implements IWorkerBridge
- [ ] CaseManagementService accepts IWorkerBridge
- [ ] useCaseManagement injects PassThroughWorkerBridge
- [ ] FinancialManagementService accepts IWorkerBridge
- [ ] NoteManagementService accepts IWorkerBridge
- [ ] WebWorkerBridge stub created
- [ ] All 250+ tests passing
- [ ] No performance regressions

---

## Success Criteria

✅ IWorkerBridge abstraction in place  
✅ PassThroughWorkerBridge working (main thread)  
✅ Services use WorkerBridge  
✅ Hooks inject WorkerBridge  
✅ All tests passing  
✅ Future worker swap is drop-in change

---

_Reference Phase 1-3 artifacts: `infrastructure/StorageRepository.ts`, `application/ApplicationState.ts`, `domain/cases/use-cases/_`, `application/services/_`_
