# Financial Domain Migration - Final Decisions & Execution Plan

**Date:** November 2, 2025  
**Status:** ✅ Ready for Implementation  
**Branch:** `phase-3-financial-domain-migration`  
**Codex Review:** Complete

---

## ✅ Decision Matrix (Locked)

### 1. Event Naming Convention

**Decision:** Use `FinancialItemAdded/Updated/Deleted`  
**Rationale:** Stay consistent with existing `DomainEventType` enum, avoid breaking existing subscribers  
**Impact:** Low - aligns with current codebase patterns

### 2. Legacy Field Storage Strategy

**Decision:** Extend `FinancialItemSnapshot` with optional legacy fields  
**Fields to Add:**

- `frequency?: string` (e.g., "Monthly", "Weekly")
- `location?: string` (physical location)
- `accountNumber?: string` (bank account)
- `verificationSource?: string` (document source)
- `notes?: string` (user notes)
- `owner?: string` (resource owner)

**Rationale:**

- Type safety over opaque metadata
- Direct mapping to UI expectations
- Easier debugging and validation
- No adapter translation needed

**Impact:** Medium - requires entity updates and storage serialization changes

### 3. ApplicationState Extensions Timing

**Decision:** Add state management in Phase 2 (as planned)  
**New State Fields:**

```typescript
private financialItemsLoading: boolean = false;
private financialItemsError: string | null = null;
```

**New Selectors:**

```typescript
getFinancialItemsByCaseId(caseId: string): FinancialItem[]
getFinancialItemsLoading(): boolean
getFinancialItemsError(): string | null
```

**New Mutations:**

```typescript
setFinancialItems(items: FinancialItem[]): void
setFinancialItemsLoading(loading: boolean): void
setFinancialItemsError(error: string | null): void
```

**Impact:** High - foundation for service layer

### 4. Timeline Assessment

**Decision:** 4-day timeline approved with buffer for adapter edge cases  
**Risk Areas:**

- Day 1: Entity + 4 use case suites (tightest segment)
- Day 2: Adapter edge cases and storage serialization
- Day 3: Hook refactor complexity
- Day 4: Integration testing and regression fixes

**Mitigation:** Create test suites in parallel with implementation

---

## 🎯 Execution Plan (Finalized)

### Branch Strategy

```bash
git checkout -b phase-3-financial-domain-migration
git push -u origin phase-3-financial-domain-migration
```

### Commit Strategy

Small, focused commits following conventional commits:

**Day 1:**

- `feat(financial): extend FinancialItem snapshot with legacy fields`
- `test(financial): add entity tests for legacy fields`
- `feat(financial): add GetFinancialItems use case`
- `test(financial): add GetFinancialItems test suite`
- `feat(financial): add CreateFinancialItem use case`
- `test(financial): add CreateFinancialItem test suite`
- `feat(financial): add UpdateFinancialItem use case`
- `test(financial): add UpdateFinancialItem test suite`
- `feat(financial): add DeleteFinancialItem use case`
- `test(financial): add DeleteFinancialItem test suite`

**Day 2:**

- `feat(financial): extend ApplicationState with financial selectors`
- `test(financial): add ApplicationState financial tests`
- `feat(financial): add FinancialManagementService`
- `test(financial): add service test suite`
- `feat(financial): add FinancialManagementAdapter`
- `test(financial): add adapter test suite`
- `feat(financial): add FinancialServiceFactory`
- `fix(storage): update StorageRepository serialization for new fields`

**Day 3:**

- `refactor(financial): migrate useFinancialItemFlow to service layer`
- `test(financial): update hook tests`
- `refactor(financial): apply useRef pattern for callback stability`
- `refactor(financial): remove direct DataManager coupling`
- `test(financial): verify component integration`

**Day 4:**

- `test(financial): run full test suite (target 412+ passing)`
- `fix(financial): address any regressions`
- `docs(financial): update feature-catalogue.md rating`
- `docs(financial): add architecture comments`
- `chore(financial): final build verification`

---

## ⚠️ Critical Risks & Mitigations

### Risk 1: Storage Serialization Changes

**Issue:** New optional fields need persistence support  
**Mitigation:** Update `StorageRepository.financials` serialization immediately after entity extension  
**Verification:** Test load/save cycle with new fields

### Risk 2: Type Name Collision

