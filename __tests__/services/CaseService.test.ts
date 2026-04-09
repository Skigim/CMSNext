import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createClockSkewTouchCaseTimestamps,
  createMockApplication,
  createMockCaseDisplay,
  createMockPersistedNormalizedFileData,
  createMockNewCaseRecordData,
  createMockNewPersonData,
  createMockPerson,
  createMockStoredCase,
  TEST_SKEWED_TRANSACTION_TIMESTAMP,
  TEST_TRANSACTION_TIMESTAMP,
  withFrozenSystemTime,
} from "@/src/test/testUtils";
import type AutosaveFileService from "@/utils/AutosaveFileService";
import { FileStorageService, type NormalizedFileData } from "@/utils/services/FileStorageService";
import { CaseService } from "@/utils/services/CaseService";
import type { CaseStatus, PersistedCase } from "@/types/case";
import { mergeCategoryConfig } from "@/types/categoryConfig";

type MockAutosaveFileService = Pick<AutosaveFileService, "readFile" | "writeFile" | "broadcastDataUpdate">;

function toPersistedCase(storedCase: ReturnType<typeof createMockStoredCase>): PersistedCase {
  const runtimeCase = storedCase as ReturnType<typeof createMockStoredCase> & {
    alerts?: unknown;
    caseRecord: typeof storedCase.caseRecord & {
      financials?: unknown;
      notes?: unknown;
    };
  };
  const {
    person: _person,
    linkedPeople: _linkedPeople,
    alerts: _alerts,
    caseRecord,
    ...persistedCase
  } = runtimeCase;
  const {
    financials: _financials,
    notes: _notes,
    ...persistedCaseRecord
  } = caseRecord;

  return {
    ...persistedCase,
    caseRecord: persistedCaseRecord,
    people: storedCase.people ?? [],
  };
}

