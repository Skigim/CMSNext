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
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  deriveKey,
  deriveKeyFromSaltString,
  generateSalt,
  isFullEncryptionMode,
  isEncryptionSupported,
  requiresAuthenticationPassword,
} from "../utils/encryption";
import { DEFAULT_ENCRYPTION_CONFIG } from "../types/encryption";
import type {
  EncryptionState,
  EncryptionErrorCode,
  EncryptionMode,
  FileEncryptionStatus,
} from "../types/encryption";
import { createLogger } from "../utils/logger";
import { APP_CONFIG } from "../utils/appConfig";

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
  /** Active runtime encryption mode from app config */
  encryptionMode: EncryptionMode;
  /** Whether this environment expects password entry before workspace access */
  requiresPassword: boolean;
  /** Whether full file encryption is active for this environment */
  isEncryptionEnabled: boolean;
  /** Whether encryption is supported in this browser (Web Crypto API available) */
  isSupported: boolean;
  /** Authenticate user and optionally derive encryption key */
  authenticate: (username: string, password: string, salt?: string) => Promise<boolean>;
  /** Update file encryption status (called after reading file metadata) */
  setFileEncrypted: (isEncrypted: boolean | null, salt?: string) => void;
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
  /** Whether startup encrypted-workspace reads can safely proceed */
  isStartupUnlockReady: boolean;
  /** Wait until startup encrypted-workspace decryption hooks are ready */
  waitForStartupUnlockReady: () => Promise<void>;
  /** Update startup encrypted-workspace readiness from hook orchestration */
  setStartupUnlockReady: (isReady: boolean) => void;
  /** Block startup encrypted-workspace reads until a later unlock attempt succeeds */
  blockStartupUnlock: () => void;
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

type EncryptedStartupState = "ready" | "pending" | "blocked";
const STARTUP_UNLOCK_BLOCKED_MESSAGE =
  "Encrypted workspace unlock is blocked until a later retry succeeds.";

