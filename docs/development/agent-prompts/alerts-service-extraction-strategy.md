# AlertsService Extraction Strategy

**Phase 1, Step 7 (Final Service Extraction)**  
**Date:** November 13, 2025  
**Status:** Planning

---

## Executive Summary

Extract alerts functionality from DataManager (~700 lines) using a **two-service architecture**:

- **AlertsStorageService**: I/O, persistence, migration (foundation layer)
- **AlertsService**: Business logic, matching, workflow (orchestration layer)

**Why split?** Alerts storage is completely independent from case storage (separate file: `alerts.json`), unlike Notes/Financials/Cases which all share `data.json`. This architectural difference justifies a dedicated storage service.

---

## Current Architecture Analysis

### Storage Pattern Comparison

| Service                         | Storage Backend      | File              | Pattern                           |
| ------------------------------- | -------------------- | ----------------- | --------------------------------- |
| FileStorageService              | AutosaveFileService  | `data.json`       | **Foundation layer** - direct I/O |
| CaseService                     | FileStorageService   | `data.json`       | Business logic → FileStorage      |
| NotesService                    | FileStorageService   | `data.json`       | Business logic → FileStorage      |
| FinancialsService               | FileStorageService   | `data.json`       | Business logic → FileStorage      |
| ActivityLogService              | FileStorageService   | `data.json`       | Business logic → FileStorage      |
| CategoryConfigService           | FileStorageService   | `data.json`       | Business logic → FileStorage      |
| **AlertsStorageService** ⬅️ NEW | AutosaveFileService  | **`alerts.json`** | **Foundation layer** - direct I/O |
| **AlertsService** ⬅️ NEW        | AlertsStorageService | `alerts.json`     | Business logic → AlertsStorage    |

### Key Architectural Insight

**Alerts use a separate persistence file (`alerts.json`) with independent versioning and migration.**

This is fundamentally different from cases/notes/financials which all live in `data.json` under the FileStorageService umbrella.

**Implication**: AlertsStorageService should mirror FileStorageService as a **foundation-layer service**, not a business-logic service.

---

## Isolation Boundaries: Preventing Cross-Contamination

### The Cross-Contamination Risk

Both `FileStorageService` and `AlertsStorageService` share the same `AutosaveFileService` instance but manage **different files**. Without proper isolation, they could interfere with each other's operations.

### How AutosaveFileService Prevents Contamination

AutosaveFileService provides **separate APIs** for different file types:

```typescript
// AutosaveFileService API (existing)
class AutosaveFileService {
  // PRIMARY FILE: data.json (cases, notes, financials, etc.)
  async readFile(): Promise<RawData | null>;
  async writeFile(data: RawData): Promise<boolean>;

  // NAMED FILES: alerts.json, other auxiliary files
  async readNamedFile(fileName: string): Promise<unknown>;
  async writeNamedFile(fileName: string, data: unknown): Promise<boolean>;
  async readTextFile(fileName: string): Promise<string | null>;
}
```

### Service-to-API Mapping

| Service              | AutosaveFileService API                | File          | Isolation Level                                              |
| -------------------- | -------------------------------------- | ------------- | ------------------------------------------------------------ |
| FileStorageService   | `readFile()` / `writeFile()`           | `data.json`   | **Exclusive API** - only service using primary file methods  |
| AlertsStorageService | `readNamedFile()` / `writeNamedFile()` | `alerts.json` | **Scoped by filename** - `"alerts.json"` passed as parameter |
| (Future services)    | `readNamedFile()` / `writeNamedFile()` | `other.json`  | **Scoped by filename** - different filename parameter        |

### Architectural Guarantees

✅ **No shared state**: Each service manages its own file namespace  
✅ **No method overlap**: FileStorageService uses different methods than AlertsStorageService  
✅ **Filename scoping**: Named file methods require explicit filename parameter  
✅ **Type safety**: FileStorageService returns `FileData`, AlertsStorageService returns `AlertsStoragePayload`  
✅ **Independent versioning**: Each storage format has its own version number and migration logic

### Example: How They Coexist

