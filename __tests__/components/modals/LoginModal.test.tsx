import { describe, expect, it, vi } from "vitest";
import { axe } from "jest-axe";
import { render, screen, waitFor } from "@testing-library/react";
import { LoginModal } from "@/components/modals/LoginModal";

const checkFileEncryptionStatus = vi.fn(() => new Promise<never>(() => {}));

vi.mock("@/contexts/EncryptionContext", () => ({
  useEncryption: () => ({
    setPendingPassword: vi.fn(),
    authenticate: vi.fn(),
    clearCredentials: vi.fn(),
  }),
}));

vi.mock("@/contexts/FileStorageContext", () => ({
  useFileStorage: () => ({
    service: {
      checkFileEncryptionStatus,
    },
    connectToExisting: vi.fn(),
    loadExistingData: vi.fn(),
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
});