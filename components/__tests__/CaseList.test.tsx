import { render, screen, fireEvent, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaseList } from "@/components/case/CaseList";
import type { CaseDisplay, CaseRecord, Person } from "@/types/case";
import type { AlertWithMatch } from "@/utils/alertsData";
import {
  restoreDefaultFileStorageFlagsManager,
  resetFileStorageFlags,
  getFileStorageFlags,
} from "@/utils/fileStorageFlags";
import { setupSampleData } from "@/utils/setupData";

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/utils/setupData", () => ({
  setupSampleData: vi.fn().mockResolvedValue(undefined),
}));

type CaseOverrides = Partial<CaseDisplay> & {
  caseRecord?: Partial<CaseRecord>;
  person?: Partial<Person>;
};

function createCase(overrides: CaseOverrides = {}): CaseDisplay {
  const person: Person = {
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
  };

  const caseRecord: CaseRecord = {
    id: "case-record-1",
    mcn: "MCN123",
    applicationDate: "2025-08-15T00:00:00.000Z",
    caseType: "Medicaid",
    personId: person.id,
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
  };

  const baseCase: CaseDisplay = {
    id: "case-1",
    name: "Jamie Rivera",
    mcn: "MCN123",
  status: "Pending",
    priority: false,
    createdAt: "2025-08-01T00:00:00.000Z",
    updatedAt: "2025-09-25T00:00:00.000Z",
    person,
    caseRecord,
  };

  const merged = { ...baseCase, ...overrides } satisfies CaseDisplay;

  return {
    ...merged,
    person: { ...person, ...(overrides.person ?? {}) },
    caseRecord: { ...caseRecord, ...(overrides.caseRecord ?? {}) },
  };
}

function createAlert(overrides: Partial<AlertWithMatch> = {}): AlertWithMatch {
  const timestamp = "2025-09-01T00:00:00.000Z";
  const baseId = overrides.id ?? `alert-${Math.random().toString(36).slice(2)}`;
  return {
    id: baseId,
    reportId: overrides.reportId ?? "report-1",
    alertCode: overrides.alertCode ?? "AL-1",
    alertType: overrides.alertType ?? "Notice",
    severity: overrides.severity ?? "High",
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
  matchedCaseId: overrides.matchedCaseId ?? "case-1",
  matchedCaseName: overrides.matchedCaseName ?? "Jamie Rivera",
    matchedCaseStatus: overrides.matchedCaseStatus ?? "Pending",
  } satisfies AlertWithMatch;
}

const setupSampleDataMock = vi.mocked(setupSampleData);

