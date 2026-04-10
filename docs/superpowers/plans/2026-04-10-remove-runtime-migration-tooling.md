# Remove Runtime Migration Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all live workspace and archive migration behavior from CMSNext runtime flows so only canonical persisted v2.2 files are supported, while leaving a dormant internal schema-evolution boundary for future v2.3 work.

**Architecture:** The runtime path becomes strict persisted-v2.2-only for both workspace and archive files. Migration UI, Settings/devtools entrypoints, DataManager orchestration, and archive upgrade behavior are removed. A new internal `utils/migrations/` scaffold replaces the old live migration surface without being wired into runtime or UI flows.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, React Testing Library, jest-axe, shadcn/ui, local-first File System Access architecture.

---

## File Structure Map

### Delete

- `components/modals/WorkspaceUpgradeNoticeModal.tsx`
- `components/diagnostics/WorkspaceMigrationPanel.tsx`
- `utils/workspaceV21Migration.ts`
- `__tests__/components/modals/WorkspaceUpgradeNoticeModal.test.tsx`
- `__tests__/components/diagnostics/WorkspaceMigrationPanel.test.tsx`
- `__tests__/utils/workspaceV21Migration.test.ts`

### Create

- `utils/migrations/schemaRunner.ts`
- `__tests__/utils/migrations/schemaRunner.test.ts`

### Rename / Replace

- Replace `utils/storageV21Migration.ts` with a v2.2-named canonical storage helper module such as `utils/persistedV22Storage.ts`
- Replace `__tests__/utils/storageV21Migration.test.ts` with `__tests__/utils/persistedV22Storage.test.ts`

### Modify

- `hooks/useConnectionFlow.ts`
- `components/app/AppContent.tsx`
- `components/app/Settings.tsx`
- `utils/featureFlags.ts`
- `utils/DataManager.ts`
- `utils/services/FileStorageService.ts`
- `utils/services/CaseArchiveService.ts`
- `utils/services/CaseService.ts`
- `utils/services/CaseBulkOperationsService.ts`
- `utils/MockFileService.ts`
- `utils/legacyMigration.ts` or delete it if left unused
- `__tests__/hooks/useConnectionFlow.test.ts`
- `__tests__/services/FileStorageService.test.ts`
- `__tests__/utils/DataManager.test.ts`
- `__tests__/utils/featureFlags.test.ts`
- `__tests__/utils/legacyMigration.test.ts` or delete it if the module is deleted
- docs that still describe migration as a live feature

---

### Task 1: Remove Connection-Time Migration And Upgrade UI

**Files:**

- Modify: `hooks/useConnectionFlow.ts`
- Modify: `components/app/AppContent.tsx`
- Delete: `components/modals/WorkspaceUpgradeNoticeModal.tsx`
- Test: `__tests__/hooks/useConnectionFlow.test.ts`
- Delete: `__tests__/components/modals/WorkspaceUpgradeNoticeModal.test.tsx`

- [ ] **Step 1: Write failing hook assertions for the new connection contract**

```ts
it("loads cases without invoking migration tooling", async () => {
  const loadCases = vi
    .fn()
    .mockResolvedValue([createMockStoredCase({ id: "case-1" })]);
  const setCases = vi.fn();
  const setError = vi.fn();
  const setHasLoadedData = vi.fn();
  const markWorkspaceReady = vi.fn();

  const { result } = renderHook(() =>
    useConnectionFlow({
      isSupported: true,
      hasLoadedData: false,
      connectionState: createMockFileStorageLifecycleSelectors(),
      service: null,
      fileStorageService: null,
      dataManager: null,
      loadCases,
      setCases,
      setError,
      setHasLoadedData,
      markWorkspaceReady,
    }),
  );

  await act(async () => {
    await result.current.handleConnectionComplete();
  });

  expect(loadCases).toHaveBeenCalledTimes(1);
  expect(markWorkspaceReady).toHaveBeenCalledTimes(1);
  expect(result.current).not.toHaveProperty("workspaceUpgradeNoticeKind");
});
```

