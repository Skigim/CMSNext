import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/src/test/reactTestUtils";
import { AppSidebar } from "@/components/app/AppSidebar";

const { setOpen, setOpenMobile } = vi.hoisted(() => ({
  setOpen: vi.fn(),
  setOpenMobile: vi.fn(),
}));

vi.mock("@/components/ui/sidebar", () =>
  import("@/__tests__/__mocks__/sidebarPrimitives").then((module) =>
    module.createSidebarModuleMock({
      setOpen,
      setOpenMobile,
    }),
  ),
);

vi.mock("@/components/app/ThemeToggle", () =>
  import("@/__tests__/__mocks__/sidebarPrimitives").then((module) => ({
    ThemeToggle: module.ThemeToggle,
  })),
);

describe("AppSidebar", () => {
  it("marks the cases navigation item active while viewing intake", () => {
    render(
      <AppSidebar
        currentView="intake"
        onNavigate={vi.fn()}
        onNewCase={vi.fn()}
      />,
    );

    const casesButton = screen.getByRole("button", { name: "Cases" });
    expect(casesButton).toHaveAttribute("data-active", "true");
  });
});
