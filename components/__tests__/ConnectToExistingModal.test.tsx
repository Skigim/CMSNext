import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectToExistingModal } from "@/components/modals/ConnectToExistingModal";

describe("ConnectToExistingModal", () => {
  it("informs users when the File System Access API is unavailable", () => {
    render(
      <ConnectToExistingModal
        isOpen
        isSupported={false}
        onConnectToExisting={vi.fn()}
        onChooseNewFolder={vi.fn()}
        onGoToSettings={vi.fn()}
      />
    );

    expect(
      screen.getByText(/browser not supported/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/requires the File System Access API/i)
    ).toBeInTheDocument();
  });

  it("handles reconnecting to a stored folder", async () => {
    const onConnectToExisting = vi.fn().mockResolvedValue(true);
    const onChooseNewFolder = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();

    render(
      <ConnectToExistingModal
        isOpen
        isSupported
        hasStoredHandle
        permissionStatus="granted"
        onConnectToExisting={onConnectToExisting}
        onChooseNewFolder={onChooseNewFolder}
        onGoToSettings={vi.fn()}
      />
    );

    const connectButton = screen.getByRole("button", { name: /connect to previous folder/i });
    await user.click(connectButton);

    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(onConnectToExisting).toHaveBeenCalledTimes(1);
    });

    // After the promise resolves the loading label should disappear
    await waitFor(() => {
      expect(screen.queryByText(/reconnecting/i)).not.toBeInTheDocument();
    });
  });

  it("surfaces connection failures returned by the storage hooks", async () => {
    const onConnectToExisting = vi.fn().mockResolvedValue(false);
    const onChooseNewFolder = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();

    render(
      <ConnectToExistingModal
        isOpen
        isSupported
        hasStoredHandle
        permissionStatus="prompt"
        onConnectToExisting={onConnectToExisting}
        onChooseNewFolder={onChooseNewFolder}
        onGoToSettings={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /connect to previous folder/i }));

    await waitFor(() => {
      expect(onConnectToExisting).toHaveBeenCalled();
    });

    expect(
      await screen.findByText(/failed to connect to existing directory/i)
    ).toBeInTheDocument();
  });

  it("delegates to folder selection when requested", async () => {
    const onConnectToExisting = vi.fn().mockResolvedValue(true);
    const onChooseNewFolder = vi.fn().mockResolvedValue(true);
    const onGoToSettings = vi.fn();
    const user = userEvent.setup();

    render(
      <ConnectToExistingModal
        isOpen
        isSupported
        hasStoredHandle={false}
        onConnectToExisting={onConnectToExisting}
        onChooseNewFolder={onChooseNewFolder}
        onGoToSettings={onGoToSettings}
      />
    );

    await user.click(screen.getByRole("button", { name: /choose data folder/i }));

    await waitFor(() => {
      expect(onChooseNewFolder).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: /go to settings/i }));
    expect(onGoToSettings).toHaveBeenCalledTimes(1);
  });
});
