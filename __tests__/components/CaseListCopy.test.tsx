import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaseList } from "@/components/case/CaseList";
import { createMockCaseDisplay } from "@/src/test/testUtils";

const clickToCopyMock = vi.hoisted(() => vi.fn());

vi.mock("@/utils/clipboard", () => ({
  clickToCopy: (...args: unknown[]) => clickToCopyMock(...args),
}));

vi.mock("@/utils/setupData", () => ({
  setupSampleData: vi.fn().mockResolvedValue(undefined),
}));

describe("CaseList MCN copy accessibility", () => {
  beforeEach(() => {
    clickToCopyMock.mockReset();
    clickToCopyMock.mockResolvedValue(true);
    localStorage.clear();
  });

  it("provides an accessible MCN copy control in the table view", async () => {
    const user = userEvent.setup();
    const caseData = createMockCaseDisplay();

    window.localStorage.setItem(
      "cmsnext.fileStorageFlags",
      JSON.stringify({ caseListView: "table" }),
    );

    render(
      <CaseList
        cases={[caseData]}
        onViewCase={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onNewCase={vi.fn()}
      />,
    );

    const copyButton = await screen.findByRole("button", {
      name: new RegExp(`copy mcn ${caseData.mcn}`, "i"),
    });

    await user.click(copyButton);

    expect(copyButton).toHaveAttribute("aria-label", `Copy MCN ${caseData.mcn}`);
    expect(clickToCopyMock).toHaveBeenCalledWith(caseData.mcn);
  });
});
