# Canonical Intake Application Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move intake create/edit onto canonical `applications[]` ownership, select the oldest non-terminal application by application date for compatibility reads, and keep non-intake application editing blocked while current screens continue to display consistent data.

**Architecture:** This plan keeps the current compatibility bridge but tightens its boundaries. Application-owned fields move into a smaller canonical application payload, storage and case services reuse a shared oldest-non-terminal selector driven by configured completion statuses, and intake plus case-detail surfaces consume the hydrated compatibility view without inventing a new applications UI yet.

`CaseColumn.tsx` was later shaken out of this slice because it is not part of the live render path. The active case-edit surface for this branch is `CaseEditSections.tsx`.

**Tech Stack:** TypeScript, React 18, Vitest, React Testing Library, existing CMSNext domain/services/hooks/components stack.

---

## File Map

- Create: `domain/applications/selectors.ts`
- Create: `domain/applications/__tests__/selectors.test.ts`
- Modify: `domain/applications/index.ts`
- Modify: `domain/applications/migration.ts`
- Modify: `types/application.ts`
- Modify: `src/test/testUtils.ts`
- Modify: `utils/storageV21Migration.ts`
- Modify: `utils/services/CaseService.ts`
- Modify: `__tests__/utils/storageV21Migration.test.ts`
- Modify: `__tests__/services/CaseService.test.ts`
- Modify: `hooks/useIntakeWorkflow.ts`
- Modify: `__tests__/hooks/useIntakeWorkflow.test.ts`
- Modify: `components/case/IntakeFormView.tsx`
- Modify: `components/case/CaseEditSections.tsx`
- Modify: `__tests__/components/case/IntakeFormView.test.tsx`
- Modify: `__tests__/components/case/CaseEditSections.test.tsx`

### Task 1: Tighten Application Ownership And Add The Selector Helper

**Files:**

- Create: `domain/applications/selectors.ts`
- Test: `domain/applications/__tests__/selectors.test.ts`
- Modify: `domain/applications/index.ts`
- Modify: `domain/applications/migration.ts`
- Modify: `types/application.ts`
- Modify: `src/test/testUtils.ts`

- [ ] **Step 1: Write the failing domain tests**

```ts
import { describe, expect, it } from "vitest";

import {
  createMockApplication,
  createMockCaseRecord,
} from "@/src/test/testUtils";
import {
  pickApplicationOwnedCaseRecordFields,
  selectOldestNonTerminalApplication,
} from "@/domain/applications";

describe("application selectors", () => {
  it("selects the oldest non-terminal application by application date", () => {
    const completionStatuses = new Set(["approved", "denied"]);
    const applications = [
      createMockApplication({
        id: "application-approved",
        applicationDate: "2026-01-01",
        status: "Approved",
      }),
      createMockApplication({
        id: "application-open-oldest",
        applicationDate: "2026-02-01",
        status: "Pending Review",
      }),
      createMockApplication({
        id: "application-open-newer",
        applicationDate: "2026-03-01",
        status: "Pending Review",
      }),
    ];

    const result = selectOldestNonTerminalApplication(
      applications,
      completionStatuses,
    );

    expect(result?.id).toBe("application-open-oldest");
  });

  it("excludes workflow review fields from the canonical application snapshot", () => {
    const snapshot = pickApplicationOwnedCaseRecordFields(
      createMockCaseRecord({
        avsSubmitted: true,
        avsSubmitDate: "2026-04-01",
        interfacesReviewed: true,
        reviewVRs: true,
        reviewPriorBudgets: true,
        reviewPriorNarr: true,
      }),
    );

    expect(snapshot).not.toHaveProperty("avsSubmitted");
    expect(snapshot).not.toHaveProperty("reviewVRs");
    expect(snapshot).not.toHaveProperty("reviewPriorBudgets");
    expect(snapshot).not.toHaveProperty("reviewPriorNarr");
  });
});
```

- [ ] **Step 2: Run the new domain tests to verify they fail**

Run: `npm run test:run -- domain/applications/__tests__/selectors.test.ts`
Expected: FAIL because `selectOldestNonTerminalApplication` does not exist yet and the snapshot still includes workflow fields.

