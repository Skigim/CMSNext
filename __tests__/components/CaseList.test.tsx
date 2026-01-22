import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CaseList } from "@/components/case/CaseList";
import { render } from "@/src/test/reactTestUtils";
import { createMockCaseDisplay } from "@/src/test/testUtils";

/**
 * CaseList Integration Tests
 * 
 * Uses the integration testing pattern:
 * - Real hooks (useCaseListPreferences, useCategoryConfig) run during tests
 * - CategoryConfig is injected via the test render wrapper
 * - localStorage is cleared between tests for useCaseListPreferences
 */

// Category config for status dropdown - injected via render wrapper
const testCategoryConfig = {
  caseStatuses: ["Pending", "Approved", "Denied"],
};

describe("CaseList status interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage so useCaseListPreferences starts fresh with defaults
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("CaseList table updates status when a new option is selected", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onUpdateCaseStatus = vi.fn().mockResolvedValue({ status: "Approved" });
    const cases = [createMockCaseDisplay({ id: "case-1" })];

    render(
      <CaseList
        cases={cases}
        onViewCase={vi.fn()}
        onNewCase={vi.fn()}
        alertsSummary={undefined}
        alertsByCaseId={new Map()}
        alerts={[]}
        onUpdateCaseStatus={onUpdateCaseStatus}
      />,
      { categoryConfig: testCategoryConfig }
    );

    // ACT
    const trigger = screen.getByRole("button", { name: /change case status/i });
    expect(within(trigger).getByText("Pending")).toBeInTheDocument();

    await user.click(trigger);

    const approvedOption = await screen.findByRole("menuitemradio", { name: "Approved" });
    await user.click(approvedOption);

    // ASSERT
    expect(onUpdateCaseStatus).toHaveBeenCalledWith("case-1", "Approved");

    await screen.findByText("Approved");
    expect(within(trigger).getByText("Approved")).toBeInTheDocument();
  });
});

describe("CaseList pagination", () => {
  const defaultProps = {
    onViewCase: vi.fn(),
    onNewCase: vi.fn(),
    alertsSummary: undefined,
    alertsByCaseId: new Map(),
    alerts: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shows pagination when there are more than 20 cases", () => {
    // ARRANGE
    const cases = Array.from({ length: 25 }, (_, i) =>
      createMockCaseDisplay({ id: `case-${i}`, name: `Case ${i + 1}` })
    );

    // ACT
    render(<CaseList cases={cases} {...defaultProps} />, {
      categoryConfig: testCategoryConfig,
    });

    // ASSERT - Should show "Showing 1-20 of 25 cases"
    expect(screen.getByText(/Showing 1–20 of 25 cases/)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /pagination/i })).toBeInTheDocument();
  });

  it("does not show pagination controls when there are 20 or fewer cases", () => {
    // ARRANGE
    const cases = Array.from({ length: 15 }, (_, i) =>
      createMockCaseDisplay({ id: `case-${i}`, name: `Case ${i + 1}` })
    );

    // ACT
    render(<CaseList cases={cases} {...defaultProps} />, {
      categoryConfig: testCategoryConfig,
    });

    // ASSERT - Should show count but no pagination nav (only 1 page)
    expect(screen.getByText(/Showing 1–15 of 15 cases/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /pagination/i })).not.toBeInTheDocument();
  });

  it("navigates to next page when clicking Next", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const cases = Array.from({ length: 45 }, (_, i) =>
      createMockCaseDisplay({ id: `case-${i}`, name: `Case ${i + 1}` })
    );

    render(<CaseList cases={cases} {...defaultProps} />, {
      categoryConfig: testCategoryConfig,
    });

    // Initially on page 1
    expect(screen.getByText(/Showing 1–20 of 45 cases/)).toBeInTheDocument();

    // ACT - Click next
    const nextButton = screen.getByLabelText(/next page/i);
    await user.click(nextButton);

    // ASSERT - Should now show page 2
    expect(screen.getByText(/Showing 21–40 of 45 cases/)).toBeInTheDocument();
  });

  it("navigates to specific page when clicking page number", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const cases = Array.from({ length: 60 }, (_, i) =>
      createMockCaseDisplay({ id: `case-${i}`, name: `Case ${i + 1}` })
    );

    render(<CaseList cases={cases} {...defaultProps} />, {
      categoryConfig: testCategoryConfig,
    });

    // ACT - Click on page 3
    const page3Link = screen.getByText("3", { selector: "[data-slot='pagination-link']" });
    await user.click(page3Link);

    // ASSERT - Should show page 3 content
    expect(screen.getByText(/Showing 41–60 of 60 cases/)).toBeInTheDocument();
  });

  it("disables Previous button on first page", () => {
    // ARRANGE
    const cases = Array.from({ length: 25 }, (_, i) =>
      createMockCaseDisplay({ id: `case-${i}`, name: `Case ${i + 1}` })
    );

    // ACT
    render(<CaseList cases={cases} {...defaultProps} />, {
      categoryConfig: testCategoryConfig,
    });

    // ASSERT
    const prevButton = screen.getByLabelText(/previous page/i);
    expect(prevButton).toHaveAttribute("aria-disabled", "true");
    expect(prevButton).toHaveClass("pointer-events-none");
  });

  it("disables Next button on last page", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const cases = Array.from({ length: 25 }, (_, i) =>
      createMockCaseDisplay({ id: `case-${i}`, name: `Case ${i + 1}` })
    );

    render(<CaseList cases={cases} {...defaultProps} />, {
      categoryConfig: testCategoryConfig,
    });

    // ACT - Go to page 2 (last page)
    const page2Link = screen.getByText("2", { selector: "[data-slot='pagination-link']" });
    await user.click(page2Link);

    // ASSERT
    const nextButton = screen.getByLabelText(/next page/i);
    expect(nextButton).toHaveAttribute("aria-disabled", "true");
    expect(nextButton).toHaveClass("pointer-events-none");
  });

  it("shows no cases message when filtered results are empty", () => {
    // ARRANGE & ACT
    render(<CaseList cases={[]} {...defaultProps} />, {
      categoryConfig: testCategoryConfig,
    });

    // ASSERT
    expect(screen.getByText(/No cases match the current filters/)).toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });
});