import { describe, expect, it, vi, beforeEach } from "vitest";
import { axe } from "jest-axe";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginModal } from "@/components/modals/LoginModal";
import { EncryptionError } from "@/types/encryption";

const checkFileEncryptionStatus = vi.fn();
const connectToExisting = vi.fn();
const loadExistingData = vi.fn();
const setPendingPassword = vi.fn();
const authenticate = vi.fn();
const clearCredentials = vi.fn();
const waitForStartupUnlockReady = vi.fn();
const setFileEncrypted = vi.fn();

const mockEncryptionContext = {
  setPendingPassword,
  authenticate,
  clearCredentials,
  waitForStartupUnlockReady,
  setFileEncrypted,
  requiresPassword: true,
  isEncryptionEnabled: true,
  isStartupUnlockReady: true,
};

vi.mock("@/contexts/EncryptionContext", () => ({
  useEncryption: () => mockEncryptionContext,
}));

vi.mock("@/contexts/FileStorageContext", () => ({
  useFileStorage: () => ({
    service: {
      checkFileEncryptionStatus,
    },
    connectToExisting,
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

describe("LoginModal", () => {
  beforeEach(() => {
    checkFileEncryptionStatus.mockReset();
    connectToExisting.mockReset();
    loadExistingData.mockReset();
    setPendingPassword.mockReset();
    authenticate.mockReset();
    clearCredentials.mockReset();
    waitForStartupUnlockReady.mockReset();
    setFileEncrypted.mockReset();

    mockEncryptionContext.requiresPassword = true;
    mockEncryptionContext.isEncryptionEnabled = true;
    mockEncryptionContext.isStartupUnlockReady = true;

    connectToExisting.mockResolvedValue(true);
    loadExistingData.mockResolvedValue(undefined);
    authenticate.mockResolvedValue(true);
    waitForStartupUnlockReady.mockResolvedValue(undefined);
    checkFileEncryptionStatus.mockImplementation(() => new Promise<never>(() => {}));
  });

  it("keeps the loading dialog described for assistive technology", async () => {
    // Arrange
    const { baseElement } = render(
      <LoginModal
        isOpen={true}
        onLoginComplete={vi.fn()}
        onChooseDifferentFolder={vi.fn()}
      />,
    );

    // Act
    await waitFor(() => {
      expect(checkFileEncryptionStatus).toHaveBeenCalledTimes(1);
    });
    const results = await axe(baseElement);

    // Assert
    expect(results).toHaveNoViolations();
    expect(screen.getByRole("dialog", { name: "Loading" })).toHaveAccessibleDescription(
      "Checking your data before unlocking your workspace.",
    );
  });

  it("bypasses password entry when the environment disables unlock gating", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onLoginComplete = vi.fn();
    mockEncryptionContext.requiresPassword = false;
    mockEncryptionContext.isEncryptionEnabled = false;
    checkFileEncryptionStatus.mockResolvedValue({ exists: true, encrypted: false });

    render(
      <LoginModal
        isOpen={true}
        onLoginComplete={onLoginComplete}
        onChooseDifferentFolder={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(checkFileEncryptionStatus).toHaveBeenCalledTimes(1);
    });
    expect(setFileEncrypted).toHaveBeenCalledWith(false);

    // ACT
    await user.click(screen.getByRole("button", { name: "Open Workspace" }));

    // ASSERT
    await waitFor(() => {
      expect(connectToExisting).toHaveBeenCalledTimes(1);
      expect(checkFileEncryptionStatus).toHaveBeenCalledTimes(2);
      expect(authenticate).toHaveBeenCalledWith("admin", "");
      expect(loadExistingData).toHaveBeenCalledTimes(1);
      expect(onLoginComplete).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("loads encrypted workspace data immediately after authentication and lets decrypt verification drive readiness", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onLoginComplete = vi.fn();
    checkFileEncryptionStatus.mockResolvedValue({ exists: true, encrypted: true });

    render(
      <LoginModal
        isOpen={true}
        onLoginComplete={onLoginComplete}
        onChooseDifferentFolder={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(checkFileEncryptionStatus).toHaveBeenCalledTimes(1);
    });
    expect(setFileEncrypted).toHaveBeenCalledWith(true);

    // ACT
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    // ASSERT
    await waitFor(() => {
      expect(connectToExisting).toHaveBeenCalledTimes(1);
      expect(checkFileEncryptionStatus).toHaveBeenCalledTimes(2);
      expect(authenticate).toHaveBeenCalledWith("admin", "correct horse battery staple");
      expect(loadExistingData).toHaveBeenCalledTimes(1);
    });
    expect(waitForStartupUnlockReady).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Incorrect password. Please try again."),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(onLoginComplete).toHaveBeenCalledTimes(1);
    });
  });

  it("shows the invalid-password error only after a real decrypt failure once startup readiness is complete", async () => {
    // ARRANGE
    const user = userEvent.setup();
    checkFileEncryptionStatus.mockResolvedValue({ exists: true, encrypted: true });
    loadExistingData.mockRejectedValue(
      new EncryptionError("wrong_password", "Incorrect password."),
    );

    render(
      <LoginModal
        isOpen={true}
        onLoginComplete={vi.fn()}
        onChooseDifferentFolder={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(checkFileEncryptionStatus).toHaveBeenCalledTimes(1);
    });

    // ACT
    await user.type(screen.getByLabelText("Password"), "wrong password");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    // ASSERT
    await waitFor(() => {
      expect(checkFileEncryptionStatus).toHaveBeenCalledTimes(2);
      expect(loadExistingData).toHaveBeenCalledTimes(1);
    });
    expect(waitForStartupUnlockReady).not.toHaveBeenCalled();
    expect(clearCredentials).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Incorrect password. Please try again."),
    ).toBeInTheDocument();
  });

  it("allows retry after a failed encrypted unlock attempt", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onLoginComplete = vi.fn();
    checkFileEncryptionStatus.mockResolvedValue({ exists: true, encrypted: true });
    loadExistingData
      .mockRejectedValueOnce(new EncryptionError("wrong_password", "Incorrect password."))
      .mockResolvedValueOnce(undefined);

    render(
      <LoginModal
        isOpen={true}
        onLoginComplete={onLoginComplete}
        onChooseDifferentFolder={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(checkFileEncryptionStatus).toHaveBeenCalledTimes(1);
    });

    // ACT
    await user.type(screen.getByLabelText("Password"), "wrong password");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    // ASSERT
    expect(
      await screen.findByText("Incorrect password. Please try again."),
    ).toBeInTheDocument();

    // ACT
    await user.type(screen.getByLabelText("Password"), "correct password");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    // ASSERT
    await waitFor(() => {
      expect(checkFileEncryptionStatus).toHaveBeenCalledTimes(3);
      expect(loadExistingData).toHaveBeenCalledTimes(2);
      expect(onLoginComplete).toHaveBeenCalledTimes(1);
    });
  });

  it("re-checks encryption status after reconnect when the initial pre-check is unknown", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onLoginComplete = vi.fn();
    checkFileEncryptionStatus
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ exists: true, encrypted: true });

    render(
      <LoginModal
        isOpen={true}
        onLoginComplete={onLoginComplete}
        onChooseDifferentFolder={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(checkFileEncryptionStatus).toHaveBeenCalledTimes(1);
    });
    expect(setFileEncrypted).toHaveBeenCalledWith(null);

    // ACT
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    // ASSERT
    await waitFor(() => {
      expect(checkFileEncryptionStatus).toHaveBeenCalledTimes(2);
      expect(setFileEncrypted).toHaveBeenLastCalledWith(true);
      expect(authenticate).toHaveBeenCalledWith("admin", "correct horse battery staple");
      expect(loadExistingData).toHaveBeenCalledTimes(1);
      expect(onLoginComplete).toHaveBeenCalledTimes(1);
    });
  });
});
