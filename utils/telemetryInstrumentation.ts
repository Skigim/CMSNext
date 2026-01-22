/**
 * Telemetry Instrumentation Utilities
 *
 * Captures storage health metrics, sync events, and performance data
 * for local observability and future usage metrics service integration.
 *
 * This module instruments:
 * - Storage sync events (success/failure rates, operation types)
 * - Autosave badge state transitions (idle → saving → saved → error)
 * - Dashboard load timing and widget performance
 * - Storage health metrics (error tracking, latency, retry counts)
 *
 * @version 1.0.0
 * @author Case Tracking Platform Team
 */

interface StorageSyncEventPayload {
  operationType: "load" | "save" | "sync" | "import" | "export";
  success: boolean;
  duration?: number;
  dataSize?: number;
  itemCount?: number;
  error?: string;
  timestamp: number;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

interface AutosaveStateTransitionPayload {
  previousState: string;
  newState: string;
  duration?: number;
  timestamp: number;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

interface PerformanceMarkerPayload {
  markName: string;
  duration?: number;
  timestamp: number;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record a storage sync event with telemetry metadata.
 * Logs success/failure rates, operation type, duration, and data size.
 *
 * @param operationType - Type of storage operation (load, save, sync, import, export)
 * @param success - Whether the operation succeeded
 * @param details - Additional metadata about the operation
 */
export function recordStorageSyncEvent(
  _operationType: StorageSyncEventPayload["operationType"],
  _success: boolean,
  _details?: Omit<StorageSyncEventPayload, "operationType" | "success" | "timestamp" | "sessionId">,
): void {
  // Telemetry disabled
  return;
}

/**
 * Record autosave badge state transition with telemetry metadata.
 * Tracks state changes (idle → saving → saved → error) with duration.
 *
 * @param previousState - Previous autosave state
 * @param newState - New autosave state
 * @param details - Additional metadata (duration, error details)
 */
export function recordAutosaveStateTransition(
  _previousState: string,
  _newState: string,
  _details?: Omit<AutosaveStateTransitionPayload, "previousState" | "newState" | "timestamp" | "sessionId">,
): void {
  // Telemetry disabled
  return;
}

/**
 * Record a performance marker for dashboard or widget operations.
 * Captures load timing, render timing, and other performance metrics.
 *
 * @param markName - Name of the performance marker (e.g., "dashboard.initial-load")
 * @param details - Duration, metadata, and other performance data
 */
export function recordPerformanceMarker(
  _markName: string,
  _details?: Omit<PerformanceMarkerPayload, "markName" | "timestamp" | "sessionId">,
): void {
  // Telemetry disabled
  return;
}

export type {
  StorageSyncEventPayload,
  AutosaveStateTransitionPayload,
  PerformanceMarkerPayload,
};
