import { createLogger } from "./logger";

/**
 * Performance Tracking Utilities
 * ==============================
 * Measures and logs application performance metrics.
 * Tracks operation duration, memory usage, and identifies performance bottlenecks.
 * 
 * ## Tracked Metrics
 * 
 * - **Operation Duration**: Time to complete operations
 * - **Memory Usage**: Heap size and garbage collection impact
 * - **Performance Warnings**: Alerts for slow operations
 * - **Custom Details**: Application-specific metric details
 * 
 * @module performanceTracker
 */

interface MeasurementDetail {
  [key: string]: unknown;
}

interface MeasurementRecord {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  detail?: MeasurementDetail;
}

interface RenderProfileRecord {
  id: string;
  phase: "mount" | "update";
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  interactionCount: number;
  meta?: MeasurementDetail;
}

interface StorageHealthMetrics {
  successCount: number;
  failureCount: number;
  totalOperations: number;
  successRate: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  consecutiveFailures: number;
  lastOperationTime: number;
  operationTypes: Record<string, number>;
}

interface ActiveMark {
  markId: string;
  fallbackStart: number;
  detail?: MeasurementDetail;
}

interface PerformanceMetaEnv {
  MODE?: string;
  mode?: string;
  DEV?: boolean;
  dev?: boolean;
  [key: string]: unknown;
}

const performanceLogger = createLogger("Performance");

const env: PerformanceMetaEnv =
  typeof import.meta !== "undefined" && typeof import.meta.env === "object"
    ? (import.meta.env as PerformanceMetaEnv)
    : {};
const mode = env?.MODE ?? env?.mode;
const dev = env?.DEV ?? env?.dev;
const nodeEnv = typeof process !== "undefined" ? process.env.NODE_ENV : undefined;
const shouldTrack = Boolean(dev || mode === "analyze" || nodeEnv === "test");
let idCounter = 0;

const hasPerformanceApi = typeof performance !== "undefined" &&
  typeof performance.mark === "function" &&
  typeof performance.measure === "function" &&
  typeof performance.clearMarks === "function" &&
  typeof performance.clearMeasures === "function";

const activeMarks = new Map<string, ActiveMark[]>();
const measurementLog: MeasurementRecord[] = [];
const renderProfileLog: RenderProfileRecord[] = [];

// Storage health tracking
const storageHealthStats = {
  successCount: 0,
  failureCount: 0,
  totalLatencyMs: 0,
  minLatencyMs: Infinity,
  maxLatencyMs: 0,
  consecutiveFailures: 0,
  lastOperationTime: 0,
  operationTypes: {} as Record<string, number>,
};

