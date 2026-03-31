import { describe, expect, it, vi, beforeEach } from "vitest";
import { axe } from "jest-axe";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginModal } from "@/components/modals/LoginModal";

const checkFileEncryptionStatus = vi.fn();
const connectToExisting = vi.fn();
const loadExistingData = vi.fn();
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

    mockEncryptionContext.requiresPassword = true;
    mockEncryptionContext.isEncryptionEnabled = true;

    connectToExisting.mockResolvedValue(true);
    loadExistingData.mockResolvedValue(undefined);
    authenticate.mockResolvedValue(true);
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

    // ACT
    await user.click(screen.getByRole("button", { name: "Open Workspace" }));

    // ASSERT
    await waitFor(() => {
      expect(connectToExisting).toHaveBeenCalledTimes(1);
      expect(authenticate).toHaveBeenCalledWith("admin", "");
      expect(loadExistingData).toHaveBeenCalledTimes(1);
      expect(onLoginComplete).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });
});
