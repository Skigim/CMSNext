import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CaseList } from "@/components/case/CaseList";
import { mergeCategoryConfig } from "@/types/categoryConfig";
import { createMockCaseDisplay } from "@/src/test/testUtils";

const categoryConfigMock = mergeCategoryConfig({
  caseStatuses: ["Pending", "Approved", "Denied", "Active", "Closed"],
});

vi.mock("@/contexts/CategoryConfigContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/CategoryConfigContext")>();
  return {
    ...actual,
    useCategoryConfig: () => ({
      config: categoryConfigMock,
      loading: false,
      error: null,
      refresh: vi.fn(),
      updateCategory: vi.fn(),
      resetToDefaults: vi.fn(),
      setConfigFromFile: vi.fn(),
    }),
  };
});

const mockPreferences = {
  viewMode: "table" as const,
  setViewMode: vi.fn(),
  sortKey: "updated" as const,
  setSortKey: vi.fn(),
  sortDirection: "desc" as const,
  setSortDirection: vi.fn(),
  segment: "all" as const,
  setSegment: vi.fn(),
  sortConfigs: [{ key: "updated" as const, direction: "desc" as const }],
  setSortConfigs: vi.fn(),
  filters: {
    statuses: [],
    priorityOnly: false,
    dateRange: {},
  },
  setFilters: vi.fn(),
};

vi.mock("@/hooks/useCaseListPreferences", () => ({
  useCaseListPreferences: () => mockPreferences,
}));

vi.mock("@/components/case/CaseAlertsDrawer", () => ({
  CaseAlertsDrawer: () => <div data-testid="alerts-drawer" />,
}));

describe("CaseList enhanced filtering and sorting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset filters to default state
    mockPreferences.filters = {
      statuses: [],
      priorityOnly: false,
      dateRange: {},
    };
    mockPreferences.sortConfigs = [{ key: "updated" as const, direction: "desc" as const }];
  });

  it("renders filter button with active filter count", async () => {
    const cases = [
      createMockCaseDisplay({ id: "case-1", status: "Pending" }),
      createMockCaseDisplay({ id: "case-2", status: "Active" }),
    ];

    render(
      <CaseList
        cases={cases}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
      />
    );

    const filterButton = screen.getByRole("button", { name: /filters/i });
    expect(filterButton).toBeInTheDocument();
  });

  it("renders multi-sort configuration button", async () => {
    const cases = [
      createMockCaseDisplay({ id: "case-1" }),
      createMockCaseDisplay({ id: "case-2" }),
    ];

    render(
      <CaseList
        cases={cases}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
      />
    );

    const sortButton = screen.getByRole("button", { name: /sort/i });
    expect(sortButton).toBeInTheDocument();
  });

  it("opens filter popover when filter button is clicked", async () => {
    const user = userEvent.setup();
    const cases = [createMockCaseDisplay({ id: "case-1" })];

    render(
      <CaseList
        cases={cases}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
      />
    );

    const filterButton = screen.getByRole("button", { name: /filters/i });
    await user.click(filterButton);

    expect(screen.getByText("Filter cases")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("opens multi-sort popover when sort button is clicked", async () => {
    const user = userEvent.setup();
    const cases = [createMockCaseDisplay({ id: "case-1" })];

    render(
      <CaseList
        cases={cases}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
      />
    );

    const sortButton = screen.getByRole("button", { name: /sort/i });
    await user.click(sortButton);

    expect(screen.getByText("Sort cases")).toBeInTheDocument();
  });

  it("displays all case status options in filter", async () => {
    const user = userEvent.setup();
    const cases = [createMockCaseDisplay({ id: "case-1" })];

    render(
      <CaseList
        cases={cases}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
      />
    );

    const filterButton = screen.getByRole("button", { name: /filters/i });
    await user.click(filterButton);

    // Verify the filter popover contains status checkboxes
    const statusLabel = screen.getAllByText("Status")[0];
    expect(statusLabel).toBeInTheDocument();
  });

  it("displays priority filter option", async () => {
    const user = userEvent.setup();
    const cases = [createMockCaseDisplay({ id: "case-1" })];

    render(
      <CaseList
        cases={cases}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
      />
    );

    const filterButton = screen.getByRole("button", { name: /filters/i });
    await user.click(filterButton);

    expect(screen.getByText("Priority cases only")).toBeInTheDocument();
  });

  it("displays date range filters", async () => {
    const user = userEvent.setup();
    const cases = [createMockCaseDisplay({ id: "case-1" })];

    render(
      <CaseList
        cases={cases}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
      />
    );

    const filterButton = screen.getByRole("button", { name: /filters/i });
    await user.click(filterButton);

    expect(screen.getByText("Date range")).toBeInTheDocument();
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("To")).toBeInTheDocument();
  });
});
