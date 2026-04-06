import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockCaseDisplay,
  createMockPersistedNormalizedFileData,
  createMockNewCaseRecordData,
  createMockNewPersonData,
  createMockPerson,
  createMockStoredCase,
} from "@/src/test/testUtils";
import type AutosaveFileService from "@/utils/AutosaveFileService";
import { FileStorageService, type NormalizedFileData } from "@/utils/services/FileStorageService";
import { CaseService } from "@/utils/services/CaseService";
import type { PersistedCase } from "@/types/case";

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
    const storedCase = createMockStoredCase({
      id: "case-1",
      people: [{ personId: "person-1", role: "applicant", isPrimary: false }],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: "person-1",
      },
      person: primaryPerson,
    });
    const persistedCaseData = toPersistedCase(storedCase);

    expect(() => caseService.hydrate(persistedCaseData, [primaryPerson])).toThrow(
      "Case case-1 must have exactly one primary person ref",
    );
  });

  it("fails to hydrate when a referenced person is missing", () => {
    const primaryPerson = createMockPerson({ id: "person-1" });
    const storedCase = createMockStoredCase({
      id: "case-1",
      people: [
        { personId: "person-1", role: "applicant", isPrimary: true },
        { personId: "person-2", role: "household_member", isPrimary: false },
      ],
      person: primaryPerson,
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
});
