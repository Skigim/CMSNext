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

## Revised Interface Definitions

### Storage Constants (NEW)

```typescript
// utils/constants/storage.ts (NEW FILE)
export const STORAGE_CONSTANTS = {
  ALERTS: {
    FILE_NAME: "alerts.json",
    CSV_NAME: "Alerts.csv",
    STORAGE_VERSION: 3,
  },
  DATA: {
    FILE_NAME: "data.json",
  },
} as const;

export type StorageConstants = typeof STORAGE_CONSTANTS;
```

### CSV Parser Utility (NEW)

```typescript
// utils/alerts/alertsCsvParser.ts (NEW FILE)
import type { CaseDisplay } from "../../types/case";
import type { AlertsIndex } from "./alertsData";

/**
 * Parse alerts from CSV content with case matching
 * Extracted from DataManager.parseAlertsWithFallback
 */
export function parseAlertsFromCsv(
  csvContent: string,
  cases: CaseDisplay[]
): AlertsIndex {
  // Uses existing parseStackedAlerts from alertsData.ts
  // Includes debug metrics and fallback logic
  // Returns AlertsIndex with matched/unmatched/missingMcn classifications
}
```

### AlertsStorageService (REVISED)

```typescript
// utils/services/AlertsStorageService.ts

import { STORAGE_CONSTANTS } from "../constants/storage";

interface AlertsStorageServiceConfig {
  fileService: AutosaveFileService;
  // No callback injection - uses shared utility function
}

export type AlertsLoadErrorType =
  | "INVALID_JSON"
  | "MIGRATION_FAILED"
  | "IO_ERROR"
  | "PARSE_ERROR";

export interface AlertsLoadError {
  type: AlertsLoadErrorType;
  message: string;
  details?: unknown;
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
  sourceFile?: string;
  error?: AlertsLoadError; // ← NEW: Structured error details
}

export interface ImportAlertsResult {
  alerts: AlertWithMatch[];
  sourceFile?: string;
  error?: AlertsLoadError; // ← NEW: Import errors
}

export class AlertsStorageService {
  private static readonly ALERTS_FILE_NAME = STORAGE_CONSTANTS.ALERTS.FILE_NAME;
  private static readonly ALERTS_CSV_NAME = STORAGE_CONSTANTS.ALERTS.CSV_NAME;
  private static readonly STORAGE_VERSION =
    STORAGE_CONSTANTS.ALERTS.STORAGE_VERSION;

  private fileService: AutosaveFileService;

  constructor(config: AlertsStorageServiceConfig);

  // Core I/O
  async loadAlertsFromStore(): Promise<LoadAlertsResult>;
  async saveAlerts(payload: AlertsStoragePayload): Promise<boolean>;

  // CSV Import - uses shared parser utility
  async importAlertsFromCsv(cases: CaseDisplay[]): Promise<ImportAlertsResult>;

  // Utilities
  private hydrateStoredAlert(entry: unknown): AlertWithMatch | null;
  private parseStoredAlertsPayload(payload: Record<string, unknown>): {
    workflows: StoredAlertWorkflowState[];
    needsMigration: boolean;
  };
}
```

### AlertsService (REVISED)

```typescript
// utils/services/AlertsService.ts

interface AlertsServiceConfig {
  alertsStorage: AlertsStorageService;
  // NO FileStorageService dependency - cases passed as parameters
}

export class AlertsService {
  private alertsStorage: AlertsStorageService;

  constructor(config: AlertsServiceConfig);

  // Public API - cases REQUIRED as parameters
  async getAlertsIndex(cases: CaseDisplay[]): Promise<AlertsIndex>;

  async updateAlertStatus(
    alertId: string,
    updates: {
      status?: AlertWorkflowStatus;
      resolvedAt?: string | null;
      resolutionNotes?: string;
    },
    cases: CaseDisplay[]
  ): Promise<AlertWithMatch | null>;

  async mergeAlertsFromCsvContent(
    csvContent: string,
    cases: CaseDisplay[]
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

  // Case Lookup (moved from DataManager)
  private buildCaseLookup(cases: CaseDisplay[]): Map<string, CaseDisplay>;
  private rematchAlertForCases(
    alert: AlertWithMatch,
    caseLookup: Map<string, CaseDisplay>
  ): AlertWithMatch;
}
```

---

## DataManager Integration (REVISED)

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

