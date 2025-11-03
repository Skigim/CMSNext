# Financial Domain Migration - Critical Discoveries

**Date:** November 2, 2025  
**Status:** Pre-Implementation Research Complete  
**Read This BEFORE Starting:** `CODEX_PROMPT_FINANCIAL_DOMAIN.md`

---

## 🚨 CRITICAL CORRECTIONS TO CODEX PROMPT

### 1. Domain Entity Already Exists ✅

**File:** `domain/financials/entities/FinancialItem.ts` (202 lines)

**What's Already There:**

- ✅ `FinancialItem` class with validation, cloning, factory methods
- ✅ `FinancialCategory` enum (Resource, Income, Expense)
- ✅ `FinancialVerificationStatus` type
- ✅ `create()` factory with ID generation and timestamps
- ✅ `rehydrate()` for loading from storage
- ✅ `clone()` for immutability
- ✅ `toJSON()` for serialization
- ✅ Validation in constructor

**Current Snapshot Shape:**

```typescript
interface FinancialItemSnapshot {
  id: string;
  caseId: string;
  category: FinancialCategory;
  description: string;
  amount: number;
  verificationStatus: FinancialVerificationStatus;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}
```

**⚠️ MISSING LEGACY FIELDS** (from `types/case.ts`):

```typescript
// These fields are used by UI components but NOT in domain entity:
frequency?: string;        // e.g., "Monthly", "Weekly"
location?: string;         // Physical location
accountNumber?: string;    // Bank account number
verificationSource?: string; // Document source
notes?: string;            // User notes
owner?: string;            // Resource owner
name?: string;             // Backward compatibility (alias for description)
dateAdded?: string;        // Legacy timestamp
status?: string;           // Legacy status field
```

**🔧 ACTION REQUIRED:**

1. **Option A (Recommended):** Extend `FinancialItemSnapshot` to include all legacy fields as optional
2. **Option B:** Store legacy fields in `metadata` object and map during adapter layer
3. Update `create()` and `rehydrate()` to handle new fields
4. Add tests for field validation and preservation

---

### 2. Repository Already Exists ✅

**File:** `domain/common/repositories/IFinancialRepository.ts`

**Interface Definition:**

```typescript
export interface IFinancialRepository
  extends IRepository<FinancialItem, string> {
  getByCaseId(caseId: string): Promise<FinancialItem[]>;
  getByCategory(category: string): Promise<FinancialItem[]>;
}
```

**Implementation:** `infrastructure/storage/StorageRepository.ts`

- ✅ `StorageRepository.financials` already implements this interface
- ✅ Integrates with File System Access API
- ✅ Methods: `getAll()`, `getById()`, `save()`, `delete()`, `getByCaseId()`, `getByCategory()`

**🔧 ACTION REQUIRED:**

1. **DO NOT CREATE** new repository interface (already exists)
2. Verify `StorageRepository.financials` methods support extended snapshot shape after entity updates
3. Update repository tests if snapshot shape changes

---

### 3. ApplicationState Methods Already Exist ⚠️

**File:** `application/ApplicationState.ts` (lines 294-303)

**Existing Financial Methods:**

```typescript
upsertFinancialItem(item: FinancialItem): void {
  this.financialItems.set(item.id, item);
  this.notify();
}

removeFinancialItem(id: string): void {
  this.financialItems.delete(id);
  this.notify();
}
```

**⚠️ MISSING STATE MANAGEMENT:**

- ❌ No `financialItemsLoading` flag
- ❌ No `financialItemsError` string
- ❌ No `setFinancialItems(items[])` bulk setter
- ❌ No `getFinancialItemsByCaseId(caseId)` selector
- ❌ Financial items stored in generic `Map<string, FinancialItem>` (not case-aware)

**🔧 ACTION REQUIRED:**

1. Add missing state fields to `ApplicationState`:
   ```typescript
   private financialItemsLoading: boolean = false;
   private financialItemsError: string | null = null;
   ```
2. Add selectors:
   ```typescript
   getFinancialItemsByCaseId(caseId: string): FinancialItem[]
   getFinancialItemsLoading(): boolean
   getFinancialItemsError(): string | null
   ```
3. Add mutations:
   ```typescript
   setFinancialItems(items: FinancialItem[]): void
   setFinancialItemsLoading(loading: boolean): void
   setFinancialItemsError(error: string | null): void
   ```

---

### 4. Event Naming Discrepancy 🚨

**Codex Prompt Says:** Use `FinancialItemCreated/Updated/Deleted`

**Actual DomainEventBus Uses:** `FinancialItemAdded/Updated/Deleted`

**Evidence:**

```typescript
// Search results show existing events:
'FinancialItemAdded' - 1 result in DomainEventBus.ts
```

