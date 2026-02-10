import React from 'react';
import { toast } from 'sonner';
import {
  BaseErrorBoundary,
  type BaseErrorBoundaryProps,
  type BaseErrorBoundaryState,
} from './BaseErrorBoundary';

interface FileSystemErrorBoundaryProps extends BaseErrorBoundaryProps {
  onRetry?: () => void;
}

interface FileSystemErrorBoundaryState extends BaseErrorBoundaryState {
  isFileSystemError: boolean;
}

/**
 * Error boundary specialised for File System Access API errors.
 *
 * Extends {@link BaseErrorBoundary} and adds:
 * - File-system error detection (permission, quota, security, abort)
 * - User-friendly error messages & descriptions
 * - Optional `onRetry` callback
 */
export class FileSystemErrorBoundary extends BaseErrorBoundary<
  FileSystemErrorBoundaryProps,
  FileSystemErrorBoundaryState
> {
  constructor(props: FileSystemErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isFileSystemError: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<FileSystemErrorBoundaryState> {
    return {
      hasError: true,
      error,
      isFileSystemError: FileSystemErrorBoundary.isFileSystemRelatedError(error),
    };
  }

  static isFileSystemRelatedError(error: Error): boolean {
    const patterns = [
      /file system/i, /filesystem/i, /permission denied/i, /access denied/i,
      /not supported/i, /quota exceeded/i, /security error/i, /user cancelled/i,
      /user aborted/i, /AbortError/i, /NotAllowedError/i, /SecurityError/i,
      /QuotaExceededError/i,
    ];

    const text = [error.message, error.name, error.stack].filter(Boolean).join(' ');
    return patterns.some((p) => p.test(text));
  }

  // -- BaseErrorBoundary hooks -----------------------------------------------

  protected getReportingContext() {
    const isFsError = this.state.isFileSystemError;
    return {
      type: 'filesystem-error-boundary',
      isFileSystemError: isFsError,
      severity: (isFsError ? 'medium' : 'high') as 'medium' | 'high',
      tags: isFsError
        ? ['filesystem', 'error-boundary', 'user-action']
        : ['error-boundary', 'react'],
    };
  }

  protected shouldShowToast(): boolean {
    return this.state.isFileSystemError;
  }

  protected showToast(): void {
    toast.error('File system error occurred', {
      description:
        'There was a problem accessing the file system. Please check permissions and try again.',
      duration: 5000,
    });
  }

  // -- Retry override --------------------------------------------------------

  handleRetry = () => {
    this.props.onRetry?.();
    this.resetTimeoutId = window.setTimeout(() => {
      this.resetErrorBoundary();
    }, 100);
  };

  // -- User-friendly messages ------------------------------------------------

  private getErrorMessage(): string {
    const error = this.state.error;
    if (!error) return 'An unexpected error occurred';
    if (error.name === 'AbortError') return 'File operation was cancelled';
    if (error.name === 'NotAllowedError' || error.message.includes('permission'))
      return 'Permission denied to access the file system';
    if (error.name === 'SecurityError')
      return 'Security restriction prevented file system access';
    if (error.name === 'QuotaExceededError') return 'Storage quota exceeded';
    if (error.message.includes('not supported'))
      return 'File system access is not supported in this browser';
    return 'A file system error occurred';
  }

  private getErrorDescription(): string {
    const error = this.state.error;
    if (!error) return 'Please try again or contact support.';
    if (error.name === 'AbortError')
      return 'The file operation was cancelled. You can try again if needed.';
    if (error.name === 'NotAllowedError' || error.message.includes('permission'))
      return 'The browser blocked access to the file system. Please check your browser settings and try again.';
    if (error.name === 'SecurityError')
      return "Your browser's security settings prevented access to the file system.";
    if (error.name === 'QuotaExceededError')
      return "Your browser's storage quota has been exceeded. Please free up some space and try again.";
    if (error.message.includes('not supported'))
      return "This browser doesn't support the File System Access API. Please use Chrome, Edge, or Opera.";
    return 'There was a problem with the file system operation. Please try again.';
  }

  // -- Fallback UI -----------------------------------------------------------

  protected renderFallback(): React.ReactNode {
    return (
      <div className="min-h-[200px] flex items-center justify-center p-6">
        <div className="max-w-md w-full p-6 bg-card border border-border rounded-lg shadow-sm">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-amber-600 dark:text-amber-400"
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

            <h3 className="text-lg font-semibold text-foreground mb-2">
              {this.getErrorMessage()}
            </h3>

            <p className="text-muted-foreground mb-6 text-sm">
              {this.getErrorDescription()}
            </p>

            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
              >
                Try Again
              </button>

              {this.state.isFileSystemError && (
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors text-sm"
                >
                  Refresh Page
                </button>
              )}
            </div>

            {/* Development error details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Error Details (Development)
                </summary>
                <div className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-auto max-h-24">
                  <div className="text-destructive font-semibold mb-1">
                    {this.state.error.name}: {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <pre className="whitespace-pre-wrap text-muted-foreground text-xs">
                      {this.state.error.stack.slice(0, 200)}...
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
}