function getInitialFileEncryptionStatus(isEncryptionEnabled: boolean): FileEncryptionStatus {
  return isEncryptionEnabled ? "unknown" : "unencrypted";
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
export function EncryptionProvider({ children }: Readonly<EncryptionProviderProps>) {
  const encryptionMode = APP_CONFIG.encryptionMode;
  const isEncryptionEnabled = isFullEncryptionMode(encryptionMode);
  const requiresPassword = requiresAuthenticationPassword(encryptionMode);

  const [state, setState] = useState<EncryptionState>({
    isAuthenticated: false,
    username: DEFAULT_USERNAME,
    derivedKey: null,
    fileEncryptionStatus: getInitialFileEncryptionStatus(isEncryptionEnabled),
    fileIsEncrypted: false,
    currentSalt: null,
    currentIterations: null,
  });
  // Async authentication/decryption callbacks need the latest encryption state
  // immediately, even before React commits a rerender for `state`.
  const encryptionStateRef = useRef(state);
  const [startupUnlockState, setStartupUnlockStateValue] = useState<EncryptedStartupState>(
    isEncryptionEnabled ? "pending" : "ready",
  );
  
  // Temporary password storage - cleared after key derivation
  // Using useRef instead of useState to prevent password from appearing in React DevTools
  const pendingPasswordRef = useRef<string | null>(null);
  const startupUnlockReadyPromiseRef = useRef<Promise<void> | null>(null);
  const resolveStartupUnlockReadyRef = useRef<(() => void) | null>(null);
  const rejectStartupUnlockReadyRef = useRef<((reason?: unknown) => void) | null>(null);

  const isSupported = useMemo(() => isEncryptionSupported(), []);

  useEffect(() => {
    encryptionStateRef.current = state;
  }, [state]);

  const updateEncryptionState = useCallback(
    (updater: (previousState: EncryptionState) => EncryptionState) => {
      setState((previousState) => {
        const nextState = updater(previousState);
        encryptionStateRef.current = nextState;
        return nextState;
      });
    },
    [],
  );

  const finalizeStartupUnlockWait = useCallback(() => {
    startupUnlockReadyPromiseRef.current = null;
    resolveStartupUnlockReadyRef.current = null;
    rejectStartupUnlockReadyRef.current = null;
  }, []);

  const setStartupUnlockState = useCallback((nextState: EncryptedStartupState) => {
    setStartupUnlockStateValue(nextState);

    if (nextState === "ready") {
      resolveStartupUnlockReadyRef.current?.();
      finalizeStartupUnlockWait();
      return;
    }

    if (nextState === "blocked") {
      rejectStartupUnlockReadyRef.current?.(new Error(STARTUP_UNLOCK_BLOCKED_MESSAGE));
      finalizeStartupUnlockWait();
      return;
    }

    if (!startupUnlockReadyPromiseRef.current) {
      startupUnlockReadyPromiseRef.current = new Promise<void>((resolve, reject) => {
        resolveStartupUnlockReadyRef.current = resolve;
        rejectStartupUnlockReadyRef.current = reject;
      });
    }
  }, [finalizeStartupUnlockWait]);

  const setStartupUnlockReady = useCallback((isReady: boolean) => {
    setStartupUnlockState(isReady ? "ready" : "pending");
  }, [setStartupUnlockState]);

  const blockStartupUnlock = useCallback(() => {
    setStartupUnlockState("blocked");
  }, [setStartupUnlockState]);

  const waitForStartupUnlockReady = useCallback(async (): Promise<void> => {
    if (startupUnlockState === "ready") {
      return;
    }

    if (startupUnlockState === "blocked") {
      throw new Error(STARTUP_UNLOCK_BLOCKED_MESSAGE);
    }

    if (!startupUnlockReadyPromiseRef.current) {
      startupUnlockReadyPromiseRef.current = new Promise<void>((resolve, reject) => {
        resolveStartupUnlockReadyRef.current = resolve;
        rejectStartupUnlockReadyRef.current = reject;
      });
    }
    await startupUnlockReadyPromiseRef.current;
  }, [startupUnlockState]);
  
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

  const resolveFileEncryptionStatus = useCallback(
    (isEncrypted: boolean | null): FileEncryptionStatus => {
      if (!isEncryptionEnabled) {
        return "unencrypted";
      }

      if (isEncrypted === null) {
        return "unknown";
      }

      return isEncrypted ? "encrypted" : "unencrypted";
    },
    [isEncryptionEnabled],
  );

  const requiresVerifiedDecrypt = useCallback(
    (salt?: string) =>
      isEncryptionEnabled &&
      (Boolean(salt) || encryptionStateRef.current.fileEncryptionStatus !== "unencrypted"),
    [isEncryptionEnabled],
  );

  /**
   * Authenticate user and optionally derive encryption key.
   * If salt is provided (from encrypted file), derive key immediately.
   * If no salt, key will be derived when file is first encrypted.
   */
  const authenticate = useCallback(
    async (username: string, password: string, salt?: string): Promise<boolean> => {
      logger.lifecycle("Authenticating user", { username, hasSalt: !!salt });

      try {
        if (encryptionMode === "disabled") {
          setStartupUnlockReady(true);
          updateEncryptionState((prev) => ({
            ...prev,
            isAuthenticated: true,
            username,
            derivedKey: null,
            fileEncryptionStatus: "unencrypted",
            currentSalt: null,
            currentIterations: null,
            fileIsEncrypted: false,
          }));
          pendingPasswordRef.current = null;
          logger.info("Authentication completed with password bypass", { encryptionMode });
          return true;
        }

        setStartupUnlockReady(!requiresVerifiedDecrypt(salt));

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

        updateEncryptionState((prev) => ({
          ...prev,
          isAuthenticated: true,
          username,
          derivedKey,
          fileEncryptionStatus: salt ? "encrypted" : prev.fileEncryptionStatus,
          fileIsEncrypted: salt ? true : prev.fileIsEncrypted,
          currentSalt: salt ?? null,
          currentIterations: salt ? DEFAULT_ENCRYPTION_CONFIG.iterations : null,
        }));

        return true;
      } catch (error) {
        if (requiresVerifiedDecrypt(salt)) {
          blockStartupUnlock();
        } else {
          setStartupUnlockReady(true);
        }
        logger.error("Authentication failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },
    [
      blockStartupUnlock,
      encryptionMode,
      requiresVerifiedDecrypt,
      setStartupUnlockReady,
      updateEncryptionState,
    ]
  );

  /**
   * Update file encryption status after reading file.
   */
  const setFileEncrypted = useCallback((isEncrypted: boolean | null, salt?: string) => {
    const fileEncryptionStatus = resolveFileEncryptionStatus(isEncrypted);
    updateEncryptionState((prev) => ({
      ...prev,
      fileEncryptionStatus,
      fileIsEncrypted: fileEncryptionStatus === "encrypted",
      currentSalt:
        fileEncryptionStatus === "encrypted" ? (salt ?? prev.currentSalt) : null,
    }));

    if (!isEncryptionEnabled || fileEncryptionStatus === "unencrypted") {
      setStartupUnlockReady(true);
      return;
    }

    if (fileEncryptionStatus === "unknown") {
      setStartupUnlockReady(false);
      return;
    }

    if (encryptionStateRef.current.derivedKey) {
      setStartupUnlockReady(true);
      return;
    }

    blockStartupUnlock();
  }, [
    blockStartupUnlock,
    isEncryptionEnabled,
    resolveFileEncryptionStatus,
    setStartupUnlockReady,
    updateEncryptionState,
  ]);

  /**
   * Initialize encryption for a new/unencrypted file.
   * Generates new salt and derives key.
   */
  const initializeEncryption = useCallback(
    async (password: string): Promise<{ salt: string; key: CryptoKey } | null> => {
      if (!isEncryptionEnabled) {
        logger.warn("Encryption initialization requested when encryption is not enabled", {
          encryptionMode,
        });
        return null;
      }

      try {
        const salt = generateSalt();
        const saltBuffer = Uint8Array.from(atob(salt), (c) => c.codePointAt(0)!).buffer;
        const key = await deriveKey(
          password,
          saltBuffer,
          DEFAULT_ENCRYPTION_CONFIG.iterations
        );

        updateEncryptionState((prev) => ({
          ...prev,
          derivedKey: key,
          fileEncryptionStatus: "encrypted",
          currentSalt: salt,
          fileIsEncrypted: true,
          currentIterations: DEFAULT_ENCRYPTION_CONFIG.iterations,
        }));
        setStartupUnlockReady(true);

        logger.info("Encryption initialized with new salt");
        return { salt, key };
      } catch (error) {
        logger.error("Failed to initialize encryption", {
          error: error instanceof Error ? error.message : String(error),
        });
        blockStartupUnlock();
        return null;
      }
    },
    [blockStartupUnlock, encryptionMode, isEncryptionEnabled, setStartupUnlockReady, updateEncryptionState]
  );

  /**
   * Clear all credentials (logout).
   */
  const clearCredentials = useCallback(() => {
    const workspaceIsEncrypted = encryptionStateRef.current.fileIsEncrypted;
    const fileEncryptionStatus = encryptionStateRef.current.fileEncryptionStatus;
    const workspaceSalt = encryptionStateRef.current.currentSalt;
    const workspaceIterations = encryptionStateRef.current.currentIterations;

    updateEncryptionState(() => ({
      isAuthenticated: false,
      username: DEFAULT_USERNAME,
      derivedKey: null,
      fileEncryptionStatus,
      fileIsEncrypted: workspaceIsEncrypted,
      currentSalt: workspaceSalt,
      currentIterations: workspaceIterations,
    }));
    pendingPasswordRef.current = null;
    if (isEncryptionEnabled && fileEncryptionStatus !== "unencrypted") {
      blockStartupUnlock();
    } else {
      setStartupUnlockReady(true);
    }
    logger.lifecycle("Credentials cleared");
  }, [
    blockStartupUnlock,
    isEncryptionEnabled,
    setStartupUnlockReady,
    updateEncryptionState,
  ]);

  /**
   * Derive key from file salt using pending password.
   * Called when reading encrypted file discovers salt.
   * Returns typed result with error codes for better error handling.
   */
  const deriveKeyFromFileSalt = useCallback(
    async (salt: string, iterations?: number): Promise<EncryptionResult<CryptoKey>> => {
      if (!isEncryptionEnabled) {
        logger.warn("Key derivation requested when encryption is not enabled", {
          encryptionMode,
        });
        return {
          success: false,
          error: "system_error",
          message: "Encryption is not enabled for this environment.",
        };
      }

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

        updateEncryptionState((prev) => ({
          ...prev,
          derivedKey: key,
          fileEncryptionStatus: "encrypted",
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
    [encryptionMode, isEncryptionEnabled, updateEncryptionState]
  );

  const value = useMemo<EncryptionContextValue>(
    () => ({
      ...state,
      encryptionMode,
      requiresPassword,
      isEncryptionEnabled,
      isSupported,
      authenticate,
      setFileEncrypted,
      initializeEncryption,
      deriveKeyFromFileSalt,
      clearCredentials,
      isStartupUnlockReady: startupUnlockState === "ready",
      waitForStartupUnlockReady,
      setStartupUnlockReady,
      blockStartupUnlock,
      // Expose getter for pendingPassword to avoid stale ref issues in consumers
      get pendingPassword() {
        return pendingPasswordRef.current;
      },
      setPendingPassword,
    }),
    [
      state,
      encryptionMode,
      requiresPassword,
      isEncryptionEnabled,
      isSupported,
      authenticate,
      setFileEncrypted,
      initializeEncryption,
      deriveKeyFromFileSalt,
      clearCredentials,
      startupUnlockState,
      waitForStartupUnlockReady,
      setStartupUnlockReady,
      blockStartupUnlock,
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