**🔧 DECISION NEEDED:**

- **Option A:** Use `FinancialItemAdded` (matches existing pattern)
- **Option B:** Rename to `FinancialItemCreated` (matches Cases: `CaseCreated`)
- **Recommendation:** Use `Created` to match Cases domain for consistency

---

### 5. Current Hook Implementation

**File:** `hooks/useFinancialItemFlow.ts` (164 lines)

**Current Pattern:**

- ❌ Direct `DataManager` coupling via `useDataManagerSafe()`
- ❌ Manual toast feedback in hook
- ❌ Direct `ApplicationState.upsertCaseFromLegacy()` calls
- ❌ No separation of concerns (hook handles orchestration + UI + storage)

**Current Methods:**

```typescript
openItemForm(category);
closeItemForm();
handleDeleteItem(category, itemId);
handleBatchUpdateItem(category, itemId, updatedItem);
handleCreateItem(category, itemData);
```

**🔧 TARGET REFACTOR:**

```typescript
// After refactor (similar to useCaseManagement):
export function useFinancialItemFlow(caseId: string) {
  const service = useFinancialService();
  const serviceRef = useRef(service);

  const items = useApplicationState((s) => s.getFinancialItemsByCaseId(caseId));
  const loading = useApplicationState((s) => s.getFinancialItemsLoading());
  const error = useApplicationState((s) => s.getFinancialItemsError());

  const loadItems = useCallback(async () => {
    return await serviceRef.current.loadItems(caseId);
  }, [caseId]);

  const createItem = useCallback(async (data: FinancialItemInput) => {
    return await serviceRef.current.createItemWithFeedback(data);
  }, []);

  // ... similar for update, delete

  return {
    items,
    loading,
    error,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
  };
}
```

**Expected LOC Reduction:** 164 → ~100 lines (~39% reduction, matching Cases pattern)

---

## 📊 Phase 1 Tasks (Revised)

### 1. Extend Domain Entity ✏️

**File:** `domain/financials/entities/FinancialItem.ts`

**Tasks:**

- [ ] Add legacy fields to `FinancialItemSnapshot` (frequency, location, accountNumber, verificationSource, notes, owner)
- [ ] Update `FinancialItemCreateInput` to accept new optional fields
- [ ] Update `create()` to handle new fields with defaults
- [ ] Update `rehydrate()` to preserve new fields
- [ ] Add `applyUpdates()` method for immutable partial updates
- [ ] Update validation to handle optional fields
- [ ] Write tests for new fields (5+ tests)

### 2. Create Use Cases 🆕

**Create these NEW files:**

- [ ] `domain/financials/use-cases/GetFinancialItems.ts`
- [ ] `domain/financials/use-cases/CreateFinancialItem.ts`
- [ ] `domain/financials/use-cases/UpdateFinancialItem.ts`
- [ ] `domain/financials/use-cases/DeleteFinancialItem.ts`

**Each use case must:**

- Depend on `IFinancialRepository` (already exists)
- Use `ApplicationState` for optimistic updates (extend state first)
- Publish domain events (decide naming: `Created` vs `Added`)
- Handle rollback on persistence failure
- Throw `DomainError` on validation/storage errors
- Include telemetry logging

### 3. Create Test Suites 🧪

**Create these NEW files:**

- [ ] `__tests__/domain/financials/entities/FinancialItem.test.ts` (5+ tests)
- [ ] `__tests__/domain/financials/use-cases/GetFinancialItems.test.ts` (8+ tests)
- [ ] `__tests__/domain/financials/use-cases/CreateFinancialItem.test.ts` (12+ tests)
- [ ] `__tests__/domain/financials/use-cases/UpdateFinancialItem.test.ts` (12+ tests)
- [ ] `__tests__/domain/financials/use-cases/DeleteFinancialItem.test.ts` (12+ tests)

**Test Coverage Required:**

- Happy path (success scenarios)
- Optimistic update + rollback on failure
- Validation errors (missing fields, invalid amounts)
- Domain event publishing with correct metadata
- AbortError propagation
- Edge cases (duplicate IDs, missing case, negative amounts)

---

## 📊 Phase 2 Tasks (Revised)

### 1. Extend ApplicationState 🔧

**File:** `application/ApplicationState.ts`

**Add these fields:**

```typescript
private financialItemsLoading: boolean = false;
private financialItemsError: string | null = null;
```

**Add these selectors:**

```typescript
getFinancialItemsByCaseId(caseId: string): FinancialItem[] {
  return Array.from(this.financialItems.values())
    .filter(item => item.caseId === caseId)
    .map(item => structuredClone(item));
}

getFinancialItemsLoading(): boolean {
  return this.financialItemsLoading;
}

getFinancialItemsError(): string | null {
  return this.financialItemsError;
}
```

