import { describe, expect, it } from "vitest";

import { createMockPerson, createMockStoredCase, omitHydratedPerson } from "@/src/test/testUtils";
import type { Person, StoredCase } from "@/types/case";

import {
  getPrimaryCasePerson,
  getPrimaryCasePersonForDisplay,
  getPrimaryCasePersonRef,
} from "../people";

function createPrimaryLinkedCase(options: {
  primaryPerson: Person;
  hydratedPerson?: Person;
  omitHydrated?: boolean;
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

  return options.omitHydrated ? omitHydratedPerson(caseData) : caseData;
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
    const caseData = createPrimaryLinkedCase({
      primaryPerson: normalizedPrimaryPerson,
      omitHydrated: true,
    });

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
});
