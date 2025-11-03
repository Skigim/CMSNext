# Codex Implementation Prompt: Financial Domain Migration

## 📋 Task Summary

Migrate the Financial domain to Phase 3 architecture following the successful Cases domain pattern. Extract business logic into domain use cases, introduce service layer orchestration, centralize state in `ApplicationState`, and streamline `useFinancialItemFlow` hook. This will improve testability, maintainability, and set the foundation for cross-domain event coordination.

## 🎯 Success Criteria

- [ ] Domain use cases created (`CreateFinancialItem`, `UpdateFinancialItem`, `DeleteFinancialItem`, `GetFinancialItems`)
- [ ] Service layer established (`FinancialManagementService`, `FinancialManagementAdapter`)
- [ ] State centralized in `ApplicationState` with reactive selectors
- [ ] Hook simplified using `useRef` pattern (similar to `useCaseManagement` reduction: 178→101 lines)
- [ ] Domain events published (`FinancialItemCreated`, `FinancialItemUpdated`, `FinancialItemDeleted`)
- [ ] All tests passing (maintain 100% pass rate)
- [ ] Feature rating increased from 73/100 to 85+/100

## 📚 Reference Implementation

**Study the Cases domain refactor as your blueprint:**

### Domain Layer Pattern

```
domain/financials/
  entities/
    FinancialItem.ts         # Domain entity with validation
  use-cases/
    CreateFinancialItem.ts   # Business logic + optimistic updates
    UpdateFinancialItem.ts   # With rollback on failure
    DeleteFinancialItem.ts   # With event publishing
    GetFinancialItems.ts     # Query use case
  repositories/
    IFinancialRepository.ts  # Storage abstraction
```

### Service Layer Pattern

```typescript
// application/services/FinancialManagementService.ts
export class FinancialManagementService {
  constructor(
    private getAllItemsUseCase: GetFinancialItemsUseCase,
    private createItemUseCase: CreateFinancialItemUseCase,
    private updateItemUseCase: UpdateFinancialItemUseCase,
    private deleteItemUseCase: DeleteFinancialItemUseCase
  ) {}

  async loadItems(): Promise<FinancialItem[]> {
    try {
      const items = await this.getAllItemsUseCase.execute();
      logger.lifecycle("[FinancialManagementService] Items loaded", {
        count: items.length,
      });
      return items;
    } catch (error) {
      logger.error("[FinancialManagementService] Failed to load items", {
        error,
      });
      throw error;
    }
  }

  async createItemWithFeedback(
    data: FinancialItemInput
  ): Promise<FinancialItem> {
    const toastId = toast.loading("Creating financial item...");
    try {
      const item = await this.createItemUseCase.execute(data);
      toast.success("Financial item created successfully", { id: toastId });
      return item;
    } catch (error) {
      if (error.name === "AbortError") {
        toast.dismiss(toastId);
      } else {
        toast.error("Failed to create item", { id: toastId });
      }
      throw error;
    }
  }

  // Similar patterns for update, delete...
}
```

### State Management Pattern

```typescript
// In application/ApplicationState.ts
private financialItems: FinancialItem[] = [];
private financialItemsLoading: boolean = false;
private financialItemsError: string | null = null;

// Selectors
getFinancialItems(): FinancialItem[] { return structuredClone(this.financialItems); }
getFinancialItemsLoading(): boolean { return this.financialItemsLoading; }
getFinancialItemsError(): string | null { return this.financialItemsError; }

// Mutations
setFinancialItems(items: FinancialItem[]): void {
  this.financialItems = items;
  this.notify();
}
```

### Hook Simplification Pattern