**Add these mutations:**

```typescript
setFinancialItems(items: FinancialItem[]): void {
  this.financialItems.clear();
  items.forEach(item => this.financialItems.set(item.id, item));
  this.notify();
}

setFinancialItemsLoading(loading: boolean): void {
  this.financialItemsLoading = loading;
  this.notify();
}

setFinancialItemsError(error: string | null): void {
  this.financialItemsError = error;
  this.notify();
}
```

### 2. Create Service Layer 🆕

**Create these NEW files:**

- [ ] `application/services/FinancialManagementService.ts`
- [ ] `application/services/FinancialManagementAdapter.ts`
- [ ] `application/services/FinancialServiceFactory.ts`

**Service Layer Pattern** (follow `CaseManagementService.ts`):

- High-level orchestration with use cases
- Toast feedback (loading → success/error)
- AbortError special handling (dismiss toast silently)
- Telemetry logging
- Error handling with `DomainError`

**Adapter Layer Pattern** (follow `CaseManagementAdapter.ts`):

- Bridge to legacy `DataManager`
- Implement `IFinancialRepository` interface
- Data transformation between domain entities and legacy `CaseDisplay`
- Handle category-specific storage (`resources`, `income`, `expenses`)

---

## 🎯 Implementation Order

### Day 1: Domain Layer

1. ✅ Review existing `FinancialItem` entity
2. ✏️ Extend entity with legacy fields
3. ✏️ Add `applyUpdates()` method
4. 🧪 Write/update entity tests
5. 🆕 Create 4 use cases
6. 🧪 Write use case tests (40+ tests)

### Day 2: State & Service Layer

1. 🔧 Extend `ApplicationState` with financial state
2. 🧪 Test state extensions
3. 🆕 Create `FinancialManagementService`
4. 🆕 Create `FinancialManagementAdapter`
5. 🆕 Create `FinancialServiceFactory`
6. 🧪 Write service/adapter tests (30+ tests)

### Day 3: Hook & Component Integration

1. 🔧 Refactor `useFinancialItemFlow` to use service layer
2. 🔧 Apply `useRef` pattern for stability
3. 🧪 Update hook tests
4. ✅ Verify components work with new hook API
5. ✅ Test autosave integration

### Day 4: Testing & Documentation

1. 🧪 Run full test suite (target: 412+ tests passing)
2. 🔧 Fix any regressions
3. 📚 Update `feature-catalogue.md` (73 → 85+)
4. 📚 Document architecture changes
5. ✅ Build verification

---

## ⚠️ Common Pitfalls to Avoid

### 1. Type Conflicts

**Problem:** `FinancialItem` from `types/case.ts` vs `domain/financials/entities/FinancialItem`  
**Solution:** Use domain entity in new code, map legacy type in adapter layer

### 2. State Divergence

**Problem:** `ApplicationState.financialItems` Map vs case-aware storage  
**Solution:** Always filter by `caseId` in selectors, never expose raw Map

### 3. Event Naming

**Problem:** Inconsistent event names break subscribers  
**Solution:** Decide on `Created` vs `Added` BEFORE implementing use cases

### 4. Missing Fields

**Problem:** UI components expect fields not in domain entity  
**Solution:** Extend entity snapshot OR map in adapter layer (don't break UI)

### 5. DataManager Coupling

**Problem:** Direct `DataManager` calls bypass use cases  
**Solution:** All mutations must go through service layer (enforce in code review)

---

## 📋 Pre-Implementation Checklist

Before starting Phase 1:

- [ ] Decide event naming: `FinancialItemCreated` or `FinancialItemAdded`
- [ ] Decide field strategy: Extend entity vs store in metadata
- [ ] Review `CaseManagementService.ts` pattern (reference implementation)
- [ ] Review `CaseManagementAdapter.ts` pattern (DataManager bridge)
- [ ] Review `useCaseManagement.ts` pattern (hook simplification)
- [ ] Confirm `ApplicationState` extensions are acceptable for Phase 2
- [ ] Verify `StorageRepository.financials` methods after entity changes

---

## 📞 Questions for User

1. **Event Naming:** Should we use `FinancialItemCreated` (matches Cases) or `FinancialItemAdded` (matches existing enum)?
2. **Legacy Fields:** Should we extend `FinancialItemSnapshot` directly or store legacy fields in `metadata`?
3. **State Timing:** Can we add `ApplicationState` financial state in Phase 2, or must it wait for Phase 3?
4. **Breaking Changes:** Is it acceptable to refactor `useFinancialItemFlow` API, or must we maintain backward compatibility?

---

**Prepared by:** GitHub Copilot  
**Date:** November 2, 2025  
**Next Step:** Get user decisions on open questions, then begin Phase 1 implementation
