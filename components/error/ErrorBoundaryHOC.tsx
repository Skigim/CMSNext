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

// Pre-configured HOCs for common use cases
export const withFileSystemErrorBoundary = <P extends object>(Component: ComponentType<P>) =>
  withErrorBoundary(Component, {
    isolateComponent: true,
    onError: (error, errorInfo) => {
      console.error('File system component error:', error, errorInfo);
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

