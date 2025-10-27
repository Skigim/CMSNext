# Phase 1 Days 5–7: Feature Flags & ApplicationState Integration

**Objective:** Implement feature flag infrastructure with ApplicationState integration, enabling controlled rollout of widget visibility and future feature toggles.

---

## Context & Current State

### Architecture Foundation

- **Storage Layer:** Filesystem-only via `FileStorageAPI` → `AutosaveFileService` → File System Access API
- **State Management:** `ApplicationState` class provides centralized domain state with immutable updates
- **Testing:** Full suite passing (281 tests), including dashboard widget integration tests
- **Shadcn Migration:** 100% complete (PR #28 merged Oct 15, 2025)

### Recent Completions

- ✅ Dashboard widget registry with lazy loading
- ✅ Widget data processing & performance tracking
- ✅ Integration tests for widget data updates
- ✅ Suspense boundary handling in tests

### Key Files

- `application/ApplicationState.ts` - Domain state container
- `utils/featureFlags.ts` - Feature flag utilities (basic structure exists)
- `hooks/useAppState.ts` - ApplicationState React integration
- `components/app/Dashboard.tsx` - Widget rendering with WidgetRegistry
- `components/app/widgets/WidgetRegistry.tsx` - Lazy widget framework

---

## Phase 1 Days 5–7 Deliverables

### Day 5: Feature Flag Infrastructure

#### 1. Enhance `utils/featureFlags.ts`

**Current State:** Basic `isFeatureEnabled` utility exists  
**Goal:** Production-ready feature flag system with type safety

```typescript
// Expected structure
export interface FeatureFlags {
  // Widget visibility flags
  "dashboard.widgets.casePriority": boolean;
  "dashboard.widgets.alertsCleared": boolean;
  "dashboard.widgets.casesProcessed": boolean;
  "dashboard.widgets.activityTimeline": boolean;
  "dashboard.widgets.casesByStatus": boolean;
  "dashboard.widgets.alertsByDescription": boolean;
  "dashboard.widgets.avgAlertAge": boolean;
  "dashboard.widgets.avgCaseProcessing": boolean;

  // Future expansion placeholders
  "reports.advancedFilters": boolean;
  "cases.bulkActions": boolean;
}

export type FeatureFlagKey = keyof FeatureFlags;

export const DEFAULT_FLAGS: FeatureFlags = {
  // All widgets enabled by default for Phase 1
  "dashboard.widgets.casePriority": true,
  "dashboard.widgets.alertsCleared": true,
  "dashboard.widgets.casesProcessed": true,
  "dashboard.widgets.activityTimeline": true,
  "dashboard.widgets.casesByStatus": true,
  "dashboard.widgets.alertsByDescription": true,
  "dashboard.widgets.avgAlertAge": true,
  "dashboard.widgets.avgCaseProcessing": true,

  // Future features disabled
  "reports.advancedFilters": false,
  "cases.bulkActions": false,
};

// Enhanced API
export function isFeatureEnabled(
  flag: FeatureFlagKey,
  flags?: Partial<FeatureFlags>
): boolean;

export function getEnabledFeatures(
  flags?: Partial<FeatureFlags>
): FeatureFlagKey[];

export function createFeatureFlagContext(
  overrides?: Partial<FeatureFlags>
): FeatureFlags;
```

**Requirements:**

- Type-safe flag keys using string literal union
- Immutable default configuration
- Runtime flag override support (for testing)
- Clear naming convention: `<domain>.<feature>.<subfeature>`
- JSDoc documentation for each flag

**Testing:**

- Unit tests in `__tests__/utils/featureFlags.test.ts`
- Test default flag values
- Test override behavior
- Test type inference

---

#### 2. Integrate Flags into ApplicationState

**File:** `application/ApplicationState.ts`

**Changes:**

```typescript
import type { FeatureFlags } from "@/utils/featureFlags";
import { DEFAULT_FLAGS } from "@/utils/featureFlags";

export interface ApplicationStateData {
  currentView: ViewType;
  selectedCaseId: string | null;
  caseListPreferences: CaseListPreferences;
  navigationLocked: boolean;
  featureFlags: FeatureFlags; // ← Add this
}

export class ApplicationState {
  private constructor(private data: ApplicationStateData) {}

  static create(initial?: Partial<ApplicationStateData>): ApplicationState {
    return new ApplicationState({
      currentView: initial?.currentView ?? "dashboard",
      selectedCaseId: initial?.selectedCaseId ?? null,
      caseListPreferences: initial?.caseListPreferences ?? DEFAULT_PREFERENCES,
      navigationLocked: initial?.navigationLocked ?? false,
      featureFlags: initial?.featureFlags ?? DEFAULT_FLAGS, // ← Add this
    });
  }

  // Accessor
  getFeatureFlags(): FeatureFlags {
    return { ...this.data.featureFlags };
  }

  isFeatureEnabled(flag: FeatureFlagKey): boolean {
    return this.data.featureFlags[flag] ?? false;
  }

  // Updater
  setFeatureFlags(flags: Partial<FeatureFlags>): ApplicationState {
    return new ApplicationState({
      ...this.data,
      featureFlags: { ...this.data.featureFlags, ...flags },
    });
  }
}
```

**Testing:**

- Add tests to `__tests__/application/ApplicationState.test.ts`
- Verify immutable updates
- Test flag accessors
- Test partial flag updates

---

#### 3. Update `useAppState` Hook

**File:** `hooks/useAppState.ts`

**Add Feature Flag Helpers:**

```typescript
export function useAppState() {
  // ... existing code ...

  const featureFlags = useMemo(() => appState.getFeatureFlags(), [appState]);

  const isFeatureEnabled = useCallback(
    (flag: FeatureFlagKey) => appState.isFeatureEnabled(flag),
    [appState]
  );

  const setFeatureFlags = useCallback(
    (flags: Partial<FeatureFlags>) => {
      setAppState((prev) => prev.setFeatureFlags(flags));
    },
    [setAppState]
  );

  return {
    // ... existing exports ...
    featureFlags,
    isFeatureEnabled,
    setFeatureFlags,
  };
}
```

**Testing:**

- Update `__tests__/hooks/useAppState.test.ts`
- Test hook returns correct flag state
- Test flag updates trigger re-renders
- Test memoization

---

### Day 6: Dashboard Widget Filtering

#### 1. Add Widget Metadata Enhancement

**File:** `components/app/widgets/WidgetRegistry.tsx`

**Update WidgetMetadata:**

```typescript
export interface WidgetMetadata {
  id: string;
  title: string;
  description?: string;
  refreshInterval?: number;
  priority?: number;
  featureFlag?: FeatureFlagKey; // ← Add this
}
```

**Filter Logic:**

```typescript
export function WidgetRegistry({
  widgets,
  gridClassName,
  loadingFallback,
  onError,
  enabledFlags, // ← New prop
}: WidgetRegistryProps) {
  // Filter widgets by feature flags
  const visibleWidgets = useMemo(() => {
    return sortedWidgets.filter((widget) => {
      if (!widget.metadata.featureFlag) return true;
      return enabledFlags?.[widget.metadata.featureFlag] ?? true;
    });
  }, [sortedWidgets, enabledFlags]);

  return (
    <div className={gridClassName}>
      {visibleWidgets.map((widget) => {
        // ... existing render logic ...
      })}
    </div>
  );
}
```

---

#### 2. Update Dashboard Component

**File:** `components/app/Dashboard.tsx`

**Connect to ApplicationState:**

```typescript
import { useAppState } from '@/hooks/useAppState';

export function Dashboard({ cases, alerts, activityLogState, ... }: DashboardProps) {
  const { featureFlags } = useAppState();

  const widgets = useMemo<RegisteredWidget[]>(() => {
    return [
      {
        metadata: {
          id: 'case-priority',
          title: 'Case Priority',
          priority: 1,
          featureFlag: 'dashboard.widgets.casePriority',  // ← Add flags
        },
        component: CasePriorityWidgetLazy,
        props: { cases },
      },
      {
        metadata: {
          id: 'avg-alert-age',
          title: 'Avg. Alert Age',
          priority: 7,
          featureFlag: 'dashboard.widgets.avgAlertAge',  // ← Add flags
        },
        component: AvgAlertAgeWidgetLazy,
        props: { alerts: allAlerts },
      },
      // ... all 8 widgets with flags ...
    ];
  }, [cases, allAlerts, activityEntries, activityLogState]);

  return (
    <div className="space-y-6">
      {/* ... header ... */}

      {widgets.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Insights</h2>
          <WidgetRegistry
            widgets={widgets}
            gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            enabledFlags={featureFlags}  // ← Pass flags
          />
        </div>
      )}

      {/* ... rest of dashboard ... */}
    </div>
  );
}
```

**Testing:**

- Update `__tests__/components/app/Dashboard.widgets.test.tsx`
- Test all widgets render when flags enabled
- Test widgets hidden when flags disabled
- Test partial flag configurations

---

### Day 7: Integration Testing & Documentation

#### 1. Comprehensive Integration Tests

**File:** `__tests__/integration/featureFlagFlow.test.tsx` (NEW)

```typescript
describe("Feature flag integration", () => {
  it("shows all widgets when all flags enabled", async () => {
    const appState = ApplicationState.create({
      featureFlags: { ...DEFAULT_FLAGS },
    });

    // Render Dashboard with all flags on
    // Assert 8 widgets visible
  });

  it("hides widgets when flags disabled", async () => {
    const appState = ApplicationState.create({
      featureFlags: {
        ...DEFAULT_FLAGS,
        "dashboard.widgets.avgAlertAge": false,
        "dashboard.widgets.casePriority": false,
      },
    });

    // Render Dashboard
    // Assert only 6 widgets visible
    // Assert avgAlertAge and casePriority not in DOM
  });

  it("dynamically updates widget visibility on flag change", async () => {
    // Render with flag on
    // Toggle flag off via setFeatureFlags
    // Assert widget unmounts
    // Toggle back on
    // Assert widget remounts
  });

  it("persists default flags on ApplicationState creation", () => {
    const state = ApplicationState.create();
    expect(state.getFeatureFlags()).toEqual(DEFAULT_FLAGS);
  });
});
```

**Scenarios to Cover:**

- All widgets enabled (default)
- Selective widget disabling
- Dynamic flag toggling
- Flag state persistence across navigation
- Edge case: all widgets disabled (show empty state?)

---

#### 2. Update Architecture Documentation

**File:** `docs/development/feature-catalogue.md`

**Add Feature Flag Section:**

```markdown
## Feature Flags

### Overview

Feature flags provide controlled rollout of features without code changes.

### Flag Naming Convention

`<domain>.<feature>.<subfeature>`

Examples:

- `dashboard.widgets.casePriority`
- `reports.advancedFilters`
- `cases.bulkActions`

### Implementation

- **Storage:** `ApplicationState.featureFlags`
- **Access:** `useAppState().isFeatureEnabled(flag)`
- **Updates:** `setFeatureFlags({ flag: true })`

### Current Flags

| Flag                             | Default | Description                     |
| -------------------------------- | ------- | ------------------------------- |
| `dashboard.widgets.casePriority` | `true`  | Case Priority widget visibility |
| `dashboard.widgets.avgAlertAge`  | `true`  | Avg Alert Age widget visibility |
| ...                              | ...     | ...                             |

### Testing

Use `ApplicationState.create({ featureFlags: { ... } })` to test flag states.
```

---

#### 3. Usage Examples Documentation

**File:** `docs/development/feature-flags-guide.md` (NEW)

````markdown
# Feature Flags Usage Guide

## Basic Usage

### Checking a Flag

```typescript
const { isFeatureEnabled } = useAppState();

if (isFeatureEnabled("dashboard.widgets.casePriority")) {
  // Render feature
}
```
````

### Toggling a Flag (Development)

```typescript
const { setFeatureFlags } = useAppState();

// Enable a feature
setFeatureFlags({ "reports.advancedFilters": true });

// Disable a feature
setFeatureFlags({ "dashboard.widgets.avgAlertAge": false });
```

## Testing with Flags

### Component Testing

```typescript
import { ApplicationState } from "@/application/ApplicationState";

const customFlags = {
  "dashboard.widgets.casePriority": false,
};

const appState = ApplicationState.create({ featureFlags: customFlags });
// Render component with custom appState
```

### Integration Testing

```typescript
it("hides feature when flag disabled", () => {
  const state = ApplicationState.create({
    featureFlags: { "feature.key": false },
  });

  // Test feature is hidden
});
```

## Adding New Flags

1. **Update Type Definition** (`utils/featureFlags.ts`):

   ```typescript
   export interface FeatureFlags {
     // ... existing flags ...
     "new.feature.key": boolean;
   }
   ```

2. **Set Default Value**:

   ```typescript
   export const DEFAULT_FLAGS: FeatureFlags = {
     // ... existing defaults ...
     "new.feature.key": false, // Start disabled
   };
   ```

3. **Use in Component**:

   ```typescript
   const { isFeatureEnabled } = useAppState();

   if (isFeatureEnabled("new.feature.key")) {
     return <NewFeature />;
   }
   ```

4. **Add Tests**.

## Best Practices

1. **Start Disabled:** New features default to `false`
2. **Clear Naming:** Use hierarchical dot notation
3. **Document:** Add JSDoc comments explaining flag purpose
4. **Test Both States:** Write tests for enabled and disabled
5. **Clean Up:** Remove flags once feature is permanent

```

---

## Acceptance Criteria

### Functional
- ✅ All 8 dashboard widgets have associated feature flags
- ✅ Widgets correctly hide/show based on flag state
- ✅ Flag state integrated into ApplicationState
- ✅ `useAppState` exposes flag helpers
- ✅ Dynamic flag updates trigger component re-renders

### Testing
- ✅ Feature flag unit tests pass
- ✅ ApplicationState flag integration tested
- ✅ Dashboard widget filtering tested
- ✅ Integration tests cover flag toggling scenarios
- ✅ Full suite maintains 100% pass rate (281 tests)

### Documentation
- ✅ Feature flag guide created
- ✅ Architecture docs updated
- ✅ Usage examples documented
- ✅ JSDoc comments on all flag utilities

### Code Quality
- ✅ Type-safe flag keys (no magic strings)
- ✅ Immutable flag updates
- ✅ Consistent naming convention
- ✅ No lint errors
- ✅ Follows shadcn/Tailwind conventions

---

## Implementation Notes

### Antipatterns to Avoid
- ❌ No localStorage/sessionStorage for flags (ApplicationState only)
- ❌ No magic string flag keys (use `FeatureFlagKey` type)
- ❌ No mutable flag objects
- ❌ No flag checks outside React components (use ApplicationState methods)

### Performance Considerations
- Memoize flag-dependent useMemo/useCallback hooks
- Avoid flag checks in render loops
- WidgetRegistry filters once per flag state change

### Future Expansion
- Flags are extensible for any feature domain
- Naming convention supports unlimited hierarchy
- ApplicationState provides single source of truth

---

## Success Metrics

1. **Zero Test Failures:** All 281 tests pass
2. **Type Safety:** No TypeScript errors
3. **Clean Build:** `npm run build` succeeds
4. **Lint Clean:** `npm run lint` passes
5. **Documentation Complete:** All deliverables have docs

---

## Handoff Checklist

- [ ] `utils/featureFlags.ts` enhanced with typed flags
- [ ] `ApplicationState` updated with flag support
- [ ] `useAppState` exports flag helpers
- [ ] `Dashboard.tsx` integrates flags via `useAppState`
- [ ] `WidgetRegistry.tsx` filters by flags
- [ ] All 8 widgets have `featureFlag` metadata
- [ ] Unit tests for feature flags (`featureFlags.test.ts`)
- [ ] Integration tests (`featureFlagFlow.test.tsx`)
- [ ] Updated ApplicationState tests
- [ ] Updated Dashboard widget tests
- [ ] Feature catalogue documentation updated
- [ ] Feature flags guide created
- [ ] Full test suite passes (`npm run test`)
- [ ] No lint errors (`npm run lint`)
- [ ] Build succeeds (`npm run build`)

---

## Reference Files

### Must Read Before Starting
1. `application/ApplicationState.ts` - State container pattern
2. `utils/featureFlags.ts` - Current flag structure
3. `hooks/useAppState.ts` - React integration
4. `components/app/Dashboard.tsx` - Widget rendering
5. `components/app/widgets/WidgetRegistry.tsx` - Widget framework
6. `.github/copilot-instructions.md` - Project conventions

### Test Files to Update
1. `__tests__/utils/featureFlags.test.ts`
2. `__tests__/application/ApplicationState.test.ts`
3. `__tests__/hooks/useAppState.test.ts`
4. `__tests__/components/app/Dashboard.widgets.test.tsx`
5. `__tests__/integration/featureFlagFlow.test.tsx` (NEW)

---

**End of Phase 1 Days 5–7 Specification**
```
