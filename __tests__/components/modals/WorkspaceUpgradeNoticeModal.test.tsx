import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceUpgradeNoticeModal } from "@/components/modals/WorkspaceUpgradeNoticeModal";

describe("WorkspaceUpgradeNoticeModal", () => {
  it("requires explicit acknowledgement before continuing", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onAcknowledge = vi.fn();

    render(
      <WorkspaceUpgradeNoticeModal
        isOpen
        noticeKind="migrated"
        onAcknowledge={onAcknowledge}
      />,
    );

    // ACT
    const continueButton = screen.getByRole("button", { name: /Continue to workspace/i });
    expect(continueButton).toBeDisabled();

    await user.click(
      screen.getByLabelText(
        /I understand that this workspace now uses the canonical v2\.2 format/i,
      ),
    );
    await user.click(continueButton);

    // ASSERT
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it("renders the already-current v2.2 message", () => {
    // ARRANGE
    const onAcknowledge = vi.fn();

    render(
      <WorkspaceUpgradeNoticeModal
        isOpen
        noticeKind="current"
        onAcknowledge={onAcknowledge}
      />,
    );

    // ASSERT
    expect(screen.getByRole("heading", { name: /Workspace is already on v2\.2/i })).toBeVisible();
    expect(
      screen.getByText(/This workspace already uses the canonical v2\.2 file format/i),
    ).toBeVisible();
  });

  it("has no accessibility violations", async () => {
    // ARRANGE
    const onAcknowledge = vi.fn();
    const { baseElement } = render(
      <WorkspaceUpgradeNoticeModal
        isOpen
        noticeKind="migrated"
        onAcknowledge={onAcknowledge}
      />,
    );

    // ACT
    const results = await axe(baseElement);

    // ASSERT
    expect(results).toHaveNoViolations();
  });
});