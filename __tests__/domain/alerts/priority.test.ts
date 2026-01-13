/**
 * @fileoverview Tests for Priority Weight Calculation
 *
 * Tests the dynamic weight calculation functions that use exponential decay
 * based on array position for alert types and case statuses.
 */

import { describe, it, expect } from "vitest";
import {
  calculateDecayFactor,
  calculatePositionalWeight,
  getAlertTypeWeight,
  getStatusWeight,
  previewWeightDistribution,
  ALERT_WEIGHT_MAX,
  ALERT_WEIGHT_MIN,
  STATUS_WEIGHT_MAX,
  STATUS_WEIGHT_MIN,
} from "@/domain/alerts/priority";
import type { AlertTypeConfig, StatusConfig } from "@/types/categoryConfig";

// ============================================================================
// calculateDecayFactor
// ============================================================================

describe("calculateDecayFactor", () => {
  it("should return 1 for single item array", () => {
    expect(calculateDecayFactor(1, 500, 50)).toBe(1);
  });

  it("should return 1 for zero or negative length", () => {
    expect(calculateDecayFactor(0, 500, 50)).toBe(1);
    expect(calculateDecayFactor(-1, 500, 50)).toBe(1);
  });

  it("should return 1 for invalid weights", () => {
    expect(calculateDecayFactor(5, 0, 50)).toBe(1);
    expect(calculateDecayFactor(5, 500, 0)).toBe(1);
    expect(calculateDecayFactor(5, -500, 50)).toBe(1);
  });

  it("should calculate correct decay for 2 items", () => {
    // decay = (50/500)^(1/1) = 0.1
    expect(calculateDecayFactor(2, 500, 50)).toBeCloseTo(0.1, 5);
  });

  it("should calculate correct decay for 5 items", () => {
    // decay = (50/500)^(1/4) ≈ 0.562
    const decay = calculateDecayFactor(5, 500, 50);
    expect(decay).toBeGreaterThan(0.5);
    expect(decay).toBeLessThan(0.6);
  });
});

// ============================================================================
// calculatePositionalWeight
// ============================================================================

describe("calculatePositionalWeight", () => {
  it("should return 0 for invalid parameters", () => {
    expect(calculatePositionalWeight(0, 0, 500, 50)).toBe(0);
    expect(calculatePositionalWeight(-1, 5, 500, 50)).toBe(0);
  });

  it("should return maxWeight for single item array", () => {
    expect(calculatePositionalWeight(0, 1, 500, 50)).toBe(500);
  });

  it("should return maxWeight for first item", () => {
    expect(calculatePositionalWeight(0, 5, 500, 50)).toBe(500);
  });

  it("should return minWeight for last item", () => {
    expect(calculatePositionalWeight(4, 5, 500, 50)).toBe(50);
  });

  it("should return minWeight for index beyond array length", () => {
    expect(calculatePositionalWeight(10, 5, 500, 50)).toBe(50);
  });

  it("should calculate decreasing weights for middle positions", () => {
    const weights = [0, 1, 2, 3, 4].map((i) =>
      calculatePositionalWeight(i, 5, 500, 50)
    );

    // First should be max
    expect(weights[0]).toBe(500);
    // Last should be min
    expect(weights[4]).toBe(50);
    // Should be decreasing
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeLessThan(weights[i - 1]);
    }
  });

  it("should handle status weight range", () => {
    const weights = [0, 1, 2].map((i) =>
      calculatePositionalWeight(i, 3, STATUS_WEIGHT_MAX, STATUS_WEIGHT_MIN)
    );

    expect(weights[0]).toBe(STATUS_WEIGHT_MAX);
    expect(weights[2]).toBe(STATUS_WEIGHT_MIN);
  });
});

// ============================================================================
// getAlertTypeWeight
// ============================================================================

describe("getAlertTypeWeight", () => {
  const alertTypes: AlertTypeConfig[] = [
    { name: "AVS Day 5", colorSlot: "red", sortOrder: 0 },
    { name: "VR Due", colorSlot: "amber", sortOrder: 1 },
    { name: "Mail Received", colorSlot: "blue", sortOrder: 2 },
  ];

  it("should return ALERT_WEIGHT_MIN for empty alertTypes", () => {
    expect(getAlertTypeWeight("AVS Day 5", [])).toBe(ALERT_WEIGHT_MIN);
  });

  it("should return ALERT_WEIGHT_MIN for undefined alertType", () => {
    expect(getAlertTypeWeight(undefined, alertTypes)).toBe(ALERT_WEIGHT_MIN);
  });

  it("should return ALERT_WEIGHT_MIN for unrecognized alertType", () => {
    expect(getAlertTypeWeight("Unknown Type", alertTypes)).toBe(ALERT_WEIGHT_MIN);
  });

  it("should return highest weight for first item", () => {
    expect(getAlertTypeWeight("AVS Day 5", alertTypes)).toBe(ALERT_WEIGHT_MAX);
  });

  it("should return lowest weight for last item", () => {
    expect(getAlertTypeWeight("Mail Received", alertTypes)).toBe(ALERT_WEIGHT_MIN);
  });

  it("should match case-insensitively", () => {
    expect(getAlertTypeWeight("avs day 5", alertTypes)).toBe(ALERT_WEIGHT_MAX);
    expect(getAlertTypeWeight("AVS DAY 5", alertTypes)).toBe(ALERT_WEIGHT_MAX);
  });

  it("should sort by sortOrder when present", () => {
    const unsorted: AlertTypeConfig[] = [
      { name: "Third", colorSlot: "blue", sortOrder: 2 },
      { name: "First", colorSlot: "red", sortOrder: 0 },
      { name: "Second", colorSlot: "amber", sortOrder: 1 },
    ];

    expect(getAlertTypeWeight("First", unsorted)).toBe(ALERT_WEIGHT_MAX);
    expect(getAlertTypeWeight("Third", unsorted)).toBe(ALERT_WEIGHT_MIN);
  });

  it("should handle items without sortOrder", () => {
    const noSortOrder: AlertTypeConfig[] = [
      { name: "First", colorSlot: "red" },
      { name: "Second", colorSlot: "amber" },
    ];

    // Should use array order when no sortOrder
    const firstWeight = getAlertTypeWeight("First", noSortOrder);
    const secondWeight = getAlertTypeWeight("Second", noSortOrder);
    expect(firstWeight).toBeGreaterThan(secondWeight);
  });
});