**Issue:** Legacy `FinancialItem` (types/case.ts) vs Domain `FinancialItem` (domain/financials/entities/)  
**Mitigation:** Use domain entity in new code, map legacy type in adapter layer only  
**Verification:** TypeScript compilation should catch conflicts

### Risk 3: File Storage Change Notifications

**Issue:** Must invoke `safeNotifyFileStorageChange` per provider stack rules  
**Mitigation:** Service layer calls this after successful persistence  
**Verification:** Check autosave badge updates after financial mutations

### Risk 4: Toast Flow Parity

**Issue:** Must match Cases domain pattern (loading → success/error via Sonner)  
**Mitigation:** Copy exact toast patterns from `CaseManagementService`  
**Verification:** Manual testing of all mutation operations

### Risk 5: Hook API Breaking Changes

**Issue:** `useFinancialItemFlow` API changes may break existing components  
**Mitigation:** Keep same public API surface, change internals only  
**Verification:** Component tests should pass without modification

---

## 📋 Implementation Checklist

### Phase 1: Domain Layer (Day 1)

- [ ] Create feature branch `phase-3-financial-domain-migration`
- [ ] Extend `FinancialItemSnapshot` with 6 legacy fields
- [ ] Update `FinancialItemCreateInput` to accept legacy fields
- [ ] Update `create()` factory to handle new fields
- [ ] Update `rehydrate()` to preserve new fields
- [ ] Add `applyUpdates()` method for immutable updates
- [ ] Update entity validation for optional fields
- [ ] Write entity tests (5+ tests covering new fields)
- [ ] Create `domain/financials/use-cases/GetFinancialItems.ts`
- [ ] Write GetFinancialItems tests (8+ tests)
- [ ] Create `domain/financials/use-cases/CreateFinancialItem.ts`
- [ ] Write CreateFinancialItem tests (12+ tests)
- [ ] Create `domain/financials/use-cases/UpdateFinancialItem.ts`
- [ ] Write UpdateFinancialItem tests (12+ tests)
- [ ] Create `domain/financials/use-cases/DeleteFinancialItem.ts`
- [ ] Write DeleteFinancialItem tests (12+ tests)
- [ ] Verify all domain tests pass in isolation
- [ ] Update `StorageRepository` serialization if needed

### Phase 2: Service & State Layer (Day 2)

- [ ] Add state fields to `ApplicationState` (loading, error)
- [ ] Add selectors (getByCaseId, getLoading, getError)
- [ ] Add mutations (setItems, setLoading, setError)
- [ ] Write ApplicationState tests for financial state
- [ ] Create `application/services/FinancialManagementService.ts`
- [ ] Implement service methods with toast feedback
- [ ] Handle AbortError gracefully (dismiss toast)
- [ ] Add telemetry logging
- [ ] Write service tests (10+ tests)
- [ ] Create `application/services/FinancialManagementAdapter.ts`
- [ ] Implement IFinancialRepository interface
- [ ] Handle DataManager bridge and transformations
- [ ] Write adapter tests (20+ tests)
- [ ] Create `application/services/FinancialServiceFactory.ts`
- [ ] Wire use cases → service → adapter → DataManager
- [ ] Implement singleton pattern
- [ ] Verify service layer tests pass

### Phase 3: Hook Integration (Day 3)

- [ ] Refactor `useFinancialItemFlow` to use service layer
- [ ] Apply `useRef` pattern for callback stability
- [ ] Remove direct DataManager dependencies
- [ ] Update hook to use ApplicationState selectors
- [ ] Maintain same public API (no breaking changes)
- [ ] Update hook tests
- [ ] Verify `FinancialItemCard` works with new hook
- [ ] Verify `FinancialItemList` works with new hook
- [ ] Test autosave integration
- [ ] Verify optimistic updates feel snappy
- [ ] Check file storage change notifications

### Phase 4: Testing & Documentation (Day 4)

- [ ] Run full test suite: `npm test -- --run`
- [ ] Target: 412+ tests passing (352 + 60 new)
- [ ] Fix any regressions
- [ ] Verify 100% pass rate
- [ ] Run build: `npm run build`
- [ ] Verify no TypeScript errors
- [ ] Verify bundle size acceptable
- [ ] Update `feature-catalogue.md` (rating 73 → 85+)
- [ ] Add code comments for complex logic
- [ ] Update migration notes
- [ ] Manual testing of all financial operations
- [ ] Verify toast feedback for all mutations
- [ ] Test error scenarios and rollback
- [ ] Verify autosave badge updates