- [ ] **Step 3: Implement the reduced application payload and selector helper**

```ts
// types/application.ts
export type ApplicationStatus = string;

export interface ApplicationVerificationSnapshot {
  isAppValidated: boolean;
  isAgedDisabledVerified: boolean;
  isCitizenshipVerified: boolean;
  isResidencyVerified: boolean;
  avsConsentDate: string;
  voterFormStatus: VoterFormStatus;
  isIntakeCompleted: boolean;
}

export interface ApplicationOwnedCaseRecordSnapshot {
  applicationDate: string;
  applicationType: string;
  hasWaiver: boolean;
  retroRequested: string;
  appValidated: boolean;
  retroMonths: string[];
  agedDisabledVerified: boolean;
  citizenshipVerified: boolean;
  residencyVerified: boolean;
  avsConsentDate: string;
  voterFormStatus: VoterFormStatus;
  intakeCompleted: boolean;
}

export type ApplicationOwnedLegacyCaseRecordField =
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
  | "intakeCompleted";
```

```ts
// domain/applications/selectors.ts
import type { Application } from "@/types/application";

export function selectOldestNonTerminalApplication(
  applications: Application[],
  completionStatuses: Set<string>,
): Application | null {
  const openApplications = applications.filter(
    (application) => !completionStatuses.has(application.status.toLowerCase()),
  );

  if (openApplications.length === 0) {
    return null;
  }

  return [...openApplications].sort((left, right) => {
    const applicationDateDifference =
      new Date(left.applicationDate).getTime() -
      new Date(right.applicationDate).getTime();
    if (applicationDateDifference !== 0) {
      return applicationDateDifference;
    }

    const createdDifference =
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    if (createdDifference !== 0) {
      return createdDifference;
    }

    return left.id.localeCompare(right.id);
  })[0];
}
```

```ts
// domain/applications/migration.ts
export const APPLICATION_OWNED_CASE_RECORD_FIELDS = [
  "applicationDate",
  "applicationType",
  "withWaiver",
  "retroRequested",
  "appValidated",
  "retroMonths",
  "agedDisabledVerified",
  "citizenshipVerified",
  "residencyVerified",
  "avsConsentDate",
  "voterFormStatus",
  "intakeCompleted",
] as const satisfies readonly ApplicationOwnedLegacyCaseRecordField[];

export function pickApplicationOwnedCaseRecordFields(
  caseRecord: CaseRecord,
): ApplicationOwnedCaseRecordSnapshot {
  return {
    applicationDate: caseRecord.applicationDate,
    applicationType: caseRecord.applicationType ?? "",
    hasWaiver: caseRecord.withWaiver,
    retroRequested: caseRecord.retroRequested,
    appValidated: caseRecord.appValidated ?? false,
    retroMonths: caseRecord.retroMonths ? [...caseRecord.retroMonths] : [],
    agedDisabledVerified: caseRecord.agedDisabledVerified ?? false,
    citizenshipVerified: caseRecord.citizenshipVerified ?? false,
    residencyVerified: caseRecord.residencyVerified ?? false,
    avsConsentDate: caseRecord.avsConsentDate ?? "",
    voterFormStatus: caseRecord.voterFormStatus ?? "",
    intakeCompleted: caseRecord.intakeCompleted,
  };
}
```

- [ ] **Step 4: Run the domain tests again and then the related migration suite**

Run: `npm run test:run -- domain/applications/__tests__/selectors.test.ts __tests__/utils/storageV21Migration.test.ts`
Expected: PASS for the new selector test, with any remaining failures isolated to storage bridge logic that Task 2 will address.

- [ ] **Step 5: Commit the domain-boundary changes**

```bash
git add domain/applications/selectors.ts domain/applications/__tests__/selectors.test.ts domain/applications/index.ts domain/applications/migration.ts types/application.ts src/test/testUtils.ts
git commit -m "refactor: tighten canonical application ownership"
```

### Task 2: Rework The Storage And Case-Service Compatibility Bridge

**Files:**

- Modify: `utils/storageV21Migration.ts`
- Modify: `utils/services/CaseService.ts`
- Test: `__tests__/utils/storageV21Migration.test.ts`
- Test: `__tests__/services/CaseService.test.ts`

