/**
 * Encryption context for managing session credentials and encryption state.
 * 
 * **Security Model:**
 * - Password never stored, only used to derive key via PBKDF2
 * - CryptoKey cached in memory for session (non-extractable, use-only)
 * - All state cleared on page refresh/close
 * - Salt stored with encrypted file, never hardcoded
 * 
 * ## Encryption Flow
 * 
 * **Encrypting a New File:**
 * 1. User provides password
 * 2. Context generates random salt
 * 3. PBKDF2 derives encryption key from password + salt
 * 4. Salt is saved with encrypted data
 * 5. Key stays in memory for session
 * 
 * **Decrypting Existing File:**
 * 1. File read, salt discovered
 * 2. User provides password
 * 3. PBKDF2 derives key using salt from file
 * 4. If key matches encrypted data, authentication succeeds
 * 
 * **Key Management:**
 * - CryptoKey is non-extractable (can't be read from memory)
 * - Key only used for encryption/decryption operations
 * - Stays in memory only during session
 * - Cleared when user logs out or page closes
 * 
 * @fileoverview Encryption context and provider
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  deriveKey,
  deriveKeyFromSaltString,
  generateSalt,
  isEncryptionSupported,
} from "../utils/encryption";
import { DEFAULT_ENCRYPTION_CONFIG } from "../types/encryption";
import type { EncryptionState, EncryptionErrorCode } from "../types/encryption";
import { createLogger } from "../utils/logger";

const logger = createLogger("EncryptionContext");

/** Result type for encryption operations */
export interface EncryptionResult<T> {
  success: boolean;
  data?: T;
  error?: EncryptionErrorCode;
  /** Only included for system_error type */
  message?: string;
}

/**
 * Encryption context value type - provides encryption state and operations.
 * 
 * Extends EncryptionState with encryption-specific methods and status flags.
 * 
 * @interface EncryptionContextValue
 */
interface EncryptionContextValue extends EncryptionState {
  /** Whether encryption is supported in this browser (Web Crypto API available) */
  isSupported: boolean;
  /** Authenticate user and optionally derive encryption key */
  authenticate: (username: string, password: string, salt?: string) => Promise<boolean>;
  /** Update file encryption status (called after reading file metadata) */
  setFileEncrypted: (isEncrypted: boolean, salt?: string) => void;
  /** Generate new salt and derive key for new encrypted file */
  initializeEncryption: (password: string) => Promise<{ salt: string; key: CryptoKey } | null>;
  /** Derive key from existing file salt using pending password */
  deriveKeyFromFileSalt: (salt: string, iterations?: number) => Promise<EncryptionResult<CryptoKey>>;
  /** Clear all credentials and logout user */
  clearCredentials: () => void;
  /** Temporary password storage for key derivation (cleared after use) */
  pendingPassword: string | null;
  /** Store password temporarily for key derivation when file salt is discovered */
  setPendingPassword: (password: string | null) => void;
}

const EncryptionContext = createContext<EncryptionContextValue | null>(null);

const DEFAULT_USERNAME = "admin";

/**
 * Props for EncryptionProvider component.
 * @interface EncryptionProviderProps
 */
interface EncryptionProviderProps {
  /** React child components */
  children: ReactNode;
}

/**
 * EncryptionProvider - Manages encryption state and key derivation.
 * 
 * Handles user authentication and encryption key management for file encryption.
 * Uses PBKDF2 for key derivation with configurable iterations.
 * 
 * ## Authentication Flow
 * 
 * **New File:**
 * 1. User provides password
 * 2. generateSalt() creates random bytes
 * 3. deriveKey(password, salt) → CryptoKey via PBKDF2
 * 4. Salt saved with encrypted file
 * 
 * **Existing File:**
 * 1. File read, salt discovered from metadata
 * 2. User provides password (stored as pending)
 * 3. deriveKeyFromFileSalt(salt) → CryptoKey
 * 4. Application uses key for decryption
 * 
 * ## Setup
 * 
 * ```typescript
 * function App() {
 *   return (
 *     <EncryptionProvider>
 *       <YourApp />
 *     </EncryptionProvider>
 *   );
 * }
 * ```
 * 
 * ## Usage
 * 
 * ```typescript
 * function AuthComponent() {
 *   const { authenticate, isAuthenticated } = useEncryption();
 *   
 *   const handleLogin = async (username, password) => {
 *     const success = await authenticate(username, password);
 *     if (success) {
 *       // User authenticated, can now decrypt
 *     }
 *   };
 * }
 * ```
 * 
 * ## Compatibility
 * 
 * Check `isSupported` before using encryption features. Returns false if:
 * - Web Crypto API not available
 * - Running on non-secure context (not HTTPS)
 * - Browser doesn't support SubtleCrypto
 * 
 * ## Security Notes
 * 
 * - Password is never stored (only used for key derivation)
 * - CryptoKey is non-extractable and session-only
 * - Salt is generated randomly per new encrypted file
 * - All data cleared on logout or page close
 * 
 * @component
 * @param {EncryptionProviderProps} props - Provider configuration
 * @returns {ReactNode} Provider wrapping children
 * 
 * @see {@link useEncryption} to access encryption context
 * @see {@link DEFAULT_ENCRYPTION_CONFIG} for PBKDF2 settings
 */
