/**
 * Toast Promise Wrapper
 * =====================
 * Wraps async operations with loading/success/error toasts.
 * Handles isMounted guards and error state updates.
 */

import { toast } from 'sonner';

export interface WithToastOptions<T> {
  /** Message shown while operation is in progress */
  loading: string;
  /** Message shown on success - can be string or function that receives result */
  success: string | ((result: T) => string);
  /** Message shown on error - can be string or function that receives error */
  error: string | ((err: Error) => string);
  /** Optional ref to check if component is still mounted before updating state */
  isMounted?: React.MutableRefObject<boolean>;
  /** Optional error state setter */
  setError?: (error: string | null) => void;
  /** Optional loading state setter */
  setLoading?: (loading: boolean) => void;
  /** Optional duration for success toast in ms */
  successDuration?: number;
  /** Optional duration for error toast in ms */
  errorDuration?: number;
}

/**
 * Wrap an async operation with toast notifications.
 * 
 * @example
 * // Simple usage
 * const result = await withToast(
 *   () => dataManager.addItem(caseId, category, data),
 *   {
 *     loading: 'Adding item...',
 *     success: 'Item added successfully',
 *     error: 'Failed to add item',
 *   }
 * );
 * 
 * @example
 * // With isMounted guard and error state
 * const result = await withToast(
 *   () => service.saveCase(caseData),
 *   {
 *     loading: 'Saving case...',
 *     success: (savedCase) => `Case for ${savedCase.person.firstName} saved`,
 *     error: (err) => `Save failed: ${err.message}`,
 *     isMounted,
 *     setError,
 *   }
 * );
 */
export async function withToast<T>(
  operation: () => Promise<T>,
  options: WithToastOptions<T>
): Promise<T | null> {
  const { 
    loading, 
    success, 
    error, 
    isMounted, 
    setError, 
    setLoading,
    successDuration,
    errorDuration,
  } = options;

  const toastId = toast.loading(loading);
  setLoading?.(true);
  setError?.(null);

  try {
    const result = await operation();

    // Check if component unmounted during async operation
    if (isMounted && !isMounted.current) {
      toast.dismiss(toastId);
      return null;
    }

    const successMessage = typeof success === 'function' ? success(result) : success;
    toast.success(successMessage, { id: toastId, duration: successDuration });
    
    return result;
  } catch (err) {
    // Check if component unmounted during async operation
    if (isMounted && !isMounted.current) {
      toast.dismiss(toastId);
      return null;
    }

    const errorObj = err instanceof Error ? err : new Error(String(err));
    const errorMessage = typeof error === 'function' ? error(errorObj) : error;
    
    setError?.(errorMessage);
    toast.error(errorMessage, { id: toastId, duration: errorDuration });
    
    throw errorObj;
  } finally {
    setLoading?.(false);
  }
}

/**
 * Create a reusable toast wrapper with pre-configured options.
 * Useful when you have consistent settings across multiple operations.
 * 
 * @example
 * const toastOps = createToastWrapper({ isMounted, setError, setLoading });
 * 
 * await toastOps(
 *   () => dataManager.deleteItem(id),
 *   { loading: 'Deleting...', success: 'Deleted!', error: 'Delete failed' }
 * );
 */
export function createToastWrapper(
  defaultOptions: Pick<WithToastOptions<unknown>, 'isMounted' | 'setError' | 'setLoading'>
) {
  return <T>(
    operation: () => Promise<T>,
    options: Omit<WithToastOptions<T>, 'isMounted' | 'setError' | 'setLoading'>
  ) => withToast(operation, { ...defaultOptions, ...options });
}
