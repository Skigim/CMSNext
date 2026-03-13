import { describe, expect, it } from "vitest";

import { createMockPerson, createMockStoredCase, omitHydratedPerson } from "@/src/test/testUtils";
import type { StoredCase } from "@/types/case";

import { createIntakeFormData, createPersonData } from "../factories";

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
  });

  it("prefills relationships from the existing case person", () => {
    // Arrange
    const existingCase = createMockStoredCase({
      person: createMockPerson({
        firstName: "Sam",
        lastName: "Tester",
        relationships: [
          { id: "rel-1", type: "Spouse", name: "Jordan Tester", phone: "5559876543" },
          { id: "rel-2", type: "Child", name: "Casey Tester", phone: "" },
        ],
      }),
    });

    // Act
    const result = createIntakeFormData(existingCase);

    // Assert
    expect(result.relationships).toEqual([
      { id: "rel-1", type: "Spouse", name: "Jordan Tester", phone: "5559876543" },
      { id: "rel-2", type: "Child", name: "Casey Tester", phone: "" },
    ]);
  });

  it("returns an empty relationships array when the person has no relationships", () => {
    // Arrange
    const existingCase = createMockStoredCase({
      person: createMockPerson({ firstName: "Sam", lastName: "Tester" }),
    });

    // Act
    const result = createIntakeFormData(existingCase);

    // Assert
    expect(result.relationships).toEqual([]);
  });
});
