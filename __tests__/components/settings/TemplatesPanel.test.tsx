import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createTemplateContextMockValue,
  settingsTemplateTestMocks,
} from "@/src/test/settingsTemplateTestUtils";

const templateContextValue = createTemplateContextMockValue();

vi.mock("@/contexts/TemplateContext", () => ({
  useTemplates: () => templateContextValue,
}));

vi.mock("@/components/settings/SortableSummaryTemplates", () => ({
  SortableSummaryTemplates: () => <div>Sortable summary templates</div>,
}));

vi.mock("@/contexts/DataManagerContext", () => ({
  useDataManagerSafe: () => null,
}));

vi.mock("sonner", () => ({
  toast: settingsTemplateTestMocks.toast,
}));

vi.mock("@/utils/logger", () => ({
  createLogger: () => settingsTemplateTestMocks.logger,
}));

import { TemplatesPanel } from "@/components/settings/TemplatesPanel";

describe("TemplatesPanel", () => {
  function renderTemplatesPanel() {
    return render(<TemplatesPanel />);
  }

  function getAddFooterTemplateButton() {
    return screen.getByRole("button", { name: "Add VR Copy Footer Template" });
  }

  it("renders a dedicated VR copy footer section", () => {
    // ARRANGE
    renderTemplatesPanel();

    // ASSERT
    expect(
      screen.getByRole("heading", { name: "VR Copy Footer" }),
    ).toBeInTheDocument();
    expect(getAddFooterTemplateButton()).toBeInTheDocument();
  });

  it("limits VR footer placeholders to case, person, and system fields", async () => {
    // ARRANGE
    const user = userEvent.setup();
    renderTemplatesPanel();

    // ACT
    await user.click(getAddFooterTemplateButton());

    // ASSERT
    expect(
      screen.getByRole("button", { name: "Current Date" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Description" }),
    ).not.toBeInTheDocument();
  });
});
