import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockCaseDisplay, createMockPerson, createMockStoredCase } from "@/src/test/testUtils";
import type AutosaveFileService from "@/utils/AutosaveFileService";
import { FileStorageService } from "@/utils/services/FileStorageService";
import { CaseService } from "@/utils/services/CaseService";
import type { PersistedCase } from "@/types/case";

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

  beforeEach(() => {
    const mockFileService = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      broadcastDataUpdate: vi.fn(),
    } as unknown as AutosaveFileService;

    const fileStorage = new FileStorageService({
      fileService: mockFileService,
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

  it("falls back to the case record person reference when no primary flag exists", () => {
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

    const result = caseService.hydrate(persistedCaseData, [primaryPerson]);

    expect(result.person).toMatchObject({ id: "person-1" });
    expect(result.linkedPeople).toEqual([
      {
        ref: { personId: "person-1", role: "applicant", isPrimary: false },
        person: expect.objectContaining({ id: "person-1" }),
      },
    ]);
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

  it("rebuilds persisted people refs from linkedPeople when people is missing", () => {
    const { primaryPerson, linkedPerson, runtimeCase } = createLinkedRuntimeCase();

    const result = caseService.dehydrate({
      ...runtimeCase,
      people: undefined,
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
    });

    expect(result.people).toEqual([
      { personId: "person-1", role: "applicant", isPrimary: true },
      { personId: "person-2", role: "household_member", isPrimary: false },
    ]);
  });
});