function now(): number {
  if (hasPerformanceApi && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function pushActiveMark(name: string, mark: ActiveMark) {
  const stack = activeMarks.get(name) ?? [];
  stack.push(mark);
  activeMarks.set(name, stack);
}

function popActiveMark(name: string): ActiveMark | null {
  const stack = activeMarks.get(name);
  if (!stack || stack.length === 0) {
    return null;
  }
  const mark = stack.pop() ?? null;
  if (!stack.length) {
    activeMarks.delete(name);
  }
  return mark;
}

function logMeasurement(record: MeasurementRecord) {
  measurementLog.push(record);
  performanceLogger.debug(`Measurement: ${record.name}`, {
    durationMs: Number(record.duration.toFixed(3)),
    detail: record.detail,
  });
}

export function startMeasurement(name: string, detail?: MeasurementDetail) {
  if (!shouldTrack) {
    return;
  }
  const markId = `${name}-${idCounter++}-start`;
  if (hasPerformanceApi) {
    try {
      performance.mark(markId);
    } catch {
      // no-op
    }
  }
  pushActiveMark(name, { markId, fallbackStart: now(), detail });
}

export function endMeasurement(name: string, detail?: MeasurementDetail) {
  if (!shouldTrack) {
    return;
  }
  const activeMark = popActiveMark(name);
  if (!activeMark) {
    performanceLogger.warn("Attempted to end measurement with no active start", { name });
    return;
  }

  const { markId, fallbackStart, detail: startDetail } = activeMark;
  const endTime = now();
  let duration = endTime - fallbackStart;

  if (hasPerformanceApi) {
    const measureId = `${name}-${idCounter++}-measure`;
    try {
      performance.measure(measureId, markId);
      const entries = performance.getEntriesByName(measureId);
      const latestEntry = entries.length > 0 ? entries[entries.length - 1] : undefined;
      if (latestEntry) {
        duration = latestEntry.duration;
      }
      performance.clearMeasures(measureId);
    } catch {
      // Ignore measurement errors and fall back to duration calculations.
    }

    try {
      performance.clearMarks(markId);
    } catch {
      // Ignore mark cleanup failures.
    }
  }

  let mergedDetail: MeasurementDetail | undefined;
  if (startDetail && detail) {
    mergedDetail = { ...startDetail, ...detail };
  } else if (startDetail) {
    mergedDetail = { ...startDetail };
  } else if (detail) {
    mergedDetail = { ...detail };
  }
  logMeasurement({
    name,
    duration,
    startTime: fallbackStart,
    endTime,
    detail: mergedDetail,
  });
}

export function recordRenderProfile(sample: RenderProfileRecord) {
  if (!shouldTrack) {
    return;
  }

  renderProfileLog.push(sample);
  performanceLogger.debug("Render profile", {
    component: sample.id,
    phase: sample.phase,
    actualDurationMs: Number(sample.actualDuration.toFixed(3)),
    baseDurationMs: Number(sample.baseDuration.toFixed(3)),
    interactionCount: sample.interactionCount,
    meta: sample.meta,
  });
}

export function getRecordedMeasurements(): MeasurementRecord[] {
  return [...measurementLog];
}

export function clearRecordedMeasurements() {
  measurementLog.length = 0;
}

export function getRenderProfiles(): RenderProfileRecord[] {
  return [...renderProfileLog];
}

export function clearRenderProfiles() {
  renderProfileLog.length = 0;
}

/**
 * Record a storage operation for health metrics tracking.
 * Tracks success/failure rates, latency, operation types, and retry counts.
 *
 * @param operationType - Type of operation (load, save, sync, import, export)
 * @param success - Whether the operation succeeded
 * @param latencyMs - Duration of the operation in milliseconds
 */
export function recordStorageOperation(
  operationType: string,
  success: boolean,
  latencyMs: number = 0,
): void {
  if (!shouldTrack) {
    return;
  }

  // Update counters
  if (success) {
    storageHealthStats.successCount++;
    storageHealthStats.consecutiveFailures = 0;
  } else {
    storageHealthStats.failureCount++;
    storageHealthStats.consecutiveFailures++;
  }

  // Update latency stats
  if (latencyMs > 0) {
    storageHealthStats.totalLatencyMs += latencyMs;
    storageHealthStats.minLatencyMs = Math.min(storageHealthStats.minLatencyMs, latencyMs);
    storageHealthStats.maxLatencyMs = Math.max(storageHealthStats.maxLatencyMs, latencyMs);
  }

  // Track operation type
  storageHealthStats.operationTypes[operationType] = (storageHealthStats.operationTypes[operationType] ?? 0) + 1;
  storageHealthStats.lastOperationTime = now();

  performanceLogger.debug("Storage operation recorded", {
    operationType,
    success,
    latencyMs: Number(latencyMs.toFixed(2)),
    consecutiveFailures: storageHealthStats.consecutiveFailures,
  });
}

/**
 * Get current storage health metrics snapshot.
 * Useful for dashboards, diagnostics, or telemetry reporting.
 *
 * @returns Current storage health metrics
 */
export function getStorageHealthMetrics(): StorageHealthMetrics {
  const totalOperations = storageHealthStats.successCount + storageHealthStats.failureCount;
  const successRate = totalOperations > 0 ? storageHealthStats.successCount / totalOperations : 1;
  const averageLatencyMs =
    storageHealthStats.successCount > 0
      ? storageHealthStats.totalLatencyMs / storageHealthStats.successCount
      : 0;

  return {
    successCount: storageHealthStats.successCount,
    failureCount: storageHealthStats.failureCount,
    totalOperations,
    successRate,
    totalLatencyMs: storageHealthStats.totalLatencyMs,
    averageLatencyMs,
    minLatencyMs: storageHealthStats.minLatencyMs === Infinity ? 0 : storageHealthStats.minLatencyMs,
    maxLatencyMs: storageHealthStats.maxLatencyMs,
    consecutiveFailures: storageHealthStats.consecutiveFailures,
    lastOperationTime: storageHealthStats.lastOperationTime,
    operationTypes: { ...storageHealthStats.operationTypes },
  };
}

/**
 * Reset storage health metrics (useful for session resets or testing).
 */
export function resetStorageHealthMetrics(): void {
  storageHealthStats.successCount = 0;
  storageHealthStats.failureCount = 0;
  storageHealthStats.totalLatencyMs = 0;
  storageHealthStats.minLatencyMs = Infinity;
  storageHealthStats.maxLatencyMs = 0;
  storageHealthStats.consecutiveFailures = 0;
  storageHealthStats.lastOperationTime = 0;
  storageHealthStats.operationTypes = {};
}

export type { MeasurementDetail, MeasurementRecord, RenderProfileRecord, StorageHealthMetrics };
