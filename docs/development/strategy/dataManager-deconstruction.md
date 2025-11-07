## Purpose

- fully and cleanly deconstruct dataManager into different modules, and keep dataManager as the arbiter of the full case object.

---

## Initial Analysis & Strategy

### Current State

**DataManager.ts**: 2,755 lines doing work of 8+ specialized services

- File I/O: ~160 lines
- Alert Management: ~430 lines (largest section)
- Case CRUD: ~270 lines
- Financial CRUD: ~206 lines
- Notes CRUD: ~210 lines
- Activity Log: ~54 lines
- Category Config: ~48 lines
- Bulk Operations: ~66 lines
- Utilities: ~150 lines

**Section Headers (Added):**
✅ Configuration & Logging
✅ Utility Functions
✅ Type Definitions
✅ Private: Alert Matching & Processing
✅ CORE FILE OPERATIONS (Private)
✅ PUBLIC API - READ OPERATIONS
✅ PUBLIC API - ALERT OPERATIONS
✅ PUBLIC API - CATEGORY CONFIGURATION
✅ PUBLIC API - WRITE OPERATIONS
✅ FINANCIAL ITEM OPERATIONS
✅ NOTE OPERATIONS
✅ BULK OPERATIONS

### Proposed Architecture

#### Core Principle: DataManager as Orchestrator

DataManager remains the **single entry point** for all case-related operations. It orchestrates specialized services but maintains responsibility for:

- Ensuring consistency across case + financials + notes + alerts
- Managing the complete `CaseDisplay` object lifecycle
- Coordinating cross-domain operations (e.g., deleting a case also deletes its financials/notes/alerts)

#### Extraction Plan: Bottom-Up Approach

**Phase 1: Foundation Services** (No dependencies on each other)

1. **FileStorageService** - Extract file I/O operations

   - `readFileData()` → `readFile()`
   - `writeFileData()` → `writeFile()`
   - `autoWriteFile()` → `autoWrite()`
   - Dependencies: `AutosaveFileService` only
   - Test coverage: ~95%

2. **ActivityLogService** - Extract activity log management

   - `normalizeActivityLog()` → module function
   - `mergeActivityEntries()` → module function
   - `getActivityLog()`, `clearActivityLogForDate()`
   - Dependencies: None (pure utility)
   - Test coverage: ~75%

3. **CategoryConfigService** - Extract category configuration
   - `getCategoryConfig()`, `updateCategoryConfig()`
   - Dependencies: FileStorageService
   - Test coverage: ~80%

**Phase 2: Domain Services** (Depend on Phase 1) 4. **AlertsService** - Extract alert management (~430 lines, biggest win)

- Private methods: `buildCaseLookup()`, `rematchAlertForCases()`, `loadAlertsFromStore()`, etc.
- Public methods: `getAlertsIndex()`, `updateAlertWorkflow()`, `bulkUpdateAlerts()`
- Dependencies: FileStorageService, alertsData utilities
- Test coverage: ~90%

5. **NotesService** - Extract note CRUD

   - `addNote()`, `updateNote()`, `deleteNote()`
   - `normalizeCaseNotes()` → internal function
   - Dependencies: FileStorageService
   - Test coverage: ~70-85%

6. **FinancialsService** - Extract financial item CRUD
   - `addFinancialItem()`, `updateFinancialItem()`, `deleteFinancialItem()`
   - Dependencies: FileStorageService
   - Test coverage: ~70-85%

**Phase 3: Orchestration Layer** 7. **CaseService** - Extract case CRUD (but not full orchestration)

- `addCase()`, `updateCase()`, `updateCaseStatus()`, `deleteCase()`
- Dependencies: FileStorageService, ActivityLogService
- Test coverage: ~70-85%

8. **DataManager** (Refactored) - Becomes thin orchestrator
   - Composes all services
   - Handles cross-domain operations (delete case → cascade to financials/notes)
   - Maintains backward compatibility with existing API
   - Delegates to specialized services

### Key Design Decisions

#### 1. Service Interface Pattern

```typescript
interface ServiceConfig {
  fileStorage: FileStorageService;
  // other dependencies
}

class AlertsService {
  constructor(private config: ServiceConfig) {}

  async getAlertsIndex(cases: CaseDisplay[]): Promise<AlertsIndex> {
    // Implementation
  }
}
```

