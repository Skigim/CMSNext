import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    templateContextValue.templates = [];
    vi.clearAllMocks();
  });

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
    expect(screen.getByText("Case")).toBeInTheDocument();
    expect(screen.getByText("Person")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.queryByText("Financial Item")).not.toBeInTheDocument();
    expect(screen.queryByText("Amount History")).not.toBeInTheDocument();
  });

  it("hides the add button when a VR footer template already exists", () => {
    // ARRANGE
    templateContextValue.templates = [
      {
        id: "vr-footer-1",
        name: "Existing Footer",
        category: "vrFooter",
        template: "Footer",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sortOrder: 0,
      },
    ];

    // ACT
    renderTemplatesPanel();

    // ASSERT
    expect(
      screen.queryByRole("button", { name: "Add VR Copy Footer Template" }),
    ).not.toBeInTheDocument();
  });
});
