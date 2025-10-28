# Phase 3: Use Case Extraction - Agent Prompt

**Context:** You are implementing Phase 3 of the architecture refactor. Phase 1 created repositories, Phase 2 unified state. Now you'll extract business logic from hooks into use cases and services.

**Reference:** See `docs/development/architecture-refactor-plan.md` for full context.

---

## ⚠️ Phase 3 Complexity Assessment

**Scale Comparison:**
- **Phase 1:** +9,670 LOC, 59 files (greenfield architecture) - 10 days
- **Phase 2:** +846 LOC, 23 files (event system addition) - 11 days  
- **Phase 3:** ~+600 net LOC, 30-35 files (refactoring-heavy) - **5-7 days estimated**

**Key Differences from Phase 1 & 2:**

| Aspect | Phase 1 | Phase 2 | **Phase 3** |
|--------|---------|---------|-------------|
| Greenfield Work | ⭐⭐⭐⭐⭐ High | ⭐⭐ Low | ⭐⭐ Low |
| Refactoring Risk | ⭐ Low | ⭐⭐⭐ Medium | **⭐⭐⭐⭐ HIGH** |
| Component Changes | Minimal | Minimal | **MANY** |
| Breaking Change Risk | Low | Low | **Medium-High** |
| Testing Burden | New tests | Enhanced tests | **Regression-heavy** |

**⚠️ CRITICAL DIFFERENCES:**
1. **More deletion than addition** - You'll be removing ~600 lines from hooks, not just adding code
2. **Component updates required** - Unlike P1/P2, this phase touches many React components
3. **Higher regression risk** - Working functionality must be preserved during migration
4. **Incremental migration mandatory** - Cannot do all domains at once (Cases → Financials → Notes)
5. **Cross-cutting changes** - Hooks, services, components, and use cases all change together

