import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EncryptedPayload } from "@/types/encryption";
import { useEncryptionFileHooks } from "@/hooks/useEncryptionFileHooks";
import { createMockNormalizedFileData } from "@/src/test/testUtils";
import type { NormalizedFileData } from "@/utils/services/FileStorageService";

const setEncryptionHooks = vi.fn<(hooks: unknown) => void>();
const mockEncryptWithKey = vi.hoisted(() => vi.fn());
const mockDecryptWithKey = vi.hoisted(() => vi.fn());
const WORKSPACE_PASSWORD = "correct horse battery staple";
const WORKSPACE_SALT = "workspace-salt";
const WORKSPACE_ITERATIONS = 600_000;

let mockFileStorageService: { setEncryptionHooks: typeof setEncryptionHooks } | null = {
  setEncryptionHooks,
};

function createWorkspaceData(
  overrides: Partial<NormalizedFileData> = {},
): NormalizedFileData {
  return createMockNormalizedFileData({
    exported_at: "2026-04-01T00:00:00.000Z",
    templates: [],
    ...overrides,
  });
}

function createEncryptedPayload(
  overrides: Partial<EncryptedPayload> = {},
): EncryptedPayload {
  return {
    version: 1,
    algorithm: "AES-256-GCM",
    salt: WORKSPACE_SALT,
    iv: "workspace-iv",
    ciphertext: "workspace-ciphertext",
    iterations: WORKSPACE_ITERATIONS,
    encryptedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function createStartupUnlockGate() {
  let resolveStartupUnlockReady: () => void = () => {};
  const startupUnlockPromise = new Promise<void>((resolve) => {
    resolveStartupUnlockReady = resolve;
  });

  return {
    resolveStartupUnlockReady,
    startupUnlockPromise,
  };
}

async function waitForInstalledHooks<T>(): Promise<T> {
  await waitFor(() => {
    expect(setEncryptionHooks).toHaveBeenCalledTimes(1);
  });

  const installedHooks = setEncryptionHooks.mock.calls[0]?.[0];
  expect(installedHooks).not.toBeNull();

  return installedHooks as T;
}

function createMockEncryptionContext() {
  return {
    requiresPassword: true,
    isEncryptionEnabled: true,
    isAuthenticated: false,
    derivedKey: null as CryptoKey | null,
    currentSalt: null as string | null,
    currentIterations: null as number | null,
    pendingPassword: null as string | null,
    fileIsEncrypted: false,
    isStartupUnlockReady: false,
    initializeEncryption: vi.fn(),
    deriveKeyFromFileSalt: vi.fn(),
    waitForStartupUnlockReady: vi.fn<() => Promise<void>>(),
    setPendingPassword: vi.fn<(password: string | null) => void>(),
    setStartupUnlockReady: vi.fn<(isReady: boolean) => void>(),
    blockStartupUnlock: vi.fn<() => void>(),
    setFileEncrypted: vi.fn<(isEncrypted: boolean | null, salt?: string) => void>(),
  };
}

let mockEncryptionContext = createMockEncryptionContext();

vi.mock("@/contexts/EncryptionContext", () => ({
  useEncryption: () => mockEncryptionContext,
}));

vi.mock("@/contexts/FileStorageContext", () => ({
  useFileStorage: () => ({
    service: mockFileStorageService,
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
    mockEncryptionContext = createMockEncryptionContext();
    mockFileStorageService = {
      setEncryptionHooks,
    };
  });

  it("reports inactive until hooks are actually installed on the file service", async () => {
    // ARRANGE
    mockFileStorageService = null;
    const { result, rerender } = renderHook(() => useEncryptionFileHooks());

    // ASSERT
    expect(result.current.isActive).toBe(false);
    expect(setEncryptionHooks).not.toHaveBeenCalled();

    // ACT
    mockFileStorageService = {
      setEncryptionHooks,
    };
    rerender();

    // ASSERT
    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });
  });

  it("stays inactive when full encryption is disabled even if the file service is available", () => {
    // ARRANGE
    mockEncryptionContext.isEncryptionEnabled = false;

    // ACT
    const { result } = renderHook(() => useEncryptionFileHooks());

    // ASSERT
    expect(result.current.isActive).toBe(false);
    expect(setEncryptionHooks).toHaveBeenCalledWith(null);
  });

  it("installs encryption hooks before authentication without marking encrypted startup as ready", async () => {
    // ARRANGE
    renderHook(() => useEncryptionFileHooks());

    // ASSERT
    const installedHooks = await waitForInstalledHooks<unknown>();
    expect(installedHooks).not.toBeNull();
    expect(mockEncryptionContext.setStartupUnlockReady).not.toHaveBeenCalled();
  });

  it("uses the login-submitted password to decrypt encrypted startup data without waiting on the readiness gate first", async () => {
    // ARRANGE
    const derivedKey = { type: "secret" } as CryptoKey;
    const decryptedWorkspace = createWorkspaceData();
    const encryptedPayload = createEncryptedPayload();

    mockEncryptionContext.pendingPassword = WORKSPACE_PASSWORD;
    mockEncryptionContext.deriveKeyFromFileSalt.mockResolvedValue({
      success: true,
      data: derivedKey,
    });
    mockDecryptWithKey.mockResolvedValue({
      success: true,
      data: decryptedWorkspace,
    });

    renderHook(() => useEncryptionFileHooks());
    const installedHooks = await waitForInstalledHooks<{
      decrypt: (payload: EncryptedPayload) => Promise<NormalizedFileData>;
    }>();

    // ACT
    const decryptPromise = installedHooks.decrypt(encryptedPayload);

    // ASSERT
    expect(mockEncryptionContext.waitForStartupUnlockReady).not.toHaveBeenCalled();
    await expect(decryptPromise).resolves.toEqual(decryptedWorkspace);
    expect(mockEncryptionContext.deriveKeyFromFileSalt).toHaveBeenCalledWith(
      WORKSPACE_SALT,
      WORKSPACE_ITERATIONS,
    );
    expect(mockDecryptWithKey).toHaveBeenCalledWith(encryptedPayload, derivedKey);
    expect(mockEncryptionContext.setStartupUnlockReady).toHaveBeenCalledWith(true);
  });

  it("fails closed for encrypted startup writes until the existing workspace has been decrypted", async () => {
    // ARRANGE
    const startupUnlockGate = createStartupUnlockGate();
    const workspaceData = createWorkspaceData();

    mockEncryptionContext.fileIsEncrypted = true;
    mockEncryptionContext.waitForStartupUnlockReady.mockImplementation(
      () => startupUnlockGate.startupUnlockPromise,
    );

    const { rerender } = renderHook(() => useEncryptionFileHooks());
    const installedHooks = await waitForInstalledHooks<{
      encrypt: (data: NormalizedFileData) => Promise<EncryptedPayload | NormalizedFileData>;
    }>();

    // ACT
    const encryptPromise = installedHooks.encrypt(workspaceData);

    // ASSERT
    await waitFor(() => {
      expect(mockEncryptionContext.waitForStartupUnlockReady).toHaveBeenCalledTimes(1);
    });
    expect(mockEncryptionContext.initializeEncryption).not.toHaveBeenCalled();
    expect(mockEncryptWithKey).not.toHaveBeenCalled();
    const failedWriteExpectation = expect(encryptPromise).rejects.toMatchObject({
      code: "system_error",
      message: "Encrypted workspace must be unlocked before saving.",
    });

    // ACT
    await act(async () => {
      mockEncryptionContext = {
        ...mockEncryptionContext,
        isAuthenticated: true,
        isStartupUnlockReady: true,
        pendingPassword: WORKSPACE_PASSWORD,
      };
      rerender();
      startupUnlockGate.resolveStartupUnlockReady();
    });

    // ASSERT
    await failedWriteExpectation;
    expect(mockEncryptionContext.initializeEncryption).not.toHaveBeenCalled();
    expect(mockEncryptWithKey).not.toHaveBeenCalled();
  });

  it("blocks startup unlock after a decrypt failure and allows a later retry to succeed", async () => {
    // ARRANGE
    const derivedKey = { type: "secret" } as CryptoKey;
    const decryptedWorkspace = createWorkspaceData();
    const encryptedPayload = createEncryptedPayload();

    mockEncryptionContext.pendingPassword = "first try";
    mockEncryptionContext.deriveKeyFromFileSalt.mockResolvedValue({
      success: true,
      data: derivedKey,
    });
    mockDecryptWithKey.mockResolvedValueOnce({
      success: false,
      error: "Invalid password or corrupted data",
    });

    renderHook(() => useEncryptionFileHooks());
    const installedHooks = await waitForInstalledHooks<{
      decrypt: (payload: EncryptedPayload) => Promise<NormalizedFileData>;
    }>();

    // ACT & ASSERT
    await expect(installedHooks.decrypt(encryptedPayload)).rejects.toThrow(
      "Invalid password or corrupted data",
    );
    expect(mockEncryptionContext.blockStartupUnlock).toHaveBeenCalledTimes(1);
    expect(mockEncryptionContext.setStartupUnlockReady).not.toHaveBeenCalledWith(true);

    // ACT
    mockEncryptionContext.pendingPassword = "second try";
    mockDecryptWithKey.mockResolvedValueOnce({
      success: true,
      data: decryptedWorkspace,
    });

    // ASSERT
    await expect(installedHooks.decrypt(encryptedPayload)).resolves.toEqual(decryptedWorkspace);
    expect(mockEncryptionContext.setStartupUnlockReady).toHaveBeenCalledWith(true);
  });
});
