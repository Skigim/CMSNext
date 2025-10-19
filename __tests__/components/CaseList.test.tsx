import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CaseList } from "@/components/case/CaseList";
import { mergeCategoryConfig } from "@/types/categoryConfig";
import { createMockCaseDisplay } from "@/src/test/testUtils";

const categoryConfigMock = mergeCategoryConfig({
  caseStatuses: ["Pending", "Approved", "Denied"],
});

vi.mock("@/contexts/CategoryConfigContext", () => ({
  useCategoryConfig: () => ({
    config: categoryConfigMock,
    loading: false,
    error: null,
    refresh: vi.fn(),
    updateCategory: vi.fn(),
    resetToDefaults: vi.fn(),
    setConfigFromFile: vi.fn(),
  }),
}));

const mockPreferences = {
  viewMode: "table" as const,
  setViewMode: vi.fn(),
  sortKey: "updated" as const,
  setSortKey: vi.fn(),
  sortDirection: "desc" as const,
  setSortDirection: vi.fn(),
  segment: "all" as const,
  setSegment: vi.fn(),
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
