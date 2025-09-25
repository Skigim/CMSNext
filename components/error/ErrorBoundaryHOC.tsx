import React, { ComponentType } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { FileSystemErrorFallback } from './ErrorFallback';

interface WithErrorBoundaryOptions {
  fallback?: React.ComponentType<{ error?: Error; resetError?: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  isolateComponent?: boolean;
}

/**
 * Higher Order Component that wraps a component with an error boundary
 * 
 * @param Component - The component to wrap
 * @param options - Configuration options for the error boundary
 * @returns Component wrapped with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
): ComponentType<P> {
  const {
    fallback,
    onError,
    resetKeys,
    isolateComponent = false
  } = options;

  const WrappedComponent = (props: P) => {
    const errorBoundaryProps = {
      onError,
      resetOnPropsChange: Boolean(resetKeys),
      resetKeys,
      fallback: fallback ? React.createElement(fallback, { 
        error: undefined, 
        resetError: undefined 
      }) : undefined
    };

    if (isolateComponent) {
      // Use a more compact fallback for component-level errors
      const compactFallback = (
        <FileSystemErrorFallback 
          compact={true}
          error={new Error('Component error occurred')}
        />
      );

      return (
        <ErrorBoundary {...errorBoundaryProps} fallback={compactFallback}>
          <Component {...props} />
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * React Hook for handling async errors that aren't caught by error boundaries
 * 
 * @param onError - Optional custom error handler
 * @returns Error handling function
 */
export function useAsyncError(onError?: (error: Error) => void) {
  const [, setError] = React.useState<Error | null>(null);

  const handleAsyncError = React.useCallback((error: Error) => {
    console.error('Async error caught:', error);
    
    if (onError) {
      onError(error);
    } else {
      // Force error boundary to catch this error by updating state
      setError(() => {
        throw error;
      });
    }
  }, [onError]);

  return handleAsyncError;
}

/**
 * Hook for creating async-safe versions of async functions
 * Automatically catches errors and reports them
 */
export function useAsyncSafe() {
  const handleAsyncError = useAsyncError();

  const wrapAsync = React.useCallback(
    <T extends (...args: any[]) => Promise<any>>(asyncFn: T): T => {
      return ((...args: any[]) => {
        return Promise.resolve(asyncFn(...args)).catch((error) => {
          handleAsyncError(error);
          throw error; // Re-throw for caller to handle if needed
        });
      }) as T;
    },
    [handleAsyncError]
  );

  return { wrapAsync, handleAsyncError };
}

/**
 * Custom hook for component-level error recovery
 * 
 * @param onReset - Optional callback when component resets
 * @returns Object with error state and reset function
 */
export function useErrorRecovery(onReset?: () => void) {
  const [hasError, setHasError] = React.useState(false);
  const [errorKey, setErrorKey] = React.useState(0);

  const resetError = React.useCallback(() => {
    setHasError(false);
    setErrorKey(prev => prev + 1);
    if (onReset) {
      onReset();
    }
  }, [onReset]);

  const triggerError = React.useCallback(() => {
    setHasError(true);
  }, []);

  return {
    hasError,
    errorKey,
    resetError,
    triggerError
  };
}

// Pre-configured HOCs for common use cases
export const withFileSystemErrorBoundary = <P extends object>(Component: ComponentType<P>) =>
  withErrorBoundary(Component, {
    isolateComponent: true,
    onError: (error, errorInfo) => {
      console.error('File system component error:', error, errorInfo);
    }
  });

export const withFormErrorBoundary = <P extends object>(Component: ComponentType<P>) =>
  withErrorBoundary(Component, {
    isolateComponent: true,
    onError: (error, errorInfo) => {
      console.error('Form component error:', error, errorInfo);
      // Could add form-specific error handling here
    }
  });

export const withDataErrorBoundary = <P extends object>(Component: ComponentType<P>) =>
  withErrorBoundary(Component, {
    isolateComponent: true,
    onError: (error, errorInfo) => {
      console.error('Data component error:', error, errorInfo);
      // Could add data-specific error handling here
    }
  });

export default withErrorBoundary;