// ============================================================================
// getStatusWeight
// ============================================================================

describe("getStatusWeight", () => {
  const statuses: StatusConfig[] = [
    { name: "Intake", colorSlot: "blue", priorityEnabled: true, sortOrder: 0 },
    { name: "Pending", colorSlot: "amber", priorityEnabled: true, sortOrder: 1 },
    { name: "Active", colorSlot: "green", priorityEnabled: false, sortOrder: 2 },
    { name: "Closed", colorSlot: "slate", priorityEnabled: false, sortOrder: 3 },
  ];

  it("should return 0 for empty statuses array", () => {
    expect(getStatusWeight("Intake", [])).toBe(0);
  });

  it("should return 0 for undefined status", () => {
    expect(getStatusWeight(undefined, statuses)).toBe(0);
  });

  it("should return 0 for status not in array", () => {
    expect(getStatusWeight("Unknown", statuses)).toBe(0);
  });

  it("should return 0 for non-priority-enabled status", () => {
    expect(getStatusWeight("Active", statuses)).toBe(0);
    expect(getStatusWeight("Closed", statuses)).toBe(0);
  });

  it("should return highest weight for first priority-enabled status", () => {
    expect(getStatusWeight("Intake", statuses)).toBe(STATUS_WEIGHT_MAX);
  });

  it("should return lower weight for subsequent priority-enabled statuses", () => {
    const intakeWeight = getStatusWeight("Intake", statuses);
    const pendingWeight = getStatusWeight("Pending", statuses);
    
    expect(intakeWeight).toBeGreaterThan(pendingWeight);
    expect(pendingWeight).toBe(STATUS_WEIGHT_MIN); // Only 2 enabled, so second is min
  });

  it("should match case-insensitively", () => {
    expect(getStatusWeight("intake", statuses)).toBe(STATUS_WEIGHT_MAX);
    expect(getStatusWeight("INTAKE", statuses)).toBe(STATUS_WEIGHT_MAX);
  });

  it("should only consider priority-enabled statuses", () => {
    const mixedStatuses: StatusConfig[] = [
      { name: "First", colorSlot: "red", priorityEnabled: false, sortOrder: 0 },
      { name: "Second", colorSlot: "amber", priorityEnabled: true, sortOrder: 1 },
      { name: "Third", colorSlot: "blue", priorityEnabled: true, sortOrder: 2 },
    ];

    // First is not enabled, so Second should get max weight
    expect(getStatusWeight("First", mixedStatuses)).toBe(0);
    expect(getStatusWeight("Second", mixedStatuses)).toBe(STATUS_WEIGHT_MAX);
  });

  it("should return 0 when no statuses are priority-enabled", () => {
    const noEnabled: StatusConfig[] = [
      { name: "Active", colorSlot: "green", priorityEnabled: false },
      { name: "Closed", colorSlot: "slate", priorityEnabled: false },
    ];

    expect(getStatusWeight("Active", noEnabled)).toBe(0);
  });
});

// ============================================================================
// previewWeightDistribution
// ============================================================================

describe("previewWeightDistribution", () => {
  it("should return empty array for zero length", () => {
    expect(previewWeightDistribution(0, 500, 50)).toEqual([]);
  });

  it("should return single maxWeight for length 1", () => {
    expect(previewWeightDistribution(1, 500, 50)).toEqual([500]);
  });

  it("should return correct weights for 2 items", () => {
    const weights = previewWeightDistribution(2, 500, 50);
    expect(weights).toHaveLength(2);
    expect(weights[0]).toBe(500);
    expect(weights[1]).toBe(50);
  });

  it("should return decreasing weights", () => {
    const weights = previewWeightDistribution(5, 500, 50);
    expect(weights).toHaveLength(5);
    
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeLessThan(weights[i - 1]);
    }
  });

  it("should have first weight as max and last as min", () => {
    const weights = previewWeightDistribution(10, 500, 50);
    expect(weights[0]).toBe(500);
    expect(weights[9]).toBe(50);
  });

  it("should work with alert weight constants", () => {
    const weights = previewWeightDistribution(5, ALERT_WEIGHT_MAX, ALERT_WEIGHT_MIN);
    expect(weights[0]).toBe(ALERT_WEIGHT_MAX);
    expect(weights[4]).toBe(ALERT_WEIGHT_MIN);
  });

  it("should work with status weight constants", () => {
    const weights = previewWeightDistribution(3, STATUS_WEIGHT_MAX, STATUS_WEIGHT_MIN);
    expect(weights[0]).toBe(STATUS_WEIGHT_MAX);
    expect(weights[2]).toBe(STATUS_WEIGHT_MIN);
  });
});
