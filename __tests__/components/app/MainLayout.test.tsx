import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/src/test/reactTestUtils";
import { MainLayout } from "@/components/app/MainLayout";

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarInset: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarTrigger: () => <button type="button">Toggle Sidebar</button>,
}));

vi.mock("@/components/app/AppSidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar">Sidebar</div>,
}));

vi.mock("@/hooks/useAutosaveStatus", () => ({
  useAutosaveStatus: () => ({ status: "saved", hasPendingChanges: false }),
}));

vi.mock("@/components/app/AutosaveStatusBadge", () => ({
  AutosaveStatusBadge: () => <div data-testid="autosave-status-badge">Autosave</div>,
}));

vi.mock("@/components/app/PinnedCasesDropdown", () => ({
  PinnedCasesDropdown: () => null,
}));

vi.mock("@/components/app/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

describe("MainLayout", () => {
  it("renders intake breadcrumbs under the cases section", () => {
    render(
      <MainLayout
        currentView="intake"
        onNavigate={vi.fn()}
        onNewCase={vi.fn()}
      >
        <div>Intake Content</div>
      </MainLayout>,
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cases" })).toBeInTheDocument();
    expect(screen.getByText("New Case")).toBeInTheDocument();
  });
});