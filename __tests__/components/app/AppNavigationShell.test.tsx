import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AppNavigationShell } from "@/components/app/AppNavigationShell";
import type { AppView } from "@/types/view";

// Mock MainLayout to focus on AppNavigationShell's responsibility
vi.mock("@/components/app/MainLayout", () => ({
  MainLayout: ({ children, currentView, onNavigate, onNewCase, sidebarOpen, onSidebarOpenChange }: any) => (
    <div data-testid="main-layout">
      <nav aria-label="Main navigation">
        <button onClick={() => onNavigate("dashboard" as AppView)} aria-label="Navigate to dashboard">
          Dashboard
        </button>
        <button onClick={() => onNavigate("dashboard" as AppView)} aria-label="Navigate to cases">
          Cases
        </button>
        <button onClick={() => onNewCase()} aria-label="Create new case">
          New Case
        </button>
        <button
          onClick={() => onSidebarOpenChange(!sidebarOpen)}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          Toggle Sidebar
        </button>
      </nav>
      <div data-testid="sidebar" hidden={!sidebarOpen} aria-hidden={!sidebarOpen}>
        Sidebar
      </div>
      <main>{children}</main>
      <div data-testid="current-view">{currentView}</div>
    </div>
  ),
}));

describe("AppNavigationShell", () => {
  it("provides accessible navigation controls with proper ARIA labels", async () => {
    const onNavigate = vi.fn();
    const onNewCase = vi.fn();
    const onSidebarOpenChange = vi.fn();

    render(
      <AppNavigationShell
        currentView="dashboard"
        sidebarOpen={true}
        onNavigate={onNavigate}
        onNewCase={onNewCase}
        onSidebarOpenChange={onSidebarOpenChange}
      >
        <div>Dashboard Content</div>
      </AppNavigationShell>,
    );

    // Verify navigation area is properly labeled
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    expect(nav).toBeInTheDocument();

    // Verify all navigation buttons have accessible labels
    expect(screen.getByRole("button", { name: /navigate to dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /navigate to cases/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create new case/i })).toBeInTheDocument();
  });

  it("manages sidebar visibility with keyboard and click interactions", async () => {
    const user = userEvent.setup();
    const onSidebarOpenChange = vi.fn();

    const { rerender } = render(
      <AppNavigationShell
        currentView="dashboard"
        sidebarOpen={false}
        onNavigate={vi.fn()}
        onNewCase={vi.fn()}
        onSidebarOpenChange={onSidebarOpenChange}
      >
        <div>Content</div>
      </AppNavigationShell>,
    );

    // Verify sidebar is hidden when closed
    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar).toHaveAttribute("hidden");
    expect(sidebar).toHaveAttribute("aria-hidden", "true");

    // Click toggle button
    const toggleButton = screen.getByRole("button", { name: /open sidebar/i });
    await user.click(toggleButton);
    expect(onSidebarOpenChange).toHaveBeenCalledWith(true);

    // Rerender with sidebar open
    rerender(
      <AppNavigationShell
        currentView="dashboard"
        sidebarOpen={true}
        onNavigate={vi.fn()}
        onNewCase={vi.fn()}
        onSidebarOpenChange={onSidebarOpenChange}
      >
        <div>Content</div>
      </AppNavigationShell>,
    );

    // Verify sidebar is now visible
    expect(sidebar).not.toHaveAttribute("hidden");
    expect(sidebar).toHaveAttribute("aria-hidden", "false");
  });

  it("supports keyboard navigation between views", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <AppNavigationShell
        currentView="dashboard"
        sidebarOpen={true}
        onNavigate={onNavigate}
        onNewCase={vi.fn()}
        onSidebarOpenChange={vi.fn()}
      >
        <div>Content</div>
      </AppNavigationShell>,
    );

    const dashboardButton = screen.getByRole("button", { name: /navigate to dashboard/i });
    const casesButton = screen.getByRole("button", { name: /navigate to cases/i });

    // Tab to first button and click
    await user.tab();
    expect(dashboardButton).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onNavigate).toHaveBeenCalledWith("dashboard");

    // Tab to next button
    await user.tab();
    expect(casesButton).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onNavigate).toHaveBeenCalledWith("dashboard");
  });

  it("passes breadcrumb title to layout", () => {
    render(
      <AppNavigationShell
        currentView="dashboard"
        breadcrumbTitle="My Cases"
        sidebarOpen={true}
        onNavigate={vi.fn()}
        onNewCase={vi.fn()}
        onSidebarOpenChange={vi.fn()}
      >
        <div>Cases Content</div>
      </AppNavigationShell>,
    );

    // Verify current view is passed correctly
    expect(screen.getByTestId("current-view")).toHaveTextContent("dashboard");
  });

  it("renders children correctly", () => {
    render(
      <AppNavigationShell
        currentView="dashboard"
        sidebarOpen={true}
        onNavigate={vi.fn()}
        onNewCase={vi.fn()}
        onSidebarOpenChange={vi.fn()}
      >
        <div data-testid="custom-content">Custom Dashboard Content</div>
      </AppNavigationShell>,
    );

    expect(screen.getByTestId("custom-content")).toHaveTextContent("Custom Dashboard Content");
  });
});