- [ ] **Step 1: Add failing storage and case-service tests for the selection rule and compatibility sync**

```ts
it("hydrates the oldest non-terminal application into case compatibility fields", () => {
  const hydrated = hydrateNormalizedData(
    createMockPersistedNormalizedFileData({
      categoryConfig: mergeCategoryConfig({
        caseStatuses: [
          {
            name: "Pending Review",
            colorSlot: "amber",
            countsAsCompleted: false,
          },
          { name: "Approved", colorSlot: "green", countsAsCompleted: true },
        ],
      }),
      applications: [
        createMockApplication({
          id: "application-approved",
          caseId: "case-1",
          applicationDate: "2026-01-01",
          status: "Approved",
          applicationType: "Old Closed",
        }),
        createMockApplication({
          id: "application-open-oldest",
          caseId: "case-1",
          applicationDate: "2026-02-01",
          status: "Pending Review",
          applicationType: "Renewal",
        }),
        createMockApplication({
          id: "application-open-newer",
          caseId: "case-1",
          applicationDate: "2026-03-01",
          status: "Pending Review",
          applicationType: "Change Report",
        }),
      ],
    }),
  );

  expect(hydrated.cases[0].caseRecord.applicationType).toBe("Renewal");
  expect(hydrated.cases[0].caseRecord.status).toBe("Pending Review");
});

it("preserves historical applicantPersonId and appends status history when updateCaseStatus changes status", async () => {
  const result = await caseService.updateCaseStatus("case-1", "Approved");

  expect(result.caseRecord.status).toBe("Approved");
  expect(
    vi.mocked(mockFileService.writeFile).mock.calls[0][0].applications[0],
  ).toMatchObject({
    applicantPersonId: "person-test-1",
    status: "Approved",
  });
  expect(
    vi.mocked(mockFileService.writeFile).mock.calls[0][0].applications[0]
      .statusHistory,
  ).toHaveLength(2);
});
```

- [ ] **Step 2: Run the targeted storage and case-service tests to verify they fail**

Run: `npm run test:run -- __tests__/utils/storageV21Migration.test.ts __tests__/services/CaseService.test.ts`
Expected: FAIL because the bridge still chooses the newest application, still copies workflow review fields into `Application.verification`, and `updateCaseStatus` does not sync application status/history yet.

- [ ] **Step 3: Implement the selector-driven bridge and status/history sync**

```ts
// utils/storageV21Migration.ts
import {
  normalizeRetroRequestedAt,
  pickApplicationOwnedCaseRecordFields,
  selectOldestNonTerminalApplication,
} from "@/domain/applications";
import { getCompletionStatusNames } from "@/types/categoryConfig";

function getPrimaryApplicationForCase(
  applications: Application[] | undefined,
  caseId: string,
  completionStatuses: Set<string>,
): Application | null {
  const caseApplications =
    applications?.filter((application) => application.caseId === caseId) ?? [];
  return selectOldestNonTerminalApplication(
    caseApplications,
    completionStatuses,
  );
}

function buildRuntimeApplicationCaseFields(
  caseItem: PersistedCase,
  application: Application | null,
): Pick<
  StoredCase["caseRecord"],
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
> {
  const legacyCaseRecord = caseItem.caseRecord as Partial<
    StoredCase["caseRecord"]
  >;

  if (!application) {
    return {
      applicationDate: legacyCaseRecord.applicationDate ?? "",
      applicationType: legacyCaseRecord.applicationType ?? "",
      withWaiver: legacyCaseRecord.withWaiver ?? false,
      retroRequested: legacyCaseRecord.retroRequested ?? "",
      appValidated: legacyCaseRecord.appValidated ?? false,
      retroMonths: [...(legacyCaseRecord.retroMonths ?? [])],
      agedDisabledVerified: legacyCaseRecord.agedDisabledVerified ?? false,
      citizenshipVerified: legacyCaseRecord.citizenshipVerified ?? false,
      residencyVerified: legacyCaseRecord.residencyVerified ?? false,
      avsConsentDate: legacyCaseRecord.avsConsentDate ?? "",
      voterFormStatus: legacyCaseRecord.voterFormStatus ?? "",
      intakeCompleted: resolveCaseRecordIntakeCompleted(
        legacyCaseRecord.intakeCompleted,
      ),
      status: legacyCaseRecord.status ?? "",
    };
  }

  return {
    applicationDate: application.applicationDate,
    applicationType: application.applicationType,
    withWaiver: application.hasWaiver,
    retroRequested: application.retroRequestedAt ?? "",
    appValidated: application.verification.isAppValidated,
    retroMonths: [...application.retroMonths],
    agedDisabledVerified: application.verification.isAgedDisabledVerified,
    citizenshipVerified: application.verification.isCitizenshipVerified,
    residencyVerified: application.verification.isResidencyVerified,
    avsConsentDate: application.verification.avsConsentDate,
    voterFormStatus: application.verification.voterFormStatus,
    intakeCompleted: resolveCaseRecordIntakeCompleted(
      application.verification.isIntakeCompleted,
    ),
    status: application.status,
  };
}
```

