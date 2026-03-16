import { describe, expect, it } from "vitest";

import { createMockPerson, createMockStoredCase, omitHydratedPerson } from "@/src/test/testUtils";
import type { Person, StoredCase } from "@/types/case";

import {
  getPrimaryCasePerson,
  getLinkedCasePersonRoleLabel,
  getPrimaryCasePersonForDisplay,
  getPrimaryCasePersonRef,
} from "../people";

function createPrimaryLinkedCase(options: {
  primaryPerson: Person;
  hydratedPerson?: Person;
}) {
  const caseData = createMockStoredCase({
    ...(options.hydratedPerson ? { person: options.hydratedPerson } : {}),
    linkedPeople: [
      {
        ref: { personId: options.primaryPerson.id, role: "applicant", isPrimary: true },
        person: options.primaryPerson,
      },
    ],
    caseRecord: {
      ...createMockStoredCase().caseRecord,
      personId: options.primaryPerson.id,
    },
  });

  return caseData;
}

function createPrimaryLinkedCaseWithoutHydratedPerson(primaryPerson: Person) {
  return omitHydratedPerson(createPrimaryLinkedCase({ primaryPerson }));
}

function createLinkedPerson(
  personId: string,
  role: NonNullable<StoredCase["linkedPeople"]>[number]["ref"]["role"],
  overrides: Partial<Person>,
) {
  const person = createMockPerson({
    id: personId,
    ...overrides,
  });

  return {
    ref: { personId, role, isPrimary: false },
    person,
  };
}

