import { createLogger } from "./logger";

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

interface ActiveMark {
  markId: string;
  fallbackStart: number;
  detail?: MeasurementDetail;
}

const performanceLogger = createLogger("Performance");

const env = typeof import.meta !== "undefined" ? (import.meta as any).env ?? {} : {};
const mode = env?.MODE ?? env?.mode;
const dev = env?.DEV ?? env?.dev;
const nodeEnv = typeof process !== "undefined" ? process.env.NODE_ENV : undefined;
const shouldTrack = Boolean(dev || mode === "analyze" || nodeEnv === "test");

const hasPerformanceApi = typeof performance !== "undefined" &&
  typeof performance.mark === "function" &&
  typeof performance.measure === "function" &&
  typeof performance.clearMarks === "function" &&
  typeof performance.clearMeasures === "function";

const activeMarks = new Map<string, ActiveMark[]>();
const measurementLog: MeasurementRecord[] = [];
const renderProfileLog: RenderProfileRecord[] = [];

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
  const markId = `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-start`;
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
    const measureId = `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-measure`;
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

  const mergedDetail = startDetail || detail ? { ...startDetail, ...detail } : detail;
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

export type { MeasurementDetail, MeasurementRecord, RenderProfileRecord };