```typescript
class DataManager {
  constructor(fileService: AutosaveFileService) {
    // SAME fileService instance, DIFFERENT APIs
    this.fileStorage = new FileStorageService({
      fileService, // Uses: readFile(), writeFile()
      // ...
    });

    this.alertsStorage = new AlertsStorageService({
      fileService, // Uses: readNamedFile("alerts.json"), writeNamedFile("alerts.json", ...)
      // ...
    });
  }
}

// No contamination possible - different method signatures
const cases = await this.fileStorage.readFileData();
// → calls fileService.readFile() → reads data.json

const alerts = await this.alertsStorage.loadAlertsFromStore();
// → calls fileService.readNamedFile("alerts.json") → reads alerts.json
```

### What If We Add More Storage Services Later?

The pattern scales safely:

```typescript
// Future: ReportsStorageService
this.reportsStorage = new ReportsStorageService({
  fileService, // Uses: readNamedFile("reports.json"), writeNamedFile("reports.json", ...)
});

// Future: ConfigStorageService
this.configStorage = new ConfigStorageService({
  fileService, // Uses: readNamedFile("config.json"), writeNamedFile("config.json", ...)
});
```

Each service is isolated by:

1. **Unique filename** passed to `readNamedFile()` / `writeNamedFile()`
2. **Type-specific interfaces** (`ReportsPayload`, `ConfigPayload`, etc.)
3. **Independent version migrations**

### Testing for Contamination

We'll add integration tests to verify isolation:

```typescript
describe("Storage Service Isolation", () => {
  it("should not contaminate data.json when writing alerts.json", async () => {
    const casesBeforeAlertWrite = await dataManager.getAllCases();
    await dataManager.updateAlertStatus("alert-1", { status: "resolved" });
    const casesAfterAlertWrite = await dataManager.getAllCases();

    expect(casesAfterAlertWrite).toEqual(casesBeforeAlertWrite); // No contamination
  });

  it("should not contaminate alerts.json when writing data.json", async () => {
    const alertsBeforeCaseWrite = await dataManager.getAlertsIndex();
    await dataManager.createCompleteCase({
      /* ... */
    });
    const alertsAfterCaseWrite = await dataManager.getAlertsIndex();

    expect(alertsAfterCaseWrite).toEqual(alertsBeforeCaseWrite); // No contamination
  });
});
```

---

## Existing Service Dependency Pattern

### Standard Pattern (Cases/Notes/Financials)

```typescript
interface ServiceConfig {
  fileStorage: FileStorageService; // ← Inject foundation layer
}

class DomainService {
  private fileStorage: FileStorageService;

  constructor(config: ServiceConfig) {
    this.fileStorage = config.fileStorage;
  }

  async operation(): Promise<Result> {
    // Read → Modify → Write pattern
    const data = await this.fileStorage.readFileData();
    // ... business logic ...
    await this.fileStorage.writeFileData(modifiedData);
  }
}
```

### Notes/Financials Special Case: Cross-Service Dependencies

```typescript
// NotesService.ts
interface NotesServiceConfig {
  fileStorage: FileStorageService;
  activityLog?: ActivityLogService; // ← Optional for activity logging
}

// FinancialsService.ts
interface FinancialsServiceConfig {
  fileStorage: FileStorageService;
  // No cross-dependencies
}

// CaseService.ts - Uses ActivityLogService internally but doesn't inject it
// Instead, creates instances as needed (see updateCaseStatus implementation)
```

**Pattern**: Services only inject FileStorageService. Cross-domain activity logging is handled internally (not via DI).

---

## Proposed AlertsService Architecture

### Two-Service Split Rationale

**AlertsStorageService** (~350 lines)

- **Role**: Foundation layer for alerts persistence
- **Analogy**: FileStorageService for cases, but for alerts
- **File**: `alerts.json` (separate from `data.json`)
- **Responsibilities**:
  - Low-level I/O: read/write `alerts.json`
  - Version migration: v1 legacy → v2 current format
  - Hydration: JSON → `AlertWithMatch` objects
  - CSV import fallback: read `Alerts.csv` when no JSON exists
  - Debug logging and error reporting

**AlertsService** (~350 lines)

- **Role**: Business logic layer
- **Analogy**: CaseService/NotesService for cases, but for alerts
- **Responsibilities**:
  - Public API: `getAlertsIndex()`, `updateAlertStatus()`, `mergeAlertsFromCsvContent()`
  - Matching logic: map alerts to cases via MCN/metadata
  - Workflow orchestration: apply stored workflows, handle status changes
  - Deduplication: prevent duplicate alert entries
  - Comparison utilities: `alertsAreEqual()`, `countUniqueAlertKeys()`

