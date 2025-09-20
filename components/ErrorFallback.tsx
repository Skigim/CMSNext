interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  title?: string;
  description?: string;
  showReload?: boolean;
  showDetails?: boolean;
}

export function ErrorFallback({
  error,
  resetError,
  title = "Something went wrong",
  description = "The application encountered an unexpected error. You can try reloading the page or contact support if the problem persists.",
  showReload = true,
  showDetails = true,
}: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4 p-6 bg-card border border-border rounded-lg shadow-lg">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-destructive/20 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {title}
          </h2>
          
          <p className="text-muted-foreground mb-6">
            {description}
          </p>

          <div className="space-y-3">
            {resetError && (
              <button
                onClick={resetError}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            )}
            
            {showReload && (
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
              >
                Reload Page
              </button>
            )}
          </div>

          {/* Development error details */}
          {process.env.NODE_ENV === 'development' && error && showDetails && (
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Error Details (Development)
              </summary>
              <div className="mt-3 p-3 bg-muted rounded text-xs font-mono overflow-auto max-h-32">
                <div className="text-destructive font-semibold mb-1">
                  {error.name}: {error.message}
                </div>
                {error.stack && (
                  <pre className="whitespace-pre-wrap text-muted-foreground">
                    {error.stack}
                  </pre>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

interface FileSystemErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  onRetry?: () => void;
  compact?: boolean;
}

export function FileSystemErrorFallback({
  error,
  resetError,
  onRetry,
  compact = false,
}: FileSystemErrorFallbackProps) {
  const getErrorMessage = (): string => {
    if (!error) return 'An unexpected error occurred';

    // Handle specific file system errors with user-friendly messages
    if (error.name === 'AbortError') {
      return 'File operation was cancelled';
    }
    
    if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
      return 'Permission denied to access the file system';
    }
    
    if (error.name === 'SecurityError') {
      return 'Security restriction prevented file system access';
    }
    
    if (error.name === 'QuotaExceededError') {
      return 'Storage quota exceeded';
    }
    
    if (error.message.includes('not supported')) {
      return 'File system access is not supported in this browser';
    }

    return 'A file system error occurred';
  };

  const getErrorDescription = (): string => {
    if (!error) return 'Please try again or contact support.';

    if (error.name === 'AbortError') {
      return 'The file operation was cancelled. You can try again if needed.';
    }
    
    if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
      return 'The browser blocked access to the file system. Please check your browser settings and try again.';
    }
    
    if (error.name === 'SecurityError') {
      return 'Your browser\'s security settings prevented access to the file system.';
    }
    
    if (error.name === 'QuotaExceededError') {
      return 'Your browser\'s storage quota has been exceeded. Please free up some space and try again.';
    }
    
    if (error.message.includes('not supported')) {
      return 'This browser doesn\'t support the File System Access API. Please use Chrome, Edge, or Opera.';
    }

    return 'There was a problem with the file system operation. Please try again.';
  };

  const isFileSystemError = error && (
    error.name === 'AbortError' ||
    error.name === 'NotAllowedError' ||
    error.name === 'SecurityError' ||
    error.name === 'QuotaExceededError' ||
    error.message.includes('not supported') ||
    error.message.includes('permission')
  );

  const containerClass = compact 
    ? "min-h-[200px] flex items-center justify-center p-4"
    : "min-h-[300px] flex items-center justify-center p-6";

  const cardClass = compact
    ? "max-w-sm w-full p-4 bg-card border border-border rounded-lg shadow-sm"
    : "max-w-md w-full p-6 bg-card border border-border rounded-lg shadow-sm";

  return (
    <div className={containerClass}>
      <div className={cardClass}>
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-3 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 5v4M16 5v4"
              />
            </svg>
          </div>
          
          <h3 className={`font-semibold text-foreground mb-2 ${compact ? 'text-base' : 'text-lg'}`}>
            {getErrorMessage()}
          </h3>
          
          <p className={`text-muted-foreground mb-4 ${compact ? 'text-xs' : 'text-sm'}`}>
            {getErrorDescription()}
          </p>

          <div className="space-y-2">
            {(resetError || onRetry) && (
              <button
                onClick={onRetry || resetError}
                className={`w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors ${compact ? 'text-xs' : 'text-sm'}`}
              >
                Try Again
              </button>
            )}
            
            {isFileSystemError && (
              <button
                onClick={() => window.location.reload()}
                className={`w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors ${compact ? 'text-xs' : 'text-sm'}`}
              >
                Refresh Page
              </button>
            )}
          </div>

          {/* Development error details */}
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-3 text-left">
              <summary className={`cursor-pointer text-muted-foreground hover:text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                Error Details (Development)
              </summary>
              <div className={`mt-2 p-2 bg-muted rounded font-mono overflow-auto ${compact ? 'text-xs max-h-20' : 'text-xs max-h-24'}`}>
                <div className="text-destructive font-semibold mb-1">
                  {error.name}: {error.message}
                </div>
                {error.stack && (
                  <pre className="whitespace-pre-wrap text-muted-foreground text-xs">
                    {error.stack.slice(0, compact ? 150 : 200)}...
                  </pre>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErrorFallback;