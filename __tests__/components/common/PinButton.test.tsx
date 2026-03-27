import type { ComponentProps } from "react";
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
type PinButtonProps = Partial<ComponentProps<typeof PinButton>>;

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

function renderPinButton(props: PinButtonProps = {}) {
  return render(<PinButton caseId="case-1" caseName="Case One" {...props} />);
}

function setupPinButton(
  hookOverrides: PinnedCasesHookOverrides = {},
  props: PinButtonProps = {},
) {
  const hookResult = createPinnedCasesHookResult(hookOverrides);
  usePinnedCasesMock.mockReturnValue(hookResult);

  return {
    ...hookResult,
    renderResult: renderPinButton(props),
  };
}

function openPinDialog(renderResult: ReturnType<typeof renderPinButton>) {
  fireEvent.click(renderResult.getByRole("button", { name: "Pin case" }));
  return getPinDialog(renderResult);
}

function getPinDialog(renderResult: ReturnType<typeof renderPinButton>) {
  return renderResult.getByRole("dialog");
}

function getPinReasonField(renderResult: ReturnType<typeof renderPinButton>) {
  return within(getPinDialog(renderResult)).getByLabelText("Pin reason (optional)");
}

function fillPinReason(renderResult: ReturnType<typeof renderPinButton>, reason: string) {
  fireEvent.change(getPinReasonField(renderResult), { target: { value: reason } });
}

function submitPinDialog(renderResult: ReturnType<typeof renderPinButton>) {
  fireEvent.click(within(getPinDialog(renderResult)).getByRole("button", { name: "Pin case" }));
}

function submitPinDialogWithShortcut(
  renderResult: ReturnType<typeof renderPinButton>,
  modifier: KeyboardModifier,
) {
  fireEvent.keyDown(getPinReasonField(renderResult), {
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
    const { pin, renderResult } = setupPinButton();

    // ACT
    const dialog = openPinDialog(renderResult);
    expect(
      within(dialog).getByText(
        "Add an optional reason for pinning this case. This stays attached to the pin only and does not create a note.",
      ),
    ).toBeInTheDocument();
    fillPinReason(renderResult, "Pending morning triage");
    submitPinDialog(renderResult);

    // ASSERT
    expect(pin).toHaveBeenCalledWith("case-1", "Pending morning triage");
  });

  it("pin dialog can be submitted without a reason", () => {
    // ARRANGE
    const { pin, renderResult } = setupPinButton({}, { caseName: undefined });

    // ACT
    openPinDialog(renderResult);
    submitPinDialog(renderResult);

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
      const { pin, renderResult } = setupPinButton();

      // ACT
      openPinDialog(renderResult);
      fillPinReason(renderResult, reason);
      submitPinDialogWithShortcut(renderResult, modifier);

      // ASSERT
      expect(pin).toHaveBeenCalledWith("case-1", reason);
    },
  );

  it("does not show the dialog when unpinning an already pinned case", () => {
    // ARRANGE
    const unpin = vi.fn();
    const { renderResult } = setupPinButton(
      {
        pinnedCaseIds: ["case-1"],
        unpin,
        isPinned: vi.fn(() => true),
        getPinReason: vi.fn(() => "Needs follow up"),
        pinnedCount: 1,
      },
      { caseName: undefined },
    );

    // ACT
    fireEvent.click(renderResult.getByRole("button", { name: /Unpin case/ }));

    // ASSERT
    expect(unpin).toHaveBeenCalledWith("case-1");
    expect(renderResult.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables pinning when the max pinned-case limit is reached", async () => {
    // ARRANGE
    const { renderResult } = setupPinButton(
      {
        pinnedCaseIds: ["case-1", "case-2"],
        canPinMore: false,
        pinnedCount: 2,
      },
      { caseId: "case-3", caseName: undefined },
    );

    // ACT
    const button = renderResult.getByRole("button", { name: "Pin case" });
    fireEvent.click(button);

    // ASSERT
    expect(button).toBeDisabled();
    expect(renderResult.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await axe(renderResult.container)).toHaveNoViolations();
  });

  it("shows a tooltip explaining why pinning is disabled", async () => {
    // ARRANGE
    const { renderResult } = setupPinButton(
      {
        pinnedCaseIds: ["case-1", "case-2"],
        canPinMore: false,
        pinnedCount: 2,
      },
      { caseId: "case-3", caseName: undefined },
    );

    // ACT
    const trigger = renderResult.getByRole("button", {
      name: "Pin case",
    }).parentElement as HTMLElement;
    fireEvent.pointerMove(trigger);
    fireEvent.mouseOver(trigger);

    // ASSERT
    expect(
      await renderResult.findByRole("tooltip", { name: "Pin limit reached" }),
    ).toBeInTheDocument();
  });
});
