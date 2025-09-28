import { render, screen, fireEvent, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaseList } from "@/components/case/CaseList";
import type { CaseDisplay, CaseRecord, Person } from "@/types/case";
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
});