- [ ] **Step 2: Run the focused hook test to verify it fails against the current migration-aware implementation**

Run: `npm run test:run -- __tests__/hooks/useConnectionFlow.test.ts`
Expected: FAIL because the hook still references `migrateWorkspaceToV22` and upgrade-notice state.

- [ ] **Step 3: Remove migration and modal state from the hook and app shell**

```ts
// hooks/useConnectionFlow.ts
interface UseConnectionFlowResult {
  showConnectModal: boolean;
  handleConnectionComplete: () => void | Promise<void>;
  dismissConnectModal: () => void;
}

const handleConnectionComplete = useCallback(async () => {
  try {
    const loadedCases = await loadCases();
    markWorkspaceReady();
    setCases(loadedCases);
    setHasLoadedData(true);
    setDismissedModalKey(null);
    setError(null);

    if (service && !service.getStatus().isRunning) {
      setTimeout(() => service.startAutosave(), 500);
    }

    toast.success(
      loadedCases.length > 0
        ? `Connected and loaded ${loadedCases.length} cases`
        : "Connected successfully - ready to start!",
      { id: "connection-success" },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const connectionErrorMessage = `Failed to complete workspace connection: ${message}`;
    setError(connectionErrorMessage);
    toast.error(connectionErrorMessage, { id: "connection-error" });
  }
}, [
  loadCases,
  markWorkspaceReady,
  service,
  setCases,
  setError,
  setHasLoadedData,
]);
```

```tsx
// components/app/AppContent.tsx
const { showConnectModal, handleConnectionComplete, dismissConnectModal } =
  useConnectionFlow({
    isSupported,
    hasLoadedData,
    connectionState,
    service,
    fileStorageService,
    dataManager,
    loadCases,
    setCases,
    setError,
    setHasLoadedData,
    markWorkspaceReady,
  });

return (
  <Profiler id="AppContent" onRender={handleAppRenderProfile}>
    <AppContentView {...appContentViewProps} />
  </Profiler>
);
```

- [ ] **Step 4: Delete the upgrade modal component and its test file**

Run:

```bash
rm /workspaces/CMSNext/components/modals/WorkspaceUpgradeNoticeModal.tsx
rm /workspaces/CMSNext/__tests__/components/modals/WorkspaceUpgradeNoticeModal.test.tsx
```

Expected: The repository no longer contains the transition-only modal surface.

- [ ] **Step 5: Re-run the focused connection tests**

Run: `npm run test:run -- __tests__/hooks/useConnectionFlow.test.ts`
Expected: PASS with no migration calls and no upgrade-notice assertions remaining.

- [ ] **Step 6: Commit the UI/runtime-load cleanup**

```bash
git add hooks/useConnectionFlow.ts components/app/AppContent.tsx __tests__/hooks/useConnectionFlow.test.ts
git rm components/modals/WorkspaceUpgradeNoticeModal.tsx __tests__/components/modals/WorkspaceUpgradeNoticeModal.test.tsx
git commit -m "refactor: remove runtime workspace upgrade UI"
```

---

### Task 2: Remove Settings And Diagnostics Migration Surfaces

**Files:**

- Modify: `components/app/Settings.tsx`
- Modify: `utils/featureFlags.ts`
- Delete: `components/diagnostics/WorkspaceMigrationPanel.tsx`
- Delete: `components/diagnostics/LegacyMigrationPanel.tsx` if no non-runtime migration purpose remains
- Modify: `__tests__/utils/featureFlags.test.ts`
- Delete or replace: `__tests__/components/diagnostics/WorkspaceMigrationPanel.test.tsx`

- [ ] **Step 1: Write failing tests that assert migration controls are gone from Settings and feature flags**

```ts
it("does not expose a settings.legacyMigration flag", () => {
  const flags = createFeatureFlagContext();

  expect(flags).not.toHaveProperty("settings.legacyMigration");
});
```

