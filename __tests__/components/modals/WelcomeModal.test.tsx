import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WelcomeModal } from "@/components/modals/WelcomeModal";

const connectToFolder = vi.fn();
const loadExistingData = vi.fn();
const checkFileEncryptionStatus = vi.fn();
const setPendingPassword = vi.fn();
const authenticate = vi.fn();
const clearCredentials = vi.fn();

const mockEncryptionContext = {
  setPendingPassword,
  authenticate,
  clearCredentials,
  requiresPassword: true,
  isEncryptionEnabled: true,
};

vi.mock("@/contexts/EncryptionContext", () => ({
  useEncryption: () => mockEncryptionContext,
}));

vi.mock("@/contexts/FileStorageContext", () => ({
  useFileStorage: () => ({
    service: {
      checkFileEncryptionStatus,
    },
    connectToFolder,
    loadExistingData,
  }),
}));

vi.mock("@/hooks/useSubmitShortcut", () => ({
  useSubmitShortcut: () => vi.fn(),
}));

vi.mock("@/components/modals/AuthBackdrop", () => ({
  AuthBackdrop: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="auth-backdrop" /> : null,
}));

describe("WelcomeModal", () => {
  beforeEach(() => {
    connectToFolder.mockReset();
    loadExistingData.mockReset();
    checkFileEncryptionStatus.mockReset();
    setPendingPassword.mockReset();
    authenticate.mockReset();
    clearCredentials.mockReset();

    mockEncryptionContext.requiresPassword = true;
    mockEncryptionContext.isEncryptionEnabled = true;

    connectToFolder.mockResolvedValue(true);
    loadExistingData.mockResolvedValue(undefined);
    authenticate.mockResolvedValue(true);
    checkFileEncryptionStatus.mockResolvedValue({ exists: false, encrypted: false });
  });

  it("completes setup immediately when the environment disables password gating", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onSetupComplete = vi.fn();
    mockEncryptionContext.requiresPassword = false;
    mockEncryptionContext.isEncryptionEnabled = false;

    render(
      <WelcomeModal
        isOpen={true}
        isSupported={true}
        onSetupComplete={onSetupComplete}
        onGoToSettings={vi.fn()}
      />,
    );

    // ACT
    await user.click(screen.getByRole("button", { name: "Choose Save Folder" }));

    // ASSERT
    await waitFor(() => {
      expect(connectToFolder).toHaveBeenCalledTimes(1);
      expect(authenticate).toHaveBeenCalledWith("admin", "");
      expect(loadExistingData).toHaveBeenCalledTimes(1);
      expect(onSetupComplete).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("Create Your Password")).not.toBeInTheDocument();
  });

  it("shows an error when bypass mode cannot initialize workspace access", async () => {
    // ARRANGE
    const user = userEvent.setup();
    mockEncryptionContext.requiresPassword = false;
    mockEncryptionContext.isEncryptionEnabled = false;
    authenticate.mockResolvedValue(false);

    render(
      <WelcomeModal
        isOpen={true}
        isSupported={true}
        onSetupComplete={vi.fn()}
        onGoToSettings={vi.fn()}
      />,
    );

    // ACT
    await user.click(screen.getByRole("button", { name: "Choose Save Folder" }));

    // ASSERT
    await waitFor(() => {
      expect(
        screen.getByText("Failed to initialize workspace access in this environment."),
      ).toBeInTheDocument();
    });
    expect(loadExistingData).not.toHaveBeenCalled();
  });
});
