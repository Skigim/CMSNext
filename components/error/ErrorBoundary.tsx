import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { clickToCopy } from '@/utils/clipboard';
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
      errorId: `error-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
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

  private readonly handleCopyError = async () => {
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

    await clickToCopy(errorText, {
      successMessage: 'Error details copied to clipboard',
      errorMessage: 'Unable to copy error details',
      toastApi: toast,
    });
  };

  // -- Fallback UI -----------------------------------------------------------

  protected renderFallback(): React.ReactNode {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
              <AlertTriangle aria-hidden="true" className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl font-semibold">Something went wrong</CardTitle>
            <CardDescription>
              The application encountered an unexpected error. You can try
              again or reload the page if the problem persists.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle aria-hidden="true" className="h-4 w-4" />
              <AlertTitle>Unexpected application error</AlertTitle>
              <AlertDescription>
                Reload the page if retrying does not recover the application.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-3">
              <Button onClick={this.handleRetry}>Try Again</Button>
              <Button variant="secondary" onClick={() => globalThis.location.reload()}>
                Reload Page
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Error Details (Development)
                </summary>
                <div className="mt-3 rounded bg-muted p-3 text-xs font-mono max-h-32 overflow-auto">
                  <div className="mb-1 font-semibold text-destructive">
                    {this.state.error.name}: {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <pre className="whitespace-pre-wrap text-muted-foreground">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
                <Button className="mt-2" size="sm" variant="secondary" onClick={this.handleCopyError}>
                  Copy Error Details
                </Button>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
}