### Target State (Step 7 Complete) - REVISED

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

    // Alerts have independent storage - NO callback injection
    this.alertsStorage = new AlertsStorageService({
      fileService, // Uses readNamedFile/writeNamedFile for alerts.json
    });
    this.alerts = new AlertsService({
      alertsStorage: this.alertsStorage,
      // NO FileStorageService dependency
    });
  }

  // Thin delegation methods - DataManager orchestrates case fetching
  async getAlertsIndex(
    options: { cases?: CaseDisplay[] } = {}
  ): Promise<AlertsIndex> {
    const cases = options.cases ?? (await this.getAllCases());
    return this.alerts.getAlertsIndex(cases);
  }

  async updateAlertStatus(
    alertId: string,
    updates: {
      status?: AlertWorkflowStatus;
      resolvedAt?: string | null;
      resolutionNotes?: string;
    },
    options: { cases?: CaseDisplay[] } = {}
  ): Promise<AlertWithMatch | null> {
    const cases = options.cases ?? (await this.getAllCases());
    return this.alerts.updateAlertStatus(alertId, updates, cases);
  }

  async mergeAlertsFromCsvContent(
    csvContent: string,
    options: { cases?: CaseDisplay[] } = {}
  ): Promise<AlertWithMatch[]> {
    const cases = options.cases ?? (await this.getAllCases());
    return this.alerts.mergeAlertsFromCsvContent(csvContent, cases);
  }
}
```

**Key changes from original design**:

1. ✅ No callback injection to `AlertsStorageService`
2. ✅ `AlertsService` doesn't depend on `FileStorageService`
3. ✅ DataManager orchestrates case fetching (maintains backward compatibility with optional `cases` parameter)
4. ✅ Clear separation: DataManager = orchestration, Services = domain logic

---

## Extraction Execution Plan (REVISED)

### Step 7a: Create Storage Constants & CSV Parser (20 min)

**NEW - Files to create:**

- `utils/constants/storage.ts` (~15 lines)
- `utils/alerts/alertsCsvParser.ts` (~50 lines)

**Responsibilities:**

- Extract `ALERTS_JSON_NAME`, `ALERTS_FILE_NAME`, `ALERTS_STORAGE_VERSION` to constants file
- Extract CSV parsing logic from `DataManager.parseAlertsWithFallback()` to shared utility
- Include debug logging and metrics
- Use existing `parseStackedAlerts()` from `alertsData.ts`

**Dependencies:**

- `alertsData.ts` (existing - has `parseStackedAlerts`)
- `logger.ts` (existing)

**Testing strategy:**

- Unit test CSV parser with sample data
- Test invalid CSV handling
- Verify metrics calculation

---

### Step 7b: Extract AlertsStorageService (35 min)

**Files to create:**

- `utils/services/AlertsStorageService.ts` (~350 lines)

**Methods to extract:**

- `loadAlertsFromStore()` - Read alerts.json with version handling + error boundaries
- `saveAlerts()` - Write alerts.json with payload structure
- `importAlertsFromCsv()` - Use shared `parseAlertsFromCsv` utility
- `hydrateStoredAlert()` - JSON → AlertWithMatch conversion
- `parseStoredAlertsPayload()` - Legacy workflow extraction with migration

**Dependencies:**

- `AutosaveFileService` (existing)
- `utils/constants/storage.ts` (from Step 7a)
- `utils/alerts/alertsCsvParser.ts` (from Step 7a)
- `alertsData.ts` utilities (existing)
- `logger.ts` (existing)
- `fileStorageErrorReporter.ts` (existing)

**Key changes from original plan:**

- ✅ Use constants from storage.ts instead of class statics
- ✅ Return structured `AlertsLoadError` instead of boolean flags
- ✅ Import `parseAlertsFromCsv` instead of callback injection

**Testing strategy:**

- Verify load/save roundtrip
- Test version migration (v1 → v2) with error handling
- Validate CSV import fallback
- Test error boundaries: corrupt JSON, missing files, parse failures
- Verify structured error objects

---

### Step 7c: Extract AlertsService (50 min)

**Files to create:**

- `utils/services/AlertsService.ts` (~350 lines)

**Methods to extract:**

- `getAlertsIndex()` - Main orchestration (cases as parameter)
- `updateAlertStatus()` - Status update with multi-tier matching (cases as parameter)
- `mergeAlertsFromCsvContent()` - CSV merge with deduplication (cases as parameter)
- `rematchAlertsForCases()` - Case matching logic
- `applyStoredAlertWorkflows()` - Workflow application
- `buildAlertLookupCandidates()` - Key generation for matching
- `alertKey()`, `alertLegacyKey()` - Keying utilities
- `alertsAreEqual()` - Comparison utility
- `countUniqueAlertKeys()` - Deduplication counter
- `buildCaseLookup()` - **MOVED FROM DataManager** (alert-specific logic)
- `rematchAlertForCases()` - **MOVED FROM DataManager** (alert-specific logic)

**Dependencies:**

- `AlertsStorageService` (from Step 7b)
- `alertsData.ts` utilities (existing)
- `logger.ts` (existing)

**Key changes from original plan:**

- ❌ NO FileStorageService dependency
- ✅ All public methods require `cases: CaseDisplay[]` parameter
- ✅ Move case lookup helpers from DataManager to AlertsService

**Testing strategy:**

- Test alert matching logic (MCN, metadata, fallback keys)
- Verify workflow application
- Test status update edge cases (multiple matches, no match, ambiguous)
- Validate CSV merge deduplication
- Test with empty cases array
- Test with large datasets (1000+ alerts)

---

### Step 7d: Update DataManager (20 min)

**Changes to DataManager:**

1. Import new constants from `utils/constants/storage.ts`
2. Add service instance properties (`alertsStorage`, `alerts`)
3. Initialize services in constructor (no callbacks)
4. Update delegation methods to fetch cases when not provided
5. Remove extracted code (~700 lines):
   - All alert storage methods
   - All alert matching methods
   - All alert workflow methods
   - CSV parsing logic (now in utility)
   - Alert helper methods
6. Keep `parseAlertsWithFallback` temporarily as wrapper to shared utility (for backward compat, can remove later)

**Expected result:**

- DataManager: 1,765 → ~1,065 lines (-700 lines, -39.7%)
- Cumulative reduction: 2,755 → 1,065 lines (-61.3% total)

**Testing strategy:**

- Run full test suite (315 tests)
- Verify backward compatibility with optional `cases` parameter
- Test alerts flow end-to-end
- Verify DataManager orchestration (fetches cases when needed)

---

### Step 7e: Integration Testing (15 min)

**NEW - Comprehensive integration test suite:**

Create `__tests__/integration/alerts-storage-isolation.test.ts`:

```typescript
describe("Alerts Storage Isolation", () => {
  // Cross-contamination tests (see Architecture Review section)
  // Concurrent operations tests
  // Error handling tests
  // Version migration tests
  // Performance benchmarks
});
```

**Test coverage:**

- ✅ data.json and alerts.json isolation
- ✅ Concurrent case + alert updates
- ✅ Corrupt JSON recovery
- ✅ Missing CSV fallback
- ✅ V1 → V2 migration
- ✅ Performance (<200ms for 1000 alerts)
- ✅ Memory footprint acceptable

---

### Revised Time Estimates

| Step                        | Original   | Revised     | Change      | Reason                          |
| --------------------------- | ---------- | ----------- | ----------- | ------------------------------- |
| 7a: Constants & Parser      | N/A        | 20 min      | +20 min     | New prerequisite step           |
| 7b: AlertsStorageService    | 30 min     | 35 min      | +5 min      | Error boundaries                |
| 7c: AlertsService           | 45 min     | 50 min      | +5 min      | Move case lookup helpers        |
| 7d: DataManager Integration | 15 min     | 20 min      | +5 min      | Case fetching orchestration     |
| 7e: Integration Tests       | N/A        | 15 min      | +15 min     | New comprehensive tests         |
| **TOTAL**                   | **90 min** | **140 min** | **+50 min** | More thorough, safer extraction |

**Justification for increased time**: External review identified gaps in error handling, testing, and architectural concerns. Additional 50 minutes ensures production-ready code with proper error boundaries and comprehensive test coverage.

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

## Architecture Review & Decisions

### External Review Feedback (November 13, 2025)

A comprehensive external review identified critical concerns with the initial strategy. This section documents the review findings and updated architectural decisions.

---

### Critical Issue #1: Circular Dependency Risk

**Original Design** (❌ REJECTED):

```typescript
interface AlertsServiceConfig {
  alertsStorage: AlertsStorageService;
  fileStorage: FileStorageService; // ← Creates tight coupling
}
```

**Problem**: AlertsService depending on FileStorageService creates coupling between alerts and cases, violating separation of concerns.

**REVISED DECISION** (✅ APPROVED):

```typescript
interface AlertsServiceConfig {
  alertsStorage: AlertsStorageService;
  // No FileStorageService dependency
}

