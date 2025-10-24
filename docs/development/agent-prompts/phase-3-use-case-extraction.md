# Phase 3: Use Case Extraction - Agent Prompt

**Context:** You are implementing Phase 3 of the architecture refactor. Phase 1 created repositories, Phase 2 unified state. Now you'll extract business logic from hooks into use cases and services.

**Reference:** See `docs/development/architecture-refactor-plan.md` for full context.

---

## Objective

Transform fat hooks into thin wrappers over use cases and service layer orchestration.

---

## Current State (Post-Phase 2)

### Existing Architecture:

- ✅ Domain repositories (StorageRepository)
- ✅ ApplicationState with domain events
- ✅ Event bus replaces manual syncs
- ❌ Business logic still in hooks (useCaseManagement: 329 lines)
- ❌ Hooks directly call DataManager + AutosaveFileService
- ❌ No orchestration layer for complex flows

### Files to Read:

- `hooks/useCaseManagement.ts` - 329 lines, **will be refactored**
- `hooks/useFinancialItemFlow.ts` - 171 lines, **will be refactored**
- `hooks/useNoteFlow.ts` - 183 lines, **will be refactored**
- `infrastructure/StorageRepository.ts` - Your repository from Phase 1
- `application/ApplicationState.ts` - Your state from Phase 2

---

## Tasks

### 1. Extract Case Use Cases

**Folder:** `domain/cases/use-cases/`

Create individual use case files:

#### CreateCase.ts

```typescript
import type { ICaseRepository } from "../repositories/ICaseRepository";
import type { CaseFormData } from "@/types/case";
import { createLogger } from "@/utils/logger";

const logger = createLogger("CreateCase");

export interface CreateCaseRequest {
  formData: CaseFormData;
}

export interface CreateCaseResponse {
  caseId: string;
  success: boolean;
  error?: string;
}

export class CreateCase {
  constructor(private repository: ICaseRepository) {}

  async execute(request: CreateCaseRequest): Promise<CreateCaseResponse> {
    logger.info("Creating case", { name: request.formData.name });

    try {
      const newCase = await this.repository.createCase(request.formData);

      logger.info("Case created successfully", { caseId: newCase.id });

      return {
        caseId: newCase.id,
        success: true,
      };
    } catch (error) {
      logger.error("Failed to create case", { error });
      return {
        caseId: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
```

#### UpdateCase.ts

```typescript
import type { ICaseRepository } from "../repositories/ICaseRepository";
import type { CaseFormData } from "@/types/case";
import { createLogger } from "@/utils/logger";

const logger = createLogger("UpdateCase");

export interface UpdateCaseRequest {
  caseId: string;
  updates: Partial<CaseFormData>;
}

export interface UpdateCaseResponse {
  success: boolean;
  error?: string;
}

export class UpdateCase {
  constructor(private repository: ICaseRepository) {}

  async execute(request: UpdateCaseRequest): Promise<UpdateCaseResponse> {
    logger.info("Updating case", { caseId: request.caseId });

    try {
      await this.repository.updateCase(request.caseId, request.updates);

      logger.info("Case updated successfully", { caseId: request.caseId });

      return { success: true };
    } catch (error) {
      logger.error("Failed to update case", { caseId: request.caseId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
```

#### DeleteCase.ts

```typescript
import type { ICaseRepository } from "../repositories/ICaseRepository";
import { createLogger } from "@/utils/logger";

const logger = createLogger("DeleteCase");

export interface DeleteCaseRequest {
  caseId: string;
}

export interface DeleteCaseResponse {
  success: boolean;
  error?: string;
}

export class DeleteCase {
  constructor(private repository: ICaseRepository) {}

  async execute(request: DeleteCaseRequest): Promise<DeleteCaseResponse> {
    logger.info("Deleting case", { caseId: request.caseId });

    try {
      await this.repository.deleteCase(request.caseId);

      logger.info("Case deleted successfully", { caseId: request.caseId });

      return { success: true };
    } catch (error) {
      logger.error("Failed to delete case", { caseId: request.caseId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
```

### 2. Create Service Layer

**File:** `application/services/CaseManagementService.ts`

Orchestrate complex flows:

```typescript
import { CreateCase } from "@/domain/cases/use-cases/CreateCase";
import { UpdateCase } from "@/domain/cases/use-cases/UpdateCase";
import { DeleteCase } from "@/domain/cases/use-cases/DeleteCase";
import { GetAllCases } from "@/domain/cases/use-cases/GetAllCases";
import type { ICaseRepository } from "@/domain/cases/repositories/ICaseRepository";
import type { CaseFormData } from "@/types/case";
import { useApplicationState } from "@/application/ApplicationState";
import { createLogger } from "@/utils/logger";

const logger = createLogger("CaseManagementService");

export class CaseManagementService {
  private createCase: CreateCase;
  private updateCase: UpdateCase;
  private deleteCase: DeleteCase;
  private getAllCases: GetAllCases;

  constructor(repository: ICaseRepository) {
    this.createCase = new CreateCase(repository);
    this.updateCase = new UpdateCase(repository);
    this.deleteCase = new DeleteCase(repository);
    this.getAllCases = new GetAllCases(repository);
  }

  /**
   * Create a new case and navigate to it
   */
  async createAndNavigateToCase(formData: CaseFormData): Promise<void> {
    const { setLoading, setError, setSelectedCase, setNavigation } =
      useApplicationState.getState();

    setLoading(true);
    setError(null);

    try {
      const response = await this.createCase.execute({ formData });

      if (!response.success) {
        throw new Error(response.error || "Failed to create case");
      }

      // Navigate to new case
      setSelectedCase(response.caseId);
      setNavigation({ currentView: "details" });

      logger.info("Case created and navigated", { caseId: response.caseId });
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
      const response = await this.updateCase.execute({ caseId, updates });

      if (!response.success) {
        throw new Error(response.error || "Failed to update case");
      }

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
      const response = await this.deleteCase.execute({ caseId });

      if (!response.success) {
        throw new Error(response.error || "Failed to delete case");
      }

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
      const response = await this.getAllCases.execute();

      if (!response.success) {
        throw new Error(response.error || "Failed to load cases");
      }

      setCases(response.cases);

      logger.info("Cases loaded", { count: response.cases.length });
    } catch (error) {
      logger.error("Failed to load cases", { error });
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }
}
```