### Dependency Flow

```
AlertsService
    ↓ (depends on)
AlertsStorageService
    ↓ (depends on)
AutosaveFileService (existing)
```

**No dependency on FileStorageService** - alerts have separate storage lifecycle.

---

## Interface Definitions

### AlertsStorageService

```typescript
// utils/services/AlertsStorageService.ts

interface AlertsStorageServiceConfig {
  fileService: AutosaveFileService;
  parseAlertsFromCsv?: (
    csvContent: string,
    cases: CaseDisplay[]
  ) => AlertsIndex;
}

export interface AlertsStoragePayload {
  version: number;
  generatedAt: string;
  updatedAt: string;
  summary: AlertsSummary;
  alerts: AlertWithMatch[];
  uniqueAlerts: number;
  sourceFile?: string;
}

export interface LoadAlertsResult {
  alerts: AlertWithMatch[] | null;
  legacyWorkflows: StoredAlertWorkflowState[];
  needsMigration: boolean;
  invalidJson: boolean;
  sourceFile?: string;
}

export interface ImportAlertsResult {
  alerts: AlertWithMatch[];
  sourceFile?: string;
}

export class AlertsStorageService {
  private fileService: AutosaveFileService;
  private parseAlertsFromCsv: (
    csvContent: string,
    cases: CaseDisplay[]
  ) => AlertsIndex;

  constructor(config: AlertsStorageServiceConfig);

  // Core I/O
  async loadAlertsFromStore(): Promise<LoadAlertsResult>;
  async saveAlerts(payload: AlertsStoragePayload): Promise<boolean>;

  // CSV Import
  async importAlertsFromCsv(cases: CaseDisplay[]): Promise<ImportAlertsResult>;

  // Utilities
  private hydrateStoredAlert(entry: unknown): AlertWithMatch | null;
  private parseStoredAlertsPayload(payload: Record<string, unknown>): {
    workflows: StoredAlertWorkflowState[];
    needsMigration: boolean;
  };
}
```

### AlertsService

```typescript
// utils/services/AlertsService.ts

interface AlertsServiceConfig {
  alertsStorage: AlertsStorageService;
  fileStorage: FileStorageService; // For reading cases during rematch
}

export class AlertsService {
  private alertsStorage: AlertsStorageService;
  private fileStorage: FileStorageService;

  constructor(config: AlertsServiceConfig);

  // Public API
  async getAlertsIndex(options?: {
    cases?: CaseDisplay[];
  }): Promise<AlertsIndex>;
  async updateAlertStatus(
    alertId: string,
    updates: {
      status?: AlertWorkflowStatus;
      resolvedAt?: string | null;
      resolutionNotes?: string;
    },
    options?: { cases?: CaseDisplay[] }
  ): Promise<AlertWithMatch | null>;
  async mergeAlertsFromCsvContent(
    csvContent: string,
    options?: { cases?: CaseDisplay[] }
  ): Promise<AlertWithMatch[]>;

  // Matching & Workflow
  private rematchAlertsForCases(
    alerts: AlertWithMatch[],
    cases: CaseDisplay[]
  ): AlertWithMatch[];
  private applyStoredAlertWorkflows(
    alerts: AlertWithMatch[],
    storedWorkflows: StoredAlertWorkflowState[]
  ): {
    alerts: AlertWithMatch[];
    changed: boolean;
    unmatchedIds: string[];
  };

  // Key Generation
  private buildAlertLookupCandidates(
    alert: AlertWithMatch
  ): AlertLookupCandidate[];
  private alertKey(alert: AlertWithMatch): string;
  private alertLegacyKey(alert: AlertWithMatch): string | null;

  // Comparison
  private alertsAreEqual(a: AlertWithMatch, b: AlertWithMatch): boolean;
  private countUniqueAlertKeys(alerts: AlertWithMatch[]): number;
}
```

---

## DataManager Integration

### Current State (Step 6 Complete)

