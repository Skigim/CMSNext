# Dashboard Widgets Implementation Plan (Issue #36)

**Created:** October 22, 2025  
**Status:** Ready for Implementation  
**Estimated Effort:** 8-12 hours  
**Priority:** Sprint 2-3 (Next 2-4 Weeks)

## Overview

Implement 6 new dashboard widgets to provide comprehensive case management insights and tracking metrics. All widgets will follow the established widget framework patterns (lazy loading, error boundaries, freshness tracking, telemetry).

---

## Widget Specifications

### 1. Alerts Cleared per Day Widget

**Purpose:** Track alert resolution velocity over the last 7 days

**Data Source:** `AlertsIndex.allAlerts` filtered by `status === 'resolved'` and `resolvedAt` within last 7 days

**Display:**

- Line or bar chart showing daily cleared alert counts
- Total alerts cleared in period
- Trend indicator (up/down compared to previous week)
- Empty state: "No alerts cleared in the last 7 days"

**Key Calculations:**

```typescript
interface DailyAlertStats {
  date: string; // YYYY-MM-DD
  clearedCount: number;
}

// Group by resolvedAt date, count per day
// Filter: alert.status === 'resolved' && alert.resolvedAt within last 7 days
```

**Priority:** 1 (Critical metric)  
**Refresh Interval:** 5 minutes

---

### 2. Cases Processed per Day Widget

**Purpose:** Visualize case completion velocity over the last 7 days

**Data Source:** `CaseActivityLogState.activityLog` filtered by `type === 'status-change'` where `toStatus` indicates completion

**Display:**

- Line or bar chart showing daily processed case counts
- Total cases processed in period
- Trend indicator
- Empty state: "No cases processed in the last 7 days"

**Key Calculations:**

```typescript
interface DailyCaseStats {
  date: string; // YYYY-MM-DD
  processedCount: number;
}

// Status values indicating "processed":
// - 'Approved', 'Denied', 'Closed', 'Spenddown' (completion statuses)
// Filter activity log by type === 'status-change'
// Count transitions TO completion statuses by date
```

**Priority:** 1 (Critical metric)  
**Refresh Interval:** 5 minutes

---

### 3. Total Cases by Status Widget

**Purpose:** Current snapshot of case distribution across all statuses

**Data Source:** `CaseDisplay[]` grouped by `caseRecord.status`

**Display:**

- Pie or bar chart showing status breakdown
- Legend with counts and percentages
- Total case count
- Color-coded by status (align with existing status badge colors)

**Key Calculations:**

```typescript
interface StatusBreakdown {
  status: string; // 'Pending', 'Approved', 'Denied', etc.
  count: number;
  percentage: number;
  color: string; // from theme
}

// Group cases by caseRecord.status
// Calculate percentage: (count / totalCases) * 100
```

**Priority:** 2 (Important overview)  
**Refresh Interval:** 5 minutes

---

### 4. Total Alerts by Description Widget

**Purpose:** Identify common alert patterns to prioritize process improvements

**Data Source:** `AlertsIndex.allAlerts` grouped by `description` field

**Display:**

- Horizontal bar chart showing top 10 alert descriptions by count
- Total unique alert types
- "Show All" expansion option for full list
- Empty state: "No alerts to analyze"

**Key Calculations:**

```typescript
interface AlertDescriptionStats {
  description: string;
  count: number;
  percentage: number;
  openCount: number; // not resolved
  resolvedCount: number;
}

// Group by alert.description
// Sort by count descending
// Show top 10, provide expansion for full list
```

**Priority:** 2 (Important insight)  
**Refresh Interval:** 5 minutes

---

### 5. Avg. Case Processing Time Widget

**Purpose:** Track efficiency metric for case resolution timelines

**Data Source:** `CaseActivityLogState.activityLog` - calculate time between case creation and first completion status

**Display:**

- Large metric display (e.g., "14.5 days")
- Trend indicator (compared to previous period)
- Breakdown by status type (Approved: X days, Denied: Y days)
- Sample size ("Based on N cases")

