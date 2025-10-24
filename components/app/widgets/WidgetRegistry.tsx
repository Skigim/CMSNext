import React, { Suspense, ReactNode, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { FeatureFlagKey, FeatureFlags } from '@/utils/featureFlags';

/**
 * Widget metadata for registration and rendering.
 */
export interface WidgetMetadata {
  /** Unique identifier for the widget */
  id: string;
  /** Display title of the widget */
  title: string;
  /** Optional description */
  description?: string;
  /** How often to refresh data (milliseconds) */
  refreshInterval?: number;
  /** Priority order (lower = higher priority, displayed first) */
  priority?: number;
  /** Optional feature flag key controlling visibility */
  featureFlag?: FeatureFlagKey;
}

/**
 * Registered widget with its component and metadata.
 */
export interface RegisteredWidget {
  metadata: WidgetMetadata;
  component: React.ComponentType<any>;
  props?: Record<string, any>;
}

/**
 * Widget skeleton/loading state component.
 * Displays a placeholder while widget is loading.
 */
function WidgetSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <Skeleton className="h-6 w-32" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

/**
 * Widget Registry Component
 *
 * Provides a lazy-loading framework for dashboard widgets with:
 * - Automatic registration and discovery
 * - Lazy loading with React.lazy()
 * - Suspense boundaries with skeleton loaders
 * - Freshness indicator support
 * - Widget metadata and priority sorting
 *
 * @example
 * ```tsx
 * <WidgetRegistry
 *   widgets={[
 *     {
 *       metadata: { id: 'case-priority', title: 'Case Priority', priority: 1 },
 *       component: CasePriorityWidget,
 *       props: { cases }
 *     }
 *   ]}
 * />
 * ```
 */
export interface WidgetRegistryProps {
  /** Array of widgets to register and render */
  widgets: RegisteredWidget[];
  /** Optional CSS class for grid container */
  gridClassName?: string;
  /** Optional fallback while widgets load */
  loadingFallback?: ReactNode;
  /** Optional error message handler */
  onError?: (error: Error, widgetId: string) => void;
  /** Active feature flag context used to filter widgets */
  enabledFlags?: Partial<FeatureFlags>;
}

export function WidgetRegistry({
  widgets,
  gridClassName = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
  loadingFallback = <WidgetSkeleton />,
  onError,
  enabledFlags,
}: WidgetRegistryProps) {
  /**
   * Sort widgets by priority (lower number = higher priority).
   * Widgets without priority default to Infinity (rendered last).
   */
  const sortedWidgets = useMemo(() => {
    return [...widgets].sort((a, b) => {
      const aPriority = a.metadata.priority ?? Infinity;
      const bPriority = b.metadata.priority ?? Infinity;
      return aPriority - bPriority;
    });
  }, [widgets]);

  const visibleWidgets = useMemo(() => {
    return sortedWidgets.filter(widget => {
      const flag = widget.metadata.featureFlag;
      if (!flag) {
        return true;
      }

      if (!enabledFlags) {
        return true;
      }

      const value = enabledFlags[flag];
      return value === undefined ? true : Boolean(value);
    });
  }, [sortedWidgets, enabledFlags]);

  return (
    <div className={gridClassName}>
      {visibleWidgets.map((widget) => {
        const WidgetComponent = widget.component;

        return (
          <ErrorBoundary
            key={widget.metadata.id}
            widgetId={widget.metadata.id}
            onError={onError}
          >
            <Suspense fallback={loadingFallback}>
              <WidgetComponent {...widget.props} metadata={widget.metadata} />
            </Suspense>
          </ErrorBoundary>
        );
      })}
    </div>
  );
}

/**
 * Simple error boundary for individual widgets.
 * Prevents one widget's error from crashing the entire registry.
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  widgetId: string;
  onError?: (error: Error, widgetId: string) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (this.props.onError) {
      this.props.onError(error, this.props.widgetId);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive font-medium">
            Failed to load widget: {this.props.widgetId}
          </p>
          {this.state.error && (
            <p className="text-xs text-destructive/80 mt-1">
              {this.state.error.message}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Create a lazy-loaded widget component.
 * Helps with code splitting for better performance.
 *
 * @param componentPromise - Dynamic import promise
 * @param componentExport - Named export or 'default'
 * @returns Lazy component ready for Suspense
 *
 * @example
 * ```tsx
 * const LazyWidget = createLazyWidget(
 *   import('@/components/app/widgets/CasePriorityWidget'),
 *   'CasePriorityWidget'
 * );
 * ```
 */
export function createLazyWidget<P>(
  componentPromise: Promise<{ [key: string]: React.ComponentType<P> }>,
  componentExport: string = 'default'
): React.LazyExoticComponent<React.ComponentType<P>> {
  return React.lazy(() =>
    componentPromise.then((module) => ({
      default: module[componentExport] as React.ComponentType<P>,
    }))
  );
}
