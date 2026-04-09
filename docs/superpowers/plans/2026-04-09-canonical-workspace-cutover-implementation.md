# Canonical Workspace Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely land the bridge-free application ownership slice by auto-upgrading persisted `2.1` workspaces to canonical `2.2` on open and by reusing case-status values directly for application records in this PR.

**Architecture:** Keep the migration upgrade explicit in the data layer, but invoke it automatically during the initial connection flow before normal runtime reads continue. Use the new `2.2` version boundary to prevent mixed `2.1` semantics, and collapse application status onto the existing case-status type for this slice so canonical application creation and status history stop depending on invalid cross-domain casts.

**Tech Stack:** React 18, TypeScript, Vitest, Sonner toasts, FileStorageService/DataManager, local-first file storage.

---

## Task 1: Lock The Cutover And Status Behavior In Tests

**Files:**

- Modify: `/workspaces/CMSNext/__tests__/services/FileStorageService.test.ts`
- Modify: `/workspaces/CMSNext/__tests__/utils/DataManager.test.ts`
- Modify: `/workspaces/CMSNext/domain/applications/__tests__/migration.test.ts`
- Create: `/workspaces/CMSNext/__tests__/hooks/useConnectionFlow.test.ts`

- [ ] **Step 1: Write the failing storage test for strict `2.2` canonical reads**

```ts
it("rejects persisted v2.1 workspaces during normal runtime reads until they are upgraded", async () => {
  vi.mocked(mockFileService.readFile).mockResolvedValue(
    migrateV20ToV21(createMockNormalizedFileDataV20()),
  );

  await expect(fileStorageService.readFileData()).rejects.toThrow(
    LegacyFormatError,
  );
});
```

- [ ] **Step 2: Run the focused FileStorageService test to verify it fails for the current code**

Run: `npm run test:run -- __tests__/services/FileStorageService.test.ts`
Expected: FAIL because the current runtime read path still accepts persisted `2.1`.

- [ ] **Step 3: Write the failing DataManager migration test for auto-upgrading the primary workspace to `2.2`**

```ts
it("migrates a persisted v2.1 workspace to persisted v2.2", async () => {
  const persistedV21 = migrateV20ToV21(createMockNormalizedFileDataV20());
  mockFileStorageService.readRawFileData.mockResolvedValue(persistedV21);

  const result = await dataManager.migrateWorkspaceToV22();

  expect(result.summary.migrated).toBe(1);
  expect(mockFileStorageService.writeNormalizedData).toHaveBeenCalledWith(
    expect.objectContaining({ version: "2.2" }),
  );
});
```

- [ ] **Step 4: Write the failing hook test for the one-time upgrade notice on connect**

```ts
it("shows a one-time upgrade toast before loading cases when the workspace is migrated", async () => {
  mockDataManager.migrateWorkspaceToV22.mockResolvedValue({
    processedAt: "2026-04-09T00:00:00.000Z",
    files: [],
    summary: {
      migrated: 1,
      alreadyV21: 0,
      failed: 0,
      skipped: 0,
    },
  });

  await result.current.handleConnectionComplete();

  expect(toast.info).toHaveBeenCalledWith(
    "Workspace upgraded to v2.2",
    expect.any(Object),
  );
  expect(mockLoadCases).toHaveBeenCalled();
});
```

- [ ] **Step 5: Write the failing migration-domain test for shared case/application status ownership**

```ts
it("creates canonical applications using the case-status value directly", () => {
  const application = createCanonicalApplication({
    applicationId: "application-1",
    initialHistoryId: "history-1",
    caseId: "case-1",
    applicantPersonId: "person-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    caseRecord: {
      applicationDate: "2026-04-09",
      applicationType: "Renewal",
      withWaiver: false,
      retroRequested: "",
      appValidated: false,
      retroMonths: [],
      agedDisabledVerified: false,
      citizenshipVerified: false,
      residencyVerified: false,
      avsConsentDate: "",
      voterFormStatus: "",
      intakeCompleted: true,
      status: "Active",
    },
  });

  expect(application.status).toBe("Active");
  expect(application.statusHistory[0]?.status).toBe("Active");
});
```

- [ ] **Step 6: Run the focused red test set and verify it fails for the current implementation**

Run: `npm run test:run -- __tests__/services/FileStorageService.test.ts __tests__/utils/DataManager.test.ts domain/applications/__tests__/migration.test.ts __tests__/hooks/useConnectionFlow.test.ts`
Expected: FAIL because runtime `2.1` still reads successfully, migration still targets `2.1`, the hook does not emit an upgrade notice, and application status still depends on the old separate type.

