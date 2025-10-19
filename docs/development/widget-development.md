# Widget Development Guide

## Overview

The CMSNext dashboard uses a **widget registry framework** for lazy-loaded, composable data visualization components. This guide walks you through creating new dashboard widgets, integrating them with the registry, and following data fetching patterns used throughout the platform.

## Architecture

### Widget Registry

The `WidgetRegistry` component provides:
- **Lazy loading** via `React.lazy()` and `Suspense` boundaries
- **Automatic error handling** with error boundaries per widget
- **Priority-based sorting** for consistent widget ordering
- **Skeleton loading states** while widgets fetch data

**Location:** `components/app/widgets/WidgetRegistry.tsx`

### Data Flow

```
useWidgetData(fetcherFn) 
  → fetches data with auto-refresh
  → tracks freshness (minutes since last update)
  → records performance metrics
  → provides error handling
  → updates every `refreshInterval` milliseconds
```

### Key Dependencies

- **`useWidgetData.ts`** - Hook for data fetching, freshness tracking, and performance instrumentation
- **`telemetryInstrumentation.ts`** - Performance marker recording
- **Shadcn UI components** - Card, Badge, ScrollArea, Skeleton for consistent styling

## Step-by-Step Widget Creation

### 1. Define Widget Props and Metadata

Create a TypeScript interface for your widget's props. All widgets receive an optional `metadata` prop injected by the registry:

```typescript
interface YourWidgetProps {
  /** Data from parent context or props */
  data: DataType[];
  
  /** Widget metadata (injected by WidgetRegistry) */
  metadata?: WidgetMetadata;
}
```

**Available metadata fields:**
```typescript
interface WidgetMetadata {
  id: string;                    // Unique identifier
  title: string;                 // Display title
  description?: string;          // Optional description
  refreshInterval?: number;      // Auto-refresh interval (ms)
  priority?: number;             // Sort order (lower = higher priority)
}
```

### 2. Create the Widget Component

**Location:** `components/app/widgets/YourWidget.tsx`

Template structure:

```typescript
import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWidgetData } from '@/hooks/useWidgetData';
import type { WidgetMetadata } from './WidgetRegistry';

interface YourWidgetProps {
  data: DataType[];
  metadata?: WidgetMetadata;
}

/**
 * Your Widget Name Component
 *
 * Brief description of what this widget displays.
 *
 * Features:
 * - Real-time data updates
 * - Freshness indicator
 * - Error handling
 *
 * @example
 * ```tsx
 * <YourWidget data={dataArray} />
 * ```
 */
export function YourWidget({ data = [], metadata }: YourWidgetProps) {
  /**
   * Fetch and format data using widget data hook.
   * The fetcher function receives fresh data on each interval.
   */
  const { data: processed, loading, error, freshness } = useWidgetData(
    async () => {
      return new Promise<ProcessedType>((resolve) => {
        setTimeout(() => {
          resolve(processData(data));
        }, 0);
      });
    },
    {
      refreshInterval: metadata?.refreshInterval ?? 5 * 60 * 1000, // 5 minutes default
      enablePerformanceTracking: true,
    }
  );

  /**
   * Format freshness timestamp for display.
   */
  const freshnessLabel = useMemo(() => {
    if (!freshness.lastUpdatedAt) {
      return 'Never updated';
    }

    if (freshness.minutesAgo === 0) {
      return 'Just now';
    }

    if (freshness.minutesAgo === 1) {
      return '1 minute ago';
    }

    if (freshness.minutesAgo && freshness.minutesAgo < 60) {
      return `${freshness.minutesAgo} minutes ago`;
    }

    const hoursAgo = Math.floor((freshness.minutesAgo || 0) / 60);
    if (hoursAgo === 1) {
      return '1 hour ago';
    }

    return `${hoursAgo} hours ago`;
  }, [freshness]);

  /**
   * Render loading state with skeleton.
   */
  if (loading && !processed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Widget Title</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  /**
   * Render error state.
   */
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Widget Title</CardTitle>
          <CardDescription>Error loading data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Widget Title</CardTitle>
            <CardDescription>Widget description</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {processed?.length ?? 0} items
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Main content area */}
        <div className="space-y-3">
          {/* Content here */}
        </div>

        {/* Freshness indicator */}
        <div className="text-xs text-muted-foreground text-center pt-3 border-t border-border/50 mt-3">
          <p>Last checked: {freshnessLabel}</p>
        </div>

        {/* Empty state */}
        {!processed?.length && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No data available
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default YourWidget;
```

### 3. Register Widget in Dashboard

Add your widget to the `widgets` array in `components/app/Dashboard.tsx`:

```typescript
import { YourWidget } from "./widgets/YourWidget";

// In Dashboard component:
const widgets = useMemo<RegisteredWidget[]>(() => {
  return [
    // ... existing widgets ...
    {
      metadata: {
        id: 'your-widget-id',
        title: 'Your Widget Title',
        description: 'Brief description',
        priority: 3,
        refreshInterval: 5 * 60 * 1000, // 5 minutes
      },
      component: YourWidget,
      props: { data: yourData },
    },
  ];
}, [yourData]);
```

**Priority Guidelines:**
- `priority: 1` - Critical metrics (case counts, alerts)
- `priority: 2` - Important activity (timeline, recent changes)
- `priority: 3+` - Supporting insights (trends, patterns)

### 4. Data Fetching Patterns

#### Pattern A: Synchronous Data Transformation

For data that's already available in props, wrap it in an async function:

```typescript
const { data: stats, loading } = useWidgetData(
  async () => {
    return new Promise<Stats>((resolve) => {
      setTimeout(() => {
        resolve(calculateStats(caseArray));
      }, 0);
    });
  },
  { refreshInterval: 5 * 60 * 1000 }
);
```

