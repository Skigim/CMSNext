import { useEffect, useRef } from "react";

/**
 * Hook for debouncing storage writes.
 *
 * Provides a consistent pattern for delaying writes to localStorage or other
 * persistence layers. Used by preference hooks to batch rapid changes.
 *
 * @module hooks/useDebouncedSave
 */

/**
 * Options for the debounced save hook.
 */
export interface UseDebouncedSaveOptions<T> {
  /** Data to persist (changes trigger debounced save) */
  data: T;
  /** Function to call when saving */
  onSave: (data: T) => void;
  /** Debounce delay in milliseconds (default: 300ms) */
  delay?: number;
  /** Skip the initial save on mount (default: true) */
  skipInitial?: boolean;
}

/**
 * Debounce writes to storage with configurable delay.
 *
 * This hook watches for changes to the `data` parameter and calls `onSave`
 * after a debounce delay. Useful for persisting preferences without
 * overwhelming the storage layer with rapid updates.
 *
 * @param options - Configuration for debounced save behavior
 *
 * @example
 * ```typescript
 * const [preferences, setPreferences] = useState(loadPrefs());
 *
 * useDebouncedSave({
 *   data: preferences,
 *   onSave: (prefs) => storage.write(prefs),
 *   delay: 300,
 * });
 *
 * // Now setPreferences can be called frequently without
 * // overwhelming localStorage with writes
 * ```
 */
export function useDebouncedSave<T>({
  data,
  onSave,
  delay = 300,
  skipInitial = true,
}: UseDebouncedSaveOptions<T>): void {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialRef = useRef(skipInitial);

  useEffect(() => {
    // Skip initial save if configured
    if (isInitialRef.current) {
      isInitialRef.current = false;
      return;
    }

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce the save
    saveTimeoutRef.current = setTimeout(() => {
      onSave(data);
    }, delay);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, onSave, delay]);
}
