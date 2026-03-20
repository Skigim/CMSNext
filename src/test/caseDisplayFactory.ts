import type { CaseDisplay } from "@/types/case";

export type CaseDisplayOverrides = Partial<Omit<CaseDisplay, "person" | "caseRecord">> & {
  person?: Partial<CaseDisplay["person"]>;
  caseRecord?: Partial<CaseDisplay["caseRecord"]>;
};

export function createCaseDisplayFixture(
  overrides: CaseDisplayOverrides = {},
): CaseDisplay {
  const baseCase: CaseDisplay = {
    id: "case-1",
    name: "Test Case",
    mcn: "MCN-001",
    status: "Pending",
    priority: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    person: {
      id: "person-1",
      firstName: "Test",
      lastName: "User",
      name: "Test User",
      email: "test@example.com",
      phone: "555-555-5555",
      dateOfBirth: "1990-01-01",
      ssn: "123-45-6789",
      organizationId: null,
      livingArrangement: "Apartment",
      address: {
        street: "123 Main St",
        city: "Anytown",
        state: "CA",
        zip: "90210",
      },
      mailingAddress: {
        street: "123 Main St",
        city: "Anytown",
        state: "CA",
        zip: "90210",
        sameAsPhysical: true,
      },
      authorizedRepIds: [],
      familyMembers: [],
      createdAt: "2024-01-01T00:00:00.000Z",
      dateAdded: "2024-01-01T00:00:00.000Z",
    },
    caseRecord: {
      id: "case-record-1",
      mcn: "MCN-001",
      applicationDate: "2024-01-10",
      caseType: "LTC",
      personId: "person-1",
      spouseId: "",
      status: "Pending",
      description: "",
      priority: false,
      livingArrangement: "Apartment",
      withWaiver: false,
      admissionDate: "",
      organizationId: "",
      authorizedReps: [],
      retroRequested: "",
      financials: {
        resources: [],
        income: [],
        expenses: [],
      },
      notes: [],
      createdDate: "2024-01-01T00:00:00.000Z",
      updatedDate: "2024-01-01T00:00:00.000Z",
      intakeCompleted: true,
    },
  };

  return {
    ...baseCase,
    ...overrides,
    person: {
      ...baseCase.person,
      ...overrides.person,
    },
    caseRecord: {
      ...baseCase.caseRecord,
      ...overrides.caseRecord,
    },
  };
}
