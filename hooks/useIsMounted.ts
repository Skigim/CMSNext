import { useEffect, useRef } from "react";

/**
 * Returns a ref that tracks whether the component is currently mounted.
 * Use this to guard async state updates and prevent memory leaks.
 *
 * @example
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
 * }, [saveData, isMounted]);
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
