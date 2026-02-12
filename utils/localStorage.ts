import { createLogger } from "@/utils/logger";

const logger = createLogger("localStorage");

/**
 * LocalStorage Adapter Utility
 * ============================
 * Provides a unified, type-safe adapter for localStorage operations.
 * 
 * ## Purpose
 * 
 * This adapter is for **UI preferences only**, NOT case data.
 * Case data must use the File Storage API.
 * 
 * Acceptable uses:
 * - Theme preferences
 * - Pinned/recent case IDs
 * - Sort/filter preferences
 * - Keyboard shortcuts
 * - UI state flags
 * 
 * ## Architecture Note
 * 
 * The "no localStorage" guideline refers to case data persistence.
 * UI preferences must use localStorage since they need browser-level
 * persistence separate from the user's data file.
 * 
 * @module localStorage
 */

/**
 * Check if localStorage is available.
 * Handles SSR, tests, and incognito mode.
 */
export function hasLocalStorage(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const testKey = "__localStorage_test__";
    globalThis.localStorage.setItem(testKey, "1");
    globalThis.localStorage.removeItem(testKey);
    return true;
  } catch {
    // localStorage disabled (e.g., incognito in some browsers)
    return false;
  }
}

/**
 * Options for the localStorage adapter.
 */
export interface LocalStorageAdapterOptions<T> {
  /** 
   * Custom parser for stored values.
   * Defaults to JSON.parse.
   */
  parse?: (value: string) => T;
  /** 
   * Custom serializer for values.
   * Defaults to JSON.stringify.
   */
  serialize?: (value: T) => string;
}

/**
 * LocalStorage adapter interface.
 */
export interface LocalStorageAdapter<T> {
  /** Read value from localStorage, returns default if not found */
  read(): T;
  /** Write value to localStorage */
  write(value: T): void;
  /** Remove value from localStorage */
  clear(): void;
  /** The storage key */
  readonly key: string;
}

/**
 * Creates a type-safe localStorage adapter.
 * 
 * All keys should follow the naming convention: `cmsnext-<feature-name>`
 * 
 * @example
 * ```typescript
 * const themeStorage = createLocalStorageAdapter('cmsnext-theme', 'light');
 * 
 * // Read
 * const currentTheme = themeStorage.read();
 * 
 * // Write
 * themeStorage.write('dark');
 * 
 * // Clear
 * themeStorage.clear();
 * ```
 * 
 * @example With custom parsing
 * ```typescript
 * const dateStorage = createLocalStorageAdapter('cmsnext-last-visit', new Date(), {
 *   parse: (s) => new Date(s),
 *   serialize: (d) => d.toISOString(),
 * });
 * ```
 * 
 * @param key - Storage key (use cmsnext-<feature> format)
 * @param defaultValue - Default value when key doesn't exist
 * @param options - Optional custom parse/serialize functions
 * @returns LocalStorageAdapter instance
 */
export function createLocalStorageAdapter<T>(
  key: string,
  defaultValue: T,
  options?: LocalStorageAdapterOptions<T>
): LocalStorageAdapter<T> {
  const parse = options?.parse ?? ((s: string) => JSON.parse(s) as T);
  const serialize = options?.serialize ?? ((v: T) => JSON.stringify(v));

  return {
    key,

    read(): T {
      if (!hasLocalStorage()) {
        return defaultValue;
      }

      try {
        const stored = globalThis.localStorage.getItem(key);
        if (stored === null) {
          return defaultValue;
        }
        return parse(stored);
      } catch (error) {
        logger.warn(`Failed to read localStorage key "${key}"`, { error });
        return defaultValue;
      }
    },

    write(value: T): void {
      if (!hasLocalStorage()) {
        return;
      }

      try {
        globalThis.localStorage.setItem(key, serialize(value));
      } catch (error) {
        logger.warn(`Failed to write localStorage key "${key}"`, { error });
      }
    },

    clear(): void {
      if (!hasLocalStorage()) {
        return;
      }

      try {
        globalThis.localStorage.removeItem(key);
      } catch (error) {
        logger.warn(`Failed to clear localStorage key "${key}"`, { error });
      }
    },
  };
}