**Key Calculations:**

```typescript
interface ProcessingTimeStats {
  averageDays: number;
  medianDays: number;
  sampleSize: number;
  byStatus: Record<string, number>; // status -> avg days
}

// For each completed case:
// - Find first activity entry (creation timestamp from caseRecord.createdDate)
// - Find completion status-change entry
// - Calculate days between
// - Average across all completed cases
```

**Priority:** 3 (Insight metric)  
**Refresh Interval:** 10 minutes (less critical for real-time)

---

### 6. Avg. Alert Age Widget

**Purpose:** Monitor unresolved alert backlog health

**Data Source:** `AlertsIndex.allAlerts` filtered by open alerts (not resolved)

**Display:**

- Large metric display (e.g., "8.2 days")
- Oldest alert age
- Count of alerts > 30 days old
- Empty state: "No open alerts"

**Key Calculations:**

```typescript
interface AlertAgeStats {
  averageDays: number;
  medianDays: number;
  oldestDays: number;
  openCount: number;
  over30Days: number;
}

// For each open alert (status !== 'resolved' || !resolvedAt):
// - Calculate days since alertDate or createdAt
// - Average across all open alerts
```

**Priority:** 3 (Insight metric)  
**Refresh Interval:** 5 minutes

---

## Implementation Steps

### Phase 1: Setup & Infrastructure (1 hour)

1. **Create widget component files:**

   - `components/app/widgets/AlertsClearedPerDayWidget.tsx`
   - `components/app/widgets/CasesProcessedPerDayWidget.tsx`
   - `components/app/widgets/CasesByStatusWidget.tsx`
   - `components/app/widgets/AlertsByDescriptionWidget.tsx`
   - `components/app/widgets/AvgCaseProcessingTimeWidget.tsx`
   - `components/app/widgets/AvgAlertAgeWidget.tsx`

2. **Create utility modules:**
   - `utils/widgetDataProcessors.ts` - Shared calculation functions
   - `utils/chartHelpers.ts` - Chart formatting utilities (if needed)

### Phase 2: Widget Implementation (4-6 hours)

For each widget:

1. **Copy template structure** from `CasePriorityWidget.tsx`
2. **Implement data fetcher** using `useWidgetData` hook
3. **Add calculation logic** per specifications above
4. **Build UI layout** with shadcn Card/Badge components
5. **Add loading/error/empty states**
6. **Add freshness indicator**
7. **Test with sample data**

**Widget Development Order:**

1. Avg. Alert Age (simplest - single metric)
2. Total Cases by Status (existing patterns)
3. Total Alerts by Description (grouping logic)
4. Alerts Cleared per Day (time-series grouping)
5. Cases Processed per Day (activity log filtering)
6. Avg. Case Processing Time (most complex - multi-step calculation)

### Phase 3: Dashboard Integration (1 hour)

1. **Import all widgets** in `Dashboard.tsx`
2. **Register in widgets array** with metadata:

   ```typescript
   const widgets = useMemo<RegisteredWidget[]>(() => {
     return [
       // ... existing widgets ...
       {
         metadata: {
           id: "alerts-cleared-per-day",
           title: "Alerts Cleared/Day",
           description: "Alert resolution trends over the last 7 days",
           priority: 1,
           refreshInterval: 5 * 60 * 1000,
         },
         component: AlertsClearedPerDayWidget,
         props: { alerts: alerts.allAlerts },
       },
       // ... repeat for all 6 widgets ...
     ];
   }, [cases, alerts, activityLogState]);
   ```

3. **Verify lazy loading** - confirm each widget has `export default`
4. **Test grid layout** with all widgets visible

### Phase 4: Testing & Polish (2-3 hours)

1. **Unit tests** for data calculation functions in `widgetDataProcessors.test.ts`
2. **Accessibility testing** with jest-axe:
   - Color contrast verification
   - ARIA labels for charts
   - Keyboard navigation
