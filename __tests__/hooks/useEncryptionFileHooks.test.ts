import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEncryptionFileHooks } from "@/hooks/useEncryptionFileHooks";
import type { EncryptedPayload } from "@/types/encryption";
import type { NormalizedFileData } from "@/utils/services/FileStorageService";

const setEncryptionHooks = vi.fn<[unknown], void>();
const mockEncryptWithKey = vi.hoisted(() => vi.fn());
const mockDecryptWithKey = vi.hoisted(() => vi.fn());

const mockEncryptionContext = {
  requiresPassword: true,
  isEncryptionEnabled: true,
  isAuthenticated: false,
  derivedKey: null as CryptoKey | null,
  currentSalt: null as string | null,
  currentIterations: null as number | null,
  pendingPassword: null as string | null,
  isStartupUnlockReady: false,
  initializeEncryption: vi.fn(),
  deriveKeyFromFileSalt: vi.fn(),
  waitForStartupUnlockReady: vi.fn<[], Promise<void>>(),
  setPendingPassword: vi.fn<[string | null], void>(),
  setStartupUnlockReady: vi.fn<[boolean], void>(),
};

vi.mock("@/contexts/EncryptionContext", () => ({
  useEncryption: () => mockEncryptionContext,
}));

vi.mock("@/contexts/FileStorageContext", () => ({
  useFileStorage: () => ({
    service: {
      setEncryptionHooks,
    },
  }),
}));

vi.mock("@/utils/encryption", () => ({
  encryptWithKey: mockEncryptWithKey,
  decryptWithKey: mockDecryptWithKey,
}));

describe("useEncryptionFileHooks", () => {
  beforeEach(() => {
    // ARRANGE
    setEncryptionHooks.mockReset();
    mockEncryptWithKey.mockReset();
    mockDecryptWithKey.mockReset();
    mockEncryptionContext.initializeEncryption.mockReset();
    mockEncryptionContext.deriveKeyFromFileSalt.mockReset();
    mockEncryptionContext.waitForStartupUnlockReady.mockReset();
    mockEncryptionContext.setPendingPassword.mockReset();
    mockEncryptionContext.setStartupUnlockReady.mockReset();

    mockEncryptionContext.requiresPassword = true;
    mockEncryptionContext.isEncryptionEnabled = true;
    mockEncryptionContext.isAuthenticated = false;
    mockEncryptionContext.derivedKey = null;
    mockEncryptionContext.currentSalt = null;
    mockEncryptionContext.currentIterations = null;
    mockEncryptionContext.pendingPassword = null;
    mockEncryptionContext.isStartupUnlockReady = false;
  });

  it("installs encryption hooks before authentication and keeps startup readiness tied to authentication", async () => {
    // ARRANGE
    const { rerender } = renderHook(() => useEncryptionFileHooks());

    // ASSERT
    await waitFor(() => {
      expect(setEncryptionHooks).toHaveBeenCalledTimes(1);
    });
    expect(setEncryptionHooks.mock.calls[0]?.[0]).not.toBeNull();
    expect(mockEncryptionContext.setStartupUnlockReady).toHaveBeenLastCalledWith(false);

    // ACT
    mockEncryptionContext.isAuthenticated = true;
    rerender();

    // ASSERT
    await waitFor(() => {
      expect(mockEncryptionContext.setStartupUnlockReady).toHaveBeenLastCalledWith(true);
    });
  });

  it("waits for startup unlock readiness before attempting encrypted startup decrypts", async () => {
    // ARRANGE
    let resolveStartupUnlockReady: () => void = () => {};
    const derivedKey = { type: "secret" } as CryptoKey;
    const decryptedWorkspace: NormalizedFileData = {
      version: "2.1",
      people: [],
      cases: [],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-04-01T00:00:00.000Z",
      total_cases: 0,
      categoryConfig: {},
      activityLog: [],
      templates: [],
    };
    const encryptedPayload: EncryptedPayload = {
      version: 1,
      algorithm: "AES-256-GCM",
      salt: "workspace-salt",
      iv: "workspace-iv",
      ciphertext: "workspace-ciphertext",
      iterations: 600_000,
      encryptedAt: "2026-04-01T00:00:00.000Z",
    };

    mockEncryptionContext.waitForStartupUnlockReady.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStartupUnlockReady = resolve;
        }),
    );

    const { rerender } = renderHook(() => useEncryptionFileHooks());

    await waitFor(() => {
      expect(setEncryptionHooks).toHaveBeenCalledTimes(1);
    });

    const installedHooks = setEncryptionHooks.mock.calls[0]?.[0] as {
      decrypt: (payload: EncryptedPayload) => Promise<NormalizedFileData>;
    };

    // ACT
    const decryptPromise = installedHooks.decrypt(encryptedPayload);

    // ASSERT
    await waitFor(() => {
      expect(mockEncryptionContext.waitForStartupUnlockReady).toHaveBeenCalledTimes(1);
    });
    expect(mockEncryptionContext.deriveKeyFromFileSalt).not.toHaveBeenCalled();

    // ACT
    mockEncryptionContext.isAuthenticated = true;
    mockEncryptionContext.isStartupUnlockReady = true;
    mockEncryptionContext.pendingPassword = "correct horse battery staple";
    mockEncryptionContext.deriveKeyFromFileSalt.mockResolvedValue({
      success: true,
      data: derivedKey,
    });
    mockDecryptWithKey.mockResolvedValue({
      success: true,
      data: decryptedWorkspace,
    });
    rerender();
    resolveStartupUnlockReady();

    // ASSERT
    await expect(decryptPromise).resolves.toEqual(decryptedWorkspace);
    expect(mockEncryptionContext.deriveKeyFromFileSalt).toHaveBeenCalledWith(
      "workspace-salt",
      600_000,
    );
    expect(mockDecryptWithKey).toHaveBeenCalledWith(encryptedPayload, derivedKey);
  });
});