describe("case people helpers", () => {
  it("prefers the hydrated person for legacy non-UI callers", () => {
    // Arrange
    const staleHydratedPerson = createMockPerson({
      id: "person-2",
      firstName: "Legacy",
      lastName: "Hydrated",
      name: "Legacy Hydrated",
    });
    const normalizedPrimaryPerson = createMockPerson({
      id: "person-1",
      firstName: "Normalized",
      lastName: "Primary",
      name: "Normalized Primary",
    });
    const caseData = createPrimaryLinkedCase({
      hydratedPerson: staleHydratedPerson,
      primaryPerson: normalizedPrimaryPerson,
    });

    // Act
    const result = getPrimaryCasePerson(caseData);

    // Assert
    expect(result).toMatchObject({ id: "person-2", name: "Legacy Hydrated" });
  });

  it("falls back to the normalized primary person when the hydrated person is missing", () => {
    // Arrange
    const normalizedPrimaryPerson = createMockPerson({
      id: "person-1",
      firstName: "Fallback",
      lastName: "Primary",
      name: "Fallback Primary",
    });
    const caseData = createPrimaryLinkedCaseWithoutHydratedPerson(normalizedPrimaryPerson);

    // Act
    const result = getPrimaryCasePerson(caseData);

    // Assert
    expect(result).toMatchObject({ id: "person-1", name: "Fallback Primary" });
  });

  it("prefers the normalized primary person for display callers", () => {
    // Arrange
    const staleHydratedPerson = createMockPerson({
      id: "person-2",
      firstName: "Legacy",
      lastName: "Hydrated",
      name: "Legacy Hydrated",
    });
    const normalizedPrimaryPerson = createMockPerson({
      id: "person-1",
      firstName: "Normalized",
      lastName: "Primary",
      name: "Normalized Primary",
    });
    const caseData = createPrimaryLinkedCase({
      hydratedPerson: staleHydratedPerson,
      primaryPerson: normalizedPrimaryPerson,
    });

    // Act
    const result = getPrimaryCasePersonForDisplay(caseData);

    // Assert
    expect(result).toMatchObject({ id: "person-1", name: "Normalized Primary" });
  });

  it("falls back to the first linked ref when no explicit primary ref matches", () => {
    // Arrange
    const firstLinkedPerson = createLinkedPerson("person-10", "household_member", {
      firstName: "First",
      lastName: "Linked",
      name: "First Linked",
    });
    const secondLinkedPerson = createLinkedPerson("person-20", "dependent", {
      firstName: "Second",
      lastName: "Linked",
      name: "Second Linked",
    });
    const caseData = createMockStoredCase({
      person: createMockPerson({ id: "person-999", name: "Detached Person" }),
      linkedPeople: [firstLinkedPerson, secondLinkedPerson],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: "person-missing",
      },
    });

    // Act
    const result = getPrimaryCasePersonRef(caseData);

    // Assert
    expect(result).toEqual({
      personId: "person-10",
      role: "household_member",
      isPrimary: false,
    });
  });

  it("uses the hydrated household relationship type for linked household labels", () => {
    // Arrange
    const primaryPerson = createMockPerson({
      id: "person-1",
      name: "Primary Applicant",
      normalizedRelationships: [
        {
          id: "rel-1",
          type: "Spouse",
          targetPersonId: "person-2",
        },
      ],
    });
    const linkedHouseholdPerson = createMockPerson({
      id: "person-2",
      name: "Morgan Member",
    });
    const caseData = createMockStoredCase({
      person: primaryPerson,
      linkedPeople: [
        {
          ref: { personId: primaryPerson.id, role: "applicant", isPrimary: true },
          person: primaryPerson,
        },
        {
          ref: { personId: linkedHouseholdPerson.id, role: "household_member", isPrimary: false },
          person: linkedHouseholdPerson,
        },
      ],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: primaryPerson.id,
      },
    });

    // Act
    const result = getLinkedCasePersonRoleLabel(
      caseData,
      linkedHouseholdPerson,
      "household_member",
    );

    // Assert
    expect(result).toBe("Spouse");
  });

  it("falls back to the generic household label when relationship type is missing", () => {
    // Arrange
    const primaryPerson = createMockPerson({
      id: "person-1",
      name: "Primary Applicant",
      normalizedRelationships: [
        {
          id: "rel-1",
          type: " ",
          targetPersonId: "person-2",
        },
      ],
    });
    const linkedHouseholdPerson = createMockPerson({
      id: "person-2",
      name: "Morgan Member",
    });
    const caseData = createMockStoredCase({
      person: primaryPerson,
      linkedPeople: [
        {
          ref: { personId: primaryPerson.id, role: "applicant", isPrimary: true },
          person: primaryPerson,
        },
        {
          ref: { personId: linkedHouseholdPerson.id, role: "household_member", isPrimary: false },
          person: linkedHouseholdPerson,
        },
      ],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: primaryPerson.id,
      },
    });

    // Act
    const result = getLinkedCasePersonRoleLabel(
      caseData,
      linkedHouseholdPerson,
      "household_member",
    );

    // Assert
    expect(result).toBe("Household member");
  });

  it("preserves unusual relationship types instead of replacing them with the generic label", () => {
    // Arrange
    const primaryPerson = createMockPerson({
      id: "person-1",
      name: "Primary Applicant",
      normalizedRelationships: [
        {
          id: "rel-1",
          type: "Former Guardian",
          targetPersonId: null,
          legacyPhone: "5550002222",
          displayNameFallback: "Morgan Member",
        },
      ],
    });
    const linkedHouseholdPerson = createMockPerson({
      id: "person-2",
      firstName: "Morgan",
      lastName: "Member",
      name: "Morgan Member",
      phone: "5550002222",
    });
    const caseData = createMockStoredCase({
      person: primaryPerson,
      linkedPeople: [
        {
          ref: { personId: primaryPerson.id, role: "applicant", isPrimary: true },
          person: primaryPerson,
        },
        {
          ref: { personId: linkedHouseholdPerson.id, role: "household_member", isPrimary: false },
          person: linkedHouseholdPerson,
        },
      ],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: primaryPerson.id,
      },
    });

    // Act
    const result = getLinkedCasePersonRoleLabel(
      caseData,
      linkedHouseholdPerson,
      "household_member",
    );

    // Assert
    expect(result).toBe("Former Guardian");
  });
});
