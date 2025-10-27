# Feature Flags Usage Guide

Feature flags provide a lightweight mechanism for gating functionality without shipping new builds. Flags are centralised in `utils/featureFlags.ts` and stored at runtime inside `ApplicationState`.

## Basic Usage

### Checking a Flag

```typescript
import { useAppState } from "@/hooks/useAppState";

const { isFeatureEnabled } = useAppState();

if (isFeatureEnabled("dashboard.widgets.casePriority")) {
  // Render flag-guarded UI
}
```

### Toggling a Flag (Development / QA)

```typescript
import { useAppState } from "@/hooks/useAppState";

const { setFeatureFlags } = useAppState();

// Enable a feature
setFeatureFlags({ "reports.advancedFilters": true });

// Disable a feature
setFeatureFlags({ "dashboard.widgets.avgAlertAge": false });
```

## Testing with Flags

### Component Testing

```typescript
import ApplicationState from "@/application/ApplicationState";

ApplicationState.resetInstance();
const appState = ApplicationState.getInstance();
appState.setFeatureFlags({ "dashboard.widgets.casePriority": false });

// Render component and assert that the widget is hidden
```

### Integration Testing

```typescript
import ApplicationState from "@/application/ApplicationState";

const appState = ApplicationState.getInstance();
appState.setFeatureFlags({ "dashboard.widgets.avgAlertAge": false });

// Render the dashboard and expect the widget to be absent
```

## Adding New Flags

1. **Define the flag** in `utils/featureFlags.ts`:
   ```typescript
   export interface FeatureFlags {
     // ...existing flags
     "dashboard.widgets.newInsight": boolean;
   }
   ```
2. **Set the default** by updating `DEFAULT_FLAGS`:
   ```typescript
   export const DEFAULT_FLAGS = Object.freeze({
     // ...existing defaults
     "dashboard.widgets.newInsight": false,
   });
   ```
3. **Use the flag** where appropriate:

   ```typescript
   const { isFeatureEnabled } = useAppState();

   if (isFeatureEnabled("dashboard.widgets.newInsight")) {
     return <NewInsightWidget />;
   }
   ```

4. **Document and test** both enabled and disabled states.

## Current Flags

| Flag                                    | Default | Description                                 |
| --------------------------------------- | ------- | ------------------------------------------- |
| `dashboard.widgets.casePriority`        | `true`  | Case Priority widget visibility             |
| `dashboard.widgets.alertsCleared`       | `true`  | Alerts Cleared/Day widget visibility        |
| `dashboard.widgets.casesProcessed`      | `true`  | Cases Processed/Day widget visibility       |
| `dashboard.widgets.activityTimeline`    | `true`  | Activity Timeline widget visibility         |
| `dashboard.widgets.casesByStatus`       | `true`  | Total Cases by Status widget visibility     |
| `dashboard.widgets.alertsByDescription` | `true`  | Alerts by Description widget visibility     |
| `dashboard.widgets.avgAlertAge`         | `true`  | Avg. Alert Age widget visibility            |
| `dashboard.widgets.avgCaseProcessing`   | `true`  | Avg. Case Processing Time widget visibility |
| `reports.advancedFilters`               | `false` | Placeholder for advanced report filters     |
| `cases.bulkActions`                     | `false` | Placeholder for case bulk action tooling    |

## Best Practices

1. **Keep defaults stable** – ship new features disabled until they are production ready.
2. **Name flags clearly** using `<area>.<feature>.<subfeature>`.
3. **Avoid mutation** – use `setFeatureFlags` for updates instead of editing objects directly.
4. **Test both states** whenever a flag guards behaviour.
5. **Retire old flags** once a feature is fully released to keep the catalogue lean.