```typescript
class DataManager {
  private fileStorage: FileStorageService;
  private activityLog: ActivityLogService;
  private categoryConfig: CategoryConfigService;
  private notes: NotesService;
  private financials: FinancialsService;
  private cases: CaseService;
  // ... 1,765 lines of code including ~700 lines of alerts logic
}
```

### Target State (Step 7 Complete)

```typescript
class DataManager {
  private fileStorage: FileStorageService;
  private activityLog: ActivityLogService;
  private categoryConfig: CategoryConfigService;
  private notes: NotesService;
  private financials: FinancialsService;
  private cases: CaseService;
  private alertsStorage: AlertsStorageService; // ← NEW
  private alerts: AlertsService; // ← NEW

  constructor(
    fileService: AutosaveFileService,
    categoryConfig?: CategoryConfig
  ) {
    this.fileStorage = new FileStorageService({
      fileService,
      normalizeCaseNotes: this.normalizeCaseNotes.bind(this),
    });

    this.activityLog = new ActivityLogService({
      fileStorage: this.fileStorage,
    });
    this.categoryConfig = new CategoryConfigService({
      fileStorage: this.fileStorage,
    });
    this.notes = new NotesService({ fileStorage: this.fileStorage });
    this.financials = new FinancialsService({ fileStorage: this.fileStorage });
    this.cases = new CaseService({ fileStorage: this.fileStorage });

    // Alerts have independent storage
    this.alertsStorage = new AlertsStorageService({
      fileService,
      parseAlertsFromCsv: this.parseAlertsWithFallback.bind(this),
    });
    this.alerts = new AlertsService({
      alertsStorage: this.alertsStorage,
      fileStorage: this.fileStorage, // For case lookup during rematch
    });
  }

  // Thin delegation methods
  async getAlertsIndex(options = {}) {
    return this.alerts.getAlertsIndex(options);
  }

  async updateAlertStatus(alertId, updates, options = {}) {
    return this.alerts.updateAlertStatus(alertId, updates, options);
  }

  async mergeAlertsFromCsvContent(csvContent, options = {}) {
    return this.alerts.mergeAlertsFromCsvContent(csvContent, options);
  }
}
```

---

## Extraction Execution Plan

### Step 7a: Extract AlertsStorageService (30 min)

**Files to create:**

- `utils/services/AlertsStorageService.ts` (~350 lines)

**Methods to extract:**

- `loadAlertsFromStore()` - Read alerts.json with version handling
- `saveAlerts()` - Write alerts.json with payload structure
- `importAlertsFromCsv()` - Read Alerts.csv fallback
- `hydrateStoredAlert()` - JSON → AlertWithMatch conversion
- `parseStoredAlertsPayload()` - Legacy workflow extraction

**Dependencies:**

- `AutosaveFileService` (existing)
- `alertsData.ts` utilities (existing)
- `logger.ts` (existing)
- `fileStorageErrorReporter.ts` (existing)

**Testing strategy:**

- Verify load/save roundtrip
- Test version migration (v1 → v2)
- Validate CSV import fallback
- Error handling for corrupt JSON

### Step 7b: Extract AlertsService (45 min)

**Files to create:**

- `utils/services/AlertsService.ts` (~350 lines)

**Methods to extract:**

- `getAlertsIndex()` - Main orchestration method
- `updateAlertStatus()` - Status update with multi-tier matching
- `mergeAlertsFromCsvContent()` - CSV merge with deduplication
- `rematchAlertsForCases()` - Case matching logic
- `applyStoredAlertWorkflows()` - Workflow application
- `buildAlertLookupCandidates()` - Key generation for matching
- `alertKey()`, `alertLegacyKey()` - Keying utilities
- `alertsAreEqual()` - Comparison utility
- `countUniqueAlertKeys()` - Deduplication counter

**Dependencies:**

- `AlertsStorageService` (from Step 7a)
- `FileStorageService` (for case lookup)
- `alertsData.ts` utilities (existing)
- `logger.ts` (existing)

**Testing strategy:**

- Test alert matching logic (MCN, metadata, fallback keys)
- Verify workflow application
- Test status update edge cases (multiple matches, no match)
- Validate CSV merge deduplication

### Step 7c: Update DataManager (15 min)

**Changes to DataManager:**

1. Add service instance properties
2. Initialize in constructor
3. Replace alert methods with delegation
4. Remove extracted code (~700 lines)

