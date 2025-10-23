# CODEX PROMPT: Implement Dashboard Tracking Widgets (Issue #36)

**Context:** CMSNext is a local-first case management system with an established widget framework. You need to implement 6 new dashboard widgets following existing patterns.

**Reference Documentation:**

- Implementation plan: `docs/development/dashboard-widgets-implementation-plan.md`
- Widget development guide: `docs/development/widget-development.md`
- Existing widget examples: `components/app/widgets/CasePriorityWidget.tsx`, `ActivityTimelineWidget.tsx`

---

## Your Task

Implement the following 6 dashboard widgets per the detailed specifications in the implementation plan:

1. **Alerts Cleared per Day Widget** - 7-day trend of resolved alerts
2. **Cases Processed per Day Widget** - 7-day trend of completed cases
3. **Total Cases by Status Widget** - Pie/bar chart of current status distribution
4. **Total Alerts by Description Widget** - Top 10 alert types by frequency
5. **Avg. Case Processing Time Widget** - Metric showing average days to resolution
6. **Avg. Alert Age Widget** - Metric showing average age of open alerts

---

## Implementation Requirements

### Architecture Constraints (CRITICAL)

✅ **Follow the established widget pattern:**

- Use `useWidgetData` hook for data fetching
- Include loading, error, and empty states
- Add freshness indicator ("Last checked: X minutes ago")
- Use shadcn `Card`, `Badge`, and other UI components
- Export default for lazy loading

✅ **Data access:**

- Alerts: Pass `alerts.allAlerts` (type: `AlertWithMatch[]`)
- Cases: Pass `cases` (type: `CaseDisplay[]`)
- Activity: Pass `activityLogState.activityLog` (type: `CaseActivityEntry[]`)

✅ **Testing:**

- Unit tests for data calculation functions
- Accessibility tests with `jest-axe`
- Integration test in `Dashboard.widgets.test.tsx`

❌ **Do NOT:**

- Introduce new state management patterns
- Use network APIs or external data sources
- Add new dependencies without discussion
- Bypass the widget registry framework

---

## Step-by-Step Instructions

### Phase 1: Create Widget Components

For each widget:

1. **Create file:** `components/app/widgets/[WidgetName].tsx`
2. **Copy structure** from `CasePriorityWidget.tsx` as template
3. **Implement calculation function** (see specs in implementation plan)
4. **Build UI** with shadcn components
5. **Add loading/error/empty states**
6. **Export default** for lazy loading

**Development order:** Start with simplest (Avg. Alert Age) and progress to most complex (Avg. Case Processing Time).

### Phase 2: Create Utility Module

**File:** `utils/widgetDataProcessors.ts`

Extract calculation functions for reusability and testing:

```typescript
export function calculateAlertsClearedPerDay(
  alerts: AlertWithMatch[]
): DailyAlertStats[] {
  // Filter resolved alerts from last 7 days
  // Group by resolvedAt date
  // Return array of { date, clearedCount }
}

export function calculateCasesProcessedPerDay(
  activityLog: CaseActivityEntry[]
): DailyCaseStats[] {
  // Filter status-change entries with completion statuses
  // Group by date
  // Return array of { date, processedCount }
}

// ... etc for each widget
```

### Phase 3: Register Widgets

**File:** `components/app/Dashboard.tsx`

Add to the `widgets` array:

```typescript
const widgets = useMemo<RegisteredWidget[]>(() => {
  return [
    // ... existing widgets (CasePriorityWidget, ActivityTimelineWidget) ...
    {
      metadata: {
        id: "alerts-cleared-per-day",
        title: "Alerts Cleared/Day",
        description: "Alert resolution trends over the last 7 days",
        priority: 1,
        refreshInterval: 5 * 60 * 1000, // 5 minutes
      },
      component: AlertsClearedPerDayWidget,
      props: { alerts: alerts.allAlerts },
    },
    {
      metadata: {
        id: "cases-processed-per-day",
        title: "Cases Processed/Day",
        description: "Daily case processing over the last 7 days",
        priority: 1,
        refreshInterval: 5 * 60 * 1000,
      },
      component: CasesProcessedPerDayWidget,
      props: { activityLog: activityLogState.activityLog },
    },
    // ... repeat for all 6 widgets (see implementation plan for full specs)
  ];
}, [cases, alerts, activityLogState]);
```

### Phase 4: Testing

1. **Unit tests:** `utils/__tests__/widgetDataProcessors.test.ts`

   - Test each calculation function
   - Cover edge cases (empty data, single day, etc.)
   - Verify date handling and grouping logic

2. **Accessibility tests:** Add to each widget's test file

   ```typescript
   import { axe } from "jest-axe";

   it("has no accessibility violations", async () => {
     const { container } = render(<Widget data={mockData} />);
     const results = await axe(container);
     expect(results).toHaveNoViolations();
   });
   ```

3. **Integration test:** `components/app/__tests__/Dashboard.widgets.test.tsx`
   - Verify all 8 widgets render (2 existing + 6 new)
   - Test data updates trigger widget re-renders
   - Verify lazy loading working

### Phase 5: Polish

1. **Performance check:**

   - Run `npm run dev` and load dashboard
   - Open React DevTools Profiler
   - Record interaction, verify widgets render < 500ms total
   - If slow, add `useMemo`/`useCallback` optimizations

2. **Bundle analysis:**

   - Run `npm run build`
   - Verify widgets in separate chunks (lazy loading working)
   - Total increase should be < 100KB

3. **Documentation:**
   - Update `docs/development/widget-development.md` with widget examples
   - Update feature catalogue ratings (Dashboard: 78 → 85)

