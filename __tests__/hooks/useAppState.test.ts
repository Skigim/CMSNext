import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import ApplicationState from "@/application/ApplicationState";
import { useAppState } from "@/hooks/useAppState";
import { DEFAULT_FLAGS } from "@/utils/featureFlags";

describe("useAppState", () => {
  beforeEach(() => {
    ApplicationState.resetInstance();
  });

  afterEach(() => {
    ApplicationState.resetInstance();
  });

  it("returns feature flags from ApplicationState", () => {
    const { result } = renderHook(() => useAppState());

    expect(result.current.featureFlags).toEqual(DEFAULT_FLAGS);
    expect(result.current.isFeatureEnabled("dashboard.widgets.casePriority")).toBe(true);
  });

  it("updates feature flags via ApplicationState setter", () => {
    const { result } = renderHook(() => useAppState());

    act(() => {
      result.current.setFeatureFlags({ "dashboard.widgets.casePriority": false });
    });

    expect(result.current.isFeatureEnabled("dashboard.widgets.casePriority")).toBe(false);
    expect(result.current.featureFlags["dashboard.widgets.casePriority"]).toBe(false);
    expect(result.current.featureFlags["dashboard.widgets.alertsCleared"]).toBe(true);
  });
});
