import { describe, expect, it } from "vitest";

import { createMockPerson, createMockStoredCase, omitHydratedPerson } from "@/src/test/testUtils";

import {
  getPrimaryCasePerson,
  getPrimaryCasePersonForDisplay,
  getPrimaryCasePersonRef,
} from "../people";

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
    const caseData = createMockStoredCase({
      person: staleHydratedPerson,
      linkedPeople: [
        {
          ref: { personId: normalizedPrimaryPerson.id, role: "applicant", isPrimary: true },
          person: normalizedPrimaryPerson,
        },
      ],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: normalizedPrimaryPerson.id,
      },
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
    const caseData = omitHydratedPerson(
      createMockStoredCase({
        linkedPeople: [
          {
            ref: { personId: normalizedPrimaryPerson.id, role: "applicant", isPrimary: true },
            person: normalizedPrimaryPerson,
          },
        ],
        caseRecord: {
          ...createMockStoredCase().caseRecord,
          personId: normalizedPrimaryPerson.id,
        },
      }),
    );

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
    const caseData = createMockStoredCase({
      person: staleHydratedPerson,
      linkedPeople: [
        {
          ref: { personId: normalizedPrimaryPerson.id, role: "applicant", isPrimary: true },
          person: normalizedPrimaryPerson,
        },
      ],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: normalizedPrimaryPerson.id,
      },
    });

    // Act
    const result = getPrimaryCasePersonForDisplay(caseData);

    // Assert
    expect(result).toMatchObject({ id: "person-1", name: "Normalized Primary" });
  });

  it("falls back to the first linked ref when no explicit primary ref matches", () => {
    // Arrange
    const firstLinkedPerson = createMockPerson({
      id: "person-10",
      firstName: "First",
      lastName: "Linked",
      name: "First Linked",
    });
    const secondLinkedPerson = createMockPerson({
      id: "person-20",
      firstName: "Second",
      lastName: "Linked",
      name: "Second Linked",
    });
    const caseData = createMockStoredCase({
      person: createMockPerson({ id: "person-999", name: "Detached Person" }),
      linkedPeople: [
        {
          ref: { personId: firstLinkedPerson.id, role: "household_member", isPrimary: false },
          person: firstLinkedPerson,
        },
        {
          ref: { personId: secondLinkedPerson.id, role: "dependent", isPrimary: false },
          person: secondLinkedPerson,
        },
      ],
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