```ts
// utils/storageV21Migration.ts
const nextStatus = sourceCaseRecord.status;
const nextStatusHistory =
  existingApplication && existingApplication.status === nextStatus
    ? existingApplication.statusHistory.map((entry) => ({ ...entry }))
    : [
        ...(existingApplication?.statusHistory.map((entry) => ({ ...entry })) ??
          []),
        {
          id: uuidv4(),
          status: nextStatus,
          effectiveDate: timestamp.slice(0, 10),
          changedAt: timestamp,
          source: "user" as const,
        },
      ];

const candidate: Application = {
  ...(existingApplication ??
    createMigratedApplication({
      applicationId: uuidv4(),
      initialHistoryId: uuidv4(),
      caseId: caseItem.id,
      applicantPersonId: resolveApplicationApplicantPersonId(caseItem),
      migratedAt: timestamp,
      caseRecord: sourceCaseRecord,
    })),
  applicantPersonId:
    existingApplication?.applicantPersonId ??
    resolveApplicationApplicantPersonId(caseItem),
  applicationDate: migratedFields.applicationDate,
  applicationType: migratedFields.applicationType,
  hasWaiver: migratedFields.hasWaiver,
  retroRequestedAt: normalizeRetroRequestedAt(migratedFields.retroRequested),
  retroMonths: [...migratedFields.retroMonths],
  status: nextStatus,
  statusHistory: nextStatusHistory,
  verification: {
    isAppValidated: migratedFields.appValidated,
    isAgedDisabledVerified: migratedFields.agedDisabledVerified,
    isCitizenshipVerified: migratedFields.citizenshipVerified,
    isResidencyVerified: migratedFields.residencyVerified,
    avsConsentDate: migratedFields.avsConsentDate,
    voterFormStatus: migratedFields.voterFormStatus,
    isIntakeCompleted: migratedFields.intakeCompleted,
  },
  updatedAt: timestamp,
};
```

```ts
// utils/services/CaseService.ts
const updatedData: NormalizedFileData = {
  ...caseData,
  cases: casesWithTouchedTimestamps,
  applications: syncRuntimeApplications(
    {
      ...caseData,
      cases: casesWithTouchedTimestamps,
    },
    true,
  ).applications,
  activityLog: ActivityLogService.mergeActivityEntries(caseData.activityLog, [
    activityEntry,
  ]),
};
```

- [ ] **Step 4: Run the narrow suites again, then the broader service/storage suites**

Run: `npm run test:run -- __tests__/utils/storageV21Migration.test.ts __tests__/services/CaseService.test.ts __tests__/services/ApplicationService.test.ts`
Expected: PASS with the oldest-non-terminal selector, preserved historical applicant linkage, and status-history append behavior.

- [ ] **Step 5: Commit the bridge changes**

```bash
git add utils/storageV21Migration.ts utils/services/CaseService.ts __tests__/utils/storageV21Migration.test.ts __tests__/services/CaseService.test.ts __tests__/services/ApplicationService.test.ts
git commit -m "feat: bridge canonical application ownership through storage"
```

### Task 3: Expose Intake Editability State In The Hook

**Files:**