- [ ] **Step 7: Commit the red tests**

```bash
git add __tests__/services/FileStorageService.test.ts __tests__/utils/DataManager.test.ts domain/applications/__tests__/migration.test.ts __tests__/hooks/useConnectionFlow.test.ts
git commit -m "test: lock workspace cutover behavior"
```

## Task 2: Introduce Canonical Persisted Version `2.2`

**Files:**

- Modify: `/workspaces/CMSNext/utils/storageV21Migration.ts`
- Modify: `/workspaces/CMSNext/utils/workspaceV21Migration.ts`
- Modify: `/workspaces/CMSNext/utils/legacyMigration.ts`

- [ ] **Step 1: Add persisted/runtime `2.2` types and a dedicated `v2.1 -> v2.2` upgrade function**

```ts
export interface PersistedNormalizedFileDataV22 {
  version: "2.2";
  people: StoredPerson[];
  cases: PersistedCase[];
  applications?: Application[];
  financials: StoredFinancialItem[];
  notes: StoredNote[];
  alerts: AlertRecord[];
  exported_at: string;
  total_cases: number;
  categoryConfig: CategoryConfig;
  activityLog: CaseActivityEntry[];
  templates?: Template[];
}

export interface RuntimeNormalizedFileDataV22 {
  version: "2.2";
  people: Person[];
  cases: StoredCase[];
  applications?: Application[];
  financials: StoredFinancialItem[];
  notes: StoredNote[];
  alerts: AlertRecord[];
  exported_at: string;
  total_cases: number;
  categoryConfig: CategoryConfig;
  activityLog: CaseActivityEntry[];
  templates?: Template[];
}

export function migrateV21ToV22(
  data: PersistedNormalizedFileDataV21,
): PersistedNormalizedFileDataV22 {
  const hydrated = hydrateNormalizedData(data);
  const synced = syncRuntimeApplications(hydrated, {
    preferRuntimeCaseFields: true,
    syncMode: "full",
  });

  return {
    ...dehydrateNormalizedData({
      ...hydrated,
      version: "2.2",
      applications: synced.applications,
    }),
    version: "2.2",
  };
}
```

- [ ] **Step 2: Update the canonical runtime serializer and validators to target `2.2` only**

```ts
export function isPersistedNormalizedFileDataV22(
  data: unknown,
): data is PersistedNormalizedFileDataV22 {
  const candidate = toNormalizedDataShapeCandidate(data);

  return (
    candidate?.version === "2.2" &&
    Array.isArray(candidate.people) &&
    hasNormalizedCollectionsAndMetadata(candidate)
  );
}

export function dehydrateNormalizedData(
  data: RuntimeNormalizedFileDataV22,
): PersistedNormalizedFileDataV22 {
  return {
    version: "2.2",
    people: persistedPeople,
    cases: data.cases.map((caseItem) => dehydrateStoredCase(caseItem)),
    applications: (data.applications ?? []).map(normalizePersistedApplication),
    financials: data.financials.map((financial) => ({ ...financial })),
    notes: data.notes.map((note) => ({ ...note })),
    alerts: data.alerts.map((alert) => ({ ...alert })),
    exported_at: data.exported_at,
    total_cases: data.total_cases,
    categoryConfig: data.categoryConfig,
    activityLog: data.activityLog.map((entry) => ({ ...entry })),
    templates: data.templates ? [...data.templates] : undefined,
  };
}
```

- [ ] **Step 3: Make the explicit migration utilities target `2.2` as the current canonical version**

```ts
export function validatePersistedV22Data(data: unknown): {
  counts: WorkspaceMigrationCounts;
  validationErrors: string[];
} {
  // same structural validation as today, but expect version "2.2"
}

export function buildPersistedArchiveDataV22(
  archiveData: CaseArchiveData,
): PersistedCaseArchiveDataV22 {
  const persistedData = dehydrateNormalizedData(runtimeNormalizedData);
  return {
    ...persistedData,
    version: "2.2",
    archiveType: "cases",
    archiveYear: archiveData.archiveYear,
    archivedAt: archiveData.archivedAt,
  };
}
```

- [ ] **Step 4: Run the focused storage and migration tests to verify the new version boundary passes**

