import { describe, expect, it } from "vitest";

import { createMockPerson, createMockStoredCase } from "@/src/test/testUtils";
import { generateCaseSummary } from "@/domain/templates";

describe("generateCaseSummary relationships compatibility", () => {
  it("renders linked and standalone normalized relationships for the primary person", () => {
    const linkedSpouse = createMockPerson({
      id: "person-2",
      firstName: "Jordan",
      lastName: "Spouse",
      name: "Jordan Spouse",
      phone: "5554443333",
    });
    const primaryPerson = createMockPerson({
      id: "person-1",
      firstName: "Taylor",
      lastName: "Applicant",
      name: "Taylor Applicant",
      relationships: [],
      normalizedRelationships: [
        {
          id: "rel-1",
          type: "Spouse",
          targetPersonId: "person-2",
        },
        {
          id: "rel-2",
          type: "Authorized Rep",
          targetPersonId: null,
          displayNameFallback: "Pat Advocate",
          legacyPhone: "5552221111",
        },
      ],
    });

    const summary = generateCaseSummary({
      ...createMockStoredCase({
        person: primaryPerson,
        people: [
          { personId: "person-1", role: "applicant", isPrimary: true },
          { personId: "person-2", role: "household_member", isPrimary: false },
        ],
      }),
      linkedPeople: [
        {
          ref: { personId: "person-1", role: "applicant", isPrimary: true },
          person: primaryPerson,
        },
        {
          ref: { personId: "person-2", role: "household_member", isPrimary: false },
          person: linkedSpouse,
        },
      ],
    });

    expect(summary).toContain("Relationships/Representatives");
    expect(summary).toContain("Spouse | Jordan Spouse | (555) 444-3333");
    expect(summary).toContain("Authorized Rep | Pat Advocate | (555) 222-1111");
  });
});
