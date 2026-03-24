import { describe, expect, it } from "vitest";

import { createMockPerson, createMockStoredCase, omitHydratedPerson } from "@/src/test/testUtils";
import type { Person, PersonRelationship, StoredCase } from "@/types/case";

import {
  createCaseRecordData,
  createIntakeFormData,
  createPersonData,
  resolveCaseRecordIntakeCompleted,
  caseNeedsIntake,
} from "../factories";

function createPrimaryLinkedPerson() {
  return createMockPerson({
    id: "person-test-1",
    firstName: "Sam",
    lastName: "Tester",
    name: "Sam Tester",
  });
}

function createHouseholdHydrationCase(options: {
  linkedHouseholdMember: Person;
  normalizedRelationships: PersonRelationship[];
}) {
  const primaryPerson = createPrimaryLinkedPerson();

  return createMockStoredCase({
    person: {
      ...primaryPerson,
      normalizedRelationships: options.normalizedRelationships,
    },
    people: [
      { personId: primaryPerson.id, role: "applicant", isPrimary: true },
      { personId: "person-2", role: "household_member", isPrimary: false },
    ],
    linkedPeople: [
      {
        ref: { personId: primaryPerson.id, role: "applicant", isPrimary: true },
        person: {
          ...primaryPerson,
          normalizedRelationships: options.normalizedRelationships,
        },
      },
      {
        ref: { personId: "person-2", role: "household_member", isPrimary: false },
        person: options.linkedHouseholdMember,
      },
    ],
  });
}

function createStructuredPhoneRelationship(
  overrides: Partial<PersonRelationship> = {},
): PersonRelationship {
  return {
    id: "rel-phone-1",
    type: "Spouse",
    targetPersonId: null,
    legacyPhone: "5559876543",
    ...overrides,
  };
}

describe("createPersonData", () => {
  it("falls back to the primary linked person when the hydrated primary person is unavailable", () => {
    // Arrange
    const primaryPerson = createMockPerson({
      id: "person-1",
      firstName: "Primary",
      lastName: "Applicant",
      email: "primary@example.com",
      livingArrangement: "Assisted Living",
      address: {
        street: "100 Main St",
        city: "Omaha",
        state: "NE",
        zip: "68102",
      },
      mailingAddress: {
        street: "PO Box 1",
        city: "Omaha",
        state: "NE",
        zip: "68101",
        sameAsPhysical: false,
      },
    });
    const linkedPerson = createMockPerson({
      id: "person-2",
      firstName: "Linked",
      lastName: "Person",
    });
    const caseWithoutHydratedPerson = {
      ...omitHydratedPerson(
        createMockStoredCase({
          caseRecord: {
            ...createMockStoredCase().caseRecord,
            personId: "person-1",
          },
          people: [
            { personId: "person-1", role: "applicant", isPrimary: true },
            { personId: "person-2", role: "household_member", isPrimary: false },
          ],
        })
      ),
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
    };

    // Intentional: this test exercises the migration fallback when the hydrated
    // primary person is temporarily unavailable on the case object.
    const existingCase = caseWithoutHydratedPerson as StoredCase;

    // Act
    const result = createPersonData(existingCase, {
      livingArrangement: "Home",
      defaultState: "IA",
    });

    // Assert
    expect(result).toMatchObject({
      firstName: "Primary",
      lastName: "Applicant",
      email: "primary@example.com",
      livingArrangement: "Assisted Living",
      address: {
        street: "100 Main St",
        city: "Omaha",
        state: "NE",
        zip: "68102",
      },
      mailingAddress: {
        street: "PO Box 1",
        city: "Omaha",
        state: "NE",
        zip: "68101",
        sameAsPhysical: false,
      },
    });
    expect(result).not.toHaveProperty("status");
  });
});

describe("createCaseRecordData", () => {
  it("defaults intakeCompleted to true for new and historical cases", () => {
    // Arrange
    const historicalCase = createMockStoredCase();
    delete (historicalCase.caseRecord as { intakeCompleted?: boolean }).intakeCompleted;

    // Act
    const blankRecord = createCaseRecordData();
    const historicalRecord = createCaseRecordData(historicalCase);

    // Assert
    expect(blankRecord.intakeCompleted).toBe(true);
    expect(historicalRecord.intakeCompleted).toBe(true);
  });

  it("preserves an existing incomplete quick-add case flag", () => {
    // Arrange
    const existingCase = createMockStoredCase({
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        intakeCompleted: false,
      },
    });

    // Act
    const result = createCaseRecordData(existingCase);

    // Assert
    expect(result.intakeCompleted).toBe(false);
  });
});