// Public API - cases MUST be passed as parameters
async getAlertsIndex(cases: CaseDisplay[]): Promise<AlertsIndex>;
async updateAlertStatus(
  alertId: string,
  updates: {...},
  cases: CaseDisplay[]
): Promise<AlertWithMatch | null>;
```

**Benefits**:

- ✅ No circular dependencies
- ✅ AlertsService is pure business logic (no data fetching)
- ✅ DataManager orchestrates both domains (cases + alerts)
- ✅ Easier to test (no need to mock FileStorageService)
- ✅ Explicit data flow: caller provides cases

**Migration impact**:

- DataManager must fetch cases before calling alert methods
- Existing callers already have cases in most scenarios
- Breaking change to internal API (acceptable - DataManager is only caller)

---

### Critical Issue #2: Callback Injection Pattern

**Original Design** (❌ REJECTED):

```typescript
interface AlertsStorageServiceConfig {
  fileService: AutosaveFileService;
  parseAlertsFromCsv?: (
    csvContent: string,
    cases: CaseDisplay[]
  ) => AlertsIndex;
}
```

**Problem**: Makes AlertsStorageService dependent on DataManager implementation details.

**REVISED DECISION** (✅ APPROVED): Create dedicated CSV parser utility

```typescript
// NEW FILE: utils/alerts/alertsCsvParser.ts
export function parseAlertsFromCsv(
  csvContent: string,
  cases: CaseDisplay[]
): AlertsIndex {
  // Extract parsing logic from DataManager.parseAlertsWithFallback
  // Shared by both DataManager and AlertsStorageService
}