function createLinkedRuntimeCase() {
  const primaryPerson = createMockPerson({ id: "person-1" });
  const linkedPerson = createMockPerson({ id: "person-2" });

  return {
    primaryPerson,
    linkedPerson,
    runtimeCase: createMockCaseDisplay({
      id: "case-1",
      people: [
        { personId: "person-1", role: "applicant", isPrimary: true },
        { personId: "person-2", role: "household_member", isPrimary: false },
      ],
      person: primaryPerson,
      linkedPeople: [
        {
          ref: { personId: "person-1", role: "applicant", isPrimary: true },
          person: primaryPerson,
        },
        {
          ref: { personId: "person-2", role: "household_member", isPrimary: false },
          person: linkedPerson,
        },
      ],
      alerts: [
        {
          id: "alert-1",
          alertCode: "CODE-1",
          alertType: "Test Alert",
          alertDate: "2026-01-01",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    }),
  };
}

function createApplicantRef(personId: string) {
  return { personId, role: "applicant" as const, isPrimary: true };
}

type StoredCaseOverrides = Partial<Omit<ReturnType<typeof createMockStoredCase>, "caseRecord">> & {
  caseRecord?: Partial<ReturnType<typeof createMockStoredCase>["caseRecord"]>;
};

function createCaseWithPrimaryApplicant(
  person: ReturnType<typeof createMockPerson>,
  overrides: StoredCaseOverrides = {},
) {
  const { caseRecord: caseRecordOverrides, ...caseOverrides } = overrides;

  return createMockStoredCase({
    id: "case-1",
    person,
    people: [createApplicantRef(person.id)],
    caseRecord: {
      ...createMockStoredCase().caseRecord,
      personId: person.id,
      ...caseRecordOverrides,
    },
    ...caseOverrides,
  });
}

function createPendingApplicationForCase(
  applicantPersonId: string,
  overrides: Partial<ReturnType<typeof createMockApplication>> = {},
) {
  return createMockApplication({
    id: "application-1",
    caseId: "case-1",
    applicantPersonId,
    status: "Pending",
    statusHistory: [
      {
        id: "history-1",
        status: "Pending",
        effectiveDate: "2026-01-01",
        changedAt: "2026-01-01T00:00:00.000Z",
        source: "migration",
      },
    ],
    ...overrides,
  });
}

describe("CaseService hydration seam", () => {
  let caseService: CaseService;
  let mockFileService: MockAutosaveFileService;
  let fileStorage: FileStorageService;

  beforeEach(() => {
    mockFileService = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      broadcastDataUpdate: vi.fn(),
    } as MockAutosaveFileService;

    fileStorage = new FileStorageService({
      fileService: mockFileService as unknown as AutosaveFileService,
    });

    caseService = new CaseService({
      fileStorage,
    });
  });

  it("hydrates a persisted case with primary and linked people", () => {
    const primaryPerson = createMockPerson({
      id: "person-1",
      firstName: "Primary",
      lastName: "Applicant",
      name: "Primary Applicant",
    });
    const householdMember = createMockPerson({
      id: "person-2",
      firstName: "Linked",
      lastName: "Member",
      name: "Linked Member",
    });
    const storedCase = createMockStoredCase({
      id: "case-1",
      people: [
        { personId: "person-1", role: "applicant", isPrimary: true },
        { personId: "person-2", role: "household_member", isPrimary: false },
      ],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: "person-1",
      },
      person: primaryPerson,
    });
    const persistedCaseData = toPersistedCase(storedCase);

    const result = caseService.hydrate(persistedCaseData, [primaryPerson, householdMember]);

    expect(result.person).toMatchObject({
      id: "person-1",
      name: "Primary Applicant",
    });
    expect(result.linkedPeople).toEqual([
      {
        ref: { personId: "person-1", role: "applicant", isPrimary: true },
        person: expect.objectContaining({ id: "person-1" }),
      },
      {
        ref: { personId: "person-2", role: "household_member", isPrimary: false },
        person: expect.objectContaining({ id: "person-2" }),
      },
    ]);
  });

  it("fails to hydrate when a persisted case has no explicit primary ref", () => {
    const primaryPerson = createMockPerson({ id: "person-1" });
    const storedCase = createCaseWithPrimaryApplicant(primaryPerson, {
      people: [{ personId: "person-1", role: "applicant", isPrimary: false }],
    });
    const persistedCaseData = toPersistedCase(storedCase);

    expect(() => caseService.hydrate(persistedCaseData, [primaryPerson])).toThrow(
      "Case case-1 must have exactly one primary person ref",
    );
  });

  it("fails to hydrate when a referenced person is missing", () => {
    const primaryPerson = createMockPerson({ id: "person-1" });
    const storedCase = createCaseWithPrimaryApplicant(primaryPerson, {
      people: [
        { personId: "person-1", role: "applicant", isPrimary: true },
        { personId: "person-2", role: "household_member", isPrimary: false },
      ],
    });
    const persistedCaseData = toPersistedCase(storedCase);

    expect(() => caseService.hydrate(persistedCaseData, [primaryPerson])).toThrow(
      "Person person-2 not found for case case-1",
    );
  });

  it("dehydrates runtime-only case fields before persistence", () => {
    const { runtimeCase } = createLinkedRuntimeCase();

    const result = caseService.dehydrate(runtimeCase);

    expect(result).not.toHaveProperty("person");
    expect(result).not.toHaveProperty("linkedPeople");
    expect(result).not.toHaveProperty("alerts");
    expect(result.caseRecord).not.toHaveProperty("financials");
    expect(result.caseRecord).not.toHaveProperty("notes");
    expect(result.people).toEqual([
      { personId: "person-1", role: "applicant", isPrimary: true },
      { personId: "person-2", role: "household_member", isPrimary: false },
    ]);
  });

  it("fails to dehydrate runtime cases without canonical people refs", () => {
    const { runtimeCase } = createLinkedRuntimeCase();

    expect(() =>
      caseService.dehydrate({
        ...runtimeCase,
        people: undefined,
      }),
    ).toThrow("Case case-1 cannot be dehydrated without canonical people[] refs");
  });

  describe("createCompleteCase", () => {
    it("writes a normalized case/person link for newly created people", async () => {
      // ARRANGE
      const newPersonData = createMockNewPersonData({
        firstName: "Taylor",
        lastName: "Applicant",
      });
      const newCaseRecordData = createMockNewCaseRecordData({
        mcn: "MCN-1000",
        personId: "",
      });
      vi.mocked(mockFileService.readFile).mockResolvedValue(createMockPersistedNormalizedFileData());
      vi.mocked(mockFileService.writeFile).mockResolvedValue(true);

      // ACT
      const result = await caseService.createCompleteCase({
        person: newPersonData,
        caseRecord: newCaseRecordData,
      });

      // ASSERT
      expect(mockFileService.writeFile).toHaveBeenCalledTimes(1);
      const writtenData = vi.mocked(mockFileService.writeFile).mock.calls[0][0];
      expect(writtenData.people).toHaveLength(1);
      expect(writtenData.cases).toHaveLength(1);
      expect(writtenData.cases[0]).not.toHaveProperty("person");
      expect(writtenData.cases[0]).not.toHaveProperty("linkedPeople");
      expect(writtenData.cases[0].people).toEqual([
        {
          personId: writtenData.people[0].id,
          role: "applicant",
          isPrimary: true,
        },
      ]);
      expect(writtenData.cases[0].caseRecord.personId).toBe(writtenData.people[0].id);
      expect(writtenData.applications).toHaveLength(1);
      expect(writtenData.applications[0]).toMatchObject({
        caseId: writtenData.cases[0].id,
        applicantPersonId: writtenData.people[0].id,
        applicationDate: newCaseRecordData.applicationDate,
        applicationType: newCaseRecordData.applicationType ?? "",
      });
      expect(result.person).toMatchObject({
        id: writtenData.people[0].id,
        firstName: "Taylor",
        lastName: "Applicant",
      });
      expect(result.linkedPeople).toEqual([
        {
          ref: {
            personId: writtenData.people[0].id,
            role: "applicant",
            isPrimary: true,
          },
          person: expect.objectContaining({ id: writtenData.people[0].id }),
        },
      ]);
    });

    it("creates additional household members as standalone linked people", async () => {
      // ARRANGE
      vi.mocked(mockFileService.readFile).mockResolvedValue(createMockPersistedNormalizedFileData());
      vi.mocked(mockFileService.writeFile).mockResolvedValue(true);

      // ACT
      const result = await caseService.createCompleteCase({
        person: createMockNewPersonData({
          firstName: "Taylor",
          lastName: "Applicant",
        }),
        caseRecord: createMockNewCaseRecordData({
          mcn: "MCN-1001",
          personId: "",
        }),
        householdMembers: [
          {
            personId: undefined,
            relationshipType: "Spouse",
            role: "household_member",
            firstName: "Jordan",
            lastName: "Applicant",
            email: "jordan@example.com",
            phone: "5552223333",
            dateOfBirth: "1988-04-05",
            ssn: "222-33-4444",
            organizationId: "org-1",
            livingArrangement: "Community",
            address: {
              street: "456 Oak St",
              apt: "",
              city: "Omaha",
              state: "NE",
              zip: "68102",
            },
            mailingAddress: {
              street: "",
              apt: "",
              city: "",
              state: "NE",
              zip: "",
              sameAsPhysical: true,
            },
            authorizedRepIds: [],
            familyMembers: [],
            relationships: [],
          },
        ],
      });

      // ASSERT
      const writtenData = vi.mocked(mockFileService.writeFile).mock.calls[0][0];
      expect(writtenData.people).toHaveLength(2);
      expect(writtenData.cases[0].people).toEqual([
        {
          personId: writtenData.people[0].id,
          role: "applicant",
          isPrimary: true,
        },
        {
          personId: writtenData.people[1].id,
          role: "household_member",
          isPrimary: false,
        },
      ]);
      expect(writtenData.people[0]).toMatchObject({
        familyMemberIds: [writtenData.people[1].id],
        relationships: [
          expect.objectContaining({
            type: "Spouse",
            targetPersonId: writtenData.people[1].id,
          }),
        ],
      });
      expect(writtenData.people[1]).toMatchObject({
        firstName: "Jordan",
        lastName: "Applicant",
        email: "jordan@example.com",
        phone: "5552223333",
        dateOfBirth: "1988-04-05",
      });
      expect(result.linkedPeople).toEqual([
        expect.objectContaining({
          ref: expect.objectContaining({
            personId: writtenData.people[0].id,
            role: "applicant",
            isPrimary: true,
          }),
        }),
        expect.objectContaining({
          ref: expect.objectContaining({
            personId: writtenData.people[1].id,
            role: "household_member",
            isPrimary: false,
          }),
          person: expect.objectContaining({
            id: writtenData.people[1].id,
            name: "Jordan Applicant",
            email: "jordan@example.com",
          }),
        }),
      ]);
    });

    it("reuses an existing person reference instead of creating a duplicate", async () => {
      // ARRANGE
      const existingPerson = createMockPerson({
        id: "person-existing-1",
        firstName: "Existing",
        lastName: "Person",
        name: "Existing Person",
      });
      vi.mocked(mockFileService.readFile).mockResolvedValue(
        createMockPersistedNormalizedFileData({
          people: [existingPerson],
        }),
      );
      vi.mocked(mockFileService.writeFile).mockResolvedValue(true);

      // ACT
      const result = await caseService.createCompleteCase({
        person: createMockNewPersonData({
          firstName: "Ignored",
          lastName: "Duplicate",
        }),
        caseRecord: createMockNewCaseRecordData({
          mcn: "MCN-2000",
          personId: "person-existing-1",
        }),
      });

      // ASSERT
      expect(mockFileService.writeFile).toHaveBeenCalledTimes(1);
      const writtenData = vi.mocked(mockFileService.writeFile).mock.calls[0][0];
      expect(writtenData.people).toHaveLength(1);
      expect(writtenData.people[0].id).toBe("person-existing-1");
      expect(writtenData.cases[0].people).toEqual([
        {
          personId: "person-existing-1",
          role: "applicant",
          isPrimary: true,
        },
      ]);
      expect(writtenData.cases[0].caseRecord.personId).toBe("person-existing-1");
      expect(result.name).toBe("Existing Person");
      expect(result.person).toMatchObject({
        id: "person-existing-1",
        firstName: "Existing",
        lastName: "Person",
      });
    });

    it("defaults intakeCompleted to true when create-case input omits it", async () => {
      // ARRANGE
      const newCaseRecordData = createMockNewCaseRecordData({
        personId: "",
      });
      delete (newCaseRecordData as { intakeCompleted?: boolean }).intakeCompleted;
      vi.mocked(mockFileService.readFile).mockResolvedValue(createMockPersistedNormalizedFileData());
      vi.mocked(mockFileService.writeFile).mockResolvedValue(true);

      // ACT
      await caseService.createCompleteCase({
        person: createMockNewPersonData(),
        caseRecord: newCaseRecordData,
      });

      // ASSERT
      const writtenData = vi.mocked(mockFileService.writeFile).mock.calls[0][0];
      expect(writtenData.applications[0].verification.isIntakeCompleted).toBe(true);
    });

    it("preserves an explicitly incomplete quick-add case flag", async () => {
      // ARRANGE
      vi.mocked(mockFileService.readFile).mockResolvedValue(createMockPersistedNormalizedFileData());
      vi.mocked(mockFileService.writeFile).mockResolvedValue(true);

      // ACT
      await caseService.createCompleteCase({
        person: createMockNewPersonData(),
        caseRecord: createMockNewCaseRecordData({
          intakeCompleted: false,
          personId: "",
        }),
      });

      // ASSERT
      const writtenData = vi.mocked(mockFileService.writeFile).mock.calls[0][0];
      expect(writtenData.applications[0].verification.isIntakeCompleted).toBe(false);
    });

    it("fails when create-case input references a missing person", async () => {
      // ARRANGE
      vi.mocked(mockFileService.readFile).mockResolvedValue(createMockPersistedNormalizedFileData());

      // ACT & ASSERT
      await expect(
        caseService.createCompleteCase({
          person: createMockNewPersonData(),
          caseRecord: createMockNewCaseRecordData({
            personId: "missing-person",
          }),
        }),
      ).rejects.toThrow("Person missing-person not found");
      expect(mockFileService.writeFile).not.toHaveBeenCalled();
    });

    it("passes existing runtime cases through the canonical writer unchanged", async () => {
      // ARRANGE
      const existingRuntimeCase = createMockStoredCase({
        id: "case-existing-1",
      });
      vi.mocked(mockFileService.readFile).mockResolvedValue(
        createMockPersistedNormalizedFileData({
          people: [existingRuntimeCase.person],
          cases: [existingRuntimeCase],
        }),
      );
      const writeNormalizedDataSpy = vi
        .spyOn(fileStorage, "writeNormalizedData")
        .mockImplementation(async (data) => data as NormalizedFileData);

      // ACT
      await caseService.createCompleteCase({
        person: createMockNewPersonData({
          firstName: "Fresh",
          lastName: "Person",
        }),
        caseRecord: createMockNewCaseRecordData({
          mcn: "MCN-3000",
          personId: "",
        }),
      });

      // ASSERT
      expect(writeNormalizedDataSpy).toHaveBeenCalledTimes(1);
      const writtenData = writeNormalizedDataSpy.mock.calls[0][0] as NormalizedFileData;
      expect(writtenData.cases).toHaveLength(2);
      expect(writtenData.cases[0]).toMatchObject({
        id: "case-existing-1",
        person: expect.objectContaining({ id: existingRuntimeCase.person.id }),
      });
      expect(writtenData.cases[1]).toMatchObject({
        person: expect.objectContaining({ name: "Fresh Person" }),
      });
      expect(writtenData.cases[1].people).toEqual([
        {
          personId: writtenData.cases[1].person.id,
          role: "applicant",
          isPrimary: true,
        },
      ]);
    });
  });

  describe("updateCaseStatus", () => {
    it("does not rewrite canonical application fields during a plain case update", async () => {
      // ARRANGE
      const primaryPerson = createMockPerson({
        id: "person-case-1",
        firstName: "Primary",
        lastName: "Person",
        name: "Primary Person",
      });
      const canonicalApplication = createMockApplication({
        id: "application-1",
        caseId: "case-1",
        applicantPersonId: "person-case-1",
        applicationDate: "2026-02-15",
        applicationType: "Renewal",
        hasWaiver: true,
        retroRequestedAt: "2026-01-01",
        retroMonths: ["Jan", "Feb"],
        verification: {
          isAppValidated: true,
          isAgedDisabledVerified: true,
          isCitizenshipVerified: true,
          isResidencyVerified: true,
          avsConsentDate: "2026-02-16",
          voterFormStatus: "requested",
          isIntakeCompleted: true,
        },
      });
      vi.mocked(mockFileService.readFile).mockResolvedValue(
        createMockPersistedNormalizedFileData({
          people: [primaryPerson],
          cases: [
            createCaseWithPrimaryApplicant(primaryPerson, {
              caseRecord: {
                mcn: "MCN-ORIGINAL",
                applicationDate: "2026-02-15",
                applicationType: "Renewal",
                withWaiver: true,
                retroRequested: "2026-01-01",
                appValidated: true,
                agedDisabledVerified: true,
                citizenshipVerified: true,
                residencyVerified: true,
                avsConsentDate: "2026-02-16",
                voterFormStatus: "requested",
                retroMonths: ["Jan", "Feb"],
                status: "Pending",
              },
            }),
          ],
          applications: [canonicalApplication],
        }),
      );
      vi.mocked(mockFileService.writeFile).mockResolvedValue(true);

      // ACT
      await caseService.updateCompleteCase("case-1", {
        person: createMockNewPersonData({
          firstName: "Primary",
          lastName: "Person",
        }),
        caseRecord: createMockNewCaseRecordData({
          personId: "person-case-1",
          mcn: "MCN-UPDATED",
          applicationDate: "2026-09-09",
          applicationType: "Stale Disabled Edit",
          withWaiver: false,
          retroRequested: "2026-09-01",
          appValidated: false,
          agedDisabledVerified: false,
          citizenshipVerified: false,
          residencyVerified: false,
          avsConsentDate: "2026-09-10",
          voterFormStatus: "declined",
          retroMonths: ["Sep"],
          status: "Pending",
        }),
      });

      // ASSERT
      const writtenData = vi.mocked(mockFileService.writeFile).mock.calls[0][0];
      expect(writtenData.applications).toHaveLength(1);
      expect(writtenData.applications[0]).toMatchObject({
        id: "application-1",
        applicationDate: "2026-02-15",
        applicationType: "Renewal",
        hasWaiver: true,
        retroRequestedAt: "2026-01-01",
        retroMonths: ["Jan", "Feb"],
        verification: {
          isAppValidated: true,
          isAgedDisabledVerified: true,
          isCitizenshipVerified: true,
          isResidencyVerified: true,
          avsConsentDate: "2026-02-16",
          voterFormStatus: "requested",
          isIntakeCompleted: true,
        },
      });
    });

    it("synchronizes canonical application status/history while preserving historical applicant linkage", async () => {
      // ARRANGE
      const primaryPerson = createMockPerson({ id: "person-case-1", name: "Primary Person" });
      const historicalApplicant = createMockPerson({
        id: "person-historical-1",
        name: "Historical Applicant",
      });
      vi.mocked(mockFileService.readFile).mockResolvedValue(
        createMockPersistedNormalizedFileData({
          people: [primaryPerson, historicalApplicant],
          cases: [
            createCaseWithPrimaryApplicant(primaryPerson, {
              status: "Pending",
              people: [createApplicantRef("person-case-1")],
              caseRecord: {
                status: "Pending",
              },
            }),
          ],
          applications: [createPendingApplicationForCase("person-historical-1")],
        }),
      );
      vi.mocked(mockFileService.writeFile).mockResolvedValue(true);

      // ACT
      const result = await caseService.updateCaseStatus("case-1", "Approved" as CaseStatus);

      // ASSERT
      expect(result.status).toBe("Approved");
      expect(result.caseRecord.status).toBe("Approved");
      expect(mockFileService.writeFile).toHaveBeenCalledTimes(1);
      const writtenData = vi.mocked(mockFileService.writeFile).mock.calls[0][0];
      expect(writtenData.applications).toHaveLength(1);
      expect(writtenData.applications[0]).toMatchObject({
        id: "application-1",
        applicantPersonId: "person-historical-1",
        status: "Approved",
      });
      expect(writtenData.applications[0].statusHistory).toHaveLength(2);
      expect(writtenData.applications[0].statusHistory[1]).toMatchObject({
        status: "Approved",
        source: "user",
      });
    });

    it("updates the oldest terminal application when no non-terminal application exists", async () => {
      // ARRANGE
      const primaryPerson = createMockPerson({ id: "person-case-1", name: "Primary Person" });
      const olderTerminalApplication = createMockApplication({
        id: "application-older-terminal",
        caseId: "case-1",
        applicantPersonId: "person-case-1",
        applicationDate: "2026-01-01",
        applicationType: "Renewal",
        createdAt: "2026-01-01T00:00:00.000Z",
        status: "Approved",
        hasWaiver: true,
        retroRequestedAt: "2025-12-01",
        retroMonths: ["2025-12"],
        verification: {
          isAppValidated: true,
          isAgedDisabledVerified: true,
          isCitizenshipVerified: true,
          isResidencyVerified: true,
          avsConsentDate: "2026-01-02",
          voterFormStatus: "requested",
          isIntakeCompleted: false,
        },
        statusHistory: [
          {
            id: "history-1",
            status: "Approved",
            effectiveDate: "2026-01-01",
            changedAt: "2026-01-01T00:00:00.000Z",
            source: "migration",
          },
        ],
      });
      const newerTerminalApplication = createMockApplication({
        id: "application-newer-terminal",
        caseId: "case-1",
        applicantPersonId: "person-case-1",
        applicationDate: "2026-03-01",
        createdAt: "2026-03-01T00:00:00.000Z",
        status: "Denied",
        statusHistory: [
          {
            id: "history-2",
            status: "Denied",
            effectiveDate: "2026-03-01",
            changedAt: "2026-03-01T00:00:00.000Z",
            source: "migration",
          },
        ],
      });
      vi.mocked(mockFileService.readFile).mockResolvedValue(
        createMockPersistedNormalizedFileData({
          categoryConfig: mergeCategoryConfig({
            caseStatuses: [
              { name: "Approved", colorSlot: "green", countsAsCompleted: true },
              { name: "Denied", colorSlot: "red", countsAsCompleted: true },
              { name: "Pending", colorSlot: "amber", countsAsCompleted: false },
            ],
          }),
          people: [primaryPerson],
          cases: [
            createCaseWithPrimaryApplicant(primaryPerson, {
              status: "Approved" as CaseStatus,
              caseRecord: {
                status: "Approved" as CaseStatus,
                applicationDate: "1999-04-01",
                applicationType: "Stale Legacy Type",
                withWaiver: false,
                retroRequested: "1999-03-01",
                retroMonths: [],
                appValidated: false,
                agedDisabledVerified: false,
                citizenshipVerified: false,
                residencyVerified: false,
                avsConsentDate: "",
                voterFormStatus: "",
                intakeCompleted: true,
              },
            }),
          ],
          applications: [olderTerminalApplication, newerTerminalApplication],
        }),
      );
      vi.mocked(mockFileService.writeFile).mockResolvedValue(true);

      // ACT
      const result = await caseService.updateCaseStatus("case-1", "Pending");

      // ASSERT
      expect(result.status).toBe("Pending");
      expect(result.caseRecord.status).toBe("Pending");
      expect(mockFileService.writeFile).toHaveBeenCalledTimes(1);
      const writtenData = vi.mocked(mockFileService.writeFile).mock.calls[0][0];
      expect(writtenData.applications).toHaveLength(2);
      expect(writtenData.applications.find((application: { id: string }) => application.id === "application-older-terminal")).toMatchObject({
        id: "application-older-terminal",
        status: "Pending",
        applicationDate: "2026-01-01",
        applicationType: "Renewal",
        hasWaiver: true,
        retroRequestedAt: "2025-12-01",
        retroMonths: ["2025-12"],
        verification: {
          isAppValidated: true,
          isAgedDisabledVerified: true,
          isCitizenshipVerified: true,
          isResidencyVerified: true,
          avsConsentDate: "2026-01-02",
          voterFormStatus: "requested",
          isIntakeCompleted: false,
        },
      });
      expect(
        writtenData.applications.find((application: { id: string }) => application.id === "application-older-terminal")?.statusHistory,
      ).toHaveLength(2);
      expect(
        writtenData.applications.find((application: { id: string }) => application.id === "application-older-terminal")?.statusHistory[1],
      ).toMatchObject({
        status: "Pending",
        source: "user",
      });
      expect(writtenData.applications.find((application: { id: string }) => application.id === "application-newer-terminal")).toEqual(
        newerTerminalApplication,
      );
    });

    it("aligns the status update transaction timestamp across case and application records", async () => {
      // ARRANGE
      const originalTouchCaseTimestamps = fileStorage.touchCaseTimestamps.bind(fileStorage);
      vi.spyOn(fileStorage, "touchCaseTimestamps").mockImplementation(
        createClockSkewTouchCaseTimestamps(
          TEST_SKEWED_TRANSACTION_TIMESTAMP,
          originalTouchCaseTimestamps,
        ),
      );
      vi.mocked(mockFileService.readFile).mockResolvedValue(
        createMockPersistedNormalizedFileData({
          people: [createMockPerson({ id: "person-1" })],
          cases: [
            createCaseWithPrimaryApplicant(createMockPerson({ id: "person-1" }), {
              status: "Pending",
              caseRecord: {
                status: "Pending",
              },
            }),
          ],
          applications: [createPendingApplicationForCase("person-1")],
        }),
      );
      vi.mocked(mockFileService.writeFile).mockResolvedValue(true);

      await withFrozenSystemTime(TEST_TRANSACTION_TIMESTAMP, async () => {
        // ACT
        const result = await caseService.updateCaseStatus("case-1", "Approved" as CaseStatus);

        // ASSERT
        expect(result.updatedAt).toBe(TEST_TRANSACTION_TIMESTAMP);
      });

      const writtenData = vi.mocked(mockFileService.writeFile).mock.calls[0][0];
      expect(writtenData.cases[0].updatedAt).toBe(TEST_TRANSACTION_TIMESTAMP);
      expect(writtenData.cases[0].caseRecord.updatedDate).toBe(TEST_TRANSACTION_TIMESTAMP);
      expect(writtenData.activityLog[0].timestamp).toBe(TEST_TRANSACTION_TIMESTAMP);
      expect(writtenData.applications[0].updatedAt).toBe(TEST_TRANSACTION_TIMESTAMP);
      expect(writtenData.applications[0].statusHistory[1]).toMatchObject({
        status: "Approved",
        effectiveDate: "2026-04-08",
        changedAt: TEST_TRANSACTION_TIMESTAMP,
      });
    });

    it("does not write or append application status history when the status is unchanged", async () => {
      // ARRANGE
      vi.mocked(mockFileService.readFile).mockResolvedValue(
        createMockPersistedNormalizedFileData({
          people: [createMockPerson({ id: "person-1" })],
          cases: [
            createCaseWithPrimaryApplicant(createMockPerson({ id: "person-1" }), {
              status: "Pending",
              caseRecord: {
                status: "Pending",
              },
            }),
          ],
          applications: [createPendingApplicationForCase("person-1")],
        }),
      );

      // ACT
      const result = await caseService.updateCaseStatus("case-1", "Pending");

      // ASSERT
      expect(result.caseRecord.status).toBe("Pending");
      expect(mockFileService.writeFile).not.toHaveBeenCalled();
    });
  });
});