**Success Strategy:**
- ✅ Migrate ONE domain at a time (don't touch all 3 simultaneously)
- ✅ Run full test suite after EACH domain migration
- ✅ Keep components working throughout (no big-bang rewrite)
- ✅ Expect more tedious work than Phase 1's greenfield building

---

## Objective

Transform fat hooks (309-164 lines each) into thin wrappers (~40-50 lines) over use cases and service layer orchestration, while preserving all existing functionality.

---

## Current State (Post-Phase 2)

### Existing Architecture:

- ✅ Domain repositories (StorageRepository)
- ✅ ApplicationState with domain events
- ✅ Event bus replaces manual syncs
- ❌ Business logic still in hooks (useCaseManagement: 309 lines)
- ❌ Hooks directly call DataManager + AutosaveFileService
- ❌ No orchestration layer for complex flows

### **Hooks to Refactor (Current Line Counts):**

| Hook | Current LOC | Target LOC | Reduction | Complexity |
|------|-------------|------------|-----------|------------|
| `useCaseManagement.ts` | 309 | ~50 | -259 | High - many operations |
| `useFinancialItemFlow.ts` | 150 | ~40 | -110 | Medium - CRUD flows |
| `useFinancialItems.ts` | 161 | ~40 | -121 | Medium - state management |
| `useNoteFlow.ts` | 164 | ~40 | -124 | Low - simple operations |
| **TOTAL** | **784** | **~170** | **-614** | **Significant refactor** |

### Files to Read:

- `hooks/useCaseManagement.ts` - 309 lines, **will be refactored to ~50**
- `hooks/useFinancialItemFlow.ts` - 150 lines, **will be refactored to ~40**
- `hooks/useFinancialItems.ts` - 161 lines, **will be refactored to ~40**
- `hooks/useNoteFlow.ts` - 164 lines, **will be refactored to ~40**
- `infrastructure/StorageRepository.ts` - Your repository from Phase 1
- `application/ApplicationState.ts` - Your state from Phase 2

### **Estimated Work Breakdown:**

```
New Code to Write:           ~1,200 lines
├─ Use cases                  ~600 lines (3 domains × 3-5 use cases each)
├─ Service layer              ~400 lines (3 service classes)
└─ Tests                      ~200 lines (use case + service tests)

Existing Code to Refactor:   ~1,400 lines
├─ Hook simplification        -614 lines (784 → 170)
├─ Component updates          ~200 lines (remove inline logic)
└─ Integration points         ~100 lines (hook → service wiring)

Net Impact:                   ~+600 lines
Files Touched:                ~30-35 files
Test Updates Required:        ~15-20 test files
```

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

## Migration Priority & Strategy

**⚠️ INCREMENTAL MIGRATION REQUIRED - Do NOT attempt all domains simultaneously**

### **Recommended Order:**

1. **Cases domain FIRST** (Days 1-3)
   - Highest impact, most dependencies
   - Largest hook (309 lines)
   - Once Cases work, pattern is proven
   - **STOP and test thoroughly before proceeding**
   
2. **Financial Items domain SECOND** (Days 4-5)
   - Complex validation, many operations
   - Two related hooks to refactor (150 + 161 lines)
   - Benefits from proven Cases pattern
   - **STOP and test thoroughly before proceeding**
   
3. **Notes domain THIRD** (Days 6-7)
   - Simpler, fewer edge cases
   - Smallest hook (164 lines)
   - Should be straightforward after 2 successful migrations
   
4. **Defer Alerts domain** (Phase 4 or later)
   - Will be redesigned in future phase
   - Keep minimal changes for now

### **Migration Steps Per Domain:**

```
For Each Domain (e.g., Cases):
  1. Create use cases (don't touch hooks yet)           [~2 hours]
  2. Create service layer (don't touch hooks yet)       [~1 hour]
  3. Write use case tests                               [~2 hours]
  4. Run tests - ensure new code works in isolation     [~30 min]
  5. Refactor hook to use service                       [~1 hour]
  6. Update components to use simplified hook           [~2 hours]
  7. Run FULL test suite (290 tests)                    [~30 min]
  8. Fix any regressions                                [~1 hour]
  9. Commit and push domain migration                   [~15 min]
  ⚠️ PAUSE - Verify domain fully working before next    [~1 day buffer]
```

### **Why Incremental Migration is Critical:**

- ❌ **Big-bang approach will fail** - Too many moving parts, impossible to debug
- ✅ **One domain = isolated blast radius** - If Cases break, Financials/Notes still work
- ✅ **Proven pattern before replication** - Don't replicate a flawed design 3x
- ✅ **Easier code review** - 3 smaller PRs vs 1 massive PR
- ✅ **Rollback safety** - Can revert one domain without losing all work

---

## Critical Constraints

### **DO NOT:**

- ❌ **Migrate all 3 domains in one PR** (highest risk failure mode)
- ❌ Refactor a hook before its use cases/services exist and are tested
- ❌ Put business logic in React components
- ❌ Call repositories directly from hooks
- ❌ Modify AutosaveFileService or FileStorageContext
- ❌ Create circular dependencies (hook → service → hook)
- ❌ Skip running full test suite between domain migrations

### **DO:**

- ✅ **One domain per PR** (Cases PR → merge → Financials PR → merge → Notes PR)
- ✅ **Run full test suite (290 tests) after each domain migration**
- ✅ One use case per file (single responsibility)
- ✅ Services orchestrate multiple use cases
- ✅ Hooks are thin wrappers (max 50 lines)
- ✅ Components only call hooks, never services
- ✅ Use ApplicationState for state updates
- ✅ Use event bus for cross-domain communication

---

## Verification Checklist

### **Per-Domain Checklist (repeat for each domain):**

**Cases Domain (PR #1):**
- [ ] Use cases created (GetAllCases, GetCaseById, etc.)
- [ ] CaseManagementService orchestrates flows
- [ ] useCaseManagement hook refactored (309 → ~50 lines)
- [ ] Components updated to use simplified hook
- [ ] **All 290 tests passing**
- [ ] **No performance regressions**
- [ ] **Merged to main before starting Financials**

**Financial Items Domain (PR #2):**
- [ ] Use cases created (AddFinancialItem, UpdateFinancialItem, DeleteFinancialItem, GetFinancialItems)
- [ ] FinancialManagementService created
- [ ] useFinancialItemFlow refactored (150 → ~40 lines)
- [ ] useFinancialItems refactored (161 → ~40 lines)
- [ ] Components updated to use simplified hooks
- [ ] **All 290+ tests passing**
- [ ] **No performance regressions**
- [ ] **Merged to main before starting Notes**

**Notes Domain (PR #3):**
- [ ] Use cases created (CreateNote, UpdateNote, DeleteNote)
- [ ] NoteManagementService created
- [ ] useNoteFlow refactored (164 → ~40 lines)
- [ ] Components updated to use simplified hook
- [ ] **All 290+ tests passing**
- [ ] **No performance regressions**
- [ ] **Phase 3 complete**

---

## Success Criteria

✅ Business logic in use cases (not in hooks)  
✅ Services orchestrate complex flows  
✅ Hooks are thin wrappers (<50 lines each)  
✅ Components only call hooks (never services directly)  
✅ **All 290+ tests passing with 0 regressions**  
✅ No circular dependencies  
✅ **3 separate PRs merged (one per domain)**  
✅ No performance degradation vs. Phase 2 baseline

---

## Timeline & Effort Estimation

**Total Duration:** 5-7 days (assuming sequential domain migration)

| Domain | Estimated Days | Risk Level | Notes |
|--------|---------------|------------|-------|
| Cases | 2-3 days | ⚠️ High | Largest hook, most components touched |
| Financials | 1.5-2 days | ⚠️ Medium | Two hooks, proven pattern from Cases |
| Notes | 1-1.5 days | ✅ Low | Simplest domain, pattern proven 2x |
| Buffer/Review | 0.5-1 day | - | Code review, regression testing |

**Comparison to Previous Phases:**
- Phase 1: 10 days (greenfield architecture)
- Phase 2: 11 days (event system addition)
- **Phase 3: 5-7 days** (refactoring-heavy, less net code)

---

_Reference Phase 1-2 artifacts: `infrastructure/StorageRepository.ts`, `application/ApplicationState.ts`, `application/DomainEventBus.ts`_
