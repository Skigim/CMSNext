import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/app/Dashboard";
import type { AlertsIndex, AlertWithMatch } from "@/utils/alertsData";
import type { CaseDisplay } from "@/types/case";
import type { CaseActivityLogState, DailyActivityReport } from "@/types/activityLog";

vi.mock("@/contexts/CategoryConfigContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/CategoryConfigContext")>();
  return {
    ...actual,
    useCategoryConfig: () => ({
      config: {
        caseStatuses: ["Pending", "Approved", "Denied"],
      },
    }),
  };
});

vi.mock("@/components/diagnostics/FileServiceDiagnostic", () => ({
  FileServiceDiagnostic: () => null,
}));

function createAlert(overrides: Partial<AlertWithMatch> = {}): AlertWithMatch {
  const timestamp = "2025-09-01T00:00:00.000Z";
  return {
    id: overrides.id ?? `alert-${Math.random().toString(36).slice(2)}`,
    reportId: overrides.reportId ?? "report-1",
    alertCode: overrides.alertCode ?? "AL-1",
    alertType: overrides.alertType ?? "Notice",
    alertDate: overrides.alertDate ?? timestamp,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
    mcNumber: overrides.mcNumber ?? "MCN123",
    personName: overrides.personName ?? "Jamie Rivera",
    program: overrides.program ?? "Medicaid",
    region: overrides.region ?? "Region 1",
    state: overrides.state ?? "FL",
    source: overrides.source ?? "Import",
    description: overrides.description ?? "Follow up with client",
    status: overrides.status ?? "new",
    resolvedAt: overrides.resolvedAt ?? null,
    resolutionNotes: overrides.resolutionNotes,
    metadata: overrides.metadata ?? {},
    matchStatus: overrides.matchStatus ?? "matched",
    matchedCaseId: overrides.matchedCaseId,
    matchedCaseName: overrides.matchedCaseName,
    matchedCaseStatus: overrides.matchedCaseStatus,
  } satisfies AlertWithMatch;
}

const baseCase: CaseDisplay = {
  id: "case-1",
  name: "Jamie Rivera",
  mcn: "MCN123",
  status: "Pending",
  priority: false,
  createdAt: "2025-08-01T00:00:00.000Z",
  updatedAt: "2025-09-25T00:00:00.000Z",
  person: {
    id: "person-1",
    firstName: "Jamie",
    lastName: "Rivera",
    name: "Jamie Rivera",
    email: "jamie@example.com",
    phone: "555-1234",
    dateOfBirth: "1990-01-01",
    ssn: "000-00-0000",
    organizationId: null,
    livingArrangement: "Home",
    address: {
      street: "123 Main St",
      city: "Cityville",
      state: "FL",
      zip: "00000",
    },
    mailingAddress: {
      street: "123 Main St",
      city: "Cityville",
      state: "FL",
      zip: "00000",
      sameAsPhysical: true,
    },
    authorizedRepIds: [],
    familyMembers: [],
    status: "Active",
    createdAt: "2025-09-01T00:00:00.000Z",
    dateAdded: "2025-09-01T00:00:00.000Z",
  },
  caseRecord: {
    id: "case-record-1",
    mcn: "MCN123",
    applicationDate: "2025-08-15T00:00:00.000Z",
    caseType: "Medicaid",
    personId: "person-1",
    spouseId: "",
    status: "Pending",
    description: "Support case",
    priority: false,
    livingArrangement: "Home",
    withWaiver: false,
    admissionDate: "2025-08-10T00:00:00.000Z",
    organizationId: "org-1",
    authorizedReps: [],
    retroRequested: "No",
    financials: {
      resources: [],
      income: [],
      expenses: [],
    },
    notes: [],
    createdDate: "2025-08-01T00:00:00.000Z",
    updatedDate: "2025-09-21T00:00:00.000Z",
  },
};

const emptyReport: DailyActivityReport = {
  date: "2025-01-01",
  totals: {
    total: 0,
    statusChanges: 0,
    priorityChanges: 0,
    notesAdded: 0,
  },
  entries: [],
  cases: [],
};

const mockActivityLogState: CaseActivityLogState = {
  activityLog: [],
  dailyReports: [],
  todayReport: null,
  yesterdayReport: null,
  loading: false,
  error: null,
  refreshActivityLog: vi.fn().mockResolvedValue(undefined),
  getReportForDate: () => emptyReport,
  clearReportForDate: vi.fn().mockResolvedValue(0),
};

describe("Dashboard", () => {
  it("renders without crashing with basic props", async () => {
    const matchedAlert = createAlert({
      id: "alert-matched",
      matchStatus: "matched",
      matchedCaseId: baseCase.id,
      matchedCaseName: baseCase.name,
    });

    const alertsIndex: AlertsIndex = {
      alerts: [matchedAlert],
      summary: {
        total: 1,
        matched: 1,
        unmatched: 0,
        missingMcn: 0,
        latestUpdated: null,
      },
      alertsByCaseId: new Map([[baseCase.id, [matchedAlert]]]),
      unmatched: [],
      missingMcn: [],
    };

    render(
      <Dashboard
        cases={[baseCase]}
        alerts={alertsIndex}
        activityLogState={mockActivityLogState}
        onNewCase={vi.fn()}
      />,
    );

    // Check that the dashboard header is rendered
    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    
    // Check that the New Case button is rendered
    expect(screen.getByRole("button", { name: /new case/i })).toBeInTheDocument();
    
    // Check that tabs are rendered
    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /analytics/i })).toBeInTheDocument();
  });

  it("displays Recent Activity section in overview tab", async () => {
    const alertsIndex: AlertsIndex = {
      alerts: [],
      summary: {
        total: 0,
        matched: 0,
        unmatched: 0,
        missingMcn: 0,
        latestUpdated: null,
      },
      alertsByCaseId: new Map(),
      unmatched: [],
      missingMcn: [],
    };

    render(
      <Dashboard
        cases={[]}
        alerts={alertsIndex}
        activityLogState={mockActivityLogState}
        onNewCase={vi.fn()}
      />,
    );

    // Check that Today's Focus section is displayed
    expect(screen.getByRole("heading", { name: /today's focus/i })).toBeInTheDocument();
  });
});