#### Pattern B: Async Data Loading

For data that requires API calls:

```typescript
const { data: records, loading, error } = useWidgetData(
  async () => {
    try {
      const response = await fetchWidgetData();
      return processResponse(response);
    } catch (err) {
      throw new Error(`Failed to load widget data: ${err}`);
    }
  },
  { refreshInterval: 3 * 60 * 1000 }
);
```

#### Pattern C: Conditional Fetching

For data that depends on prop changes:

```typescript
const { data: filtered } = useWidgetData(
  async () => {
    if (!userId) {
      return [];
    }
    return await loadUserSpecificData(userId);
  },
  { 
    refreshInterval: 10 * 60 * 1000,
    enablePerformanceTracking: true 
  }
);
```

### 5. Styling with Shadcn Components

Use shadcn/ui primitives for consistent styling:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
```

**Spacing conventions:**
- Container padding: `p-4` or `p-6`
- Content gaps: `gap-3` or `gap-4`
- Section separators: `border-t border-border/50 mt-3 pt-3`
- Icon sizing: `h-4 w-4` for inline, `h-8 w-8` for prominent

### 6. Handle Empty States

Always provide meaningful empty states:

```typescript
{!data?.length && (
  <div className="text-center py-8">
    <IconComponent className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
    <p className="text-sm text-muted-foreground">
      No data available
    </p>
  </div>
)}
```

## Testing Widgets

### Unit Tests

Create `__tests__/components/widgets/YourWidget.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { YourWidget } from '@/components/app/widgets/YourWidget';

describe('YourWidget', () => {
  it('renders loading state', () => {
    render(<YourWidget data={[]} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders data when loaded', () => {
    render(<YourWidget data={[{ id: '1', name: 'Test' }]} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<YourWidget data={[]} />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<YourWidget data={[]} />);
    expect(container).toHaveNoViolations();
  });
});
```

### Integration Tests

Test widget registration and rendering in Dashboard:

```typescript
it('renders widget in dashboard', () => {
  render(
    <Dashboard
      cases={testCases}
      alerts={testAlerts}
      activityLogState={testActivityLog}
      onViewAllCases={() => {}}
      onNewCase={() => {}}
      onNavigateToReports={() => {}}
    />
  );

  expect(screen.getByText('Widget Title')).toBeInTheDocument();
});
```

## Performance Considerations

### Bundle Size

Widgets are lazy-loaded to reduce initial bundle size:

```typescript
const LazyWidget = createLazyWidget(
  import('@/components/app/widgets/YourWidget'),
  'YourWidget'
);
```

Use this pattern when widgets are large or used conditionally.

### Data Freshness

Balance freshness vs. performance:

- **High-frequency data** (< 1 minute): Real-time metrics, activity
- **Standard refresh** (2-5 minutes): Case counts, summaries
- **Low-frequency** (> 5 minutes): Trends, analytics

### Memoization

Memoize expensive computations:

```typescript
const processedStats = useMemo(() => {
  return data.map(item => ({
    ...item,
    computed: expensiveCalculation(item)
  }));
}, [data]);
```

## Telemetry Integration

Performance tracking is automatically enabled. Access metrics in logs:

```typescript
// Automatically tracked:
// - Widget data fetch duration
// - Freshness updates
// - Error rates
// - Component mount/unmount
```

View telemetry output in browser console (dev mode):

```
[Telemetry] Storage sync event: save
[Telemetry] Performance marker: widget-data-fetch-<timestamp>
```

## Best Practices

### ✅ Do

- Use `useWidgetData` for all data fetching
- Provide loading skeletons matching widget height
- Include freshness indicators
- Handle empty states gracefully
- Memoize expensive calculations
- Use relative timestamps ("2 hours ago")
- Keep widgets focused on single responsibility
- Document widget metadata clearly

### ❌ Don't

- Fetch data directly in component body
- Bypass `useWidgetData` with custom fetch logic
- Mutate incoming props
- Use `localStorage` or direct file access
- Create component-specific loading states
- Use hardcoded colors (use Tailwind tokens)
- Render widgets outside the registry

## Examples

### Example 1: Case Priority Widget

See: `components/app/widgets/CasePriorityWidget.tsx`

Demonstrates:
- Count aggregation from case array
- Color-coded badges
- Responsive grid layout

### Example 2: Activity Timeline Widget

See: `components/app/widgets/ActivityTimelineWidget.tsx`

Demonstrates:
- Array filtering and sorting
- Relative timestamp formatting
- Scrollable content area
- Activity type badges

## Troubleshooting

### Widget not appearing

1. Check widget registration in Dashboard:
   ```typescript
   const widgets = useMemo<RegisteredWidget[]>(() => [
     { metadata: { id: 'your-id', ... }, component: YourWidget, props: {...} }
   ], [...]);
   ```

2. Verify component export:
   ```typescript
   export function YourWidget({ ... }) { ... }
   export default YourWidget;
   ```

3. Check browser console for error boundaries

### Data not updating

1. Verify `useWidgetData` is called with correct dependencies
2. Check `refreshInterval` is set and > 0
3. Inspect network tab for fetch failures
4. Check `enablePerformanceTracking` for error details

### Styling inconsistencies

1. Use `Tailwind` tokens only (no inline styles)
2. Import components from `components/ui/*`
3. Use `CardContent`, `CardHeader` for consistent padding
4. Verify responsive classes (`md:`, `lg:`)

## References

- **WidgetRegistry:** `components/app/widgets/WidgetRegistry.tsx`
- **useWidgetData hook:** `hooks/useWidgetData.ts`
- **Telemetry:** `utils/telemetryInstrumentation.ts`
- **Shadcn components:** `components/ui/*`
- **Dashboard:** `components/app/Dashboard.tsx`
