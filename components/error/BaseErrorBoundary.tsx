import React, { Component, ReactNode } from 'react';
import { errorReporting } from '@/utils/errorReporting';

// ============================================================================
// Base Error Boundary
// ============================================================================

/**
 * Shared props accepted by all error boundaries built on {@link BaseErrorBoundary}.
 */
export interface BaseErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI rendered when an error is caught */
  fallback?: ReactNode;
  /** Optional callback invoked after every caught error */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** When truthy (and `resetKeys` is set), reset the boundary when keys change */
  resetOnPropsChange?: boolean;
  /** Array of values — changing any triggers an automatic reset */
  resetKeys?: Array<string | number>;
}

export interface BaseErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Abstract base class for React error boundaries.
 *
 * Encapsulates:
 * - `getDerivedStateFromError` → sets `hasError` + `error`
 * - `componentDidCatch` → reports to `errorReporting`, calls `onError` prop
 * - `componentDidUpdate` → auto-resets when `resetKeys` change
 * - `resetErrorBoundary` / `handleRetry` helpers
 *
 * Subclasses override:
 * - {@link getReportingContext} — metadata sent to `errorReporting`
 * - {@link shouldShowToast} / {@link getToastContent} — optional toast behaviour
 * - {@link renderFallback} — default fallback UI when `props.fallback` is not set
 */
export abstract class BaseErrorBoundary<
  P extends BaseErrorBoundaryProps = BaseErrorBoundaryProps,
  S extends BaseErrorBoundaryState = BaseErrorBoundaryState,
> extends Component<P, S> {
  protected resetTimeoutId: number | null = null;

  // -- Lifecycle -------------------------------------------------------------

  static getDerivedStateFromError(error: Error): Partial<BaseErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // SAFETY: Subclass states always extend BaseErrorBoundaryState which includes
    // errorInfo, so spreading a partial update here is safe. The double cast is
    // needed because TypeScript cannot prove that `{ errorInfo }` satisfies the
    // full generic `S` at the base-class level.
    this.setState({ errorInfo } as unknown as S);

    // Skip known test errors to avoid noise
    const isTestError =
      error.message?.includes('Test error for ErrorBoundary') ||
      error.stack?.includes('ErrorBoundaryTest');

    if (!isTestError) {
      const ctx = this.getReportingContext();
      errorReporting.reportError(error, {
        componentStack: errorInfo.componentStack || undefined,
        context: {
          ...ctx,
          componentStack: errorInfo.componentStack || undefined,
        },
        severity: ctx.severity ?? 'high',
        tags: ctx.tags ?? ['error-boundary', 'react'],
      });
    }

    this.props.onError?.(error, errorInfo);

    if (this.shouldShowToast()) {
      this.showToast();
    }
  }

  componentDidUpdate(prevProps: P) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && resetOnPropsChange && resetKeys) {
      const changed = resetKeys.some(
        (key, idx) => prevProps.resetKeys?.[idx] !== key,
      );
      if (changed) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  // -- Public helpers --------------------------------------------------------

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    } as S);
  };

  handleRetry = () => {
    this.resetTimeoutId = globalThis.setTimeout(() => {
      this.resetErrorBoundary();
    }, 100);
  };

  // -- Hooks for subclasses --------------------------------------------------

  /** Return context metadata for the error-reporting service. */
  protected abstract getReportingContext(): {
    type: string;
    severity?: 'low' | 'medium' | 'high';
    tags?: string[];
    [key: string]: unknown;
  };

  /** Whether `componentDidCatch` should display a toast. Defaults to `true`. */
  protected shouldShowToast(): boolean {
    return true;
  }

  /** Display the toast (called when `shouldShowToast` returns true). */
  protected abstract showToast(): void;

  /** Render the default fallback when `props.fallback` is not supplied. */
  protected abstract renderFallback(): ReactNode;

  // -- Render ----------------------------------------------------------------

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return this.renderFallback();
    }
    return this.props.children;
  }
}
