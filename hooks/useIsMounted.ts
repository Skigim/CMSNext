import { useEffect, useRef } from "react";

/**
 * Returns a ref that tracks whether the component is currently mounted.
 * 
 * Use this to guard async state updates and prevent memory leak warnings.
 * Essential for async operations that might try to update unmounted components.
 * 
 * ## Why It's Needed
 * 
 * When a component unmounts during an async operation, React warns about memory leaks:
 * ```
 * Can't perform a React state update on an unmounted component.
 * ```
 * 
 * Use this hook to prevent the state update if component has unmounted:
 * 
 * ```typescript
 * if (isMounted.current) {
 *   setState(newValue);  // Safe - only update if mounted
 * }
 * ```
 * 
 * ## Implementation
 * 
 * - Returns a `MutableRefObject<boolean>`
 * - Automatically set to `true` on mount
 * - Automatically set to `false` on unmount
 * - No cleanup needed - ref handles it
 * 
 * ## Common Patterns
 * 
 * ### Async Fetch
 * ```typescript
 * const isMounted = useIsMounted();
 * 
 * const fetchData = useCallback(async () => {
 *   setLoading(true);
 *   try {
 *     const data = await api.fetch();
 *     if (isMounted.current) {
 *       setData(data);
 *     }
 *   } finally {
 *     if (isMounted.current) {
 *       setLoading(false);
 *     }
 *   }
 * }, [isMounted]);
 * ```
 * 
 * ### Debounced Handlers
 * ```typescript
 * const isMounted = useIsMounted();
 * 
 * const handleSearch = useCallback(
 *   debounce(async (query) => {
 *     const results = await search(query);
 *     if (isMounted.current) {
 *       setResults(results);
 *     }
 *   }, 300),
 *   [isMounted]
 * );
 * ```
 * 
 * ### Timed Updates
 * ```typescript
 * const isMounted = useIsMounted();
 * 
 * useEffect(() => {
 *   const timer = setTimeout(() => {
 *     if (isMounted.current) {
 *       setStatus('ready');
 *     }
 *   }, 1000);
 *   
 *   return () => clearTimeout(timer);
 * }, [isMounted]);
 * ```
 * 
 * ## Note
 * 
 * Alternative approach: Use AbortController for native fetch operations.
 * But this hook is simpler for many async patterns and works with any async code.
 * 
 * @hook
 * @returns {React.MutableRefObject<boolean>} Ref that is `true` if mounted, `false` if unmounted
 * 
 * @example
 * ```typescript
 * const isMounted = useIsMounted();
 * 
 * const handleSave = useCallback(async () => {
 *   setIsSaving(true);
 *   try {
 *     await saveData();
 *   } finally {
 *     if (isMounted.current) {
 *       setIsSaving(false);
 *     }
 *   }
 * }, [isMounted]);
 * ```
 */
export function useIsMounted() {
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
}
