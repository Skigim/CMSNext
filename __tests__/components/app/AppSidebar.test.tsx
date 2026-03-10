import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/src/test/reactTestUtils";
import { AppSidebar } from "@/components/app/AppSidebar";

const setOpen = vi.fn();
const setOpenMobile = vi.fn();

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children, isActive, ...props }: React.ComponentProps<"button"> & { isActive?: boolean }) => (
    <button data-active={isActive} type="button" {...props}>
      {children}
    </button>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSidebar: () => ({
    isMobile: false,
    setOpen,
    setOpenMobile,
  }),
}));

vi.mock("@/components/app/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

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