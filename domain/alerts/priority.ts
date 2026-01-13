/**
 * @fileoverview Alert and Status Priority Weight Calculations
 *
 * Pure functions for calculating dynamic priority weights based on array position.
 * Uses exponential decay to distribute weights across items, ensuring the first
 * item always gets the highest weight and the last item gets the minimum weight.
 *
 * Weight Formula:
 * - decay = (minWeight / maxWeight) ^ (1 / (arrayLength - 1))
 * - weight(index) = maxWeight * decay^index
 *
 * @module domain/alerts/priority
 */

import type { AlertTypeConfig, StatusConfig } from "../../types/categoryConfig";

// ============================================================================
// Weight Range Constants
// ============================================================================

/** Maximum weight for status-based priority (e.g., Intake) */
export const STATUS_WEIGHT_MAX = 5000;
/** Minimum weight for status-based priority */
export const STATUS_WEIGHT_MIN = 500;

/** Maximum weight for alert type priority (first in order) */
export const ALERT_WEIGHT_MAX = 500;
/** Minimum weight for alert type priority (last in order) */
export const ALERT_WEIGHT_MIN = 50;

// ============================================================================
// Core Weight Calculation
// ============================================================================

/**
 * Calculate the exponential decay factor for weight distribution.
 *
 * Given a range from maxWeight to minWeight across arrayLength items,
 * computes the decay multiplier such that:
 * - Index 0 gets maxWeight
 * - Index (arrayLength - 1) gets minWeight
 *
 * @param arrayLength - Total number of items
 * @param maxWeight - Weight for the first item (index 0)
 * @param minWeight - Weight for the last item (index arrayLength - 1)
 * @returns Decay factor (0 < decay <= 1)
 */
export function calculateDecayFactor(
  arrayLength: number,
  maxWeight: number,
  minWeight: number
): number {
  if (arrayLength <= 1) {
    return 1;
  }
  if (maxWeight <= 0 || minWeight <= 0) {
    return 1;
  }
  // decay = (min/max)^(1/(n-1))
  return Math.pow(minWeight / maxWeight, 1 / (arrayLength - 1));
}

/**
 * Calculate weight for a specific position using exponential decay.
 *
 * @param index - Position in the array (0-based)
 * @param arrayLength - Total number of items
 * @param maxWeight - Weight for the first item
 * @param minWeight - Weight for the last item
 * @returns Calculated weight, or 0 if invalid parameters
 *
 * @example
 * // 5 items with max=500, min=50
 * calculatePositionalWeight(0, 5, 500, 50) // → 500
 * calculatePositionalWeight(1, 5, 500, 50) // → 297
 * calculatePositionalWeight(2, 5, 500, 50) // → 176
 * calculatePositionalWeight(3, 5, 500, 50) // → 105
 * calculatePositionalWeight(4, 5, 500, 50) // → 50 (floored to min)
 */
export function calculatePositionalWeight(
  index: number,
  arrayLength: number,
  maxWeight: number,
  minWeight: number
): number {
  // Edge cases
  if (arrayLength <= 0 || index < 0) {
    return 0;
  }
  if (arrayLength === 1) {
    return maxWeight;
  }
  if (index >= arrayLength) {
    return minWeight;
  }

  const decay = calculateDecayFactor(arrayLength, maxWeight, minWeight);
  const weight = maxWeight * Math.pow(decay, index);

  // Floor to minWeight to avoid floating point issues
  return Math.max(Math.round(weight), minWeight);
}

// ============================================================================
// Alert Type Weight Lookup
// ============================================================================

/**
 * Get priority weight for an alert based on its type and the configured order.
 *
 * Looks up the alert type in the ordered alertTypes array and calculates
 * weight based on position using exponential decay.
 *
 * @param alertType - The alert type/description to look up
 * @param alertTypes - Ordered array of alert type configurations (first = highest priority)
 * @returns Priority weight, or ALERT_WEIGHT_MIN if not found
 *
 * @example
 * const alertTypes = [
 *   { name: "AVS Day 5", colorSlot: "red", sortOrder: 0 },
 *   { name: "VR Due", colorSlot: "amber", sortOrder: 1 },
 *   { name: "Mail Received", colorSlot: "blue", sortOrder: 2 },
 * ];
 * getAlertTypeWeight("AVS Day 5", alertTypes) // → 500 (highest)
 * getAlertTypeWeight("Mail Received", alertTypes) // → 50 (lowest)
 * getAlertTypeWeight("Unknown", alertTypes) // → 50 (fallback)
 */
