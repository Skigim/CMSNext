import fs from "node:fs";
import path from "node:path";

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

  it("parses the canonical Nightingale sample export", () => {
    const samplePath = path.resolve(__dirname, "../../external-examples/Alerts Sample.txt");
    const sampleContent = fs.readFileSync(samplePath, "utf-8");

    const result = parseStackedAlerts(sampleContent, []);

    const totalMatches = [...sampleContent.matchAll(/" {4}Total:",([0-9]+)/g)];
    expect(totalMatches.length).toBeGreaterThan(0);

    const uniqueTotals = new Set(totalMatches.map(([, value]) => Number.parseInt(value, 10)));
    expect(uniqueTotals.size).toBe(1);

    const declaredTotal = uniqueTotals.values().next().value as number;

    expect(result.summary.total).toBe(declaredTotal);
    expect(result.summary.unmatched).toBe(declaredTotal - 1);
    expect(result.summary.missingMcn).toBe(1);

    const [latest] = result.alerts;
    expect(latest.alertDate).toBe("2026-01-10T00:00:00.000Z");
    expect(latest.personName).toBe("CHRISTOPHER ALAN DAVIS");

    const smith = result.alerts.find(alert => alert.personName === "JOHN MICHAEL SMITH");
    expect(smith?.metadata).toMatchObject({
      rawDueDate: "11-15-2025",
      rawDisplayDate: "11-17-2025",
      dueDateIso: "2025-11-15T00:00:00.000Z",
      displayDateIso: "2025-11-17T00:00:00.000Z",
    });

    const missingMcn = result.alerts.find(alert => alert.matchStatus === "missing-mcn");
    expect(missingMcn).toMatchObject({
      mcNumber: null,
      alertCode: "NOTICE",
    });

    expect(result.alerts.map(alert => alert.alertDate)).toEqual(
      [...result.alerts]
        .map(alert => alert.alertDate)
        .sort((a, b) => new Date(b || 0).getTime() - new Date(a || 0).getTime()),
    );
  });

  const buildAlertRow = ({
    dueDate,
    displayDate,
    mcNumber,
    name,
    program,
    type,
    description,
    alertNumber,
  }: {
    dueDate: string;
    displayDate?: string;
    mcNumber: string;
    name: string;
    program: string;
    type: string;
    description: string;
    alertNumber: string;
  }): string => {
    const escape = (value: string) => value.replace(/"/g, '""');
    const columns: (string | number)[] = [
      '"DEPARTMENT OF HEALTH AND HUMAN SERVICES"',
      '"List Position Alert "',
      '"Office"',
      '"GENEVA - ELIGIBILITY"',
      '"Number"',
      '"61704790"',
      '"TAYLOR HARRIS"',
      '"Page -1 of 1"',
      '"Due Date"',
      '"Display Date"',
      '"MC#"',
      '" Name"',
      '"Program"',
      '"Type"',
      '"Description"',
      '"Alert_Number"',
      "",
      dueDate,
    ];

    columns.push(displayDate ?? "");

    columns.push(
      mcNumber,
      `"${escape(name)}"`,
      `"${escape(program)}"`,
      `"${escape(type)}"`,
      `"${escape(description)}"`,
      alertNumber,
      '"    Total:"',
      5,
      '"N-FOCUS: NFO6091L01"',
      '"Monday, October 6, 2025   8:38 am"',
    );

    return columns.join(",");
  };

  it("parses alert rows and matches cases", () => {
    const sample = buildAlertRow({
      dueDate: "11-15-2025",
      displayDate: "11-17-2025",
      mcNumber: "12345",
      name: "DOE,JANE",
      program: "MEDICAID",
      type: "WRKRM",
      description: "POLICY RESPONSE",
      alertNumber: "9996",
    });
    const cases: CaseDisplay[] = [buildCase()];

    const result = parseStackedAlerts(sample, cases);

    expect(result.summary.total).toBe(1);
    expect(result.summary.matched).toBe(1);
    expect(result.summary.unmatched).toBe(0);
    expect(result.alertsByCaseId.get("case-1")).toHaveLength(1);

    const [alert] = result.alerts;
    expect(alert.description).toBe("POLICY RESPONSE");
    expect(alert.personName).toBe("JANE DOE");
    expect(alert.alertDate).toBe("2025-11-15T00:00:00.000Z");
    expect(alert.matchStatus).toBe("matched");
    expect(alert.program).toBe("MEDICAID");
    expect(alert.alertType).toBe("WRKRM");
    expect(alert.alertCode).toBe("9996");
    expect(alert.metadata).toMatchObject({
      rawDueDate: "11-15-2025",
      rawDisplayDate: "11-17-2025",
      rawProgram: "MEDICAID",
      rawType: "WRKRM",
      rawDescription: "POLICY RESPONSE",
      alertNumber: "9996",
      displayDateIso: "2025-11-17T00:00:00.000Z",
    });
  });

  it("marks alerts without MCNs as missing", () => {
    const sample = buildAlertRow({
      dueDate: "09-22-2025",
      mcNumber: "",
      name: "DOE,JANE",
      program: "MEDICAID",
      type: "WRKRM",
      description: "POLICY RESPONSE",
      alertNumber: "9997",
    });
    const cases: CaseDisplay[] = [buildCase({ mcn: "12345" })];

    const result = parseStackedAlerts(sample, cases);
    expect(result.summary.total).toBe(1);
    expect(result.summary.missingMcn).toBe(1);
    expect(result.alerts[0].matchStatus).toBe("missing-mcn");
  });

  it("parses stacked alerts with flexible dates and escaped quotes", () => {
    const sample = buildAlertRow({
      dueDate: "9/5/25",
      mcNumber: "MCN5555",
      name: "SMITH,JOHN",
      program: "Medicaid",
      type: "Follow Up",
      description: "Needs \"special\" handling",
      alertNumber: "AL-777",
    });
    const cases: CaseDisplay[] = [buildCase({ id: "case-2", mcn: "MCN5555" })];

    const result = parseStackedAlerts(sample, cases);
    expect(result.summary.total).toBe(1);
    expect(result.summary.matched).toBe(1);
    const [alert] = result.alerts;
    expect(alert.alertDate).toBe("2025-09-05T00:00:00.000Z");
    expect(alert.description).toBe("Needs \"special\" handling");
    expect(alert.metadata?.rawDescription).toBe("Needs \"special\" handling");
    expect(alert.personName).toBe("JOHN SMITH");
  });

  it("parses stacked alerts rows with trailing columns and preserves each entry", () => {
    const sample = [
      buildAlertRow({
        dueDate: "10-02-2025",
        mcNumber: "784589",
        name: "DOE, JANE W",
        program: "MEDICAID",
        type: "MAILM",
        description: "RETURNED MAIL RCVD",
        alertNumber: "536",
      }),
      buildAlertRow({
        dueDate: "10-02-2025",
        mcNumber: "965042",
        name: "DUCK, DONALD H",
        program: "MEDICAID",
        type: "MAILM",
        description: "MAIL RECEIVED",
        alertNumber: "470",
      }),
      buildAlertRow({
        dueDate: "10-02-2025",
        mcNumber: "970902",
        name: "ARMSTRONG, NEIL",
        program: "MEDICAID",
        type: "WRKRM",
        description: "AVS DAY 11",
        alertNumber: "9997",
      }),
    ].join("\n");

    const cases: CaseDisplay[] = [
      buildCase({ id: "case-1", mcn: "784589" }),
      buildCase({ id: "case-2", mcn: "965042" }),
      buildCase({ id: "case-3", mcn: "970902" }),
    ];

    const result = parseStackedAlerts(sample, cases);
    expect(result.summary.total).toBe(3);
    expect(result.alerts).toHaveLength(3);
    expect(result.alerts.map(alert => alert.alertCode)).toEqual(["536", "470", "9997"]);
  });

  it("normalizes names with multiple middle names and suffixes", () => {
    const sample = buildAlertRow({
      dueDate: "01-10-2026",
      displayDate: "12-19-2025",
      mcNumber: "98765",
      name: "DAVIS, CHRISTOPHER ALAN MICHAEL, JR",
      program: "MEDICAID",
      type: "WRKRM",
      description: "RENEWAL OVERDUE",
      alertNumber: "9998",
    });

    const result = parseStackedAlerts(sample, []);
    expect(result.summary.total).toBe(1);
    const [alert] = result.alerts;
    expect(alert.personName).toBe("CHRISTOPHER ALAN MICHAEL DAVIS JR");
    expect(alert.metadata?.rawName).toBe("DAVIS, CHRISTOPHER ALAN MICHAEL, JR");
  });
});
