import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/app/Dashboard";
import {
  createAlertsIndexFromAlerts,
  createEmptyAlertsIndex,
  type AlertsIndex,
} from "@/utils/alertsData";
import {
  createMockAlertWithMatch,
  createMockCaseActivityLogState,
  createMockCaseDisplay,
} from "@/src/test/testUtils";

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

vi.mock("@/contexts/FileStorageContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/FileStorageContext")>();
  return {
    ...actual,
    useFileStorage: () => ({
      registerDataLoadHandler: () => () => undefined,
    }),
    useFileStorageDataChange: () => 0,
  };
});

vi.mock("@/components/diagnostics/FileServiceDiagnostic", () => ({
  FileServiceDiagnostic: () => null,
}));

const baseCase = createMockCaseDisplay({
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
    intakeCompleted: true,
  },
});

function renderDashboard({
  cases = [],
  alerts = createEmptyAlertsIndex(),
}: {
  cases?: ReturnType<typeof createMockCaseDisplay>[];
  alerts?: AlertsIndex;
} = {}) {
  return render(
    <Dashboard
      cases={cases}
      alerts={alerts}
      activityLogState={createMockCaseActivityLogState()}
      onNewCase={vi.fn()}
      onViewCase={vi.fn()}
    />,
  );
}

describe("Dashboard", () => {
  it("renders without crashing with basic props", async () => {
    const matchedAlert = createMockAlertWithMatch({
      id: "alert-matched",
      matchStatus: "matched",
      matchedCaseId: baseCase.id,
      matchedCaseName: baseCase.name,
    });

    renderDashboard({
      cases: [baseCase],
      alerts: createAlertsIndexFromAlerts([
        createMockAlertWithMatch({
          ...matchedAlert,
          matchedCaseId: baseCase.id,
        }),
      ]),
    });

    // Check that the Recent Activity header is rendered
    expect(screen.getByRole("heading", { name: /recent activity/i })).toBeInTheDocument();
    
    // Check that the New Case button is rendered
    expect(screen.getByRole("button", { name: /new case/i })).toBeInTheDocument();
    
    // Check that tabs are rendered
    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /analytics/i })).toBeInTheDocument();
  });

  it("displays Recent Activity section in overview tab", async () => {
    renderDashboard();

    // Check that Recent Activity section is displayed
    expect(screen.getByRole("heading", { name: /recent activity/i })).toBeInTheDocument();
  });
});
