import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("AlertsPreviewPanel", () => {
  it("renders the disabled state messaging", () => {
    render(<AlertsPreviewPanel cases={[baseCase]} />);

    expect(screen.getByText(/Sample alerts are currently disabled/i)).toBeInTheDocument();
    expect(screen.getByText(/No alerts are being loaded at this time/i)).toBeInTheDocument();
  });
});
