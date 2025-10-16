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

import { createLogger } from "./logger";

const telemetryLogger = createLogger("Telemetry");

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

interface StorageHealthMetricPayload {
  successRate: number;
  totalOperations: number;
  failedOperations: number;
  averageLatencyMs: number;
  consecutiveFailures: number;
  timestamp: number;
  sessionId: string;
}

// Session ID - persist for the entire user session
let sessionId = generateSessionId();

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
  operationType: StorageSyncEventPayload["operationType"],
  success: boolean,
  details?: Omit<StorageSyncEventPayload, "operationType" | "success" | "timestamp" | "sessionId">,
): void {
  const payload: StorageSyncEventPayload = {
    operationType,
    success,
    timestamp: Date.now(),
    sessionId,
    ...details,
  };

  telemetryLogger.debug(`Storage sync event: ${operationType}`, {
    success,
    duration: details?.duration,
    dataSize: details?.dataSize,
    itemCount: details?.itemCount,
    error: details?.error,
  });

  // TODO: Send to telemetry collection service when available
  // For now, this is captured in logs only
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
  previousState: string,
  newState: string,
  details?: Omit<AutosaveStateTransitionPayload, "previousState" | "newState" | "timestamp" | "sessionId">,
): void {
  const payload: AutosaveStateTransitionPayload = {
    previousState,
    newState,
    timestamp: Date.now(),
    sessionId,
    ...details,
  };

  telemetryLogger.debug(`Autosave state transition: ${previousState} → ${newState}`, {
    duration: details?.duration,
    metadata: details?.metadata,
  });

  // TODO: Send to telemetry collection service when available
}

/**
 * Record a performance marker for dashboard or widget operations.
 * Captures load timing, render timing, and other performance metrics.
 *
 * @param markName - Name of the performance marker (e.g., "dashboard.initial-load")
 * @param details - Duration, metadata, and other performance data
 */
export function recordPerformanceMarker(
  markName: string,
  details?: Omit<PerformanceMarkerPayload, "markName" | "timestamp" | "sessionId">,
): void {
  const payload: PerformanceMarkerPayload = {
    markName,
    timestamp: Date.now(),
    sessionId,
    ...details,
  };

  telemetryLogger.debug(`Performance marker: ${markName}`, {
    duration: details?.duration,
    metadata: details?.metadata,
  });

  // TODO: Send to telemetry collection service when available
}

/**
 * Record storage health metrics snapshot.
 * Aggregates success rate, error counts, latency averages, and retry information.
 *
 * @param metrics - Storage health snapshot containing success/failure/latency data
 */
export function recordStorageHealthMetrics(
  metrics: Omit<StorageHealthMetricPayload, "timestamp" | "sessionId">,
): void {
  const payload: StorageHealthMetricPayload = {
    timestamp: Date.now(),
    sessionId,
    ...metrics,
  };

  telemetryLogger.info(`Storage health metrics`, {
    successRate: `${(payload.successRate * 100).toFixed(1)}%`,
    totalOperations: payload.totalOperations,
    failedOperations: payload.failedOperations,
    averageLatencyMs: `${payload.averageLatencyMs.toFixed(1)}ms`,
    consecutiveFailures: payload.consecutiveFailures,
  });

  // TODO: Send to telemetry collection service when available
}

/**
 * Get the current session ID for telemetry correlation.
 *
 * @returns The current session ID
 */
export function getSessionId(): string {
  return sessionId;
}

/**
 * Reset the session ID (useful for testing or session transitions).
 * In production, this typically won't be called unless the user logs out/in.
 */
export function resetSessionId(): void {
  sessionId = generateSessionId();
  telemetryLogger.lifecycle("Session ID reset", { newSessionId: sessionId });
}

export type {
  StorageSyncEventPayload,
  AutosaveStateTransitionPayload,
  PerformanceMarkerPayload,
  StorageHealthMetricPayload,
};
