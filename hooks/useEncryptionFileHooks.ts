/**
 * Hook to wire up EncryptionContext to AutosaveFileService.
 * 
 * Sets encryption hooks on the file service when credentials are available,
 * enabling transparent encryption/decryption during file operations.
 */

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
 * Wires up the EncryptionContext to the AutosaveFileService.
 * 
 * When credentials are available (after login), this hook:
 * 1. Creates encryption hooks that use the derived key
 * 2. Sets those hooks on the file service
 * 3. Handles key derivation for encrypted files
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

        const user = encryption.getCurrentUser();
        const result = await encryptWithKey(
          data,
          key,
          salt,
          {},
          user ? [user] : undefined
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
          key = await encryption.deriveKeyFromFileSalt(data.salt);
          
          if (!key) {
            const error = "Failed to derive key - no password available";
            logger.error(error);
            lastErrorRef.current = error;
            throw new Error(error);
          }
        }

        const result = await decryptWithKey<NormalizedFileData>(data, key);

        if (!result.success || !result.data) {
          const error = result.error || "Decryption failed";
          lastErrorRef.current = error;
          logger.error("Decryption failed", { error });
          throw new Error(error);
        }

        return result.data;
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

export default useEncryptionFileHooks;