- Modify: `hooks/useIntakeWorkflow.ts`
- Test: `__tests__/hooks/useIntakeWorkflow.test.ts`

- [ ] **Step 1: Add failing hook tests for application editability**

```ts
it("loads case applications and marks application fields disabled when no non-terminal application exists", async () => {
  mockDataManager.getApplicationsForCase = vi.fn().mockResolvedValue([
    createMockApplication({
      id: "application-1",
      caseId: "case-edit-1",
      status: "Approved",
    }),
  ]);

  const existingCase = createMockStoredCase({ id: "case-edit-1" });
  const { result } = renderIntakeHook({ existingCase });

  await waitFor(() => {
    expect(mockDataManager.getApplicationsForCase).toHaveBeenCalledWith(
      "case-edit-1",
    );
  });

  expect(result.current.areApplicationFieldsDisabled).toBe(true);
});

it("keeps application fields enabled when an oldest non-terminal application exists", async () => {
  mockDataManager.getApplicationsForCase = vi.fn().mockResolvedValue([
    createMockApplication({
      id: "application-closed",
      caseId: "case-edit-1",
      applicationDate: "2026-01-01",
      status: "Approved",
    }),
    createMockApplication({
      id: "application-open",
      caseId: "case-edit-1",
      applicationDate: "2026-02-01",
      status: "Pending Review",
    }),
  ]);

  const { result } = renderIntakeHook({
    existingCase: createMockStoredCase({ id: "case-edit-1" }),
  });

  await waitFor(() => {
    expect(result.current.areApplicationFieldsDisabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run the hook suite to verify the new assertions fail**

Run: `npm run test:run -- __tests__/hooks/useIntakeWorkflow.test.ts`
Expected: FAIL because the hook does not currently load case applications or expose any application-field disable state.

- [ ] **Step 3: Implement application loading and the disable flag in the hook**

```ts
// hooks/useIntakeWorkflow.ts
import { selectOldestNonTerminalApplication } from "@/domain/applications";
import { getCompletionStatusNames } from "@/types/categoryConfig";
import type { Application } from "@/types/application";

const [caseApplications, setCaseApplications] = useState<Application[]>([]);

const completionStatuses = useMemo(
  () => getCompletionStatusNames(config),
  [config],
);

const editableApplication = useMemo(
  () =>
    activeExistingCase
      ? selectOldestNonTerminalApplication(caseApplications, completionStatuses)
      : null,
  [activeExistingCase, caseApplications, completionStatuses],
);

const areApplicationFieldsDisabled = Boolean(
  isEditing && activeExistingCase && editableApplication === null,
);

useEffect(() => {
  if (!activeExistingCase || !dataManager?.getApplicationsForCase) {
    setCaseApplications([]);
    return;
  }

  let isDisposed = false;

  const loadApplications = async () => {
    try {
      const applications = await dataManager.getApplicationsForCase(
        activeExistingCase.id,
      );
      if (!isDisposed) {
        setCaseApplications(applications);
      }
    } catch (error) {
      if (!isDisposed) {
        logger.warn("Failed to load case applications for intake edit", {
          error: extractErrorMessage(error),
        });
        setCaseApplications([]);
      }
    }
  };

  void loadApplications();

  return () => {
    isDisposed = true;
  };
}, [activeExistingCase, dataManager]);
```

- [ ] **Step 4: Run the hook suite and confirm the create/edit submit path still passes**

Run: `npm run test:run -- __tests__/hooks/useIntakeWorkflow.test.ts`
Expected: PASS, including the existing submit assertions and the new disable-state coverage.

- [ ] **Step 5: Commit the hook changes**

```bash
git add hooks/useIntakeWorkflow.ts __tests__/hooks/useIntakeWorkflow.test.ts
git commit -m "feat: expose intake application editability state"
```

### Task 4: Block Non-Intake Application Writes And Wire Intake Disabled State

**Files:**

- Modify: `components/case/IntakeFormView.tsx`
- Modify: `components/case/CaseColumn.tsx`
- Modify: `components/case/CaseEditSections.tsx`
- Test: `__tests__/components/case/IntakeFormView.test.tsx`
- Test: `__tests__/components/case/CaseEditSections.test.tsx`

- [ ] **Step 1: Add failing component tests for disabled application-owned controls**

```tsx
it("disables intake application-owned fields when the hook marks them read-only", async () => {
  withHookState({
    ...createStepState(2, {
      isEditing: true,
      areApplicationFieldsDisabled: true,
      formData: createReviewFormData({
        applicationDate: "2026-01-01",
        applicationType: "Renewal",
        avsConsentDate: "2026-01-03",
        voterFormStatus: "requested",
      }),
    }),
  });

  renderIntakeFormView();

  expect(screen.getByLabelText(/Application Date/i)).toBeDisabled();
  expect(screen.getByLabelText(/AVS Consent Date/i)).toBeDisabled();
});