**Expected result:**

- DataManager: 1,765 → ~1,065 lines (-700 lines, -39.7%)
- Cumulative reduction: 2,755 → 1,065 lines (-61.3% total)

**Testing strategy:**

- Run full test suite (315 tests)
- Verify no breaking changes in UI
- Test alerts flow end-to-end

---

## Risk Assessment

### Low Risk

✅ AlertsStorageService extraction - pure I/O, well-defined interface  
✅ Constructor injection pattern - already proven across 6 services  
✅ Test coverage - 315 tests provide safety net

### Medium Risk

⚠️ Alert matching logic complexity - multi-tier candidate system  
⚠️ CSV merge deduplication - sophisticated Map/Set logic  
⚠️ Workflow state migrations - backward compatibility required

### Mitigation Strategies

- Extract storage layer first (foundation before logic)
- Test each service independently before integration
- Maintain existing debug logging for troubleshooting
- Preserve all edge case handling (multiple matches, no matches, corrupt data)

---

## Open Questions

### 1. Should AlertsService depend on FileStorageService?

**Current thinking**: YES

- `rematchAlertsForCases()` needs access to current cases
- `getAlertsIndex()` accepts optional `cases` parameter, but can fetch if not provided
- Pattern: AlertsService reads cases via FileStorageService when needed

**Alternative**: Force caller to always pass cases

- Pro: Pure dependency on AlertsStorageService only
- Con: Breaks existing API, adds complexity to callers

**Decision**: Keep FileStorageService dependency for case lookup convenience.

---

### 2. Should parseAlertsWithFallback remain in DataManager or move to AlertsStorageService?

**Current thinking**: STAYS IN DATAMANAGER, INJECT VIA CONFIG

- Method has debug logging specific to DataManager context
- Uses `this.isDebugEnvironment()` which is DataManager-specific
- Small method (~30 lines), acts as glue between DataManager and storage

**Alternative**: Move entirely to AlertsStorageService

- Pro: Cleaner separation
- Con: Loses DataManager debug context

**Decision**: Keep in DataManager, inject as config callback to AlertsStorageService.

---

### 3. How to handle case lookup dependencies in buildCaseLookup?

**Context**: `buildCaseLookup()` is used by alert matching but defined in DataManager.

**Options**:
A. Move to AlertsService (preferred)
B. Extract to shared utility file
C. Keep in DataManager, inject as callback

**Decision**: Move to AlertsService - it's alert-specific logic.

---

### 4. Storage constants: Where should ALERTS_JSON_NAME, ALERTS_FILE_NAME, ALERTS_STORAGE_VERSION live?

**Current**: Private static in DataManager

**Options**:
A. Move to AlertsStorageService as public constants
B. Move to alertsData.ts utility file
C. Duplicate across services (bad practice)

**Decision**: Move to AlertsStorageService as public static readonly constants.

---

## Success Criteria

✅ All 315 tests passing  
✅ AlertsStorageService: ~350 lines, foundation layer complete  
✅ AlertsService: ~350 lines, business logic complete  
✅ DataManager: ~1,065 lines (61.3% reduction from baseline)  
✅ Zero breaking changes in UI  
✅ TypeScript strict mode compliance  
✅ No eslint errors  
✅ Production build successful

---

## Next Steps After Extraction

1. **Orchestrator Refactor** (~1 hour)

   - Reduce DataManager to pure delegation layer
   - Target: 500-800 lines of thin wrapper methods
   - Remove remaining business logic

2. **Storage Format Normalization** (~3-4 hours, Phase B)
   - Consolidate alerts.json into data.json (optional)
   - Normalize data structures
   - Update migration logic

---

## Questions for Review

1. **Two-service split vs. single service?** Do you agree with AlertsStorageService as foundation layer?
2. **FileStorageService dependency in AlertsService?** Should alerts service fetch cases, or always require them as parameters?
3. **parseAlertsWithFallback callback pattern?** Keep in DataManager and inject, or move to AlertsStorageService?
4. **Storage constants location?** AlertsStorageService, alertsData.ts, or keep in DataManager?
5. **Execution order?** Storage first (7a) → Business logic (7b) → Integration (7c)?

---

**Ready to proceed once strategy is approved.**
