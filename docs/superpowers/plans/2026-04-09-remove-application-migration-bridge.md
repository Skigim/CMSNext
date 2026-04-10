# Remove Application Migration Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove migration-on-save application syncing so canonical `applications[]` are written explicitly by owned flows instead of being reconstructed from case compatibility fields.

**Architecture:** Keep canonical application reads and compatibility hydration for now, but delete the write-path bridge that syncs case fields into `applications[]`. Case creation keeps creating an initial canonical application explicitly, intake edit updates canonical applications directly, and case status changes use a narrow application-status sync instead of the broader migration helper.

**Tech Stack:** React 18, TypeScript, Vitest, RTL, FileStorageService/DataManager services.

---

### Task 1: Lock The New Write Contract In Tests

**Files:**

- Modify: `__tests__/utils/storageV21Migration.test.ts`
- Modify: `__tests__/hooks/useIntakeWorkflow.test.ts`
- Modify: `__tests__/services/CaseService.test.ts`

- [ ] **Step 1: Write failing storage tests for explicit application persistence**

```ts
it("does not synthesize applications during dehydration", () => {
  const runtimeCase = createMockStoredCase({
    id: "case-1",
    person: createMockPerson({ id: "person-1" }),
    people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
    caseRecord: {
      ...createMockStoredCase().caseRecord,
      applicationDate: "2026-03-01",
      applicationType: "Renewal",
      withWaiver: true,
    },
  });

  const dehydrated = dehydrateNormalizedData({
    version: "2.1",
    people: [createMockPerson({ id: "person-1" })],
    cases: [runtimeCase],
    applications: [],
    financials: [],
    notes: [],
    alerts: [],
    exported_at: "2026-03-01T00:00:00.000Z",
    total_cases: 1,
    categoryConfig: mergeCategoryConfig(),
    activityLog: [],
  });

  expect(dehydrated.applications).toEqual([]);
});
```

- [ ] **Step 2: Run the focused storage test and confirm it fails for the old sync behavior**

Run: `npm run test:run -- __tests__/utils/storageV21Migration.test.ts`
Expected: FAIL because `dehydrateNormalizedData()` still creates an application automatically.

- [ ] **Step 3: Write failing intake and case-service tests for explicit canonical application writes**

```ts
it("updates the canonical application directly during intake edit", async () => {
  expect(mockDataManager.updateApplication).toHaveBeenCalledWith(
    "case-1",
    "application-1",
    expect.objectContaining({
      applicationDate: "2026-09-09",
      applicationType: "Change Report",
    }),
  );
});

it("creates an initial canonical application when creating a case", async () => {
  expect(result.applications).toHaveLength(1);
  expect(result.applications?.[0]).toMatchObject({
    caseId: createdCase.id,
    applicationDate: "2026-02-15",
  });
});
```

- [ ] **Step 4: Run the focused test files and confirm they fail for the current bridge implementation**

Run: `npm run test:run -- __tests__/hooks/useIntakeWorkflow.test.ts __tests__/services/CaseService.test.ts`
Expected: FAIL because intake edit still relies on `updateCompleteCase()` only and case creation still depends on `syncRuntimeApplications()`.

### Task 2: Replace Migration-On-Save With Explicit Canonical Writes

**Files:**

- Modify: `domain/applications/index.ts`
- Modify: `types/application.ts`
- Modify: `utils/storageV21Migration.ts`
- Modify: `utils/services/CaseService.ts`
- Modify: `hooks/useIntakeWorkflow.ts`

- [ ] **Step 1: Add the minimal domain/application helpers that model explicit canonical application creation and updates**

```ts
export function createInitialApplicationRecord(input: {
  applicationId: string;
  historyId: string;
  caseId: string;
  applicantPersonId: string;
  createdAt: string;
  caseRecord: Pick<
    CaseRecord,
    | "applicationDate"
    | "applicationType"
    | "withWaiver"
    | "retroRequested"
    | "appValidated"
    | "retroMonths"
    | "agedDisabledVerified"
    | "citizenshipVerified"
    | "residencyVerified"
    | "avsConsentDate"
    | "voterFormStatus"
    | "intakeCompleted"
    | "status"
  >;
}): Application {
  return {
    id: input.applicationId,
    caseId: input.caseId,
    applicantPersonId: input.applicantPersonId,
    applicationDate: input.caseRecord.applicationDate,
    applicationType: input.caseRecord.applicationType ?? "",
    status: input.caseRecord.status as Application["status"],
    statusHistory: [
      {
        id: input.historyId,
        status: input.caseRecord.status as Application["status"],
        effectiveDate: input.caseRecord.applicationDate,
        changedAt: input.createdAt,
        source: "user",
      },
    ],
    hasWaiver: input.caseRecord.withWaiver ?? false,
    retroRequestedAt: normalizeRetroRequestedAt(
      input.caseRecord.retroRequested,
    ),
    retroMonths: [...(input.caseRecord.retroMonths ?? [])],
    verification: {
      isAppValidated: input.caseRecord.appValidated ?? false,
      isAgedDisabledVerified: input.caseRecord.agedDisabledVerified ?? false,
      isCitizenshipVerified: input.caseRecord.citizenshipVerified ?? false,
      isResidencyVerified: input.caseRecord.residencyVerified ?? false,
      avsConsentDate: input.caseRecord.avsConsentDate ?? "",
      voterFormStatus: input.caseRecord.voterFormStatus ?? "",
      isIntakeCompleted: input.caseRecord.intakeCompleted ?? true,
    },
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}
```

