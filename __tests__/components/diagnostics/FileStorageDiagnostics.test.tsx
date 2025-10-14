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
    listDataFilesMock.mockReset();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    listDataFilesMock.mockReset();
    logSpy.mockRestore();
  });

  it("displays context details and updates test file list", async () => {
    listDataFilesMock.mockResolvedValueOnce(["case-data.json", "alerts.json"]);

    const { FileStorageDiagnostics } = await import("@/components/diagnostics/FileStorageDiagnostics");

    render(<FileStorageDiagnostics />);

    expect(screen.getByText(/Service: ✓ Available/i)).toBeInTheDocument();
    expect(screen.getByText(/isSupported: true/i)).toBeInTheDocument();

    const testButton = screen.getByRole("button", { name: /Test List Files/i });
    await userEvent.click(testButton);

    await waitFor(() => {
      expect(listDataFilesMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/"case-data.json"/i)).toBeInTheDocument();
    expect(screen.getByText(/"alerts.json"/i)).toBeInTheDocument();
  });

  it("logs context when requested", async () => {
    const { FileStorageDiagnostics } = await import("@/components/diagnostics/FileStorageDiagnostics");
    render(<FileStorageDiagnostics />);

    const logButton = screen.getByRole("button", { name: /Log Context to Console/i });
    await userEvent.click(logButton);

    await waitFor(() => {
      expect(logSpy).toHaveBeenCalledWith("Current context:", expect.any(Object));
    });
  });
});
