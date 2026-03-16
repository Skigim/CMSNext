import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FileStorageService, NormalizedFileData } from "@/utils/services/FileStorageService";
import { PersonService } from "@/utils/services/PersonService";
import { createMockPerson, createMockStoredCase } from "@/src/test/testUtils";
import { mergeCategoryConfig } from "@/types/categoryConfig";

describe("PersonService", () => {
  let service: PersonService;
  let mockFileStorage: ReturnType<typeof createMockFileStorage>;

  function createMockFileStorage() {
    let storedData: NormalizedFileData | null = null;

    return {
      readFileData: vi.fn().mockImplementation(() => Promise.resolve(storedData)),
      writeNormalizedData: vi.fn().mockImplementation((data: NormalizedFileData) => {
        storedData = data;
        return Promise.resolve();
      }),
      setData: (data: NormalizedFileData | null) => {
        storedData = data;
      },
    };
  }

  const createBaseData = (): NormalizedFileData => {
    const caseItem = createMockStoredCase({
      id: "case-1",
      person: createMockPerson({
        id: "person-1",
        firstName: "John",
        lastName: "Doe",
        name: "John Doe",
      }),
    });

    return {
      version: "2.1",
      people: [caseItem.person],
      cases: [caseItem],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    };
  };

  beforeEach(() => {
    mockFileStorage = createMockFileStorage();
    service = new PersonService({
      fileStorage: mockFileStorage as unknown as FileStorageService,
    });
  });

  it("returns the primary person for a case", async () => {
    mockFileStorage.setData(createBaseData());

    await expect(service.getPrimaryPersonForCase("case-1")).resolves.toMatchObject({
      id: "person-1",
      name: "John Doe",
    });
  });

  it("builds new people with v2.1 fields initialized", () => {
    const person = service.buildNewPerson({
      firstName: "Jane",
      lastName: "Doe",
      email: "",
      phone: "",
      dateOfBirth: "",
      ssn: "",
      livingArrangement: "Home",
      address: { street: "", city: "", state: "", zip: "" },
      mailingAddress: { street: "", city: "", state: "", zip: "", sameAsPhysical: true },
    });

    expect(person.familyMembers).toEqual([]);
    expect(person.familyMemberIds).toEqual([]);
    expect(person.legacyFamilyMemberNames).toEqual([]);
    expect(person.normalizedRelationships).toEqual([]);
    expect(person.updatedAt).toBe(person.createdAt);
    expect(person).not.toHaveProperty("status");
  });

  it("trims and deduplicates family members when building a new person", () => {
    const person = service.buildNewPerson({
      firstName: "Jane",
      lastName: "Doe",
      email: "",
      phone: "",
      dateOfBirth: "",
      ssn: "",
      livingArrangement: "Home",
      address: { street: "", city: "", state: "", zip: "" },
      mailingAddress: { street: "", city: "", state: "", zip: "", sameAsPhysical: true },
      familyMembers: [
        " 11111111-1111-4111-8111-111111111111 ",
        "11111111-1111-4111-8111-111111111111",
        "  Grandma Doe  ",
        "Grandma Doe",
        "   ",
      ],
    });

    expect(person.familyMembers).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "Grandma Doe",
    ]);
    expect(person.familyMemberIds).toEqual([
      "11111111-1111-4111-8111-111111111111",
    ]);
    expect(person.legacyFamilyMemberNames).toEqual(["Grandma Doe"]);
    expect(person).not.toHaveProperty("status");
  });

  it("upserts a person into the root people registry", () => {
    const baseData = createBaseData();
    const updatedPerson = {
      ...baseData.people[0],
      phone: "(555) 111-1111",
    };

    const updatedData = service.upsertPerson(baseData, updatedPerson);

    expect(updatedData.people).toHaveLength(1);
    expect(updatedData.people[0].phone).toBe("(555) 111-1111");
  });
});
