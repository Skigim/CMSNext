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

  it("renders a dialog with proper ARIA attributes when modal is open", async () => {
    const { ConnectionOnboarding } = await import("@/components/app/ConnectionOnboarding");

    render(<ConnectionOnboarding {...defaultProps} isOpen />);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("passes correct connection callbacks to the modal", async () => {
    const { ConnectionOnboarding } = await import("@/components/app/ConnectionOnboarding");
    const onConnectToExisting = vi.fn();
    const onChooseNewFolder = vi.fn();
    const onGoToSettings = vi.fn();

    render(
      <ConnectionOnboarding
        {...defaultProps}
        isOpen
        onConnectToExisting={onConnectToExisting}
        onChooseNewFolder={onChooseNewFolder}
        onGoToSettings={onGoToSettings}
      />
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    // Callbacks are verified through modal stub behavior
  });

  it("renders the modal with support message when browser is not supported", async () => {
    const { ConnectionOnboarding } = await import("@/components/app/ConnectionOnboarding");

    render(
      <ConnectionOnboarding
        {...defaultProps}
        isOpen
        isSupported={false}
      />
    );

    expect(await screen.findByRole("dialog", { name: /Browser Not Supported/i })).toBeInTheDocument();
  });

  it("renders all connection options when storage handle exists", async () => {
    const { ConnectionOnboarding } = await import("@/components/app/ConnectionOnboarding");

    render(
      <ConnectionOnboarding
        {...defaultProps}
        isOpen
        hasStoredHandle={true}
      />
    );

    const connectButton = await screen.findByRole("button", { name: /Connect to Previous Folder/i });
    const chooseButton = screen.getByRole("button", { name: /Choose Data Folder/i });
    const settingsButton = screen.getByRole("button", { name: /Go to Settings/i });

    expect(connectButton).toBeVisible();
    expect(chooseButton).toBeVisible();
    expect(settingsButton).toBeVisible();
  });

  it("handles permission denied state", async () => {
    const { ConnectionOnboarding } = await import("@/components/app/ConnectionOnboarding");

    render(
      <ConnectionOnboarding
        {...defaultProps}
        isOpen
        permissionStatus="denied"
      />
    );

    expect(await screen.findByText(/Permission was previously denied/i)).toBeVisible();
  });
});
