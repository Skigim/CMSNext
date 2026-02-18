import React from 'react';
import { toast } from 'sonner';
import {
  BaseErrorBoundary,
  type BaseErrorBoundaryProps,
  type BaseErrorBoundaryState,
} from './BaseErrorBoundary';

interface ErrorBoundaryState extends BaseErrorBoundaryState {
  errorId: string | null;
}

/**
 * General-purpose React error boundary.
 *
 * Catches JavaScript errors anywhere in its child component tree, logs them,
 * reports to the error-reporting service, and displays a fallback UI.
 *
 * Built on top of {@link BaseErrorBoundary} which handles shared lifecycle
 * logic (reporting, auto-reset via `resetKeys`, retry helpers).
 */
export class ErrorBoundary extends BaseErrorBoundary<
  BaseErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: BaseErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  // -- BaseErrorBoundary hooks -----------------------------------------------

  protected getReportingContext() {
    return {
      type: 'react-error-boundary',
      severity: 'high' as const,
      tags: ['error-boundary', 'react'],
    };
  }

  protected showToast(): void {
    toast.error('An unexpected error occurred', {
      description:
        'The application encountered an error. Please try refreshing the page.',
      duration: 5000,
    });
  }

  // -- Copy error details ----------------------------------------------------

  private readonly handleCopyError = () => {
    const { error, errorInfo, errorId } = this.state;
    if (!error) return;

    const errorDetails = {
      errorId,
      timestamp: new Date().toISOString(),
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      url: globalThis.location.href,
    };

    const errorText = JSON.stringify(errorDetails, null, 2);

    navigator.clipboard
      .writeText(errorText)
      .then(() => {
        toast.success('Error details copied to clipboard');
      })
      .catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = errorText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success('Error details copied to clipboard');
      });
  };

  // -- Fallback UI -----------------------------------------------------------

  protected renderFallback(): React.ReactNode {
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
              Something went wrong
            </h2>

            <p className="text-muted-foreground mb-6">
              The application encountered an unexpected error. You can try
              reloading the page or contact support if the problem persists.
            </p>

            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>

              <button
                onClick={() => globalThis.location.reload()}
                className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
              >
                Reload Page
              </button>
            </div>

            {/* Development error details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Error Details (Development)
                </summary>
                <div className="mt-3 p-3 bg-muted rounded text-xs font-mono overflow-auto max-h-32">
                  <div className="text-destructive font-semibold mb-1">
                    {this.state.error.name}: {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <pre className="whitespace-pre-wrap text-muted-foreground">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
                <button
                  onClick={this.handleCopyError}
                  className="mt-2 px-3 py-1 text-xs bg-muted-foreground text-background rounded hover:bg-foreground transition-colors"
                >
                  📋 Copy Error Details
                </button>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  }
}