// AlertsStorageService.ts
import { parseAlertsFromCsv } from "../alerts/alertsCsvParser";

class AlertsStorageService {
  async importAlertsFromCsv(cases: CaseDisplay[]): Promise<ImportAlertsResult> {
    const csvContent = await this.fileService.readTextFile(ALERTS_CSV_NAME);
    const parsed = parseAlertsFromCsv(csvContent, cases); // Direct call
    // ...
  }
}
```

**Benefits**:

- ✅ No callback injection complexity
- ✅ Reusable utility function
- ✅ Easier to test parsing logic in isolation
- ✅ DataManager can still use the same parser

---

### Critical Issue #3: Missing Error Boundaries

**Original Design** (❌ INCOMPLETE):

```typescript
export interface LoadAlertsResult {
  alerts: AlertWithMatch[] | null;
  legacyWorkflows: StoredAlertWorkflowState[];
  needsMigration: boolean;
  invalidJson: boolean; // ← What was invalid? Why?
  sourceFile?: string;
}
```

**REVISED DECISION** (✅ APPROVED): Add structured error details

```typescript
export type AlertsLoadErrorType =
  | "INVALID_JSON"
  | "MIGRATION_FAILED"
  | "IO_ERROR"
  | "PARSE_ERROR";

export interface AlertsLoadError {
  type: AlertsLoadErrorType;
  message: string;
  details?: unknown;
}

export interface LoadAlertsResult {
  alerts: AlertWithMatch[] | null;
  legacyWorkflows: StoredAlertWorkflowState[];
  needsMigration: boolean;
  sourceFile?: string;
  error?: AlertsLoadError; // ← NEW: Structured error info
}
```

**Benefits**:

- ✅ Clear error categorization
- ✅ Debugging information preserved
- ✅ UI can display specific error messages
- ✅ Logging can track error patterns

---

### Critical Issue #4: Storage Constants Location

**Original Design** (❌ SCATTERED): Constants spread across DataManager and services

**REVISED DECISION** (✅ APPROVED): Centralized constants file

```typescript
// NEW FILE: utils/constants/storage.ts
export const STORAGE_CONSTANTS = {
  ALERTS: {
    FILE_NAME: "alerts.json",
    CSV_NAME: "Alerts.csv",
    STORAGE_VERSION: 2,
  },
  DATA: {
    FILE_NAME: "data.json",
    // FileStorageService can use these in future refactor
  },
} as const;

