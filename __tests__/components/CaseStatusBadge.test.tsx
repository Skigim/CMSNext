import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { mergeCategoryConfig } from "@/types/categoryConfig";

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

import { CaseStatusBadge } from "@/components/case/CaseStatusBadge";

describe("CaseStatusBadge", () => {
  it("opens the dropdown and notifies when a new status is selected", async () => {
    const user = userEvent.setup();
    const handleStatusChange = vi.fn();

    render(<CaseStatusBadge status="Pending" onStatusChange={handleStatusChange} />);

    const trigger = screen.getByRole("button", { name: /update case status/i });
    await user.click(trigger);

    const approvedOption = await screen.findByRole("menuitemradio", { name: "Approved" });
    await user.click(approvedOption);

    expect(handleStatusChange).toHaveBeenCalledWith("Approved");
  });

  it("renders a static badge when no change handler is provided", () => {
    render(<CaseStatusBadge status="Pending" />);

    expect(screen.getByRole("status")).toHaveTextContent("Pending");
    expect(screen.queryByRole("button", { name: /update case status/i })).not.toBeInTheDocument();
  });
});