Run: `npm run test:run -- __tests__/services/FileStorageService.test.ts __tests__/utils/DataManager.test.ts __tests__/utils/workspaceV21Migration.test.ts __tests__/utils/legacyMigration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the version-cutover layer**

```bash
git add utils/storageV21Migration.ts utils/workspaceV21Migration.ts utils/legacyMigration.ts __tests__/services/FileStorageService.test.ts __tests__/utils/DataManager.test.ts __tests__/utils/workspaceV21Migration.test.ts __tests__/utils/legacyMigration.test.ts
git commit -m "refactor: cut over canonical workspace to v2.2"
```

## Task 3: Auto-Upgrade `2.1` Workspaces On Open

**Files:**

- Modify: `/workspaces/CMSNext/utils/DataManager.ts`
- Modify: `/workspaces/CMSNext/hooks/useConnectionFlow.ts`
- Modify: `/workspaces/CMSNext/components/diagnostics/WorkspaceMigrationPanel.tsx`
- Modify: `/workspaces/CMSNext/__tests__/hooks/useConnectionFlow.test.ts`
- Modify: `/workspaces/CMSNext/__tests__/components/diagnostics/WorkspaceMigrationPanel.test.tsx`

- [ ] **Step 1: Replace the current `migrateWorkspaceToV21` entrypoint with `migrateWorkspaceToV22` and migrate `2.1` in the primary workspace path**

```ts
async migrateWorkspaceToV22(): Promise<WorkspaceMigrationReport> {
  const files: WorkspaceMigrationFileReport[] = [];
  files.push(await this.migratePrimaryWorkspaceFile());
  return buildWorkspaceMigrationReport(files);
}

private async migratePrimaryWorkspaceFile(): Promise<WorkspaceMigrationFileReport> {
  const rawData = await this.fileStorage.readRawFileData();

  if (isPersistedNormalizedFileDataV22(rawData)) {
    return {
      fileName: MAIN_WORKSPACE_FILE_NAME,
      fileKind: "workspace",
      disposition: "already-current",
      sourceVersion: rawData.version,
      counts: summarizePersistedCounts(rawData),
      validationErrors: [],
      message: "Already persisted as v2.2.",
    };
  }

  if (isPersistedNormalizedFileDataV21(rawData)) {
    const migratedData = migrateV21ToV22(rawData);
    await this.fileStorage.writeNormalizedData(hydrateNormalizedData(migratedData));
    return {
      fileName: MAIN_WORKSPACE_FILE_NAME,
      fileKind: "workspace",
      disposition: "migrated",
      sourceVersion: rawData.version,
      counts: summarizePersistedCounts(migratedData),
      validationErrors: [],
      message: "Migrated workspace file to persisted v2.2.",
    };
  }

  if (isPersistedNormalizedFileDataV20(rawData)) {
    const migratedData = migrateV21ToV22(migrateV20ToV21(rawData));
    await this.fileStorage.writeNormalizedData(hydrateNormalizedData(migratedData));
    return {
      fileName: MAIN_WORKSPACE_FILE_NAME,
      fileKind: "workspace",
      disposition: "migrated",
      sourceVersion: rawData.version,
      counts: summarizePersistedCounts(migratedData),
      validationErrors: [],
      message: "Migrated workspace file to persisted v2.2.",
    };
  }

  // keep the existing failure branch
}
```

- [ ] **Step 2: Invoke the migration automatically during initial connection before `loadCases()` and show a one-time notice when a migration happened**

```ts
const migrationReport = dataManager
  ? await dataManager.migrateWorkspaceToV22()
  : null;

if (migrationReport?.summary.migrated) {
  toast.info("Workspace upgraded to v2.2", {
    id: "workspace-upgraded",
    description:
      "Your saved data was upgraded to the new canonical workspace format.",
  });
}

const loadedCases = await loadCases();
```

- [ ] **Step 3: Update the diagnostics panel to reflect the new current-version migration action**

```tsx
const migrationReport = await dataManager.migrateWorkspaceToV22();

<Button onClick={handleMigrateWorkspace}>Upgrade Workspace To v2.2</Button>;
```

- [ ] **Step 4: Run the focused startup and diagnostics tests to verify auto-upgrade and notice behavior**

Run: `npm run test:run -- __tests__/hooks/useConnectionFlow.test.ts __tests__/components/diagnostics/WorkspaceMigrationPanel.test.tsx __tests__/utils/DataManager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the automatic upgrade flow**

```bash
git add utils/DataManager.ts hooks/useConnectionFlow.ts components/diagnostics/WorkspaceMigrationPanel.tsx __tests__/hooks/useConnectionFlow.test.ts __tests__/components/diagnostics/WorkspaceMigrationPanel.test.tsx __tests__/utils/DataManager.test.ts
git commit -m "feat: auto-upgrade v2.1 workspaces on open"
```