```tsx
it("does not render migration panels in storage settings", async () => {
  render(<Settings cases={[]} />);

  expect(screen.queryByText(/Workspace Migration/i)).toBeNull();
  expect(screen.queryByText(/Legacy Migration/i)).toBeNull();
});
```

- [ ] **Step 2: Run the focused Settings and feature flag tests to verify failure**

Run: `npm run test:run -- __tests__/utils/featureFlags.test.ts __tests__/components/app/Settings.test.tsx`
Expected: FAIL because Settings still imports migration panels and feature flags still include `settings.legacyMigration`.

- [ ] **Step 3: Remove Settings wiring and the migration feature flag**

```tsx
// components/app/Settings.tsx
import FileStorageSettings from "../diagnostics/FileStorageSettings";
import { FileStorageDiagnostics } from "../diagnostics/FileStorageDiagnostics";

const showDevTools = featureFlags["settings.devTools"] ?? false;

<TabsContent value="storage" className="space-y-6">
  <div className="grid gap-6">
    <FileStorageSettings />
    <FileStorageDiagnostics />
    <Card>{/* storage information card */}</Card>
  </div>
</TabsContent>;
```

```ts
// utils/featureFlags.ts
export interface FeatureFlags {
  "dashboard.widgets.casePriority": boolean;
  "dashboard.widgets.alertsCleared": boolean;
  "dashboard.widgets.casesProcessed": boolean;
  "dashboard.widgets.activityTimeline": boolean;
  "dashboard.widgets.casesByStatus": boolean;
  "dashboard.widgets.alertsByDescription": boolean;
  "dashboard.widgets.avgAlertAge": boolean;
  "dashboard.widgets.avgCaseProcessing": boolean;
  "dashboard.widgets.todaysWork": boolean;
  "dashboard.widgets.dailyStats": boolean;
  "dashboard.widgets.recentCases": boolean;
  "dashboard.widgets.pinnedCases": boolean;
  "reports.advancedFilters": boolean;
  "alerts.advancedFilters": boolean;
  "cases.bulkActions": boolean;
  "settings.devTools": boolean;
}
```

- [ ] **Step 4: Delete migration-only diagnostics components and tests**

Run:

```bash
rm /workspaces/CMSNext/components/diagnostics/WorkspaceMigrationPanel.tsx
rm /workspaces/CMSNext/__tests__/components/diagnostics/WorkspaceMigrationPanel.test.tsx
```

If `LegacyMigrationPanel.tsx` remains migration-only after import cleanup, also run:

```bash
rm /workspaces/CMSNext/components/diagnostics/LegacyMigrationPanel.tsx
rm /workspaces/CMSNext/__tests__/utils/legacyMigration.test.ts
```

- [ ] **Step 5: Re-run the focused Settings and feature flag tests**

Run: `npm run test:run -- __tests__/utils/featureFlags.test.ts __tests__/components/app/Settings.test.tsx`
Expected: PASS with no migration controls or flags remaining.

- [ ] **Step 6: Commit the product-surface removal**

```bash
git add components/app/Settings.tsx utils/featureFlags.ts __tests__/utils/featureFlags.test.ts __tests__/components/app/Settings.test.tsx
git rm components/diagnostics/WorkspaceMigrationPanel.tsx __tests__/components/diagnostics/WorkspaceMigrationPanel.test.tsx
git commit -m "refactor: remove migration settings and diagnostics"
```

---

### Task 3: Remove DataManager Migration Orchestration And Make Archive Reads Strict

**Files:**

- Modify: `utils/DataManager.ts`
- Modify: `utils/services/CaseArchiveService.ts`
- Modify: `utils/services/FileStorageService.ts`
- Delete: `utils/workspaceV21Migration.ts`
- Modify: `__tests__/utils/DataManager.test.ts`
- Modify: `__tests__/services/FileStorageService.test.ts`
- Create: `__tests__/services/CaseArchiveService.loadArchive.test.ts`