it("renders case-edit application controls as disabled while leaving workflow markers editable", () => {
  render(
    <CaseEditSections
      caseData={createMockStoredCase().caseRecord}
      isEditing
      onCaseDataChange={vi.fn()}
      onAddressChange={vi.fn()}
      onMailingAddressChange={vi.fn()}
      onRelationshipsChange={{ add: vi.fn(), update: vi.fn(), remove: vi.fn() }}
    />,
  );

  expect(screen.getByLabelText(/Application Date/i)).toBeDisabled();
  expect(screen.getByLabelText(/AVS Consent Date/i)).toBeDisabled();
  expect(screen.getByLabelText(/AVS Submit Date/i)).not.toBeDisabled();
});
```

- [ ] **Step 2: Run the component suites to verify the UI assertions fail**

Run: `npm run test:run -- __tests__/components/case/IntakeFormView.test.tsx __tests__/components/case/CaseEditSections.test.tsx`
Expected: FAIL because the hook state has no `areApplicationFieldsDisabled` output yet and the form controls are still editable.

- [ ] **Step 3: Disable only the application-owned controls in intake and case-edit surfaces**

```tsx
// components/case/IntakeFormView.tsx
const applicationFieldsDisabled = isEditing && areApplicationFieldsDisabled;

<Input
  id="intake-applicationDate"
  type="date"
  value={isoToDateInputValue(formData.applicationDate)}
  onChange={(e) => onChange("applicationDate", dateInputValueToISO(e.target.value) ?? "")}
  disabled={applicationFieldsDisabled}
/>

<Select
  value={formData.applicationType ?? ""}
  onValueChange={(value) => onChange("applicationType", value)}
  disabled={applicationFieldsDisabled}
>
```

```tsx
// components/case/CaseEditSections.tsx and components/case/CaseColumn.tsx
<Select
  value={caseData.applicationType || ""}
  onValueChange={(value) => onCaseDataChange("applicationType", value || undefined)}
  disabled
>

<Input
  id="applicationDate"
  type="date"
  value={isoToDateInputValue(caseData.applicationDate)}
  onChange={(e) => onCaseDataChange("applicationDate", dateInputValueToISO(e.target.value) || "")}
  className="h-8"
  disabled
/>

<Select
  value={caseData.status}
  onValueChange={(value) => onCaseDataChange("status", value)}
  disabled
>

<Input
  id="avsConsentDate"
  type="date"
  value={isoToDateInputValue(caseData.avsConsentDate ?? "")}
  onChange={(e) => onCaseDataChange("avsConsentDate", dateInputValueToISO(e.target.value) || "")}
  disabled
/>
```

- [ ] **Step 4: Run the UI suites, then execute the repo validation sequence**

Run: `npm run test:run -- __tests__/components/case/IntakeFormView.test.tsx __tests__/components/case/CaseEditSections.test.tsx __tests__/hooks/useIntakeWorkflow.test.ts __tests__/utils/storageV21Migration.test.ts __tests__/services/CaseService.test.ts`
Then:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: PASS across targeted tests first, then PASS for the full validation sequence.

- [ ] **Step 5: Commit the UI and validation changes**

```bash
git add components/case/IntakeFormView.tsx components/case/CaseColumn.tsx components/case/CaseEditSections.tsx __tests__/components/case/IntakeFormView.test.tsx __tests__/components/case/CaseEditSections.test.tsx
git commit -m "feat: lock application edits to intake workflow"
```
