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

type PinnedCasesHookResult = ReturnType<typeof usePinnedCases>;
type PinnedCasesHookOverrides = Partial<PinnedCasesHookResult>;
type KeyboardModifier = Pick<KeyboardEvent, "ctrlKey" | "metaKey">;

function createPinnedCasesHookResult(
  overrides: PinnedCasesHookOverrides = {},
): PinnedCasesHookResult {
  return {
    pinnedCaseIds: [],
    pin: vi.fn(),
    unpin: vi.fn(),
    togglePin: vi.fn(),
    isPinned: vi.fn(() => false),
    getPinReason: vi.fn(),
    canPinMore: true,
    pinnedCount: 0,
    reorder: vi.fn(),
    pruneStale: vi.fn(),
    ...overrides,
  };
}

function renderPinButton(props: Partial<React.ComponentProps<typeof PinButton>> = {}) {
  return render(<PinButton caseId="case-1" caseName="Case One" {...props} />);
}

function openPinDialog() {
  fireEvent.click(renderPinButtonResult().getByRole("button", { name: "Pin case" }));
  return getPinDialog();
}

let renderPinButtonResult: ReturnType<typeof renderPinButton>;

function getPinDialog() {
  return renderPinButtonResult.getByRole("dialog");
}

function getPinReasonField() {
  return within(getPinDialog()).getByLabelText("Pin reason (optional)");
}

function fillPinReason(reason: string) {
  fireEvent.change(getPinReasonField(), { target: { value: reason } });
}

function submitPinDialog() {
  fireEvent.click(within(getPinDialog()).getByRole("button", { name: "Pin case" }));
}

function submitPinDialogWithShortcut(modifier: KeyboardModifier) {
  fireEvent.keyDown(getPinReasonField(), {
    key: "Enter",
    ...modifier,
  });
}

describe("PinButton", () => {
  beforeEach(() => {
    usePinnedCasesMock.mockReset();
  });

  it("prompts for an optional reason before pinning", () => {
    // ARRANGE
    const pin = vi.fn();
    usePinnedCasesMock.mockReturnValue(createPinnedCasesHookResult({ pin }));
    renderPinButtonResult = renderPinButton();

    // ACT
    openPinDialog();
    fillPinReason("Pending morning triage");
    submitPinDialog();

    // ASSERT
    expect(
      renderPinButtonResult.getByText(
        "Add an optional reason for pinning this case. This stays attached to the pin only and does not create a note.",
      ),
    ).toBeInTheDocument();
    expect(pin).toHaveBeenCalledWith("case-1", "Pending morning triage");
  });

  it("pin dialog can be submitted without a reason", () => {
    // ARRANGE
    const pin = vi.fn();
    usePinnedCasesMock.mockReturnValue(createPinnedCasesHookResult({ pin }));
    renderPinButtonResult = renderPinButton({ caseName: undefined });

    // ACT
    openPinDialog();
    submitPinDialog();

    // ASSERT
    expect(pin).toHaveBeenCalledWith("case-1", "");
  });

  it.each([
    [{ ctrlKey: true, metaKey: false }, "Needs quick access"],
    [{ ctrlKey: false, metaKey: true }, "Mac shortcut works too"],
  ] as const)(
    "submits the pin dialog with keyboard shortcut %j",
    (modifier, reason) => {
      // ARRANGE
      const pin = vi.fn();
      usePinnedCasesMock.mockReturnValue(createPinnedCasesHookResult({ pin }));
      renderPinButtonResult = renderPinButton();

      // ACT
      openPinDialog();
      fillPinReason(reason);
      submitPinDialogWithShortcut(modifier);

      // ASSERT
      expect(pin).toHaveBeenCalledWith("case-1", reason);
    },
  );

  it("does not show the dialog when unpinning an already pinned case", () => {
    // ARRANGE
    const unpin = vi.fn();
    usePinnedCasesMock.mockReturnValue(
      createPinnedCasesHookResult({
        pinnedCaseIds: ["case-1"],
        unpin,
        isPinned: vi.fn(() => true),
        getPinReason: vi.fn(() => "Needs follow up"),
        pinnedCount: 1,
      }),
    );
    renderPinButtonResult = renderPinButton({ caseName: undefined });

    // ACT
    fireEvent.click(renderPinButtonResult.getByRole("button", { name: /Unpin case/ }));

    // ASSERT
    expect(unpin).toHaveBeenCalledWith("case-1");
    expect(renderPinButtonResult.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables pinning when the max pinned-case limit is reached", async () => {
    // ARRANGE
    usePinnedCasesMock.mockReturnValue(
      createPinnedCasesHookResult({
        pinnedCaseIds: ["case-1", "case-2"],
        canPinMore: false,
        pinnedCount: 2,
      }),
    );
    renderPinButtonResult = renderPinButton({ caseId: "case-3", caseName: undefined });

    // ACT
    const button = renderPinButtonResult.getByRole("button", { name: "Pin case" });
    fireEvent.click(button);

    // ASSERT
    expect(button).toBeDisabled();
    expect(renderPinButtonResult.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await axe(renderPinButtonResult.container)).toHaveNoViolations();
  });

  it("shows a tooltip explaining why pinning is disabled", async () => {
    // ARRANGE
    usePinnedCasesMock.mockReturnValue(
      createPinnedCasesHookResult({
        pinnedCaseIds: ["case-1", "case-2"],
        canPinMore: false,
        pinnedCount: 2,
      }),
    );
    renderPinButtonResult = renderPinButton({ caseId: "case-3", caseName: undefined });

    // ACT
    const trigger = renderPinButtonResult.getByRole("button", {
      name: "Pin case",
    }).parentElement as HTMLElement;
    fireEvent.pointerMove(trigger);
    fireEvent.mouseOver(trigger);

    // ASSERT
    expect(
      await renderPinButtonResult.findByRole("tooltip", { name: "Pin limit reached" }),
    ).toBeInTheDocument();
  });
});
