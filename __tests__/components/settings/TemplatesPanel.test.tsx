import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/contexts/TemplateContext", () => ({
  useTemplates: () => ({
    templates: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    getTemplatesByCategory: vi.fn().mockReturnValue([]),
    getTemplateById: vi.fn(),
    addTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    reorderTemplates: vi.fn(),
  }),
}));

vi.mock("@/components/settings/SortableSummaryTemplates", () => ({
  SortableSummaryTemplates: () => <div>Sortable summary templates</div>,
}));

vi.mock("@/contexts/DataManagerContext", () => ({
  useDataManagerSafe: () => null,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "id"),
  },
}));

vi.mock("@/utils/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    lifecycle: vi.fn(),
  }),
}));

import { TemplatesPanel } from "@/components/settings/TemplatesPanel";

describe("TemplatesPanel", () => {
  it("renders a dedicated VR copy footer section", () => {
    // ARRANGE
    render(<TemplatesPanel />);

    // ASSERT
    expect(
      screen.getByRole("heading", { name: "VR Copy Footer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add VR Copy Footer Template" }),
    ).toBeInTheDocument();
  });

  it("limits VR footer placeholders to case, person, and system fields", async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<TemplatesPanel />);

    // ACT
    await user.click(
      screen.getByRole("button", { name: "Add VR Copy Footer Template" }),
    );

    // ASSERT
    expect(
      screen.getByRole("button", { name: "Current Date" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Description" }),
    ).not.toBeInTheDocument();
  });
});
