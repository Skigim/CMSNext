import { describe, it, expect, afterEach } from "vitest";
import {
  startMeasurement,
  endMeasurement,
  getRecordedMeasurements,
  clearRecordedMeasurements,
  recordRenderProfile,
  getRenderProfiles,
  clearRenderProfiles,
} from "@/utils/performanceTracker";

describe("performanceTracker", () => {
  afterEach(() => {
    clearRecordedMeasurements();
    clearRenderProfiles();
  });

  it("records measurement durations with metadata", () => {
    startMeasurement("navigation:test", { view: "dashboard" });
    endMeasurement("navigation:test", { result: "list" });

    const measurements = getRecordedMeasurements();
    expect(measurements.length).toBeGreaterThan(0);

    const latest = measurements[measurements.length - 1];
    expect(latest).toBeDefined();
    expect(latest.name).toBe("navigation:test");
    expect(latest.duration).toBeGreaterThanOrEqual(0);
    expect(latest.detail).toMatchObject({ view: "dashboard", result: "list" });
  });

  it("records render profile samples", () => {
    recordRenderProfile({
      id: "AppContent",
      phase: "mount",
      actualDuration: 2.5,
      baseDuration: 1.2,
      startTime: 0,
      commitTime: 2.5,
      interactionCount: 0,
      meta: { currentView: "dashboard" },
    });

    const profiles = getRenderProfiles();
    expect(profiles.length).toBe(1);
    expect(profiles[0]).toMatchObject({
      id: "AppContent",
      phase: "mount",
      interactionCount: 0,
      meta: { currentView: "dashboard" },
    });
  });
});
