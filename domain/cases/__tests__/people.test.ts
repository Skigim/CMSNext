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

function createHouseholdRoleLabelCase(options: {
  primaryPerson: Person;
  linkedHouseholdPerson: Person;
}): StoredCase {
  return createMockStoredCase({
    person: options.primaryPerson,
    linkedPeople: [
      {
        ref: { personId: options.primaryPerson.id, role: "applicant", isPrimary: true },
        person: options.primaryPerson,
      },
      {
        ref: {
          personId: options.linkedHouseholdPerson.id,
          role: "household_member",
          isPrimary: false,
        },
        person: options.linkedHouseholdPerson,
      },
    ],
    caseRecord: {
      ...createMockStoredCase().caseRecord,
      personId: options.primaryPerson.id,
    },
  });
}

function createHouseholdRoleLabelScenario(options: {
  title: string;
  primaryPerson: Person;
  linkedHouseholdPerson: Person;
  expectedLabel: string;
}) {
  return {
    title: options.title,
    caseData: createHouseholdRoleLabelCase({
      primaryPerson: options.primaryPerson,
      linkedHouseholdPerson: options.linkedHouseholdPerson,
    }),
    linkedHouseholdPerson: options.linkedHouseholdPerson,
    expectedLabel: options.expectedLabel,
  };
}

describe("case people helpers", () => {
  it.each([
    {
      title: "prefers the normalized primary person for all primary-person callers",
      caseData: createPrimaryLinkedCase({
        hydratedPerson: createMockPerson({
          id: "person-2",
          firstName: "Legacy",
          lastName: "Hydrated",
          name: "Legacy Hydrated",
        }),
        primaryPerson: createMockPerson({
          id: "person-1",
          firstName: "Normalized",
          lastName: "Primary",
          name: "Normalized Primary",
        }),
      }),
      resolver: getPrimaryCasePerson,
      expectedPerson: { id: "person-1", name: "Normalized Primary" },
    },
    {
      title: "falls back to the normalized primary person when the hydrated person is missing",
      caseData: createPrimaryLinkedCaseWithoutHydratedPerson(
        createMockPerson({
          id: "person-1",
          firstName: "Fallback",
          lastName: "Primary",
          name: "Fallback Primary",
        }),
      ),
      resolver: getPrimaryCasePerson,
      expectedPerson: { id: "person-1", name: "Fallback Primary" },
    },
    {
      title: "prefers the normalized primary person for display callers",
      caseData: createPrimaryLinkedCase({
        hydratedPerson: createMockPerson({
          id: "person-2",
          firstName: "Legacy",
          lastName: "Hydrated",
          name: "Legacy Hydrated",
        }),
        primaryPerson: createMockPerson({
          id: "person-1",
          firstName: "Normalized",
          lastName: "Primary",
          name: "Normalized Primary",
        }),
      }),
      resolver: getPrimaryCasePersonForDisplay,
      expectedPerson: { id: "person-1", name: "Normalized Primary" },
    },
  ])("$title", ({ caseData, resolver, expectedPerson }) => {
    // Arrange (scenario parameters are defined in the table above)

    // Act
    const result = resolver(caseData);

    // Assert
    expect(result).toMatchObject(expectedPerson);
  });

  it("returns null when no normalized primary ref exists", () => {
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
    });

    // Act
    const result = getPrimaryCasePersonRef(caseData);

    // Assert
    expect(result).toBeNull();
  });

  it.each([
    createHouseholdRoleLabelScenario({
      title: "uses the hydrated household relationship type for linked household labels",
      primaryPerson: createMockPerson({
        id: "person-1",
        name: "Primary Applicant",
        normalizedRelationships: [
          {
            id: "rel-1",
            type: "Spouse",
            targetPersonId: "person-2",
          },
        ],
      }),
      linkedHouseholdPerson: createMockPerson({
        id: "person-2",
        name: "Morgan Member",
      }),
      expectedLabel: "Spouse",
    }),
    createHouseholdRoleLabelScenario({
      title: "falls back to the generic household label when relationship type is missing",
      primaryPerson: createMockPerson({
        id: "person-1",
        name: "Primary Applicant",
        normalizedRelationships: [
          {
            id: "rel-1",
            type: " ",
            targetPersonId: "person-2",
          },
        ],
      }),
      linkedHouseholdPerson: createMockPerson({
        id: "person-2",
        name: "Morgan Member",
      }),
      expectedLabel: "Household member",
    }),
    createHouseholdRoleLabelScenario({
      title: "preserves unusual relationship types instead of replacing them with the generic label",
      primaryPerson: createMockPerson({
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
      }),
      linkedHouseholdPerson: createMockPerson({
        id: "person-2",
        firstName: "Morgan",
        lastName: "Member",
        name: "Morgan Member",
        phone: "5550002222",
      }),
      expectedLabel: "Former Guardian",
    }),
    createHouseholdRoleLabelScenario({
      title: "matches household relationship labels through normalized display-name fallback",
      primaryPerson: createMockPerson({
        id: "person-1",
        name: "Primary Applicant",
        normalizedRelationships: [
          {
            id: "rel-1",
            type: "Adult Child",
            targetPersonId: null,
            displayNameFallback: "  MORGAN   MEMBER  ",
          },
        ],
      }),
      linkedHouseholdPerson: createMockPerson({
        id: "person-2",
        name: " Morgan   Member ",
        firstName: "",
        lastName: "",
        phone: "",
      }),
      expectedLabel: "Adult Child",
    }),
  ])("$title", ({ caseData, linkedHouseholdPerson, expectedLabel }) => {
    // Act
    const result = getLinkedCasePersonRoleLabel(
      caseData,
      linkedHouseholdPerson,
      "household_member",
    );

    // Assert
    expect(result).toBe(expectedLabel);
  });
});
