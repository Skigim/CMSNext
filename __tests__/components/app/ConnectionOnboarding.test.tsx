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

vi.mock("@/components/modals/ConnectToExistingModal", () =>
  import("../../__mocks__/ConnectToExistingModalStub"),
);

describe("ConnectionOnboarding", () => {
  const baseNavigation = {
    currentView: "dashboard" as AppView,
    breadcrumbTitle: "Dashboard",
    sidebarOpen: false,
    onNavigate: vi.fn(),
    onNewCase: vi.fn(),
    onSidebarOpenChange: vi.fn(),
  };

  const defaultProps = {
    navigation: baseNavigation,
    message: "Setting up data storage...",
    isOpen: false,
    isSupported: true,
    permissionStatus: "granted",
    hasStoredHandle: true,
    onConnectToExisting: vi.fn(),
    onChooseNewFolder: vi.fn(),
    onGoToSettings: vi.fn(),
  };

  it("shows the onboarding placeholder when the modal is closed", async () => {
    const { ConnectionOnboarding } = await import("@/components/app/ConnectionOnboarding");

    render(<ConnectionOnboarding {...defaultProps} />);

    expect(screen.getByTestId("app-navigation-shell")).toBeInTheDocument();
    expect(screen.getByText(/Setting up data storage/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Connect to Previous Folder/i })).toBeNull();
  });

  it("renders the connection modal when open", async () => {
    const { ConnectionOnboarding } = await import("@/components/app/ConnectionOnboarding");

    render(<ConnectionOnboarding {...defaultProps} isOpen />);

    expect(await screen.findByRole("button", { name: /Connect to Previous Folder/i })).toBeVisible();
  });
});
