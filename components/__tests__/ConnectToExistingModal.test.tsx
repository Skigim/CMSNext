import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectToExistingModal } from "@/components/modals/ConnectToExistingModal";

// Mock dependencies
const mockSetPendingPassword = vi.fn();
const mockAuthenticate = vi.fn();
const mockClearCredentials = vi.fn();
const mockConnectToFolder = vi.fn();
const mockConnectToExisting = vi.fn();
const mockLoadExistingData = vi.fn();
const mockCheckFileEncryptionStatus = vi.fn();

vi.mock("@/contexts/EncryptionContext", () => ({
  useEncryption: () => ({
    setPendingPassword: mockSetPendingPassword,
    authenticate: mockAuthenticate,
    clearCredentials: mockClearCredentials,
  }),
}));

vi.mock("@/contexts/FileStorageContext", () => ({
  useFileStorage: () => ({
    service: {
      checkFileEncryptionStatus: mockCheckFileEncryptionStatus,
    },
    connectToFolder: mockConnectToFolder,
    connectToExisting: mockConnectToExisting,
    loadExistingData: mockLoadExistingData,
  }),
}));

vi.mock("@/utils/logger", () => ({
  createLogger: () => ({
    lifecycle: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("ConnectToExistingModal", () => {
  const defaultProps = {
    isOpen: true,
    isSupported: true,
    onConnectionComplete: vi.fn(),
    onGoToSettings: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockResolvedValue(true);
    mockConnectToFolder.mockResolvedValue(true);
    mockConnectToExisting.mockResolvedValue(true);
    mockLoadExistingData.mockResolvedValue({});
    mockCheckFileEncryptionStatus.mockResolvedValue({ exists: false, encrypted: false });
  });

  describe("Browser Support", () => {
    it("renders unsupported browser message when File System API unavailable", () => {
      // ARRANGE & ACT
      render(
        <ConnectToExistingModal
          {...defaultProps}
          isSupported={false}
        />
      );

      // ASSERT
      expect(screen.getByText("Browser Not Supported")).toBeInTheDocument();
      expect(
        screen.getByText(/requires the File System Access API/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Google Chrome/)).toBeInTheDocument();
      expect(screen.getByText(/Microsoft Edge/)).toBeInTheDocument();
    });

    it("does not render folder selection when browser unsupported", () => {
      // ARRANGE & ACT
      render(
        <ConnectToExistingModal
          {...defaultProps}
          isSupported={false}
        />
      );

      // ASSERT
      expect(screen.queryByText(/Connect to Your Data/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /new location/i })).not.toBeInTheDocument();
    });
  });

  describe("Folder Selection Step", () => {
    it("renders nothing when modal is closed", () => {
      // ARRANGE & ACT
      render(
        <ConnectToExistingModal
          {...defaultProps}
          isOpen={false}
        />
      );

      // ASSERT
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("displays folder selection UI with encryption benefits", () => {
      // ARRANGE & ACT
      render(<ConnectToExistingModal {...defaultProps} />);

      // ASSERT
      expect(screen.getByText("Connect to Your Data")).toBeInTheDocument();
      expect(screen.getByText(/AES-256 encryption/i)).toBeInTheDocument();
      expect(screen.getByText(/Password never stored/i)).toBeInTheDocument();
      expect(screen.getByText(/Complete offline access/i)).toBeInTheDocument();
    });

    it("shows first-time setup alert when no stored handle exists", () => {
      // ARRANGE & ACT
      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={false}
        />
      );

      // ASSERT
      expect(screen.getByText(/First time setup/i)).toBeInTheDocument();
    });

    it("hides first-time setup alert when stored handle exists", () => {
      // ARRANGE & ACT
      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={true}
        />
      );

      // ASSERT
      expect(screen.queryByText(/First time setup/i)).not.toBeInTheDocument();
    });

    it("displays reconnect button only when stored handle exists", () => {
      // ARRANGE & ACT
      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={true}
          permissionStatus="granted"
        />
      );

      // ASSERT
      expect(
        screen.getByRole("button", { name: /connect to previous folder/i })
      ).toBeInTheDocument();
    });

    it("hides reconnect button when no stored handle", () => {
      // ARRANGE & ACT
      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={false}
        />
      );

      // ASSERT
      expect(
        screen.queryByRole("button", { name: /connect to previous folder/i })
      ).not.toBeInTheDocument();
    });

    it("shows permission denied warning when status is denied", () => {
      // ARRANGE & ACT
      render(
        <ConnectToExistingModal
          {...defaultProps}
          permissionStatus="denied"
        />
      );

      // ASSERT
      expect(
        screen.getByText(/Permission was previously denied/i)
      ).toBeInTheDocument();
    });
  });

  describe("Folder Connection Flow", () => {
    it("calls connectToExisting when reconnecting to previous folder", async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={true}
        />
      );

      // ACT
      await user.click(screen.getByRole("button", { name: /connect to previous folder/i }));

      // ASSERT
      await waitFor(() => {
        expect(mockConnectToExisting).toHaveBeenCalledTimes(1);
      });
      expect(mockConnectToFolder).not.toHaveBeenCalled();
    });

    it("calls connectToFolder when choosing new folder", async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<ConnectToExistingModal {...defaultProps} />);

      // ACT - open dropdown and click new folder
      await user.click(screen.getByRole("button", { name: /new location/i }));
      await user.click(screen.getByText(/Choose New Folder/i));

      // ASSERT
      await waitFor(() => {
        expect(mockConnectToFolder).toHaveBeenCalledTimes(1);
      });
      expect(mockConnectToExisting).not.toHaveBeenCalled();
    });

    it("transitions to password step after successful folder connection", async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockConnectToExisting.mockResolvedValue(true);
      mockCheckFileEncryptionStatus.mockResolvedValue({ exists: false, encrypted: false });

      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={true}
        />
      );

      // ACT
      await user.click(screen.getByRole("button", { name: /connect to previous folder/i }));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/Create Password/i)).toBeInTheDocument();
      });
    });

    it("shows enter password mode for encrypted files", async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockConnectToExisting.mockResolvedValue(true);
      mockCheckFileEncryptionStatus.mockResolvedValue({ exists: true, encrypted: true });

      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={true}
        />
      );

      // ACT
      await user.click(screen.getByRole("button", { name: /connect to previous folder/i }));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText("Enter Password")).toBeInTheDocument();
      });
      expect(screen.getByText(/decrypt and access your data/i)).toBeInTheDocument();
    });

    it("shows create password mode for new/unencrypted files", async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockConnectToExisting.mockResolvedValue(true);
      mockCheckFileEncryptionStatus.mockResolvedValue({ exists: false, encrypted: false });

      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={true}
        />
      );

      // ACT
      await user.click(screen.getByRole("button", { name: /connect to previous folder/i }));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText("Create Password")).toBeInTheDocument();
      });
      expect(screen.getByText(/encrypt and protect your data/i)).toBeInTheDocument();
    });

    it("does not transition when user cancels folder selection", async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockConnectToExisting.mockResolvedValue(false); // User cancelled

      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={true}
        />
      );

      // ACT
      await user.click(screen.getByRole("button", { name: /connect to previous folder/i }));

      // ASSERT
      await waitFor(() => {
        expect(mockConnectToExisting).toHaveBeenCalled();
      });
      // Should stay on choose step
      expect(screen.getByText("Connect to Your Data")).toBeInTheDocument();
      expect(screen.queryByText(/Create Password/i)).not.toBeInTheDocument();
    });
  });

  describe("Password Step - Create Mode", () => {
    const setupCreatePasswordStep = async () => {
      const user = userEvent.setup();
      mockConnectToExisting.mockResolvedValue(true);
      mockCheckFileEncryptionStatus.mockResolvedValue({ exists: false, encrypted: false });

      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={true}
        />
      );

      await user.click(screen.getByRole("button", { name: /connect to previous folder/i }));
      await waitFor(() => {
        expect(screen.getByText("Create Password")).toBeInTheDocument();
      });

      return user;
    };

    it("displays password warning about no recovery", async () => {
      // ARRANGE & ACT
      await setupCreatePasswordStep();

      // ASSERT
      expect(screen.getByText(/Remember this password/i)).toBeInTheDocument();
      expect(screen.getByText(/no password recovery/i)).toBeInTheDocument();
    });

    it("shows confirm password field in create mode", async () => {
      // ARRANGE & ACT
      await setupCreatePasswordStep();

      // ASSERT
      expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    });

    it("displays error when passwords do not match", async () => {
      // ARRANGE
      const user = await setupCreatePasswordStep();

      // ACT
      await user.type(screen.getByLabelText(/^Password$/i), "password123");
      await user.type(screen.getByLabelText(/Confirm Password/i), "different");
      await user.click(screen.getByRole("button", { name: /Secure & Continue/i }));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
      });
      expect(mockAuthenticate).not.toHaveBeenCalled();
    });

    it("displays error when password is too short", async () => {
      // ARRANGE
      const user = await setupCreatePasswordStep();

      // ACT
      await user.type(screen.getByLabelText(/^Password$/i), "abc");
      await user.type(screen.getByLabelText(/Confirm Password/i), "abc");
      await user.click(screen.getByRole("button", { name: /Secure & Continue/i }));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/at least 4 characters/i)).toBeInTheDocument();
      });
      expect(mockAuthenticate).not.toHaveBeenCalled();
    });

    it("displays error when password is empty", async () => {
      // ARRANGE
      const user = await setupCreatePasswordStep();

      // ACT
      await user.click(screen.getByRole("button", { name: /Secure & Continue/i }));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
      });
      expect(mockAuthenticate).not.toHaveBeenCalled();
    });

    it("calls onConnectionComplete after successful password creation", async () => {
      // ARRANGE
      const onConnectionComplete = vi.fn();
      const user = userEvent.setup();
      mockConnectToExisting.mockResolvedValue(true);
      mockCheckFileEncryptionStatus.mockResolvedValue({ exists: false, encrypted: false });

      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={true}
          onConnectionComplete={onConnectionComplete}
        />
      );

      await user.click(screen.getByRole("button", { name: /connect to previous folder/i }));
      await waitFor(() => {
        expect(screen.getByText("Create Password")).toBeInTheDocument();
      });

      // ACT
      await user.type(screen.getByLabelText(/^Password$/i), "validPassword");
      await user.type(screen.getByLabelText(/Confirm Password/i), "validPassword");
      await user.click(screen.getByRole("button", { name: /Secure & Continue/i }));

      // ASSERT
      await waitFor(() => {
        expect(mockSetPendingPassword).toHaveBeenCalledWith("validPassword");
        expect(mockAuthenticate).toHaveBeenCalledWith("admin", "validPassword");
        expect(mockLoadExistingData).toHaveBeenCalled();
        expect(onConnectionComplete).toHaveBeenCalled();
      });
    });
  });

  describe("Password Step - Enter Mode", () => {
    const setupEnterPasswordStep = async () => {
      const user = userEvent.setup();
      mockConnectToExisting.mockResolvedValue(true);
      mockCheckFileEncryptionStatus.mockResolvedValue({ exists: true, encrypted: true });

      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={true}
        />
      );

      await user.click(screen.getByRole("button", { name: /connect to previous folder/i }));
      await waitFor(() => {
        expect(screen.getByText("Enter Password")).toBeInTheDocument();
      });

      return user;
    };

    it("does not show confirm password field in enter mode", async () => {
      // ARRANGE & ACT
      await setupEnterPasswordStep();

      // ASSERT
      expect(screen.queryByLabelText(/Confirm Password/i)).not.toBeInTheDocument();
    });

    it("does not show password recovery warning in enter mode", async () => {
      // ARRANGE & ACT
      await setupEnterPasswordStep();

      // ASSERT
      expect(screen.queryByText(/Remember this password/i)).not.toBeInTheDocument();
    });

    it("displays error for incorrect password (decryption failure)", async () => {
      // ARRANGE
      const user = await setupEnterPasswordStep();
      mockLoadExistingData.mockRejectedValue(new Error("Invalid password or corrupted data"));

      // ACT
      await user.type(screen.getByLabelText(/^Password$/i), "wrongPassword");
      await user.click(screen.getByRole("button", { name: /Unlock/i }));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/Incorrect password/i)).toBeInTheDocument();
      });
      expect(mockClearCredentials).toHaveBeenCalled();
    });

    it("clears password field after decryption failure", async () => {
      // ARRANGE
      const user = await setupEnterPasswordStep();
      mockLoadExistingData.mockRejectedValue(new Error("Invalid password"));

      // ACT
      const passwordInput = screen.getByLabelText(/^Password$/i);
      await user.type(passwordInput, "wrongPassword");
      await user.click(screen.getByRole("button", { name: /Unlock/i }));

      // ASSERT
      await waitFor(() => {
        expect(passwordInput).toHaveValue("");
      });
    });

    it("calls onConnectionComplete after successful decryption", async () => {
      // ARRANGE
      const onConnectionComplete = vi.fn();
      const user = userEvent.setup();
      mockConnectToExisting.mockResolvedValue(true);
      mockCheckFileEncryptionStatus.mockResolvedValue({ exists: true, encrypted: true });

      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={true}
          onConnectionComplete={onConnectionComplete}
        />
      );

      await user.click(screen.getByRole("button", { name: /connect to previous folder/i }));
      await waitFor(() => {
        expect(screen.getByText("Enter Password")).toBeInTheDocument();
      });

      // ACT
      await user.type(screen.getByLabelText(/^Password$/i), "correctPassword");
      await user.click(screen.getByRole("button", { name: /Unlock/i }));

      // ASSERT
      await waitFor(() => {
        expect(mockSetPendingPassword).toHaveBeenCalledWith("correctPassword");
        expect(mockAuthenticate).toHaveBeenCalledWith("admin", "correctPassword");
        expect(mockLoadExistingData).toHaveBeenCalled();
        expect(onConnectionComplete).toHaveBeenCalled();
      });
    });
  });

  describe("Back Navigation", () => {
    it("returns to folder selection when back button clicked", async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockConnectToExisting.mockResolvedValue(true);
      mockCheckFileEncryptionStatus.mockResolvedValue({ exists: false, encrypted: false });

      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={true}
        />
      );

      await user.click(screen.getByRole("button", { name: /connect to previous folder/i }));
      await waitFor(() => {
        expect(screen.getByText("Create Password")).toBeInTheDocument();
      });

      // ACT
      await user.click(screen.getByRole("button", { name: /Back/i }));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText("Connect to Your Data")).toBeInTheDocument();
      });
      expect(screen.queryByText(/Create Password/i)).not.toBeInTheDocument();
    });

    it("clears credentials when navigating back", async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockConnectToExisting.mockResolvedValue(true);
      mockCheckFileEncryptionStatus.mockResolvedValue({ exists: false, encrypted: false });

      render(
        <ConnectToExistingModal
          {...defaultProps}
          hasStoredHandle={true}
        />
      );

      await user.click(screen.getByRole("button", { name: /connect to previous folder/i }));
      await waitFor(() => {
        expect(screen.getByText("Create Password")).toBeInTheDocument();
      });

      // ACT
      await user.click(screen.getByRole("button", { name: /Back/i }));

      // ASSERT
      await waitFor(() => {
        expect(mockClearCredentials).toHaveBeenCalled();
      });
    });
  });

  describe("Settings Navigation", () => {
    it("calls onGoToSettings when import JSON option selected", async () => {
      // ARRANGE
      const onGoToSettings = vi.fn();
      const user = userEvent.setup();

      render(
        <ConnectToExistingModal
          {...defaultProps}
          onGoToSettings={onGoToSettings}
        />
      );

      // ACT
      await user.click(screen.getByRole("button", { name: /new location/i }));
      await user.click(screen.getByText(/Import JSON/i));

      // ASSERT
      expect(onGoToSettings).toHaveBeenCalledTimes(1);
    });
  });
});