---

## Key Data Structures

### Alert Data

```typescript
interface AlertWithMatch {
  id: string;
  alertDate: string;
  createdAt: string;
  description?: string;
  status?: "new" | "in-progress" | "acknowledged" | "snoozed" | "resolved";
  resolvedAt?: string | null;
  // ... other fields
}
```

### Case Data

```typescript
interface CaseDisplay {
  caseRecord?: {
    id: string;
    status: string; // 'Pending', 'Approved', 'Denied', 'Closed', etc.
    createdDate: string;
    // ... other fields
  };
  // ... other fields
}
```

### Activity Log Data

```typescript
interface CaseActivityEntry {
  id: string;
  timestamp: string; // ISO date
  type: "status-change" | "note-added";
  caseId: string;
  payload: {
    toStatus?: string; // for status-change
    fromStatus?: string | null;
    // ... other fields
  };
}
```

---

## Completion Statuses (for Cases Processed calculation)

Consider a case "processed" when its status becomes one of:

- `'Approved'`
- `'Denied'`
- `'Closed'`
- `'Spenddown'`

Filter activity log for `type === 'status-change'` where `payload.toStatus` matches one of these.

---

## Date Handling Utilities

You may need these helper functions:

```typescript
// Get last 7 days as array of date strings
function getLast7Days(): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split("T")[0]); // YYYY-MM-DD
  }
  return dates;
}

// Get date string from ISO timestamp
function getDateFromISO(isoString: string): string {
  return isoString.split("T")[0]; // YYYY-MM-DD
}

// Calculate days between dates
function daysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
```

---

## Visualization Approach

**Start simple, iterate later:**

1. **For trend charts (cleared/day, processed/day):**

   - Use CSS-based bar chart (flexbox with height: percentage)
   - Or simple table with bars
   - Defer to charting library (recharts) in future if needed

2. **For status/description breakdowns:**

   - Horizontal bar chart with CSS
   - Show percentage bars with labels
   - Top 10 items, collapsible "Show All" for full list

3. **For metrics (avg time, avg age):**
   - Large number display
   - Trend indicator (up/down arrow)
   - Supporting details below

**Example CSS bar chart:**

```tsx
<div className="space-y-2">
  {data.map((item) => (
    <div key={item.label} className="flex items-center gap-2">
      <span className="text-sm w-24">{item.label}</span>
      <div className="flex-1 bg-muted rounded-full h-6">
        <div
          className="bg-primary h-full rounded-full flex items-center px-2"
          style={{ width: `${item.percentage}%` }}
        >
          <span className="text-xs text-primary-foreground">{item.count}</span>
        </div>
      </div>
    </div>
  ))}
</div>
```

---

## Success Criteria Checklist

- [ ] All 6 widgets implemented and rendering
- [ ] Dashboard shows 8 total widgets (2 existing + 6 new)
- [ ] Loading states appear during data fetching
- [ ] Empty states show when no data available
- [ ] Error states handle calculation failures
- [ ] Freshness indicators update correctly
- [ ] All calculation unit tests passing
- [ ] All accessibility tests passing (jest-axe)
- [ ] Integration test confirms all widgets render
- [ ] Performance: Dashboard loads in < 500ms
- [ ] Bundle: Widgets lazy load in separate chunks
- [ ] No console errors or warnings

---

## Example Widget Template

Use this as your starting point:

```typescript
import { useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWidgetData } from "@/hooks/useWidgetData";
import type { WidgetMetadata } from "./WidgetRegistry";
import type { AlertWithMatch } from "@/utils/alertsData";

interface YourWidgetProps {
  alerts: AlertWithMatch[]; // or cases, or activityLog
  metadata?: WidgetMetadata;
}

export function YourWidget({ alerts = [], metadata }: YourWidgetProps) {
  const fetchData = useCallback(async () => {
    // Your calculation logic here
    return processData(alerts);
  }, [alerts]);

  const { data, loading, error, freshness } = useWidgetData(fetchData, {
    refreshInterval: metadata?.refreshInterval ?? 5 * 60 * 1000,
    enablePerformanceTracking: true,
  });

  const freshnessLabel = useMemo(() => {
    if (!freshness.lastUpdatedAt) return "Never updated";
    if (freshness.minutesAgo === 0) return "Just now";
    if (freshness.minutesAgo === 1) return "1 minute ago";
    if (freshness.minutesAgo && freshness.minutesAgo < 60) {
      return `${freshness.minutesAgo} minutes ago`;
    }
    const hoursAgo = Math.floor((freshness.minutesAgo || 0) / 60);
    return hoursAgo === 1 ? "1 hour ago" : `${hoursAgo} hours ago`;
  }, [freshness]);

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Widget Title</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Widget Title</CardTitle>
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
          <Badge variant="outline">{data?.count ?? 0}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Your visualization here */}

        {!data && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center pt-3 border-t mt-3">
          Last checked: {freshnessLabel}
        </div>
      </CardContent>
    </Card>
  );
}

export default YourWidget;
```

---

## Questions or Blockers?

If you encounter any issues:

1. **Data structure unclear?** Check the type definitions in `types/case.ts`, `types/activityLog.ts`
2. **Widget framework confusing?** Reference `widget-development.md` guide
3. **Test setup issues?** See existing tests in `components/__tests__/` and `__tests__/`
4. **Performance concerns?** Use React DevTools Profiler to identify bottlenecks

**Ready to start? Begin with Phase 1, Widget #1 (Avg. Alert Age Widget) - it's the simplest!**

Good luck! 🚀
