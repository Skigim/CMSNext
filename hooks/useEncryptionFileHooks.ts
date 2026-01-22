import { useEffect, useCallback, useMemo, useRef } from "react";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useFileStorage } from "@/contexts/FileStorageContext";
import {
  encryptWithKey,
  decryptWithKey,
} from "@/utils/encryption";
import { isEncryptedPayload } from "@/types/encryption";
import type { EncryptedPayload } from "@/types/encryption";
import type { NormalizedFileData } from "@/utils/services/FileStorageService";
import { createLogger } from "@/utils/logger";

const logger = createLogger("useEncryptionFileHooks");

interface UseEncryptionFileHooksResult {
  /** Whether encryption is active (key derived and hooks set) */
  isActive: boolean;
  /** Error from last encryption/decryption operation */
  lastError: string | null;
  /** Clear the last error */
  clearError: () => void;
  /** Store password for key derivation (called before loading data) */
  storePassword: (password: string) => void;
}

/**
 * Hook to wire up EncryptionContext to AutosaveFileService
 * 
 * Enables transparent file-level encryption/decryption by creating and installing
 * encryption hooks on the file service. Automatically derives keys from password when needed.
 * 
 * **Encryption Architecture:**
 * File service → Before write: encrypt data → After read: decrypt data
 * Uses cached CryptoKey (non-extractable) from EncryptionContext for all operations.
 * 
 * **Initialization Flow:**
 * 1. User enters password → EncryptionContext.setPendingPassword(pwd)
 * 2. First encrypt operation: deriveKey(pwd, newSalt) → cache key
 * 3. First decrypt operation: deriveKey(pwd, fileSalt) from existing file
 * 4. Subsequent operations: Use cached key (fast, no PBKDF2 overhead)
 * 
 * **PBKDF2 Key Derivation (EncryptionContext):**
 * - Algorithm: PBKDF2-SHA256
 * - Iterations: 600,000 (OWASP 2023 recommendation)
 * - Salt: Stored in encrypted file header for recovery
 * - Key: 256-bit (AES-GCM compatible)
 * 
 * **Encryption/Decryption:**
 * - Algorithm: AES-256-GCM
 * - IV: Random per operation
 * - Auth tag: Prevents tampering
 * - Format: { iv, authTag, ciphertext, salt } in EncryptedPayload
 * 
 * **Error Handling:**
 * - Missing password: Falls back to unencrypted storage
 * - Failed initialization: Logs error, returns data unencrypted, allows work to continue
 * - Invalid encrypted file: Throws error (decryption must succeed or user is notified)
 * 
 * **Usage Example:**
 * ```typescript
 * const encryption = useEncryptionFileHooks();
 * 
 * // User enters password
 * encryption.storePassword("user-entered-password");
 * // Hook automatically derives key on next read/write
 * 
 * // User logs out
 * // EncryptionContext clears credentials
 * // Next operation: Falls back to unencrypted (or re-prompts for password)
 * 
 * // Check if encryption is active
 * if (encryption.isActive) {
 *   console.log("Encryption enabled");
 * }
 * 
 * if (encryption.lastError) {
 *   console.error("Encryption error:", encryption.lastError);
 *   encryption.clearError();
 * }
 * ```
 * 
 * **Dependencies:**
 * - Requires EncryptionContext in tree (provides useEncryption)
 * - Requires FileStorageContext in tree (provides useFileStorage)
 * - AutosaveFileService must support setEncryptionHooks()
 * 
 * @returns {UseEncryptionFileHooksResult} Encryption status and control:
 * - `isActive`: Boolean - true when encryption hooks are installed on file service
 * - `lastError`: String | null - error from last encrypt/decrypt operation
 * - `clearError()`: Clear lastError state for display purposes
 * - `storePassword(pwd)`: Pass password to context for key derivation
 */