---

## 🎓 Cases Domain Patterns to Follow

### Use Case Pattern

```typescript
// Follow CreateCase.ts pattern exactly
export class CreateFinancialItemUseCase {
  constructor(
    private repository: IFinancialRepository,
    private eventBus: DomainEventBus,
    private logger: Logger
  ) {}

  async execute(input: FinancialItemCreateInput): Promise<FinancialItem> {
    // 1. Create entity with validation
    const item = FinancialItem.create(input);

    // 2. Optimistic update via ApplicationState
    ApplicationState.getInstance().upsertFinancialItem(item);

    // 3. Attempt persistence
    try {
      await this.repository.save(item);

      // 4. Publish event on success
      this.eventBus.publish(
        new FinancialItemAdded(item.id, {
          timestamp: Date.now(),
          caseId: item.caseId,
          category: item.category,
        })
      );

      this.logger.lifecycle("[CreateFinancialItem] Item created", {
        id: item.id,
      });
      return item;
    } catch (error) {
      // 5. Rollback on failure
      ApplicationState.getInstance().removeFinancialItem(item.id);
      this.logger.error("[CreateFinancialItem] Failed to persist", { error });
      throw new DomainError("Failed to create financial item", error);
    }
  }
}
```

### Service Pattern

```typescript
// Follow CaseManagementService.ts pattern exactly
async createItemWithFeedback(input: FinancialItemInput): Promise<FinancialItem> {
  const toastId = toast.loading('Creating financial item...');
  try {
    const item = await this.createItemUseCase.execute(input);
    toast.success('Financial item created successfully', { id: toastId });
    return item;
  } catch (error) {
    if (error.name === 'AbortError') {
      toast.dismiss(toastId); // Silent dismissal
    } else {
      toast.error('Failed to create financial item', { id: toastId });
    }
    throw error;
  }
}
```

### Hook Pattern

```typescript
// Follow useCaseManagement.ts pattern exactly
export function useFinancialItemFlow(caseId: string) {
  const service = useFinancialService();
  const serviceRef = useRef(service);

  useEffect(() => {
    serviceRef.current = service;
  }, [service]);

  const items = useApplicationState((s) => s.getFinancialItemsByCaseId(caseId));
  const loading = useApplicationState((s) => s.getFinancialItemsLoading());
  const error = useApplicationState((s) => s.getFinancialItemsError());

  const loadItems = useCallback(async () => {
    return await serviceRef.current.loadItems(caseId);
  }, [caseId]);

  const createItem = useCallback(async (data: FinancialItemInput) => {
    return await serviceRef.current.createItemWithFeedback(data);
  }, []);

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

---

## 📊 Success Metrics

### Quantitative Targets

- [ ] Test count: 352 → 412+ tests (+60 new tests, 17% increase)
- [ ] Test pass rate: Maintain 100% (412/412)
- [ ] Hook LOC: 164 → ~100 lines (~39% reduction)
- [ ] Feature rating: 73 → 85+ (12+ point increase)
- [ ] Build status: Clean TypeScript compilation
- [ ] Bundle size: No significant increase (<5%)

### Qualitative Targets

- [ ] Code patterns match Cases domain exactly
- [ ] Clear separation of concerns across layers
- [ ] Comprehensive test coverage (happy path + errors + rollback)
- [ ] Domain events published for all mutations
- [ ] Toast feedback for all user-facing operations
- [ ] Optimistic updates with automatic rollback
- [ ] No breaking changes to existing components

---

## 🚀 Ready to Execute

All decisions locked, risks identified, patterns established. Branch created:

```bash
git checkout -b phase-3-financial-domain-migration
```

Begin Phase 1: Domain Layer (Day 1)

**First commit:**

```bash
feat(financial): extend FinancialItem snapshot with legacy fields

Add optional fields to FinancialItemSnapshot:
- frequency, location, accountNumber
- verificationSource, notes, owner

Update create() and rehydrate() to handle new fields
Add validation for optional fields
Include comprehensive entity tests

Ref: FINANCIAL_MIGRATION_DISCOVERIES.md
```

**Let's ship it! 🎉**