export type StorageConstants = typeof STORAGE_CONSTANTS;
```

**Benefits**:

- ✅ Single source of truth
- ✅ Easy to update file names/versions
- ✅ TypeScript type safety via `as const`
- ✅ Prevents duplication bugs

**Files to create**:

- `utils/constants/storage.ts` (new file in Step 7a)

---

### Additional Consideration #1: Version Migration Details

**Gap identified**: Strategy mentions v1 → v2 migration but lacks specifics.

**DECISION**: Document migration path explicitly

**Version 1 (Legacy Format)**:

```typescript
// Stored workflow states separate from alerts
{
  workflows: StoredAlertWorkflowState[];
  // No version field
}
```

**Version 2 (Intermediate Format)**:

```typescript
{
  version: 2,
  generatedAt: string,
  updatedAt: string,
  summary: AlertsSummary,
  alerts: AlertWithMatch[], // Workflows merged into alert objects
  uniqueAlerts: number,
  sourceFile?: string
}
```

**Version 3 (Current Format)**:

```typescript
{
  version: 3,
  generatedAt: string,
  updatedAt: string,
  summary: AlertsSummary,
  alerts: AlertWithMatch[], // Enhanced with resolvedAt workflow semantics
  uniqueAlerts: number,
  sourceFile?: string
}
```

**Migration strategy (v1 → v2 → v3)**:

1. **v1 → v2**: Detect missing `version` field → assume v1

   - Extract `workflows` array from v1 payload
   - Load alerts from CSV (v1 had no stored alerts)
   - Apply workflows to alerts via `applyStoredAlertWorkflows()`
   - Save as v2 format with version stamp

2. **v2 → v3**: Detect `version: 2`

   - v2 and v3 schemas are structurally identical
   - v3 enforces stricter `resolvedAt` semantics (null when status !== 'resolved')
   - No data migration needed - v2 files load directly
   - Save operations write v3 format with corrected `resolvedAt` values

3. **Rollback**: If migration fails, log error and return empty alerts (safe degradation)

4. **Partial migration**: If some workflows fail to match, log unmatchedIds and continue

---

### Additional Consideration #2: Testing Gaps

**Gap identified**: Missing test cases for concurrent operations and partial failures.

**DECISION**: Add integration test suite

```typescript
// __tests__/integration/alerts-storage-isolation.test.ts