- [ ] **Step 2: Remove the broad storage sync path and keep dehydration purely canonical**

```ts
export function dehydrateNormalizedData(
  data: RuntimeNormalizedFileDataV21,
): PersistedNormalizedFileDataV21 {
  return {
    version: "2.1",
    people: persistedPeople,
    cases: data.cases.map((caseItem) => dehydrateStoredCase(caseItem)),
    applications: (data.applications ?? []).map(normalizePersistedApplication),
    ...
  };
}
```

- [ ] **Step 3: Move canonical application creation into case creation and canonical application updates into intake edit**

```ts
const createdApplication = createInitialApplicationRecord({
  applicationId: uuidv4(),
  historyId: uuidv4(),
  caseId,
  applicantPersonId: personId,
  createdAt: timestamp,
  caseRecord: newCase.caseRecord,
});

const updatedData: NormalizedFileData = {
  ...updatedDataWithPeople,
  people: updatedPeople,
  cases: newCases,
  applications: [...(currentData.applications ?? []), createdApplication],
};
```

```ts
if (isEditing && editableApplication) {
  await dataManager.updateApplication(
    activeExistingCase.id,
    editableApplication.id,
    {
      applicationDate: caseRecord.applicationDate,
      applicationType: caseRecord.applicationType ?? "",
      hasWaiver: caseRecord.withWaiver ?? false,
      retroRequestedAt: normalizeRetroRequestedAt(caseRecord.retroRequested),
      retroMonths: [...(caseRecord.retroMonths ?? [])],
      verification: {
        isAppValidated: caseRecord.appValidated ?? false,
        isAgedDisabledVerified: caseRecord.agedDisabledVerified ?? false,
        isCitizenshipVerified: caseRecord.citizenshipVerified ?? false,
        isResidencyVerified: caseRecord.residencyVerified ?? false,
        avsConsentDate: caseRecord.avsConsentDate ?? "",
        voterFormStatus: caseRecord.voterFormStatus ?? "",
        isIntakeCompleted: caseRecord.intakeCompleted ?? true,
      },
    },
  );
}
```

- [ ] **Step 4: Run the focused tests again and then the broader related suite**

Run: `npm run test:run -- __tests__/utils/storageV21Migration.test.ts __tests__/hooks/useIntakeWorkflow.test.ts __tests__/services/CaseService.test.ts`
Then: `npm run test:run`
Expected: PASS.

### Task 3: Narrow Status Mirroring And Remove Dead Migration Artifacts

**Files:**

- Modify: `utils/services/CaseService.ts`
- Modify: `utils/services/CaseBulkOperationsService.ts`
- Modify: `utils/services/FileStorageService.ts`
- Modify: `domain/applications/migration.ts`
- Modify: `domain/applications/__tests__/migration.test.ts`

- [ ] **Step 1: Replace status-only application syncing with a narrower selected-application status helper**

```ts
const synchronizedApplications = syncSelectedApplicationStatuses({
  applications: caseData.applications ?? [],
  cases: casesWithTouchedTimestamps,
  categoryConfig: caseData.categoryConfig,
  transactionTimestamp: timestamp,
});
```

- [ ] **Step 2: Remove the unused migration module and its test coverage once no production imports remain**

Run: `npm run test:run -- domain/applications/__tests__/migration.test.ts`
Expected: FAIL or no references remain.

- [ ] **Step 3: Delete the dead migration exports and update any remaining imports**

```ts
export {
  createInitialApplicationRecord,
  normalizeRetroRequestedAt,
} from "./factories";
export { selectOldestNonTerminalApplication } from "./selectors";
```

- [ ] **Step 4: Run related tests for case status flows and storage reads**

Run: `npm run test:run -- __tests__/services/FileStorageService.test.ts __tests__/services/CaseService.test.ts __tests__/utils/storageV21Migration.test.ts`
Expected: PASS.

### Task 4: Update Docs And Verify The Full Slice

**Files:**

- Modify: `README.md`
- Modify: `docs/development/ROADMAP_APR_2026.md`
- Modify: `docs/development/feature-catalogue.md`

- [ ] **Step 1: Update docs to describe explicit canonical application writes instead of migration-on-save**

```md
Intake and case creation now write canonical `applications[]` explicitly. Runtime case fields may still be hydrated for compatibility reads, but normal saves no longer reconstruct applications from case-embedded values.
```

- [ ] **Step 2: Run repo validation**

Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run test:run`
Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Record any durable repo-memory update if the write contract changed materially**

```md
- Application ownership: canonical applications are now written explicitly by case/intake flows; storage dehydration no longer synthesizes them from case fields.
```