#### 2. DataManager Orchestration Pattern

```typescript
export class DataManager {
  private fileStorage: FileStorageService;
  private alerts: AlertsService;
  private notes: NotesService;
  private financials: FinancialsService;
  private cases: CaseService;

  constructor(config: DataManagerConfig) {
    this.fileStorage = new FileStorageService(config.fileService);
    this.alerts = new AlertsService({ fileStorage: this.fileStorage });
    this.notes = new NotesService({ fileStorage: this.fileStorage });
    // etc...
  }

  // Maintain existing API for backward compatibility
  async getAllCases(): Promise<CaseDisplay[]> {
    return this.cases.getAll();
  }

  async deleteCase(caseId: string): Promise<void> {
    // Orchestrate cross-domain deletion
    await this.cases.delete(caseId);
    await this.financials.deleteByCaseId(caseId);
    await this.notes.deleteByCaseId(caseId);
    // Activity log entry added by CaseService
  }
}
```

#### 3. Storage Format Consideration

**Current:** DataManager writes legacy `{cases: [CaseDisplay]}` format (nested)
**Future:** Normalized `{cases: [CaseSnapshot], financials: [], notes: []}`

**Decision:** Extract services **first** with current format, then migrate format **second**

- Reason: Smaller, safer changes. Service extraction is complex enough.
- After extraction, switching storage format becomes a FileStorageService concern only.

#### 4. Test Strategy

- Each extracted service gets its own test file
- Keep existing DataManager.test.ts as integration test
- Aim for 100% test pass rate at each extraction step
- Use backup file pattern: `cp DataManager.ts DataManager.ts.backup`

### Extraction Sequence (Detailed)

#### Step 1: FileStorageService (~1 hour)

1. Create `utils/services/FileStorageService.ts`
2. Move file I/O methods from DataManager
3. Update DataManager to use FileStorageService
4. Run tests → verify 315 passing
5. Commit: "refactor: extract FileStorageService from DataManager"

#### Step 2: ActivityLogService (~30 min)

1. Create `utils/services/ActivityLogService.ts`
2. Extract activity log methods
3. Update DataManager delegation
4. Tests → commit

#### Step 3: CategoryConfigService (~30 min)

Similar pattern...

#### Step 4: AlertsService (~2 hours - biggest extraction)

1. Create `utils/services/AlertsService.ts`
2. Extract ~430 lines of alert logic
3. Update DataManager to delegate
4. Tests → commit

...continue pattern for remaining services

### Risk Assessment

**MEDIUM Risk** (40% risk of issues)

- Large number of interdependencies between CRUD operations
- Tests are good but not exhaustive on edge cases
- DataManager is used by many components

**Mitigation:**

- Extract one service at a time
- Run full test suite after each extraction
- Keep backup files
- Maintain 100% backward compatibility in DataManager API
- Do NOT change storage format during extraction

### Success Criteria

✅ All 315 tests passing after each extraction
✅ DataManager public API unchanged (backward compatible)
✅ Each service has clear, single responsibility
✅ DataManager.ts reduced to ~500-800 lines (orchestration only)
✅ Each service independently testable
✅ Code easier to understand and modify

### Timeline Estimate

- Phase 1 (3 services): ~2-3 hours
- Phase 2 (3 services): ~4-5 hours
- Phase 3 (orchestration): ~2-3 hours
- **Total:** ~8-11 hours of focused work

### Open Questions

