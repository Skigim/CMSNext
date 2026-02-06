/**
 * Encryption types for file data protection at rest.
 * Uses AES-256-GCM with PBKDF2 key derivation.
 */

/**
 * Encrypted payload format stored in JSON files.
 * Contains all necessary info to decrypt (except password).
 */
export interface EncryptedPayload {
  /** Format version for future upgrades */
  version: 1;
  /** Algorithm identifier */
  algorithm: "AES-256-GCM";
  /** Base64-encoded salt for PBKDF2 */
  salt: string;
  /** Base64-encoded initialization vector */
  iv: string;
  /** Base64-encoded encrypted ciphertext */
  ciphertext: string;
  /** PBKDF2 iteration count (for verification/display) */
  iterations: number;
  /** Timestamp when encrypted */
  encryptedAt: string;
}

/**
 * Result from encryption operations
 */
export interface EncryptionResult {
  success: boolean;
  payload?: EncryptedPayload;
  error?: string;
}

/**
 * Result from decryption operations
 */
export interface DecryptionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Encryption configuration options
 */
export interface EncryptionConfig {
  /** PBKDF2 iteration count - higher is slower but more secure */
  iterations?: number;
  /** Salt length in bytes */
  saltLength?: number;
  /** IV length in bytes (12 for GCM) */
  ivLength?: number;
}

/**
 * Default encryption configuration
 * 
 * PBKDF2 iterations set to 600,000 per OWASP 2023 recommendation
 * for PBKDF2-HMAC-SHA256. This provides strong brute-force resistance
 * while keeping key derivation under ~1s on modern hardware.
 * 
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */
export const DEFAULT_ENCRYPTION_CONFIG: Required<EncryptionConfig> = {
  iterations: 600_000,
  saltLength: 16,
  ivLength: 12,
};

/**
 * Type guard to check if data is an encrypted payload
 */
export function isEncryptedPayload(data: unknown): data is EncryptedPayload {
  if (!data || typeof data !== "object") return false;

  const obj = data as Record<string, unknown>;

  return (
    obj.version === 1 &&
    obj.algorithm === "AES-256-GCM" &&
    typeof obj.salt === "string" &&
    typeof obj.iv === "string" &&
    typeof obj.ciphertext === "string" &&
    typeof obj.iterations === "number" &&
    typeof obj.encryptedAt === "string"
  );
}

/**
 * Encryption context state
 */
export interface EncryptionState {
  /** Whether user has authenticated this session */
  isAuthenticated: boolean;
  /** Current username */
  username: string;
  /** Cached derived key for encryption/decryption */
  derivedKey: CryptoKey | null;
  /** Whether the current file is encrypted */
  fileIsEncrypted: boolean;
  /** Salt from current encrypted file (needed for key derivation) */
  currentSalt: string | null;
  /** PBKDF2 iterations used to derive the cached key (must match on encrypt/decrypt) */
  currentIterations: number | null;
}
