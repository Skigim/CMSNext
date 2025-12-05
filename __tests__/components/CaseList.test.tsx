import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CaseList } from "@/components/case/CaseList";
import { mergeCategoryConfig } from "@/types/categoryConfig";
import { createMockCaseDisplay } from "@/src/test/testUtils";

const categoryConfigMock = mergeCategoryConfig({
  caseStatuses: ["Pending", "Approved", "Denied"],
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
    excludeStatuses: [],
    excludePriority: false,
  },
  setFilters: vi.fn(),
  resetPreferences: vi.fn(),
};

vi.mock("@/hooks/useCaseListPreferences", () => ({
  useCaseListPreferences: () => mockPreferences,
}));

vi.mock("@/components/case/CaseAlertsDrawer", () => ({
  CaseAlertsDrawer: () => <div data-testid="alerts-drawer" />,
}));

describe("CaseList status interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("CaseList table updates status when a new option is selected", async () => {
    const user = userEvent.setup();
    const onUpdateCaseStatus = vi.fn().mockResolvedValue({ status: "Approved" });

  const cases = [createMockCaseDisplay({ id: "case-1" })];

    render(
      <CaseList
        cases={cases}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
        alertsSummary={undefined}
        alertsByCaseId={new Map()}
        alerts={[]}
        onUpdateCaseStatus={onUpdateCaseStatus}
      />,
    );

  const trigger = screen.getByRole("button", { name: /change case status/i });
    expect(within(trigger).getByText("Pending")).toBeInTheDocument();

    await user.click(trigger);

    const approvedOption = await screen.findByRole("menuitemradio", { name: "Approved" });
    await user.click(approvedOption);

    expect(onUpdateCaseStatus).toHaveBeenCalledWith("case-1", "Approved");

    await screen.findByText("Approved");
    expect(within(trigger).getByText("Approved")).toBeInTheDocument();
  });
});

describe("CaseList pagination", () => {
  const defaultProps = {
    onViewCase: vi.fn(),
    onEditCase: vi.fn(),
    onDeleteCase: vi.fn(),
    onNewCase: vi.fn(),
    alertsSummary: undefined,
    alertsByCaseId: new Map(),
    alerts: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows pagination when there are more than 20 cases", () => {
    const cases = Array.from({ length: 25 }, (_, i) =>
      createMockCaseDisplay({ id: `case-${i}`, name: `Case ${i + 1}` })
    );

    render(<CaseList cases={cases} {...defaultProps} />);

    // Should show "Showing 1-20 of 25 cases"
    expect(screen.getByText(/Showing 1–20 of 25 cases/)).toBeInTheDocument();
    
    // Should have pagination navigation
    expect(screen.getByRole("navigation", { name: /pagination/i })).toBeInTheDocument();
  });

  it("does not show pagination controls when there are 20 or fewer cases", () => {
    const cases = Array.from({ length: 15 }, (_, i) =>
      createMockCaseDisplay({ id: `case-${i}`, name: `Case ${i + 1}` })
    );

    render(<CaseList cases={cases} {...defaultProps} />);

    // Should show count but no pagination nav (only 1 page)
    expect(screen.getByText(/Showing 1–15 of 15 cases/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /pagination/i })).not.toBeInTheDocument();
  });

  it("navigates to next page when clicking Next", async () => {
    const user = userEvent.setup();
    const cases = Array.from({ length: 45 }, (_, i) =>
      createMockCaseDisplay({ id: `case-${i}`, name: `Case ${i + 1}` })
    );

    render(<CaseList cases={cases} {...defaultProps} />);

    // Initially on page 1
    expect(screen.getByText(/Showing 1–20 of 45 cases/)).toBeInTheDocument();

    // Click next - use aria-label to find the link
    const nextButton = screen.getByLabelText(/next page/i);
    await user.click(nextButton);

    // Should now show page 2
    expect(screen.getByText(/Showing 21–40 of 45 cases/)).toBeInTheDocument();
  });

  it("navigates to specific page when clicking page number", async () => {
    const user = userEvent.setup();
    const cases = Array.from({ length: 60 }, (_, i) =>
      createMockCaseDisplay({ id: `case-${i}`, name: `Case ${i + 1}` })
    );

    render(<CaseList cases={cases} {...defaultProps} />);

    // Click on page 3 - find by text content
    const page3Link = screen.getByText("3", { selector: "[data-slot='pagination-link']" });
    await user.click(page3Link);

    // Should show page 3 content
    expect(screen.getByText(/Showing 41–60 of 60 cases/)).toBeInTheDocument();
  });

  it("disables Previous button on first page", () => {
    const cases = Array.from({ length: 25 }, (_, i) =>
      createMockCaseDisplay({ id: `case-${i}`, name: `Case ${i + 1}` })
    );

    render(<CaseList cases={cases} {...defaultProps} />);

    const prevButton = screen.getByLabelText(/previous page/i);
    expect(prevButton).toHaveAttribute("aria-disabled", "true");
    expect(prevButton).toHaveClass("pointer-events-none");
  });

  it("disables Next button on last page", async () => {
    const user = userEvent.setup();
    const cases = Array.from({ length: 25 }, (_, i) =>
      createMockCaseDisplay({ id: `case-${i}`, name: `Case ${i + 1}` })
    );

    render(<CaseList cases={cases} {...defaultProps} />);

    // Go to page 2 (last page) - find by text content
    const page2Link = screen.getByText("2", { selector: "[data-slot='pagination-link']" });
    await user.click(page2Link);

    const nextButton = screen.getByLabelText(/next page/i);
    expect(nextButton).toHaveAttribute("aria-disabled", "true");
    expect(nextButton).toHaveClass("pointer-events-none");
  });

  it("shows no cases message when filtered results are empty", () => {
    render(<CaseList cases={[]} {...defaultProps} />);

    expect(screen.getByText(/No cases match the current filters/)).toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });
});
