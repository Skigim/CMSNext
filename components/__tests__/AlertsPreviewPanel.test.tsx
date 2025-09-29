import { describe, expect, it, vi, beforeEach } from "vitest";

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("../../archive/data/sample-alerts.csv?raw", () => ({
  default:
    "ReportID,AlertCode,AlertType,Severity,AlertDate,CreatedAt,UpdatedAt,MCNumber,Name,Program,Source,State,Comments\n" +
    'AL-1,LP-001,"Recertification Due",High,2025-01-01,2025-01-01 08:00,2025-01-03 09:00,MCN-001,Alice Carter,Medicaid,"State Feed",WA,"Schedule interview"\n' +
    'AL-2,LP-014,"Income Verification",Medium,2025-01-02,2025-01-02 09:00,2025-01-04 10:30,,Brandon Singh,Medicaid,"Employer Match",WA,"Missing MCN"',
}));

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertsPreviewPanel } from "@/components/alerts/AlertsPreviewPanel";
import type { CaseDisplay } from "@/types/case";

const baseCase: CaseDisplay = {
  id: "case-1",
  name: "Alice Carter",
  mcn: "MCN-001",
  status: "Active",
  priority: false,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  person: {
    id: "person-1",
    firstName: "Alice",
    lastName: "Carter",
    name: "Alice Carter",
    email: "alice@example.com",
    phone: "",
    dateOfBirth: "",
    ssn: "",
    organizationId: null,
    livingArrangement: "",
    address: { street: "", city: "", state: "", zip: "" },
    mailingAddress: { street: "", city: "", state: "", zip: "", sameAsPhysical: true },
    authorizedRepIds: [],
    familyMembers: [],
    status: "Active",
    createdAt: "2025-01-01T00:00:00.000Z",
    dateAdded: "2025-01-01T00:00:00.000Z",
  },
  caseRecord: {
    id: "case-record-1",
    mcn: "MCN-001",
    applicationDate: "2025-01-01",
    caseType: "Standard",
    personId: "person-1",
    spouseId: "",
    status: "Active",
    description: "",
    priority: false,
    livingArrangement: "",
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
    createdDate: "2025-01-01T00:00:00.000Z",
    updatedDate: "2025-01-01T00:00:00.000Z",
  },
};

const renderComponent = () => render(<AlertsPreviewPanel cases={[baseCase]} />);

describe("AlertsPreviewPanel", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it("shows the loading prompt before data is loaded", () => {
    renderComponent();
    expect(screen.getByText(/No alerts loaded yet/i)).toBeInTheDocument();
  });

  it("loads alerts from the sample file and summarizes matches", async () => {
    const user = userEvent.setup();
    renderComponent();

    const button = screen.getByRole("button", { name: /load sample alerts/i });
    await user.click(button);

    expect(await screen.findByText(/Recertification Due/)).toBeInTheDocument();
    expect(screen.getByText(/Matched/)).toBeInTheDocument();
    expect(screen.getByText(/Needs MCN/)).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith("Loaded 2 sample alerts");
    expect(toastError).not.toHaveBeenCalled();
  });
});
