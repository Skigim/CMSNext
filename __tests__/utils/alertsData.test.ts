import { describe, expect, it } from "vitest";

import { parseStackedAlerts, createEmptyAlertsIndex } from "@/utils/alertsData";
import type { CaseDisplay } from "@/types/case";

function buildCase(partial?: Partial<CaseDisplay>): CaseDisplay {
  const now = new Date().toISOString();
  return {
    id: partial?.id ?? "case-1",
    name: partial?.name ?? "Jane Doe",
    mcn: partial?.mcn ?? "12345",
    status: partial?.status ?? "Active",
    priority: partial?.priority ?? false,
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
    person: partial?.person ?? {
      id: "person-1",
      firstName: "Jane",
      lastName: "Doe",
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "555-1234",
      dateOfBirth: now,
      ssn: "123-45-6789",
      organizationId: null,
      livingArrangement: "",
      address: {
        street: "",
        city: "",
        state: "",
        zip: "",
      },
      mailingAddress: {
        street: "",
        city: "",
        state: "",
        zip: "",
        sameAsPhysical: true,
      },
      authorizedRepIds: [],
      familyMembers: [],
      status: "Active",
      createdAt: now,
      dateAdded: now,
    },
    caseRecord: partial?.caseRecord ?? {
      id: "record-1",
      mcn: partial?.caseRecord?.mcn ?? (partial?.mcn ?? "12345"),
      applicationDate: now,
      caseType: "",
      personId: "person-1",
      spouseId: "",
      status: "Active",
      description: "",
      priority: false,
      livingArrangement: "",
      withWaiver: false,
      admissionDate: now,
      organizationId: "",
      authorizedReps: [],
      retroRequested: "",
      financials: {
        resources: [],
        income: [],
        expenses: [],
      },
      notes: [],
      createdDate: now,
      updatedDate: now,
    },
  };
}

describe("alertsData", () => {
  it("creates an empty alerts index", () => {
    const empty = createEmptyAlertsIndex();
    expect(empty.summary.total).toBe(0);
    expect(empty.alerts).toHaveLength(0);
    expect(empty.alertsByCaseId.size).toBe(0);
  });

  it("parses stacked alerts and matches cases", () => {
    const sample = "\"DEPARTMENT OF HEALTH AND HUMAN SERVICES\",\"List Position Alert \",\"Office\",\"GENEVA - ELIGIBILITY\",\"Number\n\n\",\"61704790\",\"TAYLOR HARRIS\",\"Page -1 of 1\",\"Due Date\",\"Display Date\",\"MC#\",\" Name\",\"Program\",\"Type\",\"Description\",\"Alert_Number\",,09-22-2025,12345,\"DOE,JANE\",\"MEDICAID\",\"WRKRM\",\"POLICY RESPONSE\",9996,\"    Total:\",64,\"N-FOCUS: NFO6091L01\",\"Monday, September 22, 2025   1:59 pm\"";
    const cases: CaseDisplay[] = [buildCase()];

    const result = parseStackedAlerts(sample, cases);

    expect(result.summary.total).toBe(1);
    expect(result.summary.matched).toBe(1);
    expect(result.summary.unmatched).toBe(0);
    expect(result.alertsByCaseId.get("case-1")).toHaveLength(1);

    const [alert] = result.alerts;
    expect(alert.description).toBe("POLICY RESPONSE");
    expect(alert.personName).toBe("JANE DOE");
    expect(alert.alertDate).toBe("2025-09-22T00:00:00.000Z");
    expect(alert.matchStatus).toBe("matched");
  });

  it("marks alerts without MCNs as missing", () => {
    const sample = "\"header\",,09-22-2025,,\"DOE,JANE\",\"MEDICAID\",\"WRKRM\",\"POLICY RESPONSE\",9997,\"tail\"";
    const cases: CaseDisplay[] = [buildCase({ mcn: "12345" })];

    const result = parseStackedAlerts(sample, cases);
    expect(result.summary.total).toBe(1);
    expect(result.summary.missingMcn).toBe(1);
    expect(result.alerts[0].matchStatus).toBe("missing-mcn");
  });
});