```typescript
// hooks/useFinancialItemFlow.ts (AFTER refactor)
export function useFinancialItemFlow(caseId: string) {
  const service = useFinancialService();
  const serviceRef = useRef(service);

  useEffect(() => {
    serviceRef.current = service;
  }, [service]);

  const items = useApplicationState((state) => state.getFinancialItems());
  const loading = useApplicationState((state) =>
    state.getFinancialItemsLoading()
  );
  const error = useApplicationState((state) => state.getFinancialItemsError());

  const loadItems = useCallback(async () => {
    return await serviceRef.current.loadItems(caseId);
  }, [caseId]);

  const createItem = useCallback(async (data: FinancialItemInput) => {
    return await serviceRef.current.createItemWithFeedback(data);
  }, []);

  // Similar for update, delete...

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

## 🏗️ Implementation Steps

### Phase 1: Domain Layer (Day 1)

1. **Create Domain Entities**

   - Extract `FinancialItem` entity from current models
   - Add validation methods, cloning, immutability checks
   - Create comprehensive entity tests

2. **Create Repository Interface**

   - Define `IFinancialRepository` abstraction
   - Methods: `getAll()`, `getById()`, `save()`, `delete()`

3. **Implement Use Cases**
   - `GetFinancialItemsUseCase`: Load all items for a case
   - `CreateFinancialItemUseCase`: Create with optimistic update
   - `UpdateFinancialItemUseCase`: Update with rollback on failure
   - `DeleteFinancialItemUseCase`: Delete with domain event
   - Each use case should publish domain events
   - Write comprehensive tests (12+ tests per use case)

### Phase 2: Service & Adapter Layers (Day 2)

1. **Create Service Layer**

   - `FinancialManagementService`: High-level orchestration
   - Add toast feedback for all mutations
   - Handle `AbortError` gracefully (dismiss toast)
   - Add telemetry logging
   - Write service tests (10+ tests)

2. **Create Adapter Layer**

   - `FinancialManagementAdapter`: Bridge to legacy DataManager
   - Implement `IFinancialRepository` interface
   - Handle data transformations between layers
   - Write adapter tests (20+ tests)

3. **Create Service Factory**
   - `FinancialServiceFactory`: Dependency injection
   - Wire use cases → service → adapter → DataManager
   - Singleton pattern for service instances

### Phase 3: State & Hook Integration (Day 3)

1. **Centralize State**

   - Add financial state to `ApplicationState`
   - Implement selectors and mutations
   - Update `useApplicationState` hook
   - Add state tests

2. **Simplify Hook**

   - Refactor `useFinancialItemFlow` to use service layer
   - Apply `useRef` pattern for stable callbacks
   - Remove direct DataManager dependencies
   - Reduce LOC by ~40% (target: similar to Cases reduction)
   - Update hook tests

3. **Update Components**
   - Ensure `FinancialItemCard` uses new hook API
   - Verify `FinancialItemList` works with centralized state
   - Update any other financial components

### Phase 4: Testing & Documentation (Day 4)

1. **Comprehensive Testing**

   - Run full test suite: `npm test -- --run`
   - Ensure 100% pass rate (352+ tests)
   - Add integration tests if needed
   - Fix any regressions

2. **Update Documentation**

   - Update `feature-catalogue.md` rating (73→85+)
   - Document new architecture in code comments
   - Update any component documentation

3. **Performance Validation**
   - Run `npm run build` - ensure no errors
   - Test autosave integration with financial items
   - Verify optimistic updates feel snappy

## 📋 Checklist

### Domain Layer

- [ ] `domain/financials/entities/FinancialItem.ts` created with validation
- [ ] `domain/financials/repositories/IFinancialRepository.ts` interface defined
- [ ] `domain/financials/use-cases/CreateFinancialItem.ts` implemented with tests
- [ ] `domain/financials/use-cases/UpdateFinancialItem.ts` implemented with tests
- [ ] `domain/financials/use-cases/DeleteFinancialItem.ts` implemented with tests
- [ ] `domain/financials/use-cases/GetFinancialItems.ts` implemented with tests
- [ ] All use case tests passing (40+ tests)

### Service Layer

- [ ] `application/services/FinancialManagementService.ts` created
- [ ] Service includes toast feedback for all mutations
- [ ] Service tests created (10+ tests)
- [ ] `application/services/FinancialManagementAdapter.ts` created
- [ ] Adapter tests created (20+ tests)
- [ ] `application/services/FinancialServiceFactory.ts` created
- [ ] All service/adapter tests passing

### State Management

- [ ] Financial state added to `ApplicationState.ts`
- [ ] Selectors implemented (`getFinancialItems`, `getFinancialItemsLoading`, etc.)
- [ ] Mutations implemented (`setFinancialItems`, `setFinancialItemsLoading`, etc.)
- [ ] `useApplicationState` hook updated
- [ ] State tests passing

### Hook Layer

- [ ] `useFinancialItemFlow` refactored to use service layer
- [ ] `useRef` pattern applied for stable callbacks
- [ ] Direct DataManager dependencies removed
- [ ] Hook LOC reduced by ~40%
- [ ] Hook tests updated and passing

### Integration

- [ ] All components updated to use new hook API
- [ ] `FinancialItemCard` working correctly
- [ ] `FinancialItemList` working correctly
- [ ] Autosave integration verified
- [ ] Full test suite passing (100% pass rate)

### Documentation

- [ ] `feature-catalogue.md` updated (rating 73→85+)
- [ ] Code comments added for new architecture
- [ ] Migration notes documented

## 🎓 Key Learnings from Cases Domain

### What Worked Well

1. **UseRef Pattern**: Prevents infinite render loops by stabilizing callback references
2. **Optimistic Updates**: Immediate UI feedback with automatic rollback on error
3. **Domain Events**: Clean separation enables future cross-domain coordination
4. **Structured Clone**: `structuredClone()` in selectors prevents accidental mutations
5. **Toast Feedback**: Loading→Success/Error flow provides excellent UX
6. **AbortError Handling**: Silent dismissal for user-cancelled operations

### Common Pitfalls to Avoid

1. **Don't skip `useRef`**: Without it, callbacks recreate on every render causing infinite loops
2. **Clone in selectors**: Always return `structuredClone()` from ApplicationState getters
3. **Test rollback**: Verify optimistic updates roll back when persistence fails
4. **Handle AbortError**: Special case for user cancellations (dismiss toast, don't error)
5. **Event metadata**: Include timestamps, user context in domain events

## 🔍 Testing Strategy

### Required Test Coverage

- **Domain Entities**: Construction, validation, cloning, immutability (5+ tests each)
- **Use Cases**: Happy path, optimistic updates, rollback, error handling, edge cases (12+ tests each)
- **Service Layer**: Orchestration, toast feedback, error handling, AbortError (10+ tests)
- **Adapter Layer**: Data transformation, repository interface, error handling (20+ tests)
- **Hook Layer**: State synchronization, callback stability, loading states (4+ tests)
- **Integration**: End-to-end financial item workflows (as needed)

### Test Quality Standards

- All tests must use descriptive names following the pattern: `should <action> when <condition>`
- Mock external dependencies (`DataManager`, `toast`, `logger`)
- Use `vi.hoisted()` for mock initialization to avoid hoisting errors
- Verify both success and failure paths
- Test optimistic update + rollback scenarios
- Maintain 100% test pass rate

## 📦 Dependencies

**Study these reference files:**

- `domain/cases/` - Complete domain layer pattern
- `application/services/CaseManagementService.ts` - Service orchestration
- `application/services/CaseManagementAdapter.ts` - Adapter pattern
- `hooks/useCaseManagement.ts` - Simplified hook with useRef
- `__tests__/domain/cases/use-cases/*.test.ts` - Use case test patterns
- `__tests__/application/services/*.test.ts` - Service test patterns

## 🎯 Expected Outcomes

### Quantitative Improvements

- Hook complexity: ~40% reduction in LOC (following Cases pattern)
- Test coverage: 60+ new tests added
- Feature rating: 73→85+ (12+ point increase)
- Maintainability: Clear separation of concerns across layers

### Qualitative Improvements

- Testability: Pure domain logic easy to unit test
- Flexibility: Service layer enables future enhancements (audit trails, batch ops)
- Consistency: Same patterns as Cases domain (easier onboarding)
- Reliability: Optimistic updates with rollback prevent data loss
- Observability: Domain events enable cross-domain coordination

## ⚠️ Important Constraints

1. **Maintain 100% Test Pass Rate**: All 352+ tests must pass throughout migration
2. **No Breaking Changes**: Existing UI components should work without modification
3. **Follow Cases Pattern**: Use the same architectural patterns for consistency
4. **Document As You Go**: Add code comments explaining complex logic
5. **Incremental Commits**: Make small, focused commits for easier review

## 🚀 Getting Started

```bash
# 1. Create feature branch
git checkout -b phase-3-financial-domain-migration

# 2. Study reference implementation
# Read through domain/cases/ and application/services/Case*

# 3. Start with domain layer
# Create entities and use cases first

# 4. Run tests frequently
npm test -- --run

# 5. Build to verify no compilation errors
npm run build

# 6. Commit incrementally
git add .
git commit -m "feat(financial): add domain entities and use cases"
```

## 📞 Questions?

Refer to the Cases domain implementation as the authoritative example. If you encounter edge cases not covered there, follow the same architectural principles: domain purity, service orchestration, state centralization, and comprehensive testing.

**Good luck! 🎉**