- [ ] **Step 1: Write failing tests for strict archive behavior and missing DataManager migration APIs**

```ts
it("rejects legacy archive payloads instead of upgrading them", async () => {
  (mockFileService.readNamedFile as ReturnType<typeof vi.fn>).mockResolvedValue(
    { version: "2.1" },
  );

  await expect(
    archiveService.loadArchivedCases("archived-cases-2026.json"),
  ).rejects.toThrow(LegacyFormatError);
});
```

```ts
it("does not expose migrateWorkspaceToV22 on DataManager", () => {
  expect("migrateWorkspaceToV22" in dataManager).toBe(false);
  expect("migrateWorkspaceToV21" in dataManager).toBe(false);
});
```

- [ ] **Step 2: Run the focused storage and orchestration tests to verify failure**

Run: `npm run test:run -- __tests__/services/FileStorageService.test.ts __tests__/utils/DataManager.test.ts`
Expected: FAIL because DataManager still exposes migration methods and archive logic still imports migration helpers.

- [ ] **Step 3: Remove DataManager migration methods and tighten archive loading**

```ts
// utils/DataManager.ts
// Delete migrateWorkspaceToV22 and migrateWorkspaceToV21 entirely.
// Keep readRawFileData only if another active non-runtime tool still needs it.
```

```ts
// utils/services/CaseArchiveService.ts
import {
  buildPersistedArchiveDataV22,
  hydratePersistedArchiveDataV22,
  isPersistedCaseArchiveDataV22,
} from "@/utils/persistedV22Storage";

async loadArchivedCases(fileName: string): Promise<CaseArchiveData | null> {
  const rawData = await this.fileService.readNamedFile(fileName);
  if (!rawData) {
    return null;
  }

  if (!isPersistedCaseArchiveDataV22(rawData)) {
    throw new LegacyFormatError("v2.1 or older archive format");
  }

  return hydratePersistedArchiveDataV22(rawData);
}
```

```ts
// utils/services/FileStorageService.ts
constructor(detectedFormat: string) {
  const message = detectedFormat.startsWith("invalid v2.2 format")
    ? `This workspace file is not in a valid canonical v${NORMALIZED_VERSION} format.`
    : "This workspace is using an outdated schema (v2.1 or older). To load this file, it must be upgraded using a previous version of CMSNext.";

  super(message);
  this.name = "LegacyFormatError";
}
```

- [ ] **Step 4: Delete the migration orchestration module**

Run:

```bash
rm /workspaces/CMSNext/utils/workspaceV21Migration.ts
rm /workspaces/CMSNext/__tests__/utils/workspaceV21Migration.test.ts
```

- [ ] **Step 5: Replace migration-oriented DataManager tests with strict-runtime tests**

```ts
// __tests__/utils/DataManager.test.ts
describe("runtime storage surface", () => {
  it("still exposes readRawFileData only when explicitly needed by non-runtime callers", async () => {
    const rawData = { version: "2.2", cases: [] };
    (
      mockFileStorageService.readRawFileData as ReturnType<typeof vi.fn>
    ).mockResolvedValue(rawData);

    await expect(dataManager.readRawFileData()).resolves.toEqual(rawData);
  });
});
```

- [ ] **Step 6: Re-run the focused storage and orchestration tests**

Run: `npm run test:run -- __tests__/services/FileStorageService.test.ts __tests__/utils/DataManager.test.ts __tests__/services/CaseArchiveService.loadArchive.test.ts`
Expected: PASS with strict workspace/archive behavior and no migration orchestration methods remaining.

- [ ] **Step 7: Commit the orchestration and archive strictness cleanup**

```bash
git add utils/DataManager.ts utils/services/CaseArchiveService.ts utils/services/FileStorageService.ts __tests__/utils/DataManager.test.ts __tests__/services/FileStorageService.test.ts __tests__/services/CaseArchiveService.loadArchive.test.ts
git rm utils/workspaceV21Migration.ts __tests__/utils/workspaceV21Migration.test.ts
git commit -m "refactor: remove runtime workspace migration orchestration"
```

