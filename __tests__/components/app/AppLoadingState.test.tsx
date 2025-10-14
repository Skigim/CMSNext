import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppView } from "@/types/view";

vi.mock("@/components/app/AppNavigationShell", () => ({
  AppNavigationShell: ({ children, ...props }: any) => (
    <div data-testid="app-navigation-shell" data-current-view={props.currentView}>
      {children}
    </div>
  ),
}));

describe("AppLoadingState", () => {
  const navigation = {
    currentView: "dashboard" as AppView,
    breadcrumbTitle: "Dashboard",
    sidebarOpen: true,
    onNavigate: vi.fn(),
    onNewCase: vi.fn(),
    onSidebarOpenChange: vi.fn(),
  };

  it("renders the loading message inside the navigation shell", async () => {
    const { AppLoadingState } = await import("@/components/app/AppLoadingState");

    render(<AppLoadingState navigation={navigation} />);

    expect(screen.getByTestId("app-navigation-shell")).toBeInTheDocument();
    expect(screen.getByText("Loading cases...")).toBeVisible();
  });

  it("supports overriding the loading message", async () => {
    const { AppLoadingState } = await import("@/components/app/AppLoadingState");

    render(<AppLoadingState navigation={navigation} message="Syncing data" />);

    expect(screen.getByText("Syncing data")).toBeVisible();
  });
});
