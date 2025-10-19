'use client';

import { AlertCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" role="alert" aria-live="polite">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex gap-3">
            <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" aria-hidden="true" />
            <div className="flex-1">
              <CardTitle className="text-destructive">{title}</CardTitle>
              <CardDescription className="mt-2">
                {description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Development error details */}
          {process.env.NODE_ENV === 'development' && error && showDetails && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Error Details (Development)
              </summary>
              <div className="mt-3 p-3 bg-muted rounded-md text-xs font-mono overflow-auto max-h-32 space-y-1">
                <div className="text-destructive font-semibold">
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
        </CardContent>

        <CardFooter className="flex gap-3 flex-col">
          {resetError && (
            <Button
              onClick={resetError}
              variant="default"
              className="w-full"
            >
              Try Again
            </Button>
          )}

          {showReload && (
            <Button
              onClick={handleReload}
              variant="secondary"
              className="w-full"
            >
              Reload Page
            </Button>
          )}
        </CardFooter>
      </Card>
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

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else if (resetError) {
      resetError();
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div
      className={compact ? "min-h-[200px] flex items-center justify-center p-4" : "min-h-[300px] flex items-center justify-center p-6"}
      role="alert"
      aria-live="assertive"
    >
      <Card className={compact ? "w-full max-w-sm" : "w-full max-w-md"}>
        <CardHeader>
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <CardTitle className={compact ? "text-base" : "text-lg"}>
                {getErrorMessage()}
              </CardTitle>
              <CardDescription className={compact ? "text-xs mt-1" : "text-sm mt-2"}>
                {getErrorDescription()}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Development error details */}
          {process.env.NODE_ENV === 'development' && error && (
            <details className="group">
              <summary className={`cursor-pointer text-muted-foreground hover:text-foreground transition-colors ${compact ? 'text-xs' : 'text-sm'}`}>
                Error Details (Development)
              </summary>
              <div className={`mt-2 p-2 bg-muted rounded-md font-mono overflow-auto ${compact ? 'text-xs max-h-20' : 'text-xs max-h-24'}`}>
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
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          {(resetError || onRetry) && (
            <Button
              onClick={handleRetry}
              variant="default"
              className="w-full"
              size={compact ? "sm" : "default"}
            >
              Try Again
            </Button>
          )}

          {isFileSystemError && (
            <Button
              onClick={handleReload}
              variant="secondary"
              className="w-full"
              size={compact ? "sm" : "default"}
            >
              Refresh Page
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export default ErrorFallback;