1. Should we extract services into `utils/services/` or `application/services/`?
   - Recommendation: `utils/services/` for now (they're utility-level, not domain layer)
2. Should FileStorageService be injectable or singleton?
   - Recommendation: Injectable (easier to test, more flexible)
3. Do we need interfaces for each service?

   - Recommendation: Not initially. Add if we need multiple implementations.

4. How do we handle the dual-format problem (Phase 3 vs Phase 2)?
   - Recommendation: Ignore during extraction. Handle in separate normalization work.

---

## The Big Win: Storage Format Migration Becomes Trivial

### Before Service Extraction (Current Problem)

To switch from legacy → normalized storage format, you'd need to touch:

- ❌ DataManager (case mutations)
- ❌ FinancialItemFlow hook (financial mutations)
- ❌ NoteFlow hook (note mutations)
- ❌ CaseManagement hook (case mutations)
- ❌ AlertsFlow hook (alert mutations)
- ❌ Every component that touches storage
- **Risk:** High - changes scattered across 10+ files

### After Service Extraction (The Solution)

To switch formats, you only change **ONE place**:

- ✅ **FileStorageService** reads/writes normalized format
- ✅ DataManager doesn't care - it just calls `fileStorage.read()` and `fileStorage.write()`
- ✅ All domain services work with in-memory `CaseDisplay` objects
- ✅ Format conversion happens at storage boundary only
- **Risk:** Low - single responsibility, single change point

### Migration Becomes a FileStorageService Concern

```typescript
// FileStorageService.ts - THE ONLY FILE THAT NEEDS TO CHANGE

class FileStorageService {
  async read(): Promise<FileData> {
    const raw = await this.autosaveService.readFile();

    // Handle both formats during transition
    if (this.isNormalizedFormat(raw)) {
      return this.denormalizeForRuntime(raw);  // Normalized → CaseDisplay
    }
    return this.readLegacyFormat(raw);  // Already CaseDisplay
  }

  async write(data: FileData): Promise<void> {
    const normalized = this.normalizeForStorage(data);  // CaseDisplay → Normalized
    await this.autosaveService.writeFile(normalized);
  }

  private normalizeForStorage(data: FileData): NormalizedData {
    // Extract cases, financials, notes into separate arrays
    return {
      cases: data.cases.map(c => this.toCaseSnapshot(c)),
      financials: data.cases.flatMap(c => this.extractFinancials(c)),
      notes: data.cases.flatMap(c => this.extractNotes(c)),
      // ... etc
    };
  }

  private denormalizeForRuntime(normalized: NormalizedData): FileData {
    // Reconstruct CaseDisplay objects with nested data
    const cases = normalized.cases.map(snapshot => {
      const caseFinancials = normalized.financials.filter(f => f.caseId === snapshot.id);
      const caseNotes = normalized.notes.filter(n => n.caseId === snapshot.id);
      return this.toCaseDisplay(snapshot, caseFinancials, caseNotes);
    });

    return { cases, exported_at: normalized.exported_at, ... };
  }
}
```

### The Beauty: Clean Separation of Concerns

**Runtime Layer** (In-Memory)

- DataManager orchestrates
- Services operate on `CaseDisplay` objects
- All business logic works with rich, nested objects
- No awareness of storage format

**Storage Layer** (Persistence)

- FileStorageService handles format
- Converts between runtime ↔ storage formats
- Can change format without touching business logic
- Single source of truth for serialization

### Phase 4: Storage Normalization (After Service Extraction)

Once services are extracted, storage normalization becomes:

**Step 1:** Add normalization/denormalization to FileStorageService (~2 hours)
**Step 2:** Test with dual-format support (reads both, writes normalized) (~1 hour)
**Step 3:** Migration complete - delete legacy format support (~30 min)

**Total time:** ~3-4 hours instead of weeks
**Files changed:** 1-2 instead of 10+
**Risk:** Low instead of high

### Why This Order Matters

**Wrong Order:** Normalize storage first, then extract services

- Every service extraction breaks storage layer
- Constant format juggling during development
- High cognitive load, easy to introduce bugs

**Right Order:** Extract services first, then normalize storage

- Services stabilize around in-memory format
- Storage becomes implementation detail
- One clean migration at the end
- Clear separation of concerns

---

## Decision: Two-Phase Approach

### Phase A: Service Extraction (This Work)

Extract 7 services from DataManager while keeping legacy storage format

- Timeline: 8-11 hours
- Risk: Medium (but isolated per service)
- Outcome: Clean architecture, easier to maintain

### Phase B: Storage Normalization (Future Work)

Switch FileStorageService to normalized format

- Timeline: 3-4 hours
- Risk: Low (only touches FileStorageService)
- Outcome: Proper normalized storage, domain purity

**Total:** ~12-15 hours over 2 phases instead of attempting both simultaneously

---

## Next Steps

1. Get alignment on architecture approach
2. Start with Phase 1, Step 1: FileStorageService extraction
3. Work incrementally with test verification at each step
