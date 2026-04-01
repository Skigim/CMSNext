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
    setFileEncrypted: vi.fn<(isEncrypted: boolean, salt?: string) => void>(),
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
    mockEncryptionContext = {
      ...mockEncryptionContext,
      isAuthenticated: true,
    };
    rerender();

    // ASSERT
    await waitFor(() => {
      expect(mockEncryptionContext.setStartupUnlockReady).toHaveBeenLastCalledWith(true);
    });
  });

  it("waits for startup unlock readiness before attempting encrypted startup decrypts", async () => {
    // ARRANGE
    const derivedKey = { type: "secret" } as CryptoKey;
    const startupUnlockGate = createStartupUnlockGate();
    const decryptedWorkspace = createWorkspaceData();
    const encryptedPayload = createEncryptedPayload();

    mockEncryptionContext.waitForStartupUnlockReady.mockImplementation(
      () => startupUnlockGate.startupUnlockPromise,
    );

    const { rerender } = renderHook(() => useEncryptionFileHooks());
    const installedHooks = await waitForInstalledHooks<{
      decrypt: (payload: EncryptedPayload) => Promise<NormalizedFileData>;
    }>();

    // ACT
    const decryptPromise = installedHooks.decrypt(encryptedPayload);

    // ASSERT
    await waitFor(() => {
      expect(mockEncryptionContext.waitForStartupUnlockReady).toHaveBeenCalledTimes(1);
    });
    expect(mockEncryptionContext.deriveKeyFromFileSalt).not.toHaveBeenCalled();

    // ACT
    mockEncryptionContext = {
      ...mockEncryptionContext,
      isAuthenticated: true,
      isStartupUnlockReady: true,
      pendingPassword: WORKSPACE_PASSWORD,
    };
    mockEncryptionContext.deriveKeyFromFileSalt.mockResolvedValue({
      success: true,
      data: derivedKey,
    });
    mockDecryptWithKey.mockResolvedValue({
      success: true,
      data: decryptedWorkspace,
    });
    rerender();
    startupUnlockGate.resolveStartupUnlockReady();

    // ASSERT
    await expect(decryptPromise).resolves.toEqual(decryptedWorkspace);
    expect(mockEncryptionContext.deriveKeyFromFileSalt).toHaveBeenCalledWith(
      WORKSPACE_SALT,
      WORKSPACE_ITERATIONS,
    );
    expect(mockDecryptWithKey).toHaveBeenCalledWith(encryptedPayload, derivedKey);
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
});