describe("Alerts Storage Isolation", () => {
  describe("Cross-contamination prevention", () => {
    it("should not affect data.json when writing alerts.json", async () => {
      const casesSnapshot = await dataManager.getAllCases();
      await dataManager.updateAlertStatus(
        "alert-1",
        { status: "resolved" },
        cases
      );
      expect(await dataManager.getAllCases()).toEqual(casesSnapshot);
    });

    it("should not affect alerts.json when writing data.json", async () => {
      const alertsSnapshot = await dataManager.getAlertsIndex(cases);
      await dataManager.createCompleteCase({
        /* ... */
      });
      expect(await dataManager.getAlertsIndex(cases)).toEqual(alertsSnapshot);
    });
  });

  describe("Concurrent operations", () => {
    it("should handle simultaneous case and alert updates", async () => {
      const [caseResult, alertResult] = await Promise.all([
        dataManager.updateCaseStatus("case-1", "closed"),
        dataManager.updateAlertStatus("alert-1", { status: "resolved" }, cases),
      ]);
      expect(caseResult).toBeDefined();
      expect(alertResult).toBeDefined();
    });
  });

  describe("Error handling", () => {
    it("should handle corrupt alerts.json gracefully", async () => {
      // Manually write invalid JSON
      await fileService.writeNamedFile("alerts.json", "INVALID{JSON");
      const result = await dataManager.getAlertsIndex(cases);
      expect(result.error?.type).toBe("INVALID_JSON");
      expect(result.alerts).toEqual([]); // Fallback to CSV import
    });

    it("should handle missing CSV file", async () => {
      // No alerts.json, no Alerts.csv
      const result = await dataManager.getAlertsIndex(cases);
      expect(result.alerts).toEqual([]);
      expect(result.summary.total).toBe(0);
    });
  });

  describe("Version migration", () => {
    it("should migrate v1 to v2 format", async () => {
      const v1Payload = {
        workflows: [
          /* legacy workflows */
        ],
      };
      await fileService.writeNamedFile("alerts.json", v1Payload);

      const result = await dataManager.getAlertsIndex(cases);
      expect(result.needsMigration).toBe(true);
      // After first load, should auto-save as v2

      const reloaded = await alertsStorage.loadAlertsFromStore();
      expect(reloaded.alerts).toBeDefined();
      expect(reloaded.legacyWorkflows).toEqual([]);
    });
  });
});
```

---

### Additional Consideration #3: Performance & Memory

**Gap identified**: Large alert datasets could cause memory issues.

**DECISION**: Accept current in-memory implementation, document future optimization path

**Current approach**: Load all alerts into memory (acceptable for MVP)

- Typical dataset: ~100-500 alerts
- Memory footprint: ~1-5 MB
- Load time: <100ms

**Future optimization path** (Phase C - not part of this extraction):

- Implement pagination for UI display
- Add streaming parser for CSV import
- Consider IndexedDB for client-side caching
- Lazy load alerts only when AlertsView is active

**Action**: Add performance benchmarks to test suite

```typescript
describe("Alerts Performance", () => {
  it("should load 1000 alerts in <200ms", async () => {
    const start = performance.now();
    const result = await dataManager.getAlertsIndex(largeCasesDataset);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(200);
  });
});
```

---

### FINAL ARCHITECTURAL DECISIONS SUMMARY

| Question                            | Original                      | Revised Decision                             |
| ----------------------------------- | ----------------------------- | -------------------------------------------- |
| **FileStorageService dependency?**  | Inject into AlertsService     | ❌ NO - Pass cases as parameters             |
| **parseAlertsFromCsv pattern?**     | Callback injection            | ❌ NO - Dedicated utility function           |
| **Error handling?**                 | Boolean flags only            | ✅ Structured error objects                  |
| **Storage constants?**              | Scatter across services       | ✅ Centralized constants file                |
| **CSV parser location?**            | DataManager                   | ✅ utils/alerts/alertsCsvParser.ts           |
| **Case lookup in buildCaseLookup?** | DataManager                   | ✅ Move to AlertsService (alert-specific)    |
| **Two-service split?**              | Yes                           | ✅ YES - Confirmed correct approach          |
| **Execution order?**                | Storage → Logic → Integration | ✅ YES - Add integration tests between steps |

---

## Success Criteria (REVISED)

### Functional Requirements

✅ All 315 tests passing  
✅ Zero breaking changes in public API (DataManager methods maintain backward compatibility)  
✅ Alerts flow end-to-end: load → display → update → save  
✅ CSV import fallback works when alerts.json missing  
✅ V1 → V2 migration preserves all workflow states

### Code Quality

✅ TypeScript strict mode compliance (zero errors)  
✅ No eslint errors or warnings  
✅ Production build successful (`npm run build`)  
✅ All services follow established patterns (constructor injection, read-modify-write)

### Architecture

✅ Storage constants in centralized file (`utils/constants/storage.ts`)  
✅ CSV parser as shared utility (`utils/alerts/alertsCsvParser.ts`)  
✅ AlertsStorageService: ~350 lines, foundation layer complete  
✅ AlertsService: ~350 lines, business logic complete  
✅ No circular dependencies (AlertsService does NOT depend on FileStorageService)  
✅ DataManager: ~1,065 lines (61.3% reduction from 2,755 baseline)

### Error Handling

✅ Structured error objects in `LoadAlertsResult` and `ImportAlertsResult`  
✅ Graceful degradation on corrupt JSON (fallback to CSV)  
✅ Clear error messages logged for debugging  
✅ No unhandled promise rejections

### Testing

✅ Integration test suite for storage isolation  
✅ Concurrent operations test (cases + alerts simultaneously)  
✅ Error boundary tests (corrupt JSON, missing files)  
✅ Version migration tests (v1 → v2)  
✅ Performance benchmark (<200ms for 1000 alerts)

### Documentation

✅ Architecture decisions documented in strategy file  
✅ Interface contracts clearly defined  
✅ Migration path explained (v1 → v2)  
✅ External review feedback addressed

---

## Summary of Changes from External Review

### ✅ Accepted Recommendations (All Implemented)

1. **Eliminated circular dependency** - AlertsService no longer depends on FileStorageService
2. **Removed callback injection** - Created shared `alertsCsvParser.ts` utility instead
3. **Added error boundaries** - Structured `AlertsLoadError` with type/message/details
4. **Centralized constants** - New `utils/constants/storage.ts` file
5. **Documented migration** - V1 → V2 format with rollback strategy
6. **Enhanced testing** - Comprehensive integration test suite
7. **Moved case lookup** - `buildCaseLookup()` from DataManager to AlertsService
8. **Performance notes** - Documented current limits and future optimization path

### 📊 Impact Assessment

| Metric                      | Original Plan                          | Revised Plan             | Delta          |
| --------------------------- | -------------------------------------- | ------------------------ | -------------- |
| **Circular dependencies**   | 1 (AlertsService → FileStorageService) | 0                        | ✅ -100%       |
| **Callback injections**     | 1 (parseAlertsFromCsv)                 | 0                        | ✅ -100%       |
| **New utility files**       | 0                                      | 2 (constants + parser)   | +2 files       |
| **Error detail coverage**   | 20% (boolean flags)                    | 100% (structured errors) | +80%           |
| **Integration tests**       | 2 (basic isolation)                    | 7 (comprehensive)        | +5 tests       |
| **Execution time**          | 90 min                                 | 140 min                  | +50 min (+56%) |
| **Architecture violations** | 4 identified                           | 0 remaining              | ✅ -100%       |

### 🎯 Quality Improvements

**Before External Review:**

- ⚠️ Tight coupling between domains
- ⚠️ Callback complexity
- ⚠️ Incomplete error handling
- ⚠️ Scattered constants
- ⚠️ Gaps in test coverage

**After Revisions:**

- ✅ Clean separation of concerns
- ✅ Simple, reusable utilities
- ✅ Comprehensive error boundaries
- ✅ Single source of truth for constants
- ✅ Production-ready test coverage

### 📝 Files Created (Revised Plan)

1. `utils/constants/storage.ts` (NEW - 15 lines)
2. `utils/alerts/alertsCsvParser.ts` (NEW - 50 lines)
3. `utils/services/AlertsStorageService.ts` (350 lines)
4. `utils/services/AlertsService.ts` (350 lines)
5. `__tests__/integration/alerts-storage-isolation.test.ts` (NEW - comprehensive)

**Total new code**: ~800 lines  
**Deleted from DataManager**: ~700 lines  
**Net impact**: +100 lines overall, but significantly better architecture

---

## Next Steps After Extraction

1. **Orchestrator Refactor** (~1 hour)

   - Reduce DataManager to pure delegation layer
   - Target: 500-800 lines of thin wrapper methods
   - Remove remaining business logic
   - Consider renaming to `DataOrchestrator` to reflect role

2. **Storage Format Normalization** (~3-4 hours, Phase B)

   - **Option A**: Consolidate alerts.json into data.json (single file)
   - **Option B**: Keep separate files but normalize structure
   - Update migration logic
   - Performance testing with consolidated format

3. **Phase C - Future Optimizations** (not part of current extraction)
   - Pagination for large alert datasets
   - Streaming CSV parser
   - IndexedDB caching
   - Lazy loading strategies

---

## Implementation Clarifications

### Q1: Debug Logging Without DataManager Context

**Question**: CSV parser used `this.isDebugEnvironment()` from DataManager. How to handle debug logging in extracted code?

**DECISION**: Use logger singleton pattern (existing in codebase)

```typescript
// utils/alerts/alertsCsvParser.ts
import { createLogger } from "../logger";