3. **Performance profiling:**
   - React Profiler with all 8 widgets (2 existing + 6 new)
   - Monitor render times and re-render frequency
   - Optimize with `useMemo`/`useCallback` if needed
4. **Bundle size check:**
   - Run build and analyze chunks
   - Verify lazy loading working (widgets in separate chunks)
5. **Empty state testing:**
   - Test each widget with empty data arrays
   - Verify loading states appear correctly
6. **Documentation:**
   - Add widget examples to `widget-development.md`
   - Update feature catalogue ratings

---

## Data Access Patterns

### Accessing Alerts Data

```typescript
// In Dashboard.tsx, alerts prop is AlertsIndex
interface AlertsIndex {
  allAlerts: AlertWithMatch[];
  alertsByCaseId: Map<string, AlertWithMatch[]>;
  summary: AlertsSummary;
}

// Pass to widgets
props: {
  alerts: alerts.allAlerts;
}

// In widget, filter for resolved
const resolvedAlerts = alerts.filter(
  (a) => a.status === "resolved" && a.resolvedAt
);

// In widget, filter for open
const openAlerts = alerts.filter(
  (a) => a.status !== "resolved" || !a.resolvedAt
);
```

### Accessing Case Data

```typescript
// In Dashboard.tsx, cases prop is CaseDisplay[]
// Pass directly to widgets
props: {
  cases;
}

// In widget, access status
cases.forEach((c) => {
  const status = c.caseRecord?.status || "Unknown";
  const createdDate = c.caseRecord?.createdDate;
});
```

### Accessing Activity Log Data

```typescript
// In Dashboard.tsx, activityLogState is CaseActivityLogState
// Pass entire state or specific properties
props: {
  activityLog: activityLogState.activityLog;
}

// In widget, filter by type
const statusChanges = activityLog.filter(
  (entry) => entry.type === "status-change"
);

// Access payload
statusChanges.forEach((change) => {
  const toStatus = change.payload.toStatus;
  const timestamp = change.timestamp;
});
```

---

## Testing Strategy

### Unit Tests

**File:** `components/app/widgets/__tests__/widgetDataProcessors.test.ts`

```typescript
describe("Widget Data Processors", () => {
  describe("calculateAlertsClearedPerDay", () => {
    it("groups resolved alerts by day", () => {
      // Test with sample alerts spanning 7 days
    });

    it("excludes open alerts", () => {
      // Verify only resolved alerts counted
    });

    it("handles empty data", () => {
      // Returns empty array for no alerts
    });
  });

  // ... repeat for each calculation function
});
```

### Accessibility Tests

Add to each widget test file:

```typescript
import { axe } from "jest-axe";

it("has no accessibility violations", async () => {
  const { container } = render(<YourWidget data={mockData} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Integration Tests

**File:** `components/app/__tests__/Dashboard.widgets.test.tsx`

```typescript
describe('Dashboard Widgets Integration', () => {
  it('renders all 8 widgets', async () => {
    render(<Dashboard cases={mockCases} alerts={mockAlerts} ... />);

    await waitFor(() => {
      expect(screen.getByText('Case Priority')).toBeInTheDocument();
      expect(screen.getByText('Alerts Cleared/Day')).toBeInTheDocument();
      // ... verify all 8 widgets
    });
  });

  it('updates widgets when data changes', async () => {
    const { rerender } = render(<Dashboard ... />);

    // Change data and verify widget updates
    rerender(<Dashboard cases={updatedCases} ... />);

    await waitFor(() => {
      expect(screen.getByText(/new count/i)).toBeInTheDocument();
    });
  });
});
```

---

## Performance Considerations

### Bundle Size Targets

- Each widget: < 10KB gzipped
- Total widget code: < 60KB gzipped
- Lazy loading ensures widgets load on-demand

### Render Optimization

1. **Memoize expensive calculations:**

   ```typescript
   const stats = useMemo(() => calculateComplexStats(data), [data]);
   ```

2. **Use `useCallback` for fetchers:**

   ```typescript
   const fetchData = useCallback(async () => {
     return processData(rawData);
   }, [rawData]);
   ```

3. **Limit re-renders:**
   - Widget registry already implements per-widget error boundaries
   - Each widget re-renders independently
   - Use `React.memo` for chart sub-components if needed

### Data Refresh Strategy

- High-priority widgets (metrics): 5-minute refresh
- Low-priority widgets (trends): 10-minute refresh
- User can manually refresh entire dashboard (future enhancement)

---

## Risks & Mitigations

| Risk                    | Impact                    | Mitigation                                                            |
| ----------------------- | ------------------------- | --------------------------------------------------------------------- |
| Bundle size growth      | Performance degradation   | Lazy loading per widget, tree-shaking analysis                        |
| Calculation performance | UI sluggishness           | Optimize algorithms, use Web Workers for heavy processing (future)    |
| Empty state handling    | Poor UX                   | Comprehensive empty state testing, helpful messages                   |
| Chart library selection | Dependencies, bundle size | Start with CSS-based visualizations, evaluate recharts/visx if needed |
| Activity log data gaps  | Inaccurate metrics        | Document limitations, handle missing data gracefully                  |

---

## Dependencies

### Required

- ✅ Widget framework (`WidgetRegistry`, `useWidgetData`)
- ✅ Shadcn UI components (`Card`, `Badge`, etc.)
- ✅ Activity log infrastructure
- ✅ Alerts index with resolved status tracking

### Optional

- Chart library (recharts, visx, chart.js) - evaluate during implementation
- Alternative: CSS-based bar charts for simple visualizations

---

## Success Criteria

- ✅ All 6 widgets implemented and rendering correctly
- ✅ Widgets respond to data updates in real-time
- ✅ Loading, error, and empty states functional
- ✅ Accessibility tests passing (jest-axe + manual screen reader)
- ✅ Performance: Dashboard with 8 widgets renders in < 500ms
- ✅ Bundle: Widgets load lazily, total increase < 100KB
- ✅ Tests: 80%+ code coverage for calculation functions
- ✅ Documentation: Widget examples added to guide

---

## Future Enhancements

**Post-MVP (not in scope for this issue):**

- Export widget data to CSV
- Configurable widget refresh intervals
- User preference for visible widgets
- Historical trend comparisons (30-day, 90-day)
- Drill-down from widget to filtered case list
- Widget sharing/embedding
- Custom date range selection

---

## Implementation Checklist

### Phase 1: Setup

- [ ] Create 6 widget component files
- [ ] Create `widgetDataProcessors.ts` utility module
- [ ] Set up test files structure

### Phase 2: Widget Development

- [ ] Avg. Alert Age Widget
- [ ] Total Cases by Status Widget
- [ ] Total Alerts by Description Widget
- [ ] Alerts Cleared per Day Widget
- [ ] Cases Processed per Day Widget
- [ ] Avg. Case Processing Time Widget

### Phase 3: Integration

- [ ] Register all widgets in Dashboard.tsx
- [ ] Verify lazy loading configuration
- [ ] Test grid layout with 8 widgets

### Phase 4: Testing & Polish

- [ ] Unit tests for data processors
- [ ] Accessibility tests for each widget
- [ ] Performance profiling
- [ ] Bundle size analysis
- [ ] Empty state testing
- [ ] Documentation updates

### Phase 5: Delivery

- [ ] All tests passing
- [ ] PR description with screenshots
- [ ] Feature catalogue ratings updated
- [ ] Roadmap status updated to "Complete"

---

## Notes

- Follow existing widget patterns from `CasePriorityWidget` and `ActivityTimelineWidget`
- Use telemetry instrumentation for performance tracking
- Document any assumptions about data availability
- Keep widgets simple and focused - avoid feature creep
- Defer advanced charting until after MVP proves value
