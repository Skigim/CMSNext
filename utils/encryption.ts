/**
 * File encryption service using Web Crypto API.
 * Provides AES-256-GCM encryption with PBKDF2 key derivation.
 *
 * Security features:
 * - AES-256-GCM authenticated encryption (confidentiality + integrity)
 * - PBKDF2 with 100k+ iterations for key derivation
 * - Random salt and IV per encryption
 * - Derived key cached in memory (non-extractable)
 */

import type {
  EncryptedPayload,
  EncryptionResult,
  DecryptionResult,
  EncryptionConfig,
  UserProfile,
} from "../types/encryption";
import { DEFAULT_ENCRYPTION_CONFIG } from "../types/encryption";
import { createLogger } from "./logger";

const logger = createLogger("encryption");

/**
 * Converts ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives an encryption key from a password using PBKDF2.
 *
 * @param password - User password
 * @param salt - Random salt (should be stored with ciphertext)
 * @param iterations - PBKDF2 iteration count
 * @returns CryptoKey suitable for AES-GCM
 */
export async function deriveKey(
  password: string,
  salt: ArrayBuffer,
  iterations: number = DEFAULT_ENCRYPTION_CONFIG.iterations
): Promise<CryptoKey> {
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Derive AES-256 key (non-extractable for security)
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Derives a key from password and base64-encoded salt string.
 * Convenience wrapper for deriveKey when salt is from EncryptedPayload.
 */
export async function deriveKeyFromSaltString(
  password: string,
  saltBase64: string,
  iterations: number = DEFAULT_ENCRYPTION_CONFIG.iterations
): Promise<CryptoKey> {
  const salt = base64ToArrayBuffer(saltBase64);
  return deriveKey(password, salt, iterations);
}

/**
 * Encrypts data using AES-256-GCM with PBKDF2-derived key.
 *
 * @param data - Data to encrypt (will be JSON serialized)
 * @param password - User password
 * @param config - Optional encryption configuration
 * @param users - Optional user profiles to include in payload
 * @returns Encrypted payload with all necessary decryption info
 */
export async function encrypt<T>(
  data: T,
  password: string,
  config: EncryptionConfig = {},
  users?: UserProfile[]
): Promise<EncryptionResult> {
  const { iterations, saltLength, ivLength } = {
    ...DEFAULT_ENCRYPTION_CONFIG,
    ...config,
  };

  try {
    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(saltLength));
    const iv = crypto.getRandomValues(new Uint8Array(ivLength));

    // Derive key from password
    const key = await deriveKey(password, salt.buffer, iterations);

    // Serialize and encrypt data
    const plaintext = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      plaintext
    );

    const payload: EncryptedPayload = {
      version: 1,
      algorithm: "AES-256-GCM",
      salt: arrayBufferToBase64(salt.buffer),
      iv: arrayBufferToBase64(iv.buffer),
      ciphertext: arrayBufferToBase64(ciphertext),
      iterations,
      encryptedAt: new Date().toISOString(),
      users,
    };

    logger.debug("Data encrypted successfully", {
      plaintextSize: plaintext.byteLength,
      ciphertextSize: ciphertext.byteLength,
    });

    return { success: true, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Encryption failed", { error: message });
    return { success: false, error: message };
  }
}

/**
 * Encrypts data using a pre-derived CryptoKey.
 * More efficient when key is cached in memory.
 *
 * @param data - Data to encrypt
 * @param key - Pre-derived CryptoKey
 * @param existingSalt - Salt used to derive the key (for payload)
 * @param config - Optional encryption configuration
 * @param users - Optional user profiles
 */
export async function encryptWithKey<T>(
  data: T,
  key: CryptoKey,
  existingSalt: string,
  config: EncryptionConfig = {},
  users?: UserProfile[]
): Promise<EncryptionResult> {
  const { iterations, ivLength } = {
    ...DEFAULT_ENCRYPTION_CONFIG,
    ...config,
  };

  try {
    // Generate new IV (must be unique per encryption)
    const iv = crypto.getRandomValues(new Uint8Array(ivLength));

    // Serialize and encrypt data
    const plaintext = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      plaintext
    );

    const payload: EncryptedPayload = {
      version: 1,
      algorithm: "AES-256-GCM",
      salt: existingSalt, // Reuse existing salt
      iv: arrayBufferToBase64(iv.buffer),
      ciphertext: arrayBufferToBase64(ciphertext),
      iterations,
      encryptedAt: new Date().toISOString(),
      users,
    };

    logger.debug("Data encrypted with cached key", {
      plaintextSize: plaintext.byteLength,
      ciphertextSize: ciphertext.byteLength,
    });

    return { success: true, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Encryption with key failed", { error: message });
    return { success: false, error: message };
  }
}

/**
 * Decrypts an encrypted payload using AES-256-GCM.
 *
 * @param payload - Encrypted payload from encrypt()
 * @param password - User password
 * @returns Decrypted data or error
 */
export async function decrypt<T>(
  payload: EncryptedPayload,
  password: string
): Promise<DecryptionResult<T>> {
  try {
    // Decode base64 values
    const salt = base64ToArrayBuffer(payload.salt);
    const iv = base64ToArrayBuffer(payload.iv);
    const ciphertext = base64ToArrayBuffer(payload.ciphertext);

    // Derive key from password
    const key = await deriveKey(password, salt, payload.iterations);

    // Decrypt data
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      ciphertext
    );

    // Parse JSON
    const text = new TextDecoder().decode(plaintext);
    const data = JSON.parse(text) as T;

    logger.debug("Data decrypted successfully", {
      ciphertextSize: ciphertext.byteLength,
      plaintextSize: plaintext.byteLength,
    });

    return { success: true, data };
  } catch (error) {
    // GCM authentication failure shows as generic "operation failed"
    const message = error instanceof Error ? error.message : String(error);
    const isAuthError =
      message.includes("operation failed") ||
      message.includes("OperationError");

    if (isAuthError) {
      logger.warn("Decryption failed - likely wrong password");
      return { success: false, error: "Invalid password or corrupted data" };
    }

    logger.error("Decryption failed", { error: message });
    return { success: false, error: message };
  }
}

/**
 * Decrypts an encrypted payload using a pre-derived CryptoKey.
 * More efficient when key is cached in memory.
 */
export async function decryptWithKey<T>(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<DecryptionResult<T>> {
  try {
    const iv = base64ToArrayBuffer(payload.iv);
    const ciphertext = base64ToArrayBuffer(payload.ciphertext);

    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      ciphertext
    );

    const text = new TextDecoder().decode(plaintext);
    const data = JSON.parse(text) as T;

    logger.debug("Data decrypted with cached key");

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isAuthError =
      message.includes("operation failed") ||
      message.includes("OperationError");

    if (isAuthError) {
      return { success: false, error: "Invalid password or corrupted data" };
    }

    logger.error("Decryption with key failed", { error: message });
    return { success: false, error: message };
  }
}

/**
 * Generates a new random salt as base64 string.
 * Used when enabling encryption on a new or unencrypted file.
 */
export function generateSalt(
  length: number = DEFAULT_ENCRYPTION_CONFIG.saltLength
): string {
  const salt = crypto.getRandomValues(new Uint8Array(length));
  return arrayBufferToBase64(salt.buffer);
}

/**
 * Checks if Web Crypto API is available for encryption
 */
export function isEncryptionSupported(): boolean {
  return (
    typeof crypto !== "undefined" &&
    typeof crypto.subtle !== "undefined" &&
    typeof crypto.subtle.encrypt === "function"
  );
}
