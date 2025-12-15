/**
 * Encryption context for managing session credentials and encryption state.
 * 
 * Security model:
 * - Password never stored, only used to derive key
 * - CryptoKey cached in memory for session (non-extractable)
 * - All state cleared on page refresh/close
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  deriveKey,
  deriveKeyFromSaltString,
  generateSalt,
  isEncryptionSupported,
} from "../utils/encryption";
import { DEFAULT_ENCRYPTION_CONFIG } from "../types/encryption";
import type { EncryptionState, UserProfile } from "../types/encryption";
import { createLogger } from "../utils/logger";

const logger = createLogger("EncryptionContext");

interface EncryptionContextValue extends EncryptionState {
  /** Whether encryption is supported in this browser */
  isSupported: boolean;
  /** Authenticate user and derive encryption key */
  authenticate: (username: string, password: string, salt?: string) => Promise<boolean>;
  /** Set file encryption status (called after reading file) */
  setFileEncrypted: (isEncrypted: boolean, salt?: string) => void;
  /** Generate new salt for enabling encryption */
  initializeEncryption: (password: string) => Promise<{ salt: string; key: CryptoKey } | null>;
  /** Derive key from salt when file salt is discovered */
  deriveKeyFromFileSalt: (salt: string) => Promise<CryptoKey | null>;
  /** Clear all credentials (logout) */
  clearCredentials: () => void;
  /** Get current user profile */
  getCurrentUser: () => UserProfile | null;
  /** Temporary password storage for key derivation (cleared after use) */
  pendingPassword: string | null;
  /** Store password temporarily for key derivation */
  setPendingPassword: (password: string | null) => void;
}

const EncryptionContext = createContext<EncryptionContextValue | null>(null);

const DEFAULT_USERNAME = "admin";

interface EncryptionProviderProps {
  children: ReactNode;
}

export function EncryptionProvider({ children }: EncryptionProviderProps) {
  const [state, setState] = useState<EncryptionState>({
    isAuthenticated: false,
    username: DEFAULT_USERNAME,
    derivedKey: null,
    fileIsEncrypted: false,
    currentSalt: null,
  });
  
  // Temporary password storage - cleared after key derivation
  const [pendingPassword, setPendingPasswordState] = useState<string | null>(null);

  const isSupported = useMemo(() => isEncryptionSupported(), []);
  
  /**
   * Store password temporarily for key derivation when file salt is discovered.
   */
  const setPendingPassword = useCallback((password: string | null) => {
    setPendingPasswordState(password);
    if (password) {
      logger.debug("Pending password stored for key derivation");
    } else {
      logger.debug("Pending password cleared");
    }
  }, []);

  /**
   * Authenticate user and optionally derive encryption key.
   * If salt is provided (from encrypted file), derive key immediately.
   * If no salt, key will be derived when file is first encrypted.
   */
  const authenticate = useCallback(
    async (username: string, password: string, salt?: string): Promise<boolean> => {
      logger.lifecycle("Authenticating user", { username, hasSalt: !!salt });

      try {
        let derivedKey: CryptoKey | null = null;

        if (salt) {
          // Derive key from existing salt (encrypted file)
          derivedKey = await deriveKeyFromSaltString(
            password,
            salt,
            DEFAULT_ENCRYPTION_CONFIG.iterations
          );
          logger.info("Key derived from existing salt");
        }
        // If no salt, we'll derive key later when encrypting

        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          username,
          derivedKey,
          currentSalt: salt ?? null,
        }));

        return true;
      } catch (error) {
        logger.error("Authentication failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },
    []
  );

  /**
   * Update file encryption status after reading file.
   */
  const setFileEncrypted = useCallback((isEncrypted: boolean, salt?: string) => {
    setState((prev) => ({
      ...prev,
      fileIsEncrypted: isEncrypted,
      currentSalt: salt ?? prev.currentSalt,
    }));
  }, []);

  /**
   * Initialize encryption for a new/unencrypted file.
   * Generates new salt and derives key.
   */
  const initializeEncryption = useCallback(
    async (password: string): Promise<{ salt: string; key: CryptoKey } | null> => {
      try {
        const salt = generateSalt();
        const saltBuffer = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)).buffer;
        const key = await deriveKey(
          password,
          saltBuffer,
          DEFAULT_ENCRYPTION_CONFIG.iterations
        );

        setState((prev) => ({
          ...prev,
          derivedKey: key,
          currentSalt: salt,
          fileIsEncrypted: true,
        }));

        logger.info("Encryption initialized with new salt");
        return { salt, key };
      } catch (error) {
        logger.error("Failed to initialize encryption", {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
    []
  );

  /**
   * Clear all credentials (logout).
   */
  const clearCredentials = useCallback(() => {
    setState({
      isAuthenticated: false,
      username: DEFAULT_USERNAME,
      derivedKey: null,
      fileIsEncrypted: false,
      currentSalt: null,
    });
    setPendingPasswordState(null);
    logger.lifecycle("Credentials cleared");
  }, []);

  /**
   * Derive key from file salt using pending password.
   * Called when reading encrypted file discovers salt.
   */
  const deriveKeyFromFileSalt = useCallback(
    async (salt: string): Promise<CryptoKey | null> => {
      if (!pendingPassword) {
        logger.error("No pending password for key derivation");
        return null;
      }

      try {
        const key = await deriveKeyFromSaltString(
          pendingPassword,
          salt,
          DEFAULT_ENCRYPTION_CONFIG.iterations
        );

        setState((prev) => ({
          ...prev,
          derivedKey: key,
          currentSalt: salt,
          fileIsEncrypted: true,
        }));

        // Clear password after successful derivation
        setPendingPasswordState(null);

        logger.info("Key derived from file salt");
        return key;
      } catch (error) {
        logger.error("Failed to derive key from file salt", {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
    [pendingPassword]
  );

  /**
   * Get current user as UserProfile.
   */
  const getCurrentUser = useCallback((): UserProfile | null => {
    if (!state.isAuthenticated) return null;
    return {
      id: state.username,
      name: state.username,
      createdAt: new Date().toISOString(),
    };
  }, [state.isAuthenticated, state.username]);

  const value = useMemo<EncryptionContextValue>(
    () => ({
      ...state,
      isSupported,
      authenticate,
      setFileEncrypted,
      initializeEncryption,
      deriveKeyFromFileSalt,
      clearCredentials,
      getCurrentUser,
      pendingPassword,
      setPendingPassword,
    }),
    [
      state,
      isSupported,
      authenticate,
      setFileEncrypted,
      initializeEncryption,
      deriveKeyFromFileSalt,
      clearCredentials,
      getCurrentUser,
      pendingPassword,
      setPendingPassword,
    ]
  );

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
}

/**
 * Hook to access encryption context.
 * Throws if used outside EncryptionProvider.
 */
export function useEncryption(): EncryptionContextValue {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error("useEncryption must be used within EncryptionProvider");
  }
  return context;
}

/**
 * Hook to safely access encryption context (returns null if not available).
 */
export function useEncryptionSafe(): EncryptionContextValue | null {
  return useContext(EncryptionContext);
}
