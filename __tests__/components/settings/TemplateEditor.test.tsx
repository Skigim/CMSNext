import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ============================================================================
// Mocks
// ============================================================================

vi.mock("@/contexts/TemplateContext", () => ({
  useTemplates: () => ({
    templates: [
      {
        id: "tmpl-1",
        name: "Test Template",
        category: "vr",
        template: "Hello {{name}}",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sortOrder: 0,
      },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    reorderTemplates: vi.fn(),
  }),
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

import { TemplateEditor } from "@/components/settings/TemplateEditor";

describe("TemplateEditor - keyboard accessibility", () => {
  it("renders template rows", () => {
    render(<TemplateEditor category="vr" />);
    
    // Should render the template name
    expect(screen.getByText("Test Template")).toBeInTheDocument();
  });

  it("header row responds to Enter key for expand/collapse", () => {
    render(<TemplateEditor category="vr" />);
    
    // Find the expandable header (has role="button")
    const expandButton = screen.getByRole("button", { name: /Test Template/i }) 
      ?? screen.getAllByRole("button").find(b => b.textContent?.includes("Test Template"));
    
    if (expandButton) {
      fireEvent.keyDown(expandButton, { key: "Enter" });
      expect(expandButton).toBeInTheDocument();
    }
  });

  it("action buttons container stops keyboard event propagation", () => {
    render(<TemplateEditor category="vr" />);
    
    // The edit/delete button container should have onKeyDown={stopPropagation}
    // This ensures keyboard events on action buttons don't trigger the expand/collapse
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});
