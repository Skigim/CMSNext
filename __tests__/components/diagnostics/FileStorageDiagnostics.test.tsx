import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const listDataFilesMock = vi.fn<() => Promise<string[]>>();
let logSpy: ReturnType<typeof vi.spyOn>;

vi.mock("@/contexts/FileStorageContext", () => ({
  useFileStorage: () => ({
    service: {},
    isSupported: true,
    isConnected: true,
    hasStoredHandle: true,
    status: { status: "ready", message: "All good" },
    connectToFolder: vi.fn(),
    listDataFiles: listDataFilesMock,
    readNamedFile: vi.fn(),
  }),
}));

describe("FileStorageDiagnostics", () => {
  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    listDataFilesMock.mockReset();
    logSpy.mockRestore();
  });

  it("displays diagnostics wrapped in Card with proper structure", async () => {
    const { FileStorageDiagnostics } = await import("@/components/diagnostics/FileStorageDiagnostics");

    render(<FileStorageDiagnostics />);

    // Verify Card structure with heading
    expect(screen.getByText("FileStorage Diagnostics")).toBeInTheDocument();
    
    // Verify sections are rendered
    expect(screen.getByText("Capabilities")).toBeInTheDocument();
    expect(screen.getByText("Status Details")).toBeInTheDocument();
    expect(screen.getByText("Available Methods")).toBeInTheDocument();
  });

  it("displays status badges with correct variants and ARIA labels", async () => {
    const { FileStorageDiagnostics } = await import("@/components/diagnostics/FileStorageDiagnostics");

    render(<FileStorageDiagnostics />);

    // Service badge should show available
    expect(screen.getByLabelText("Service available")).toBeInTheDocument();
    expect(screen.getByText("✓ Available")).toBeInTheDocument();

    // Capability badges with ARIA labels
    expect(screen.getByLabelText("File storage supported: true")).toBeInTheDocument();
    expect(screen.getByLabelText("File storage connected: true")).toBeInTheDocument();
    expect(screen.getByLabelText("Stored handle available: true")).toBeInTheDocument();
  });

  it("renders buttons with proper shadcn Button styles and ARIA labels", async () => {
    const { FileStorageDiagnostics } = await import("@/components/diagnostics/FileStorageDiagnostics");

    render(<FileStorageDiagnostics />);

    const logButton = screen.getByRole("button", { name: /Log current storage context to browser console/i });
    expect(logButton).toBeInTheDocument();

    const testButton = screen.getByRole("button", { name: /Test file listing capability/i });
    expect(testButton).toBeInTheDocument();
  });

  it("displays context details and updates test file list when button clicked", async () => {
    listDataFilesMock.mockResolvedValueOnce(["case-data.json", "alerts.json"]);

    const { FileStorageDiagnostics } = await import("@/components/diagnostics/FileStorageDiagnostics");

    render(<FileStorageDiagnostics />);

    // Before clicking, test files section should not be visible
    expect(screen.queryByText("Test Files")).not.toBeInTheDocument();

    const testButton = screen.getByRole("button", { name: /Test file listing capability/i });
    await userEvent.click(testButton);

    await waitFor(() => {
      expect(listDataFilesMock).toHaveBeenCalledTimes(1);
    });

    // After clicking, test results should display
    expect(screen.getByText("Test Files")).toBeInTheDocument();
    expect(screen.getByText(/"case-data.json"/i)).toBeInTheDocument();
    expect(screen.getByText(/"alerts.json"/i)).toBeInTheDocument();
  });

  it("logs context when requested", async () => {
    const { FileStorageDiagnostics } = await import("@/components/diagnostics/FileStorageDiagnostics");
    render(<FileStorageDiagnostics />);

    const logButton = screen.getByRole("button", { name: /Log current storage context to browser console/i });
    await userEvent.click(logButton);

    await waitFor(() => {
      expect(logSpy).toHaveBeenCalledWith("Current context:", expect.any(Object));
    });
  });

  it("has proper keyboard navigation on buttons", async () => {
    const { FileStorageDiagnostics } = await import("@/components/diagnostics/FileStorageDiagnostics");

    render(<FileStorageDiagnostics />);

    const logButton = screen.getByRole("button", { name: /Log current storage context to browser console/i });
    
    // Buttons should be focusable
    expect(logButton).not.toHaveAttribute("disabled");
    
    // Buttons should be keyboard accessible
    logButton.focus();
    expect(logButton).toHaveFocus();
  });

  it("displays available methods with correct types", async () => {
    const { FileStorageDiagnostics } = await import("@/components/diagnostics/FileStorageDiagnostics");

    render(<FileStorageDiagnostics />);

    expect(screen.getByText("connectToFolder")).toBeInTheDocument();
    expect(screen.getByText("listDataFiles")).toBeInTheDocument();
    expect(screen.getByText("readNamedFile")).toBeInTheDocument();
    
    // Methods should show as "function" type
    const methodBadges = screen.getAllByText("function");
    expect(methodBadges.length).toBeGreaterThanOrEqual(3);
  });
});