beforeEach(() => {
  localStorage.clear();
  restoreDefaultFileStorageFlagsManager();
  resetFileStorageFlags();
  setupSampleDataMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CaseList", () => {
  it("switches to table view and persists the preference", () => {
    const cases = [
      createCase(),
      createCase({ id: "case-2", name: "Avery Chen", mcn: "MCN456", updatedAt: "2025-09-26T00:00:00.000Z" }),
    ];

    render(
      <CaseList
        cases={cases}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Resources/i)).not.toBeInTheDocument();

    const tableToggle = screen.getByRole("button", { name: /table view/i });
    fireEvent.click(tableToggle);

    expect(screen.getByRole("columnheader", { name: /status/i })).toBeInTheDocument();
    expect(getFileStorageFlags().caseListView).toBe("table");
  });

  it("exposes sample data loader even when cases exist", () => {
    const cases = [createCase()];

    render(
      <CaseList
        cases={cases}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /demo tools/i }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getByText(/add sample data/i)).toBeInTheDocument();
  });

  it("toggles sort direction from table headers", () => {
    const cases = [
      createCase({
        id: "case-1",
        name: "Newest Case",
        updatedAt: "2025-09-26T00:00:00.000Z",
      }),
      createCase({
        id: "case-2",
        name: "Old Case",
        updatedAt: "2025-08-01T00:00:00.000Z",
      }),
    ];

    render(
      <CaseList
        cases={cases}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /table view/i }));

    const lastUpdatedHeader = screen.getByRole("columnheader", { name: /last updated/i });
    expect(lastUpdatedHeader).toHaveAttribute("aria-sort", "descending");

    const sortButton = within(lastUpdatedHeader).getByRole("button", { name: /sort by last updated/i });
    expect(sortButton.getAttribute("aria-label")).toMatch(/descending/i);

    const rowsBefore = screen.getAllByRole("row");
    expect(within(rowsBefore[1]).getByRole("button", { name: /newest case/i })).toBeInTheDocument();

    fireEvent.click(sortButton);

    expect(lastUpdatedHeader).toHaveAttribute("aria-sort", "ascending");
    expect(sortButton.getAttribute("aria-label")).toMatch(/ascending/i);

    const rowsAfter = screen.getAllByRole("row");
    expect(within(rowsAfter[1]).getByRole("button", { name: /old case/i })).toBeInTheDocument();
  });

  it("sorts cases by alerts count when the alerts header is toggled", () => {
    const cases = [
      createCase({
        id: "case-1",
        name: "Case With Two Alerts",
        updatedAt: "2025-09-26T00:00:00.000Z",
      }),
      createCase({
        id: "case-2",
        name: "Case With One Alert",
        updatedAt: "2025-09-20T00:00:00.000Z",
      }),
    ];

    const alertsByCaseId = new Map<string, AlertWithMatch[]>([
      ["case-1", [createAlert({ id: "alert-1", description: "Missing document" }), createAlert({ id: "alert-2", description: "Update income" })]],
      ["case-2", [createAlert({ id: "alert-3", description: "Schedule interview", matchedCaseId: "case-2", matchedCaseName: "Case With One Alert" })]],
    ]);

    render(
      <CaseList
        cases={cases}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
        alertsByCaseId={alertsByCaseId}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /table view/i }));

    const alertsHeader = screen.getByRole("columnheader", { name: /alerts/i });
    const sortButton = within(alertsHeader).getByRole("button", { name: /sort by alerts/i });

    fireEvent.click(sortButton);

    let rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByRole("button", { name: /case with two alerts/i })).toBeInTheDocument();

    fireEvent.click(sortButton);

    rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByRole("button", { name: /case with one alert/i })).toBeInTheDocument();
  });

  it("sorts by status when the status header is clicked", () => {
    const cases = [
      createCase({
        id: "case-1",
        name: "Pending Case",
        status: "Pending",
        updatedAt: "2025-09-20T00:00:00.000Z",
      }),
      createCase({
        id: "case-2",
        name: "Active Case",
        status: "Active",
        updatedAt: "2025-09-20T00:00:00.000Z",
      }),
    ];

    render(
      <CaseList
        cases={cases}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /table view/i }));

    const statusHeader = screen.getByRole("columnheader", { name: /^status$/i });
    expect(statusHeader).toHaveAttribute("aria-sort", "none");

    const statusButton = within(statusHeader).getByRole("button", { name: /sort by status/i });
    fireEvent.click(statusButton);

    expect(statusHeader).toHaveAttribute("aria-sort", "ascending");

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByRole("button", { name: /active case/i })).toBeInTheDocument();

    fireEvent.click(statusButton);

    expect(statusHeader).toHaveAttribute("aria-sort", "descending");
    const resortedRows = screen.getAllByRole("row");
    expect(within(resortedRows[1]).getByRole("button", { name: /pending case/i })).toBeInTheDocument();
  });

  it("only counts unresolved alerts in the table badge", () => {
    const caseItem = createCase({ id: "case-with-alerts", name: "Case With Alerts" });
    const activeAlert = createAlert({ id: "alert-open", matchedCaseId: "case-with-alerts", matchedCaseName: "Case With Alerts", status: "new", resolvedAt: null });
    const resolvedAlert = createAlert({ id: "alert-resolved", matchedCaseId: "case-with-alerts", matchedCaseName: "Case With Alerts", status: "resolved", resolvedAt: "2025-09-30T12:00:00.000Z" });

    const alertsByCaseId = new Map<string, AlertWithMatch[]>([["case-with-alerts", [activeAlert, resolvedAlert]]]);
    const allAlerts = [activeAlert, resolvedAlert];

    render(
      <CaseList
        cases={[caseItem]}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
        alertsByCaseId={alertsByCaseId}
        alerts={allAlerts}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /table view/i }));

    expect(screen.getByLabelText("1 alert")).toBeInTheDocument();
    expect(screen.queryByLabelText("2 alerts")).not.toBeInTheDocument();
  });
});