export function useEncryptionFileHooks(): UseEncryptionFileHooksResult {
  const encryption = useEncryption();
  const { service } = useFileStorage();
  const lastErrorRef = useRef<string | null>(null);

  // Expose storePassword as a pass-through to context
  const storePassword = useCallback((password: string) => {
    encryption.setPendingPassword(password);
  }, [encryption]);

  // Clear error helper
  const clearError = useCallback(() => {
    lastErrorRef.current = null;
  }, []);

  // Create encryption hooks for the file service
  const encryptionHooks = useMemo(() => {
    if (!encryption.isAuthenticated) {
      return null;
    }

    return {
      /**
       * Encrypt data before writing to file.
       * Uses cached key if available, derives new one for first encryption.
       */
      encrypt: async (data: NormalizedFileData): Promise<EncryptedPayload | NormalizedFileData> => {
        logger.debug("Encryption hook called", {
          hasKey: !!encryption.derivedKey,
          hasSalt: !!encryption.currentSalt,
          hasPendingPassword: !!encryption.pendingPassword,
        });

        let key = encryption.derivedKey;
        let salt = encryption.currentSalt;

        // If no key yet (unencrypted file), initialize encryption with pending password
        if (!key || !salt) {
          if (encryption.pendingPassword) {
            const result = await encryption.initializeEncryption(encryption.pendingPassword);
            if (!result) {
              logger.error("Failed to initialize encryption");
              lastErrorRef.current = "Failed to initialize encryption";
              return data; // Return unencrypted on failure
            }
            // Use the returned key/salt directly (state update is async)
            key = result.key;
            salt = result.salt;
            // Clear pending password after use
            encryption.setPendingPassword(null);
            logger.info("Encryption initialized for new file");
          } else {
            // No password stored - return data unencrypted
            // This happens on reconnection without re-entering password
            logger.debug("No password available, skipping encryption");
            return data;
          }
        }

        // At this point we should have both key and salt
        if (!key || !salt) {
          logger.warn("Missing key or salt after initialization");
          return data;
        }

        const result = await encryptWithKey(
          data,
          key,
          salt
        );

        if (!result.success || !result.payload) {
          lastErrorRef.current = result.error || "Encryption failed";
          logger.error("Encryption failed", { error: result.error });
          return data; // Return unencrypted on failure
        }

        return result.payload;
      },

      /**
       * Decrypt data after reading from file.
       * Handles key derivation if needed (first read of encrypted file).
       */
      decrypt: async (data: EncryptedPayload): Promise<NormalizedFileData> => {
        logger.debug("Decryption hook called", {
          hasKey: !!encryption.derivedKey,
          hasSalt: !!encryption.currentSalt,
          hasPendingPassword: !!encryption.pendingPassword,
          dataSalt: data.salt,
        });

        let key = encryption.derivedKey;

        // If we don't have a key yet, derive from pending password and file salt
        if (!key) {
          // Use the context method to derive key from file salt
          const result = await encryption.deriveKeyFromFileSalt(data.salt);
          
          if (!result.success || !result.data) {
            let error: string;
            switch (result.error) {
              case 'missing_password':
                error = "No password available. Please log in again.";
                break;
              case 'system_error':
                error = `Encryption system error: ${result.message || 'Unknown error'}`;
                break;
              default:
                error = "Failed to derive encryption key";
            }
            logger.error(error);
            lastErrorRef.current = error;
            throw new Error(error);
          }
          
          key = result.data;
        }

        const decryptResult = await decryptWithKey<NormalizedFileData>(data, key);

        if (!decryptResult.success || !decryptResult.data) {
          const error = decryptResult.error || "Decryption failed";
          lastErrorRef.current = error;
          logger.error("Decryption failed", { error });
          throw new Error(error);
        }

        return decryptResult.data;
      },

      /**
       * Check if data is an encrypted payload.
       */
      isEncrypted: (data: unknown): data is EncryptedPayload => {
        return isEncryptedPayload(data);
      },
    };
  }, [encryption]);

  // Set/clear encryption hooks on service when they change
  useEffect(() => {
    if (!service) return;

    if (encryptionHooks) {
      logger.lifecycle("Setting encryption hooks on file service");
      service.setEncryptionHooks(encryptionHooks);
    } else {
      logger.lifecycle("Clearing encryption hooks from file service");
      service.setEncryptionHooks(null);
    }

    // Cleanup on unmount
    return () => {
      service.setEncryptionHooks(null);
    };
  }, [service, encryptionHooks]);

  return {
    isActive: !!encryptionHooks,
    lastError: lastErrorRef.current,
    clearError,
    storePassword,
  };
}