export function getAlertTypeWeight(
  alertType: string | undefined,
  alertTypes: AlertTypeConfig[]
): number {
  if (!alertType || alertTypes.length === 0) {
    return ALERT_WEIGHT_MIN;
  }

  // Sort by sortOrder if present, otherwise use array order
  const sortedTypes = [...alertTypes].sort((a, b) => {
    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });

  // Find index by case-insensitive match
  const normalizedType = alertType.toUpperCase().trim();
  const index = sortedTypes.findIndex(
    (config) => config.name.toUpperCase().trim() === normalizedType
  );

  if (index === -1) {
    // Not found in config - return minimum weight
    return ALERT_WEIGHT_MIN;
  }

  return calculatePositionalWeight(
    index,
    sortedTypes.length,
    ALERT_WEIGHT_MAX,
    ALERT_WEIGHT_MIN
  );
}

// ============================================================================
// Status Weight Lookup
// ============================================================================

/**
 * Get priority weight for a case status based on configuration.
 *
 * Only statuses with `priorityEnabled: true` contribute to priority scoring.
 * Weight is calculated based on position among enabled statuses.
 *
 * @param status - The case status to look up
 * @param statuses - Array of status configurations
 * @returns Priority weight, or 0 if status is not priority-enabled
 *
 * @example
 * const statuses = [
 *   { name: "Intake", colorSlot: "blue", priorityEnabled: true, sortOrder: 0 },
 *   { name: "Pending", colorSlot: "amber", priorityEnabled: true, sortOrder: 1 },
 *   { name: "Active", colorSlot: "green", priorityEnabled: false },
 * ];
 * getStatusWeight("Intake", statuses) // → 5000 (highest)
 * getStatusWeight("Pending", statuses) // → 500 (lowest enabled)
 * getStatusWeight("Active", statuses) // → 0 (not enabled)
 */
export function getStatusWeight(
  status: string | undefined,
  statuses: StatusConfig[]
): number {
  if (!status || statuses.length === 0) {
    return 0;
  }

  // Filter to only priority-enabled statuses and sort by sortOrder
  const enabledStatuses = statuses
    .filter((s) => s.priorityEnabled === true)
    .sort((a, b) => {
      const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });

  if (enabledStatuses.length === 0) {
    return 0;
  }

  // Find index by case-insensitive match
  const normalizedStatus = status.toUpperCase().trim();
  const index = enabledStatuses.findIndex(
    (config) => config.name.toUpperCase().trim() === normalizedStatus
  );

  if (index === -1) {
    // Status exists but not priority-enabled or not found
    return 0;
  }

  return calculatePositionalWeight(
    index,
    enabledStatuses.length,
    STATUS_WEIGHT_MAX,
    STATUS_WEIGHT_MIN
  );
}

// ============================================================================
// Utility: Preview Weight Distribution
// ============================================================================

/**
 * Generate a preview of weight distribution for a given array length.
 * Useful for UI display of how weights will be assigned.
 *
 * @param arrayLength - Number of items
 * @param maxWeight - Maximum weight (first item)
 * @param minWeight - Minimum weight (last item)
 * @returns Array of weights for each position
 *
 * @example
 * previewWeightDistribution(5, 500, 50)
 * // → [500, 297, 176, 105, 50]
 */
export function previewWeightDistribution(
  arrayLength: number,
  maxWeight: number,
  minWeight: number
): number[] {
  if (arrayLength <= 0) {
    return [];
  }
  return Array.from({ length: arrayLength }, (_, index) =>
    calculatePositionalWeight(index, arrayLength, maxWeight, minWeight)
  );
}