---

### Task 4: Replace The V2.1-Named Storage Helper Surface And Add The Future Stub Boundary

**Files:**

- Create: `utils/migrations/schemaRunner.ts`
- Test: `__tests__/utils/migrations/schemaRunner.test.ts`
- Replace: `utils/storageV21Migration.ts` with `utils/persistedV22Storage.ts`
- Replace: `__tests__/utils/storageV21Migration.test.ts` with `__tests__/utils/persistedV22Storage.test.ts`
- Modify: `utils/services/CaseService.ts`
- Modify: `utils/services/CaseBulkOperationsService.ts`
- Modify: `utils/MockFileService.ts`
- Modify: imports in `utils/DataManager.ts` and `utils/services/FileStorageService.ts`

- [ ] **Step 1: Write failing tests for the new canonical-storage and future-stub modules**

```ts
it("hydrates and dehydrates canonical persisted v2.2 data", () => {
  const runtimeData = createMockNormalizedFileData();
  const persisted = dehydrateNormalizedData(runtimeData);
  const hydrated = hydrateNormalizedData(persisted);

  expect(persisted.version).toBe("2.2");
  expect(hydrated.version).toBe("2.2");
});
```

```ts
it("runs no transforms when no schema transforms are registered", () => {
  const result = runSchemaTransforms({
    currentVersion: "2.2",
    targetVersion: "2.3",
    data: { version: "2.2" },
    transforms: [],
  });

  expect(result.applied).toEqual([]);
  expect(result.data).toEqual({ version: "2.2" });
});
```

- [ ] **Step 2: Run the focused canonical-storage and schema-runner tests to verify failure**

Run: `npm run test:run -- __tests__/utils/storageV21Migration.test.ts`
Expected: FAIL once the new module names are introduced by the test updates.

- [ ] **Step 3: Create the new canonical-storage module and future schema runner**

```ts
// utils/migrations/schemaRunner.ts
export interface SchemaTransform<TData> {
  fromVersion: string;
  toVersion: string;
  apply: (data: TData) => TData;
}

export interface RunSchemaTransformsOptions<TData> {
  currentVersion: string;
  targetVersion: string;
  data: TData;
  transforms: SchemaTransform<TData>[];
}

export function runSchemaTransforms<TData>({
  data,
  transforms,
}: RunSchemaTransformsOptions<TData>) {
  let nextData = data;
  const applied: Array<{ fromVersion: string; toVersion: string }> = [];

  for (const transform of transforms) {
    nextData = transform.apply(nextData);
    applied.push({
      fromVersion: transform.fromVersion,
      toVersion: transform.toVersion,
    });
  }

  return { data: nextData, applied };
}
```

```ts
// utils/persistedV22Storage.ts
export {
  dehydrateNormalizedData,
  hydrateNormalizedData,
  isPersistedNormalizedFileDataV22,
  normalizePersistedApplication,
} from "./storageV21Migration";
```

In the same task, move the actual implementation out of `storageV21Migration.ts` into `persistedV22Storage.ts` and leave no live production imports pointing at the old filename.

- [ ] **Step 4: Update imports to the new canonical module name**

```ts
// utils/services/CaseService.ts
import {
  dehydrateStoredCase,
  hydrateStoredCase,
  syncRuntimeApplications,
} from "@/utils/persistedV22Storage";

// utils/services/CaseBulkOperationsService.ts
import { syncRuntimeApplications } from "@/utils/persistedV22Storage";

// utils/services/FileStorageService.ts
import {
  dehydrateNormalizedData,
  hydrateNormalizedData,
  isPersistedNormalizedFileDataV22,
} from "@/utils/persistedV22Storage";
```

- [ ] **Step 5: Delete or replace the old v2.1-named test/module pair**

Run:

```bash
git mv /workspaces/CMSNext/__tests__/utils/storageV21Migration.test.ts /workspaces/CMSNext/__tests__/utils/persistedV22Storage.test.ts
git rm /workspaces/CMSNext/utils/storageV21Migration.ts
```

If a staged rename is safer than a hard delete, ensure the final tree contains only the v2.2-named module.

- [ ] **Step 6: Re-run focused canonical-storage tests**

Run: `npm run test:run -- __tests__/utils/persistedV22Storage.test.ts __tests__/utils/migrations/schemaRunner.test.ts __tests__/services/CaseService.test.ts`
Expected: PASS with all production imports moved away from the old v2.1 filename.

- [ ] **Step 7: Commit the storage-boundary replacement**

```bash
git add utils/migrations/schemaRunner.ts __tests__/utils/migrations/schemaRunner.test.ts utils/persistedV22Storage.ts __tests__/utils/persistedV22Storage.test.ts utils/services/CaseService.ts utils/services/CaseBulkOperationsService.ts utils/services/FileStorageService.ts utils/MockFileService.ts utils/DataManager.ts
git rm utils/storageV21Migration.ts __tests__/utils/storageV21Migration.test.ts
git commit -m "refactor: replace v2.1 storage helpers with canonical v2.2 boundary"
```

---

### Task 5: Final Cleanup, Documentation, And Full Validation

**Files:**

- Modify: docs that describe migration as an active feature
- Modify or delete: `utils/legacyMigration.ts` and `__tests__/utils/legacyMigration.test.ts`
- Modify: any remaining imports or comments mentioning live runtime migration
- Test: full repository validation set

- [ ] **Step 1: Write failing documentation and cleanup assertions where appropriate**

```ts
it("does not mention settings.legacyMigration in feature flag defaults", () => {
  expect(DEFAULT_FLAGS).not.toHaveProperty("settings.legacyMigration");
});
```

If `legacyMigration.ts` remains, add a test that proves it is isolated and not imported from runtime/UI code. If it does not remain, plan to delete its test as well.

- [ ] **Step 2: Update docs and remove stale migration commentary**

Update docs so they describe:

- persisted v2.2 as the only supported runtime format,
- no automatic or Settings-driven migration path,
- archive files requiring canonical v2.2 as well,
- and the future migration scaffold as internal-only.

Suggested docs to touch first:

```text
README.md
CLAUDE.md
.github/copilot-instructions.md
docs/development/feature-catalogue.md
docs/development/ROADMAP_APR_2026.md
```

- [ ] **Step 3: Delete `legacyMigration.ts` if it has no remaining non-runtime purpose**

Run:

```bash
rm /workspaces/CMSNext/utils/legacyMigration.ts
rm /workspaces/CMSNext/__tests__/utils/legacyMigration.test.ts
```

If it must stay temporarily, strip all runtime/UI references and document that it is dormant internal debt.

- [ ] **Step 4: Run the full validation sequence**

Run:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: PASS on all four commands with no migration UI, no runtime migration orchestration, and no v2.1-named production storage module remaining.

- [ ] **Step 5: Commit the final cleanup and documentation updates**

```bash
git add README.md CLAUDE.md .github/copilot-instructions.md docs/development/feature-catalogue.md docs/development/ROADMAP_APR_2026.md utils/featureFlags.ts __tests__/utils/featureFlags.test.ts
git commit -m "docs: remove runtime migration workflow references"
```

- [ ] **Step 6: Final repository review for parallel execution readiness**

Verify that the remaining tasks were completed in a dependency-safe order:

- Task 1 and Task 2 can be implemented in parallel.
- Task 3 depends on Task 2 only for Settings surface cleanup, not for storage correctness.
- Task 4 depends on Task 3’s decision to remove live migration behavior.
- Task 5 depends on all previous tasks.

This makes `subagent-driven-development` the recommended execution mode for speed: dispatch Task 1 and Task 2 first, review, then Task 3, Task 4, and Task 5 in sequence.
