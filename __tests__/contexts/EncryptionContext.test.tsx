import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EncryptionProvider, useEncryption } from "@/contexts/EncryptionContext";
import type { EncryptionMode } from "@/types/encryption";
import { DEFAULT_ENCRYPTION_CONFIG } from "@/types/encryption";
import type { AppConfig } from "@/utils/appConfig";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  lifecycle: vi.fn(),
}));

const mockAppConfig = vi.hoisted(() => ({
  APP_CONFIG: {
    appEnv: "dev" as const,
    encryptionMode: "full" as EncryptionMode,
    devtoolsEnabled: true,
    schemaInspectorEnabled: true,
    dataFlowDebugEnabled: true,
    verboseLogging: true,
  } satisfies AppConfig,
}));

const mockDeriveKey = vi.hoisted(() => vi.fn());
const mockDeriveKeyFromSaltString = vi.hoisted(() => vi.fn());
const mockGenerateSalt = vi.hoisted(() => vi.fn(() => "generated-salt"));
const mockIsEncryptionSupported = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/utils/logger", () => ({
  createLogger: () => mockLogger,
}));

vi.mock("@/utils/appConfig", () => mockAppConfig);

vi.mock("@/utils/encryption", async () => {
  const actual = await vi.importActual<typeof import("@/utils/encryption")>(
    "@/utils/encryption",
  );

  return {
    ...actual,
    deriveKey: mockDeriveKey,
    deriveKeyFromSaltString: mockDeriveKeyFromSaltString,
    generateSalt: mockGenerateSalt,
    isEncryptionSupported: mockIsEncryptionSupported,
  };
});

function createWrapper() {
  return function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return <EncryptionProvider>{children}</EncryptionProvider>;
  };
}

describe("EncryptionContext", () => {
  beforeEach(() => {
    mockAppConfig.APP_CONFIG.encryptionMode = "full";
    mockDeriveKey.mockReset();
    mockDeriveKeyFromSaltString.mockReset();
    mockGenerateSalt.mockClear();
    mockIsEncryptionSupported.mockClear();
    Object.values(mockLogger).forEach((method) => method.mockClear());
  });

  it("renders provider with children", () => {
    // ARRANGE & ACT
    render(
      <EncryptionProvider>
        <div data-testid="child">Encrypted</div>
      </EncryptionProvider>,
    );

    // ASSERT
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("bypasses verification only when encryption mode is disabled", async () => {
    // ARRANGE
    mockAppConfig.APP_CONFIG.encryptionMode = "disabled";
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEncryption(), { wrapper });

    // ACT
    await act(async () => {
      result.current.setPendingPassword("dev-secret");
      await result.current.authenticate("admin", "dev-secret", "existing-salt");
    });

    // ASSERT
    expect(mockDeriveKeyFromSaltString).not.toHaveBeenCalled();
    expect(result.current.encryptionMode).toBe("disabled");
    expect(result.current.requiresPassword).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.derivedKey).toBeNull();
    expect(result.current.currentSalt).toBeNull();
    expect(result.current.currentIterations).toBeNull();
    expect(result.current.pendingPassword).toBeNull();
  });

  it("keeps noop mode on the verification path when a salt is provided", async () => {
    // ARRANGE
    const derivedKey = { type: "secret" } as CryptoKey;
    mockAppConfig.APP_CONFIG.encryptionMode = "noop";
    mockDeriveKeyFromSaltString.mockResolvedValue(derivedKey);
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEncryption(), { wrapper });

    // ACT
    await act(async () => {
      await result.current.authenticate("admin", "noop-secret", "existing-salt");
    });

    // ASSERT
    expect(mockDeriveKeyFromSaltString).toHaveBeenCalledOnce();
    expect(mockDeriveKeyFromSaltString).toHaveBeenCalledWith(
      "noop-secret",
      "existing-salt",
      DEFAULT_ENCRYPTION_CONFIG.iterations,
    );
    expect(result.current.encryptionMode).toBe("noop");
    expect(result.current.requiresPassword).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.derivedKey).toBe(derivedKey);
    expect(result.current.currentSalt).toBe("existing-salt");
    expect(result.current.currentIterations).toBe(DEFAULT_ENCRYPTION_CONFIG.iterations);
  });

  it("keeps encrypted reconnect startup blocked until decrypt verification succeeds", async () => {
    // ARRANGE
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEncryption(), { wrapper });

    // ACT
    await act(async () => {
      result.current.setFileEncrypted(true, "workspace-salt");
      await result.current.authenticate("admin", "secret");
    });

    // ASSERT
    expect(result.current.fileIsEncrypted).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isStartupUnlockReady).toBe(false);

    // ACT
    await act(async () => {
      result.current.setStartupUnlockReady(true);
    });

    // ASSERT
    expect(result.current.isStartupUnlockReady).toBe(true);
  });

  it("keeps encrypted startup blocked after credentials are cleared and rejects startup waits until retry", async () => {
    // ARRANGE
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEncryption(), { wrapper });

    await act(async () => {
      result.current.setFileEncrypted(true, "workspace-salt");
      result.current.setStartupUnlockReady(true);
    });
    expect(result.current.isStartupUnlockReady).toBe(true);

    // ACT
    await act(async () => {
      result.current.clearCredentials();
    });

    // ASSERT
    expect(result.current.fileIsEncrypted).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isStartupUnlockReady).toBe(false);
    await expect(result.current.waitForStartupUnlockReady()).rejects.toThrow(
      "Encrypted workspace unlock is blocked until a later retry succeeds.",
    );
  });

  it("codePointAt handles basic ASCII characters", () => {
    // ARRANGE
    const char = "A";

    // ACT
    const codePoint = char.codePointAt(0);

    // ASSERT
    expect(codePoint).toBe(65);
  });

  it("codePointAt handles multi-byte characters correctly", () => {
    // ARRANGE
    const emoji = "😀";

    // ACT
    const codePoint = emoji.codePointAt(0);

    // ASSERT
    expect(codePoint).toBe(0x1F600);
    expect(codePoint).toBeGreaterThan(0xFFFF);
  });
});
