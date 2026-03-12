import { describe, expect, it } from "vitest";

import { createMockPerson, createMockStoredCase, omitHydratedPerson } from "@/src/test/testUtils";
import type { StoredCase } from "@/types/case";

import { createPersonData } from "../factories";

describe("createPersonData", () => {
  it("falls back to the primary linked person when the hydrated primary person is unavailable", () => {
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

    const result = createPersonData(existingCase, {
      livingArrangement: "Home",
      defaultState: "IA",
    });

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