## Task 4: Reuse Case Status Directly For Applications In This Slice

**Files:**

- Modify: `/workspaces/CMSNext/types/application.ts`
- Modify: `/workspaces/CMSNext/domain/applications/migration.ts`
- Modify: `/workspaces/CMSNext/utils/storageV21Migration.ts`
- Modify: `/workspaces/CMSNext/domain/applications/__tests__/migration.test.ts`
- Modify: `/workspaces/CMSNext/__tests__/services/CaseService.test.ts`

- [ ] **Step 1: Collapse the separate application-status type onto `CaseStatus` for this slice**

```ts
import type { CaseStatus, VoterFormStatus } from "@/types/case";

export type ApplicationStatus = CaseStatus;

export interface ApplicationStatusHistory {
  id: string;
  status: ApplicationStatus;
  effectiveDate: string;
  changedAt: string;
  source: ApplicationStatusHistorySource;
  notes?: string;
}
```

- [ ] **Step 2: Remove the unsafe status cast from canonical application creation and status sync helpers**

```ts
export function createCanonicalApplication(
  input: CreateCanonicalApplicationInput,
): Application {
  const applicationFields = pickApplicationOwnedCaseRecordFields(
    input.caseRecord,
  );
  const status = input.caseRecord.status;

  return {
    id: input.applicationId,
    caseId: input.caseId,
    applicantPersonId: input.applicantPersonId,
    applicationDate: applicationFields.applicationDate,
    applicationType: applicationFields.applicationType,
    status,
    statusHistory: [
      {
        id: input.initialHistoryId,
        status,
        effectiveDate: applicationFields.applicationDate,
        changedAt: input.createdAt,
        source: "user",
      },
    ],
    // remainder unchanged
  };
}
```

- [ ] **Step 3: Normalize the v2.0 migration path and runtime sync path around the shared status type**

```ts
function syncApplicationWithCase(
  caseItem: StoredCase,
  existingApplication: Application | null,
  timestamp: string,
  syncMode: RuntimeApplicationSyncMode = "full",
): { application: Application; hasChanged: boolean } {
  const sourceCaseRecord = createApplicationSourceCase(caseItem);
  const nextStatus = sourceCaseRecord.status;

  // existing logic, but no ApplicationStatus cast
}
```

- [ ] **Step 4: Run the focused status tests to verify canonical creation and status history now share the case-status type**

Run: `npm run test:run -- domain/applications/__tests__/migration.test.ts __tests__/services/CaseService.test.ts __tests__/utils/storageV21Migration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the transitional status alignment**

```bash
git add types/application.ts domain/applications/migration.ts utils/storageV21Migration.ts domain/applications/__tests__/migration.test.ts __tests__/services/CaseService.test.ts __tests__/utils/storageV21Migration.test.ts
git commit -m "refactor: reuse case statuses for applications"
```

## Task 5: Update Documentation And Re-Validate The PR

**Files:**

- Modify: `/workspaces/CMSNext/README.md`
- Modify: `/workspaces/CMSNext/docs/development/feature-catalogue.md`
- Modify: `/workspaces/CMSNext/docs/development/ROADMAP_APR_2026.md`
- Modify: `/workspaces/CMSNext/docs/superpowers/plans/2026-04-09-remove-application-migration-bridge.md`

- [ ] **Step 1: Update documentation to say canonical bridge-free workspaces are persisted as `2.2` and that application status temporarily reuses case-status values**

```md
Persisted v2.2 data is the canonical bridge-free workspace format. Persisted v2.1 workspaces are upgraded automatically on open before normal runtime operations continue.

For this slice, application records reuse the same status vocabulary as case records. A follow-up slice will move both record types onto the fully configurable shared status namespace.
```

- [ ] **Step 2: Refresh the older bridge-removal plan so it points at the approved cutover spec rather than the superseded versionless approach**

```md
This implementation now proceeds under `docs/superpowers/specs/2026-04-09-canonical-workspace-cutover-design.md`, which introduces the persisted `2.2` cutover and the transitional shared case-status approach for application records.
```

- [ ] **Step 3: Run full validation**

Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run test:run`
Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit the docs and validation pass**

```bash
git add README.md docs/development/feature-catalogue.md docs/development/ROADMAP_APR_2026.md docs/superpowers/plans/2026-04-09-remove-application-migration-bridge.md
git commit -m "docs: document canonical v2.2 cutover"
```
