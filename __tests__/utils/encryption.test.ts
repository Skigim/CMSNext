import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock crypto.subtle for testing in Node.js environment
const mockSubtle = {
  importKey: vi.fn(),
  deriveKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
};

const mockGetRandomValues = vi.fn((array: Uint8Array) => {
  // Fill with predictable values for testing
  for (let i = 0; i < array.length; i++) {
    array[i] = (i * 7 + 11) % 256;
  }
  return array;
});

// Setup mock before imports
vi.stubGlobal("crypto", {
  subtle: mockSubtle,
  getRandomValues: mockGetRandomValues,
});

// Import after mocking
import {
  deriveKey,
  deriveKeyFromSaltString,
  encrypt,
  encryptWithKey,
  decrypt,
  decryptWithKey,
  generateSalt,
  isEncryptionSupported,
} from "@/utils/encryption";
import { isEncryptedPayload, DEFAULT_ENCRYPTION_CONFIG } from "@/types/encryption";

describe("encryption utilities", () => {
  // Mock CryptoKey for testing
  const mockCryptoKey = {
    type: "secret",
    extractable: false,
    algorithm: { name: "AES-GCM", length: 256 },
    usages: ["encrypt", "decrypt"],
  } as unknown as CryptoKey;

  // Mock key material
  const mockKeyMaterial = {
    type: "raw",
    extractable: false,
    algorithm: { name: "PBKDF2" },
    usages: ["deriveKey"],
  } as unknown as CryptoKey;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    mockSubtle.importKey.mockResolvedValue(mockKeyMaterial);
    mockSubtle.deriveKey.mockResolvedValue(mockCryptoKey);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("isEncryptionSupported", () => {
    it("returns true when crypto.subtle is available", () => {
      expect(isEncryptionSupported()).toBe(true);
    });

    it("returns false when crypto is undefined", () => {
      const originalCrypto = global.crypto;
      // @ts-expect-error Testing undefined crypto
      global.crypto = undefined;

      expect(isEncryptionSupported()).toBe(false);

      global.crypto = originalCrypto;
    });
  });

  describe("generateSalt", () => {
    it("generates salt of default length", () => {
      const salt = generateSalt();

      expect(mockGetRandomValues).toHaveBeenCalledWith(
        expect.any(Uint8Array)
      );
      expect(typeof salt).toBe("string");
      // Base64 encoded 16 bytes should be about 24 chars
      expect(salt.length).toBeGreaterThan(0);
    });

    it("generates salt of custom length", () => {
      const salt = generateSalt(32);

      expect(mockGetRandomValues).toHaveBeenCalledWith(
        expect.any(Uint8Array)
      );
      expect(typeof salt).toBe("string");
    });

    it("returns base64 encoded string", () => {
      const salt = generateSalt();

      // Should be valid base64
      expect(() => atob(salt)).not.toThrow();
    });
  });

  describe("deriveKey", () => {
    it("derives key using PBKDF2", async () => {
      const password = "test-password";
      const salt = new Uint8Array(16).buffer;

      await deriveKey(password, salt);

      expect(mockSubtle.importKey).toHaveBeenCalledWith(
        "raw",
        expect.anything(), // The encoded password
        "PBKDF2",
        false,
        ["deriveKey"]
      );

      expect(mockSubtle.deriveKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "PBKDF2",
          iterations: DEFAULT_ENCRYPTION_CONFIG.iterations,
          hash: "SHA-256",
        }),
        mockKeyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    });

    it("uses custom iteration count", async () => {
      const password = "test-password";
      const salt = new Uint8Array(16).buffer;
      const iterations = 50000;

      await deriveKey(password, salt, iterations);

      expect(mockSubtle.deriveKey).toHaveBeenCalledWith(
        expect.objectContaining({
          iterations,
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it("returns the derived key", async () => {
      const result = await deriveKey("password", new Uint8Array(16).buffer);

      expect(result).toBe(mockCryptoKey);
    });
  });

  describe("deriveKeyFromSaltString", () => {
    it("converts base64 salt and derives key", async () => {
      const password = "test-password";
      const saltBase64 = btoa(String.fromCharCode(...new Uint8Array(16)));

      await deriveKeyFromSaltString(password, saltBase64);

      expect(mockSubtle.importKey).toHaveBeenCalled();
      expect(mockSubtle.deriveKey).toHaveBeenCalled();
    });
  });

  describe("encrypt", () => {
    const testData = { foo: "bar", count: 42 };

    beforeEach(() => {
      // Mock successful encryption
      mockSubtle.encrypt.mockResolvedValue(
        new TextEncoder().encode("encrypted-ciphertext").buffer
      );
    });

    it("returns encrypted payload on success", async () => {
      const result = await encrypt(testData, "password");

      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.version).toBe(1);
      expect(result.payload?.algorithm).toBe("AES-256-GCM");
      expect(result.payload?.salt).toBeDefined();
      expect(result.payload?.iv).toBeDefined();
      expect(result.payload?.ciphertext).toBeDefined();
      expect(result.payload?.iterations).toBe(DEFAULT_ENCRYPTION_CONFIG.iterations);
      expect(result.payload?.encryptedAt).toBeDefined();
    });

    it("returns error on encryption failure", async () => {
      mockSubtle.encrypt.mockRejectedValue(new Error("Encryption failed"));

      const result = await encrypt(testData, "password");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Encryption failed");
    });

    it("uses AES-GCM algorithm", async () => {
      await encrypt(testData, "password");

      expect(mockSubtle.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({ name: "AES-GCM" }),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe("encryptWithKey", () => {
    const testData = { foo: "bar" };
    const existingSalt = btoa(String.fromCharCode(...new Uint8Array(16)));

    beforeEach(() => {
      mockSubtle.encrypt.mockResolvedValue(
        new TextEncoder().encode("encrypted").buffer
      );
    });

    it("encrypts with cached key", async () => {
      const result = await encryptWithKey(testData, mockCryptoKey, existingSalt);

      expect(result.success).toBe(true);
      expect(mockSubtle.deriveKey).not.toHaveBeenCalled(); // Key already provided
      expect(mockSubtle.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({ name: "AES-GCM" }),
        mockCryptoKey,
        expect.anything() // The encoded data
      );
    });

    it("reuses existing salt in payload", async () => {
      const result = await encryptWithKey(testData, mockCryptoKey, existingSalt);

      expect(result.payload?.salt).toBe(existingSalt);
    });

    it("generates new IV for each encryption", async () => {
      await encryptWithKey(testData, mockCryptoKey, existingSalt);
      
      // getRandomValues should be called for IV
      expect(mockGetRandomValues).toHaveBeenCalled();
    });
  });

  describe("decrypt", () => {
    const createPayload = () => ({
      version: 1 as const,
      algorithm: "AES-256-GCM" as const,
      salt: btoa(String.fromCharCode(...new Uint8Array(16))),
      iv: btoa(String.fromCharCode(...new Uint8Array(12))),
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(32))),
      iterations: DEFAULT_ENCRYPTION_CONFIG.iterations,
      encryptedAt: new Date().toISOString(),
    });

    beforeEach(() => {
      mockSubtle.decrypt.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify({ decrypted: true })).buffer
      );
    });

    it("decrypts payload and returns data", async () => {
      const result = await decrypt<{ decrypted: boolean }>(createPayload(), "password");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ decrypted: true });
    });

    it("derives key from password and payload salt", async () => {
      await decrypt(createPayload(), "password");

      expect(mockSubtle.importKey).toHaveBeenCalled();
      expect(mockSubtle.deriveKey).toHaveBeenCalled();
    });

    it("returns error for wrong password (auth failure)", async () => {
      mockSubtle.decrypt.mockRejectedValue(new DOMException("operation failed", "OperationError"));

      const result = await decrypt(createPayload(), "wrong-password");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid password or corrupted data");
    });

    it("returns error for other decryption failures", async () => {
      mockSubtle.decrypt.mockRejectedValue(new Error("Some other error"));

      const result = await decrypt(createPayload(), "password");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Some other error");
    });
  });

  describe("decryptWithKey", () => {
    const createPayload = () => ({
      version: 1 as const,
      algorithm: "AES-256-GCM" as const,
      salt: btoa(String.fromCharCode(...new Uint8Array(16))),
      iv: btoa(String.fromCharCode(...new Uint8Array(12))),
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(32))),
      iterations: DEFAULT_ENCRYPTION_CONFIG.iterations,
      encryptedAt: new Date().toISOString(),
    });

    beforeEach(() => {
      mockSubtle.decrypt.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify({ data: "test" })).buffer
      );
    });

    it("decrypts with cached key", async () => {
      const result = await decryptWithKey(createPayload(), mockCryptoKey);

      expect(result.success).toBe(true);
      expect(mockSubtle.deriveKey).not.toHaveBeenCalled();
      expect(mockSubtle.decrypt).toHaveBeenCalledWith(
        expect.objectContaining({ name: "AES-GCM" }),
        mockCryptoKey,
        expect.any(ArrayBuffer)
      );
    });
  });

  describe("isEncryptedPayload", () => {
    it("returns true for valid encrypted payload", () => {
      const payload = {
        version: 1,
        algorithm: "AES-256-GCM",
        salt: "abc123",
        iv: "def456",
        ciphertext: "ghi789",
        iterations: 100000,
        encryptedAt: "2025-01-01T00:00:00Z",
      };

      expect(isEncryptedPayload(payload)).toBe(true);
    });

    it("returns false for null/undefined", () => {
      expect(isEncryptedPayload(null)).toBe(false);
      expect(isEncryptedPayload(undefined)).toBe(false);
    });

    it("returns false for non-object", () => {
      expect(isEncryptedPayload("string")).toBe(false);
      expect(isEncryptedPayload(123)).toBe(false);
      expect(isEncryptedPayload([])).toBe(false);
    });

    it("returns false for wrong version", () => {
      expect(
        isEncryptedPayload({
          version: 2,
          algorithm: "AES-256-GCM",
          salt: "a",
          iv: "b",
          ciphertext: "c",
          iterations: 100000,
          encryptedAt: "date",
        })
      ).toBe(false);
    });

    it("returns false for missing required fields", () => {
      expect(
        isEncryptedPayload({
          version: 1,
          algorithm: "AES-256-GCM",
          // missing salt
          iv: "b",
          ciphertext: "c",
          iterations: 100000,
          encryptedAt: "date",
        })
      ).toBe(false);
    });

    it("returns false for unencrypted data (regular object)", () => {
      expect(
        isEncryptedPayload({
          cases: [],
          financials: [],
          notes: [],
        })
      ).toBe(false);
    });
  });
});