### 3. Refactor useCaseManagement Hook

**File:** `hooks/useCaseManagement.ts` (reduce from 329 → ~50 lines)

```typescript
import { useMemo } from "react";
import { CaseManagementService } from "@/application/services/CaseManagementService";
import { StorageRepository } from "@/infrastructure/StorageRepository";
import type { CaseFormData } from "@/types/case";

/**
 * Thin wrapper hook over CaseManagementService
 */
export function useCaseManagement() {
  // Create service instance (memoized)
  const service = useMemo(() => {
    const repository = new StorageRepository();
    return new CaseManagementService(repository);
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

### 4. Repeat Pattern for Financial Items

**Folder:** `domain/financials/use-cases/`

Create:

- `AddFinancialItem.ts`
- `UpdateFinancialItem.ts`
- `DeleteFinancialItem.ts`

**Service:** `application/services/FinancialManagementService.ts`

**Hook:** Refactor `hooks/useFinancialItemFlow.ts` (171 → ~40 lines)

### 5. Repeat Pattern for Notes

**Folder:** `domain/notes/use-cases/`

Create:

- `CreateNote.ts`
- `UpdateNote.ts`
- `DeleteNote.ts`

**Service:** `application/services/NoteManagementService.ts`

**Hook:** Refactor `hooks/useNoteFlow.ts` (183 → ~40 lines)

### 6. Update Components

Components should call hooks, not services directly:

**File:** `components/case/CaseForm.tsx`

```typescript
// BEFORE:
const handleSubmit = async (data: CaseFormData) => {
  // 50 lines of inline logic
};

// AFTER:
const { createCase, updateCase } = useCaseManagement();

const handleSubmit = async (data: CaseFormData) => {
  if (editingCaseId) {
    await updateCase(editingCaseId, data);
  } else {
    await createCase(data);
  }
};
```

---

## Testing

**File:** `domain/cases/use-cases/__tests__/CreateCase.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateCase } from "../CreateCase";
import type { ICaseRepository } from "../../repositories/ICaseRepository";

describe("CreateCase", () => {
  let mockRepository: ICaseRepository;
  let useCase: CreateCase;

  beforeEach(() => {
    mockRepository = {
      createCase: vi.fn(),
      updateCase: vi.fn(),
      deleteCase: vi.fn(),
      getCaseById: vi.fn(),
      getAllCases: vi.fn(),
    };
    useCase = new CreateCase(mockRepository);
  });

  it("should create a case successfully", async () => {
    const formData = { name: "Test Case", status: "open" as const };
    const newCase = {
      id: "case-1",
      ...formData,
      createdAt: new Date().toISOString(),
    };

    vi.mocked(mockRepository.createCase).mockResolvedValue(newCase);

    const response = await useCase.execute({ formData });

    expect(response.success).toBe(true);
    expect(response.caseId).toBe("case-1");
    expect(mockRepository.createCase).toHaveBeenCalledWith(formData);
  });

  it("should handle errors", async () => {
    vi.mocked(mockRepository.createCase).mockRejectedValue(
      new Error("Write failed")
    );

    const response = await useCase.execute({ formData: { name: "Test" } });

    expect(response.success).toBe(false);
    expect(response.error).toBe("Write failed");
  });
});
```

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

## Migration Priority

1. **Cases domain** (highest impact, most dependencies)
2. **Financial Items** (complex validation, many operations)
3. **Notes** (simpler, fewer edge cases)
4. **Defer Alerts** (will be redesigned, keep minimal changes)

---

## Verification Checklist

- [ ] Use cases created for Cases domain
- [ ] CaseManagementService orchestrates flows
- [ ] useCaseManagement hook refactored (329 → ~50 lines)
- [ ] Use cases created for Financial Items
- [ ] FinancialManagementService created
- [ ] useFinancialItemFlow refactored (171 → ~40 lines)
- [ ] Use cases created for Notes
- [ ] NoteManagementService created
- [ ] useNoteFlow refactored (183 → ~40 lines)
- [ ] Components updated to call hooks only
- [ ] All 250+ tests passing
- [ ] No performance regressions

---

## Success Criteria

✅ Business logic in use cases  
✅ Services orchestrate complex flows  
✅ Hooks are thin wrappers (<50 lines)  
✅ Components only call hooks  
✅ All tests passing  
✅ No circular dependencies

---

_Reference Phase 1-2 artifacts: `infrastructure/StorageRepository.ts`, `application/ApplicationState.ts`, `application/DomainEventBus.ts`_