export function EncryptionProvider({ children }: EncryptionProviderProps) {
  const [state, setState] = useState<EncryptionState>({
    isAuthenticated: false,
    username: DEFAULT_USERNAME,
    derivedKey: null,
    fileIsEncrypted: false,
    currentSalt: null,
    currentIterations: null,
  });
  
  // Temporary password storage - cleared after key derivation
  // Using useRef instead of useState to prevent password from appearing in React DevTools
  const pendingPasswordRef = useRef<string | null>(null);

  const isSupported = useMemo(() => isEncryptionSupported(), []);
  
  /**
   * Store password temporarily for key derivation when file salt is discovered.
   */
  const setPendingPassword = useCallback((password: string | null) => {
    pendingPasswordRef.current = password;
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
          currentIterations: salt ? DEFAULT_ENCRYPTION_CONFIG.iterations : null,
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
          currentIterations: DEFAULT_ENCRYPTION_CONFIG.iterations,
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
      currentIterations: null,
    });
    pendingPasswordRef.current = null;
    logger.lifecycle("Credentials cleared");
  }, []);

  /**
   * Derive key from file salt using pending password.
   * Called when reading encrypted file discovers salt.
   * Returns typed result with error codes for better error handling.
   */
  const deriveKeyFromFileSalt = useCallback(
    async (salt: string, iterations?: number): Promise<EncryptionResult<CryptoKey>> => {
      const password = pendingPasswordRef.current;
      if (!password) {
        logger.error("No pending password for key derivation");
        return { success: false, error: 'missing_password' };
      }

      try {
        const effectiveIterations = iterations ?? DEFAULT_ENCRYPTION_CONFIG.iterations;
        const key = await deriveKeyFromSaltString(
          password,
          salt,
          effectiveIterations
        );

        setState((prev) => ({
          ...prev,
          derivedKey: key,
          currentSalt: salt,
          fileIsEncrypted: true,
          currentIterations: effectiveIterations,
        }));

        // Clear password after successful derivation
        pendingPasswordRef.current = null;

        logger.info("Key derived from file salt");
        return { success: true, data: key };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Failed to derive key from file salt", { error: message });
        
        // Key derivation failures are typically system errors
        // Wrong password manifests as decryption failure, not derivation failure
        return { success: false, error: 'system_error', message };
      }
    },
    []
  );

  const value = useMemo<EncryptionContextValue>(
    () => ({
      ...state,
      isSupported,
      authenticate,
      setFileEncrypted,
      initializeEncryption,
      deriveKeyFromFileSalt,
      clearCredentials,
      // Expose getter for pendingPassword to avoid stale ref issues in consumers
      get pendingPassword() {
        return pendingPasswordRef.current;
      },
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
 * 
 * Provides access to encryption state and operations.
 * Throws if used outside EncryptionProvider.
 * 
 * Use when you need encryption and can guarantee provider is present.
 * 
 * ## Example
 * 
 * ```typescript
 * function AuthForm() {
 *   const { authenticate, isAuthenticated, isSupported } = useEncryption();
 *   
 *   if (!isSupported) {
 *     return <p>Encryption not supported in this browser</p>;
 *   }
 *   
 *   const handleSubmit = async (password) => {
 *     const success = await authenticate('admin', password);
 *     if (success) {
 *       // User is now authenticated
 *     }
 *   };
 * }
 * ```
 * 
 * @hook
 * @returns {EncryptionContextValue} Encryption state and operations
 * @throws {Error} If used outside EncryptionProvider
 * 
 * @see {@link useEncryptionSafe} for safe alternative that returns null
 */
export function useEncryption(): EncryptionContextValue {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error("useEncryption must be used within EncryptionProvider");
  }
  return context;
}

/**
 * Hook to safely access encryption context (returns null if unavailable).
 * 
 * Use when encryption might not be available or you're uncertain about provider presence.
 * 
 * ## Example
 * 
 * ```typescript
 * function OptionalEncryption() {
 *   const encryption = useEncryptionSafe();
 *   
 *   if (!encryption) {
 *     return <NoEncryption />;
 *   }
 *   
 *   return <EncryptionUI encryption={encryption} />;
 * }
 * ```
 * 
 * @hook
 * @returns {EncryptionContextValue | null} Encryption context or null if unavailable
 * 
 * @see {@link useEncryption} for throwing alternative (stricter)
 */
export function useEncryptionSafe(): EncryptionContextValue | null {
  return useContext(EncryptionContext);
}