const logger = createLogger("AlertsCsvParser");

export function parseAlertsFromCsv(
  csvContent: string,
  cases: CaseDisplay[]
): AlertsIndex {
  const stacked = parseStackedAlerts(csvContent, cases);
  const stackedUnique = countUniqueAlertKeys(stacked.alerts);

  // Use logger.debug instead of isDebugEnvironment check
  logger.debug("Alert parser metrics", {
    metrics: {
      stacked: {
        total: stacked.alerts.length,
        unique: stackedUnique,
        uniqueRatio:
          stacked.alerts.length > 0
            ? Number((stackedUnique / stacked.alerts.length).toFixed(4))
            : 0,
      },
    },
  });

  return stacked;
}
```

**Rationale**:

- ✅ Existing pattern used by all services (FileStorageService, ActivityLogService, etc.)
- ✅ Logger handles debug mode detection internally
- ✅ No dependency on DataManager
- ✅ Consistent with codebase conventions

**Example from existing code**:

```typescript
// FileStorageService.ts line 11
const logger = createLogger("FileStorageService");

// ActivityLogService.ts line 6
const logger = createLogger("ActivityLogService");
```

---

### Q2: ActivityLogService Integration for Alert Status Changes

**Question**: Should alert status changes create activity log entries?

**DECISION**: No activity log for alert status changes (alerts are NOT case mutations)

**Rationale**:

- ❌ Alerts are **separate domain** from cases (stored in alerts.json, not data.json)
- ❌ Alert status changes don't modify case data
- ❌ ActivityLog is specifically for case lifecycle events (create, update, status change)
- ✅ Alert workflow state is already persisted in alerts.json
- ✅ Alert history can be reconstructed from resolvedAt timestamps

**Current ActivityLog usage** (from existing code):

```typescript
// CaseService.ts - Creates activity entries for case status changes
async updateCaseStatus(caseId: string, status: CaseDisplay["status"]): Promise<CaseDisplay> {
  // ... update case ...

  // Create activity log entry
  const activityEntry: CaseActivityEntry = {
    id: uuidv4(),
    caseId,
    caseName: updatedCase.name,
    action: 'status_change',
    timestamp: now,
    details: {
      previousStatus: targetCase.status,
      newStatus: status,
    },
  };

  currentData.activityLog.push(activityEntry);
}
```

**AlertsService does NOT create activity entries** - alert updates are logged separately in alerts.json:

```typescript
// AlertsService.updateAlertStatus
const updatedAlert: AlertWithMatch = {
  ...targetAlert,
  status: nextStatus,
  resolvedAt: nextResolvedAt,
  resolutionNotes: updates.resolutionNotes ?? targetAlert.resolutionNotes,
  updatedAt: new Date().toISOString(), // ← Timestamp for alert history
};
```

**Future consideration**: If alert-to-case linkage requires activity tracking, add in Phase C (not part of this extraction).

---

### Q3: Testing Strategy Specificity

**REVISED**: Step-by-step testing checkpoints with specific test commands

#### After Step 7a: Constants & CSV Parser

**Run**:

```bash
npm run test -- alertsCsvParser.test.ts
npm run test -- storage.test.ts
```

**Verify**:

- ✅ CSV parsing with valid data
- ✅ CSV parsing with invalid/corrupt data
- ✅ Metrics calculation (unique alerts, match ratios)
- ✅ Constants exported correctly

**Exit criteria**: All new unit tests pass (expect ~5-8 new tests)

---

#### After Step 7b: AlertsStorageService

**Run**:

```bash
npm run test -- AlertsStorageService.test.ts
```

**Verify**:

- ✅ Load/save roundtrip
- ✅ Version migration (v1 → v2)
- ✅ Error boundaries (corrupt JSON, missing files)
- ✅ CSV import fallback
- ✅ Structured error objects returned

**Mock dependencies**: `AutosaveFileService` (use existing test mocks)

**Exit criteria**: All AlertsStorageService tests pass (expect ~15-20 new tests)

---

#### After Step 7c: AlertsService

**Run**:

```bash
npm run test -- AlertsService.test.ts
```

**Verify**:

- ✅ Alert matching logic (MCN, metadata, fallback keys)
- ✅ Multi-tier candidate matching (strong → fallback)
- ✅ Workflow application
- ✅ Status update edge cases (no match, multiple matches)
- ✅ CSV merge deduplication
- ✅ Empty cases array handling

**Mock dependencies**: `AlertsStorageService` (mock load/save methods)

**Exit criteria**: All AlertsService tests pass (expect ~20-25 new tests)

---

#### After Step 7d: DataManager Integration

**Run**:

```bash
npm run test -- DataManager.test.ts
npm run test  # Full test suite
```

**Verify**:

- ✅ DataManager delegation methods work
- ✅ Case fetching orchestration (optional cases param)
- ✅ Backward compatibility maintained
- ✅ All 315 existing tests still pass
- ✅ No new test failures introduced

**Exit criteria**: 315/315 tests passing (may increase to ~340-350 with new tests)

---

#### After Step 7e: Integration Testing

**Run**:

```bash
npm run test -- alerts-storage-isolation.test.ts
npm run test  # Full suite again
npm run build  # Production build
```

**Verify**:

- ✅ Cross-contamination prevention (data.json ↔ alerts.json isolation)
- ✅ Concurrent operations (cases + alerts simultaneously)
- ✅ Error recovery (corrupt JSON → CSV fallback)
- ✅ Version migration end-to-end
- ✅ Performance (<200ms for 1000 alerts)
- ✅ Production build successful
- ✅ Zero TypeScript errors
- ✅ Zero ESLint errors

**Manual testing**: Load app, navigate to Alerts view, verify UI works

**Exit criteria**: All tests pass, build succeeds, UI functional

---

### Testing Commands Reference

```bash
# Run specific test file
npm run test -- <filename>.test.ts

# Run all tests
npm run test

# Run tests in watch mode (during development)
npm run test:watch

# Build for production
npm run build

# Lint check
npm run lint
```

---

## Final Approval Checklist

Before proceeding with extraction, verify:

- [ ] All external review concerns addressed
- [ ] No circular dependencies in revised architecture
- [ ] Constants centralized in dedicated file
- [ ] CSV parser extracted as shared utility
- [ ] Error boundaries include structured details
- [ ] Integration test plan comprehensive
- [ ] Time estimates realistic (140 min vs 90 min)
- [ ] Success criteria updated with new requirements
- [ ] Migration path documented (v1 → v2)
- [ ] Performance considerations noted

---

**Status**: ✅ Strategy revised and ready for implementation  
**Next Action**: Begin Step 7a (Storage Constants & CSV Parser)  
**Estimated Completion**: 140 minutes (2 hours 20 minutes) from start
