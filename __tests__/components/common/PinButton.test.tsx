import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import { fireEvent, render, within } from "@/src/test/reactTestUtils";
import { PinButton } from "@/components/common/PinButton";
import { usePinnedCases } from "@/hooks/usePinnedCases";

expect.extend(toHaveNoViolations);

vi.mock("@/hooks/usePinnedCases", () => ({
  usePinnedCases: vi.fn(),
}));

const usePinnedCasesMock = vi.mocked(usePinnedCases);

describe("PinButton", () => {
  beforeEach(() => {
    usePinnedCasesMock.mockReset();
  });

  it("prompts for an optional reason before pinning", () => {
    const pin = vi.fn();

    usePinnedCasesMock.mockReturnValue({
      pinnedCaseIds: [],
      pin,
      unpin: vi.fn(),
      togglePin: vi.fn(),
      isPinned: vi.fn(() => false),
      getPinReason: vi.fn(),
      canPinMore: true,
      pinnedCount: 0,
      reorder: vi.fn(),
      pruneStale: vi.fn(),
    });

    const { getByRole, getByText } = render(
      <PinButton caseId="case-1" caseName="Case One" />
    );

    fireEvent.click(getByRole("button", { name: "Pin case" }));

    expect(
      getByText("Add an optional reason for pinning this case. This stays attached to the pin only and does not create a note.")
    ).toBeInTheDocument();

    const dialog = getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Pin reason (optional)"), {
      target: { value: "Pending morning triage" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Pin case" }));

    expect(pin).toHaveBeenCalledWith("case-1", "Pending morning triage");
  });

  it("pin dialog can be submitted without a reason", () => {
    const pin = vi.fn();

    usePinnedCasesMock.mockReturnValue({
      pinnedCaseIds: [],
      pin,
      unpin: vi.fn(),
      togglePin: vi.fn(),
      isPinned: vi.fn(() => false),
      getPinReason: vi.fn(),
      canPinMore: true,
      pinnedCount: 0,
      reorder: vi.fn(),
      pruneStale: vi.fn(),
    });

    const { getByRole } = render(<PinButton caseId="case-1" />);

    fireEvent.click(getByRole("button", { name: "Pin case" }));

    const dialog = getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Pin case" }));

    expect(pin).toHaveBeenCalledWith("case-1", "");
  });

  it("does not show the dialog when unpinning an already pinned case", () => {
    const unpin = vi.fn();

    usePinnedCasesMock.mockReturnValue({
      pinnedCaseIds: ["case-1"],
      pin: vi.fn(),
      unpin,
      togglePin: vi.fn(),
      isPinned: vi.fn(() => true),
      getPinReason: vi.fn(() => "Needs follow up"),
      canPinMore: true,
      pinnedCount: 1,
      reorder: vi.fn(),
      pruneStale: vi.fn(),
    });

    const { getByRole, queryByRole } = render(<PinButton caseId="case-1" />);

    fireEvent.click(getByRole("button", { name: /Unpin case/ }));

    expect(unpin).toHaveBeenCalledWith("case-1");
    expect(queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables pinning when the max pinned-case limit is reached", async () => {
    // Arrange
    usePinnedCasesMock.mockReturnValue({
      pinnedCaseIds: ["case-1", "case-2"],
      pin: vi.fn(),
      unpin: vi.fn(),
      togglePin: vi.fn(),
      isPinned: vi.fn(() => false),
      getPinReason: vi.fn(),
      canPinMore: false,
      pinnedCount: 2,
      reorder: vi.fn(),
      pruneStale: vi.fn(),
    });

    const { container, getByRole, queryByRole } = render(<PinButton caseId="case-3" />);

    // Act
    const button = getByRole("button", { name: "Pin case" });
    fireEvent.click(button);

    // Assert
    expect(button).toBeDisabled();
    expect(queryByRole("dialog")).not.toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("shows a tooltip explaining why pinning is disabled", async () => {
    // Arrange
    usePinnedCasesMock.mockReturnValue({
      pinnedCaseIds: ["case-1", "case-2"],
      pin: vi.fn(),
      unpin: vi.fn(),
      togglePin: vi.fn(),
      isPinned: vi.fn(() => false),
      getPinReason: vi.fn(),
      canPinMore: false,
      pinnedCount: 2,
      reorder: vi.fn(),
      pruneStale: vi.fn(),
    });

    const { findByRole, getByRole } = render(<PinButton caseId="case-3" />);

    // Act
    const trigger = getByRole("button", { name: "Pin case" }).parentElement as HTMLElement;
    fireEvent.pointerMove(trigger);
    fireEvent.mouseOver(trigger);

    // Assert
    expect(await findByRole("tooltip", { name: "Pin limit reached" })).toBeInTheDocument();
  });
});