describe("resolveCaseRecordIntakeCompleted", () => {
  it("defaults to true when all candidate values are missing", () => {
    // Arrange / Act
    const result = resolveCaseRecordIntakeCompleted(undefined, null);

    // Assert
    expect(result).toBe(true);
  });

  it("preserves the first defined value including false", () => {
    // Arrange / Act
    const falseResult = resolveCaseRecordIntakeCompleted(false, true);
    const trueResult = resolveCaseRecordIntakeCompleted(undefined, true);

    // Assert
    expect(falseResult).toBe(false);
    expect(trueResult).toBe(true);
  });
});

describe("caseNeedsIntake", () => {
  it("returns true only for explicitly incomplete cases", () => {
    // Arrange
    const incompleteCase = createMockStoredCase({
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        intakeCompleted: false,
      },
    });
    const completeCase = createMockStoredCase({
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        intakeCompleted: true,
      },
    });

    // Act
    const incompleteResult = caseNeedsIntake(incompleteCase);
    const completeResult = caseNeedsIntake(completeCase);
    const undefinedResult = caseNeedsIntake();

    // Assert
    expect(incompleteResult).toBe(true);
    expect(completeResult).toBe(false);
    expect(undefinedResult).toBe(false);
  });
});

describe("createIntakeFormData", () => {
  it("prefills supported intake fields from an existing stored case", () => {
    // Arrange
    const existingCase = createMockStoredCase({
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        mcn: "MCN-EDIT-1",
        applicationDate: "2026-02-01",
        caseType: "ABD Medicaid",
        applicationType: "Renewal",
        livingArrangement: "Assisted Living",
        withWaiver: true,
        admissionDate: "2026-02-10",
        organizationId: "org-edit",
        retroRequested: "Jan, Feb",
        appValidated: true,
        agedDisabledVerified: true,
        citizenshipVerified: true,
        residencyVerified: true,
        contactMethods: ["mail", "email"],
        voterFormStatus: "requested",
        pregnancy: true,
        avsConsentDate: "2026-02-12",
        maritalStatus: "Married",
      },
      person: createMockPerson({
        firstName: "Pat",
        lastName: "Editor",
        phone: "5551234567",
        email: "pat@example.com",
        dateOfBirth: "1980-03-04",
        ssn: "123-45-6789",
        address: {
          street: "100 Main St",
          apt: "Apt 3",
          city: "Omaha",
          state: "NE",
          zip: "68102",
        },
        mailingAddress: {
          street: "PO Box 12",
          apt: "Suite 5",
          city: "Omaha",
          state: "NE",
          zip: "68101",
          sameAsPhysical: false,
        },
      }),
    });

    // Act
    const result = createIntakeFormData(existingCase);

    // Assert
    expect(result).toMatchObject({
      firstName: "Pat",
      lastName: "Editor",
      phone: "5551234567",
      email: "pat@example.com",
      dateOfBirth: "1980-03-04",
      ssn: "123-45-6789",
      maritalStatus: "Married",
      address: {
        street: "100 Main St",
        apt: "Apt 3",
        city: "Omaha",
        state: "NE",
        zip: "68102",
      },
      mailingAddress: {
        street: "PO Box 12",
        apt: "Suite 5",
        city: "Omaha",
        state: "NE",
        zip: "68101",
        sameAsPhysical: false,
      },
      mcn: "MCN-EDIT-1",
      applicationDate: "2026-02-01",
      caseType: "ABD Medicaid",
      applicationType: "Renewal",
      livingArrangement: "Assisted Living",
      withWaiver: true,
      admissionDate: "2026-02-10",
      organizationId: "org-edit",
      retroRequested: "Jan, Feb",
      appValidated: true,
      agedDisabledVerified: true,
      citizenshipVerified: true,
      residencyVerified: true,
      contactMethods: ["mail", "email"],
      voterFormStatus: "requested",
      pregnancy: true,
      avsConsentDate: "2026-02-12",
    });
    expect(result).not.toHaveProperty("status");
  });

  it("hydrates relationshipType from a normalized target match", () => {
    // Arrange
    const linkedHouseholdMember = createMockPerson({
      id: "person-2",
      firstName: "Jordan",
      lastName: "Tester",
      name: "Jordan Tester",
      phone: "5559876543",
      email: "jordan@example.com",
      dateOfBirth: "1985-02-03",
      livingArrangement: "Community",
      address: {
        street: "10 Main St",
        city: "Omaha",
        state: "NE",
        zip: "68102",
      },
      mailingAddress: {
        street: "PO Box 7",
        city: "Omaha",
        state: "NE",
        zip: "68101",
        sameAsPhysical: false,
      },
    });
    const existingCase = createHouseholdHydrationCase({
      linkedHouseholdMember,
      normalizedRelationships: [
        { id: "rel-1", type: "Spouse", targetPersonId: "person-2" },
      ],
    });

    // Act
    const result = createIntakeFormData(existingCase);

    // Assert
    expect(result.householdMembers).toEqual([
      expect.objectContaining({
        personId: "person-2",
        relationshipType: "Spouse",
        role: "household_member",
        firstName: "Jordan",
        lastName: "Tester",
        phone: "5559876543",
        email: "jordan@example.com",
        dateOfBirth: "1985-02-03",
      }),
    ]);
    expect(result.householdMembers[0]?.relationshipType).toBe("Spouse");
    expect(result.householdMembers[0]).not.toHaveProperty("status");
  });

  it("falls back to a linked person's first and last name when display-name hydration is needed", () => {
    // Arrange
    const linkedHouseholdMember = createMockPerson({
      id: "person-2",
      firstName: "Jordan",
      lastName: "Tester",
      name: "",
      phone: "5559876543",
    });
    const existingCase = createHouseholdHydrationCase({
      linkedHouseholdMember,
      normalizedRelationships: [
        {
          id: "rel-1",
          type: "Spouse",
          targetPersonId: null,
          displayNameFallback: " Jordan   Tester ",
        },
      ],
    });

    // Act
    const result = createIntakeFormData(existingCase);

    // Assert
    expect(result.householdMembers[0]?.relationshipType).toBe("Spouse");
    expect(result.householdMembers[0]).toEqual(
      expect.objectContaining({
        personId: "person-2",
        firstName: "Jordan",
        lastName: "Tester",
      }),
    );
  });

  it("hydrates relationshipType from a unique normalized phone fallback", () => {
    // Arrange
    const linkedHouseholdMember = createMockPerson({
      id: "person-2",
      firstName: "Jordan",
      lastName: "Tester",
      phone: "(555) 987-6543",
    });
    // Intentional: stored and linked phone values use different formatting so
    // the test exercises normalizePhoneNumber()-based fallback matching.
    const existingCase = createHouseholdHydrationCase({
      linkedHouseholdMember,
      normalizedRelationships: [
        createStructuredPhoneRelationship({
          legacyPhone: "555-987-6543",
        }),
      ],
    });

    // Act
    const result = createIntakeFormData(existingCase);

    // Assert
    expect(result.householdMembers[0]?.relationshipType).toBe("Spouse");
    expect(result.householdMembers[0]?.relationshipId).toBe("rel-phone-1");
  });

  it("does not hydrate relationshipType from an ambiguous normalized phone fallback", () => {
    // Arrange
    const linkedHouseholdMember = createMockPerson({
      id: "person-2",
      firstName: "Jordan",
      lastName: "Tester",
      phone: "(555) 987-6543",
    });
    const existingCase = createHouseholdHydrationCase({
      linkedHouseholdMember,
      normalizedRelationships: [
        createStructuredPhoneRelationship(),
        // Intentional: both legacy phone variants normalize to the same digits,
        // so no unique structured fallback should be selected.
        createStructuredPhoneRelationship({
          id: "rel-phone-2",
          type: "Child",
          legacyPhone: "555-987-6543",
        }),
      ],
    });

    // Act
    const result = createIntakeFormData(existingCase);

    // Assert
    expect(result.householdMembers[0]?.relationshipType).toBe("");
    expect(result.householdMembers[0]?.relationshipId).toBeUndefined();
  });

  it("does not hydrate relationshipType from an ambiguous display-name fallback", () => {
    // Arrange
    const linkedHouseholdMember = createMockPerson({
      id: "person-2",
      firstName: "Jordan",
      lastName: "Tester",
      name: "",
      phone: "",
    });
    const existingCase = createHouseholdHydrationCase({
      linkedHouseholdMember,
      normalizedRelationships: [
        {
          id: "rel-name-1",
          type: "Spouse",
          targetPersonId: null,
          displayNameFallback: "Jordan Tester",
        },
        {
          id: "rel-name-2",
          type: "Child",
          targetPersonId: null,
          displayNameFallback: " Jordan   Tester ",
        },
      ],
    });

    // Act
    const result = createIntakeFormData(existingCase);

    // Assert
    expect(result.householdMembers[0]?.relationshipType).toBe("");
    expect(result.householdMembers[0]?.relationshipId).toBeUndefined();
  });

  it("does not project relationship-only entries into household drafts without linked people", () => {
    // Arrange
    const existingCase = createMockStoredCase({
      person: createMockPerson({
        firstName: "Sam",
        lastName: "Tester",
        relationships: [{ id: "rel-1", type: "Child", name: "Casey Tester", phone: "" }],
      }),
    });

    // Act
    const result = createIntakeFormData(existingCase);

    // Assert
    expect(result.householdMembers).toEqual([]);
    expect(result.relationships).toEqual([
      expect.objectContaining({
        type: "Child",
        name: "Casey Tester",
      }),
    ]);
  });
});
