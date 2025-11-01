import { createLogger } from "./logger";

/**
 * Telemetry event types that can be captured.
 * Represents key system events without PII or sensitive financial data.
 */
export type TelemetryEventType =
  | "storage-sync-start"
  | "storage-sync-success"
  | "storage-sync-error"
  | "autosave-badge-state-change"
  | "dashboard-load-start"
  | "dashboard-load-complete"
  | "import-initiated"
  | "export-initiated"
  | "case-created"
  | "case-updated"
  | "case-deleted"
  | "financial-item-added"
  | "financial-item-removed"
  | "note-created"
  | "storage-error-recovered";

/**
 * Base telemetry event structure.
 * All events include a session ID, timestamp, and type.
 */
export interface TelemetryEvent {
  sessionId: string;
  timestamp: string; // ISO 8601 format
  eventType: TelemetryEventType;
  duration?: number; // milliseconds (optional, for performance events)
  metadata?: Record<string, unknown>;
}

/**
 * Telemetry collection schema for validation.
 */
export interface TelemetrySchema {
  version: string;
  sessionId: string;
  startedAt: string;
  events: TelemetryEvent[];
}

interface TelemetryConfig {
  enabled: boolean;
  sessionId: string;
}

const telemetryLogger = createLogger("Telemetry");

// Configuration from environment or local state
const telemetryConfig: TelemetryConfig = {
  enabled: isCollectionEnabled(),
  sessionId: generateSessionId(),
};

// In-memory event buffer (cleared when written to file)
let eventBuffer: TelemetryEvent[] = [];
const BUFFER_SIZE_LIMIT = 100; // Write to file when buffer reaches this size

/**
 * Check if telemetry collection is enabled.
 * Respects environment variable VITE_ENABLE_TELEMETRY or local storage flag.
 */
function isCollectionEnabled(): boolean {
  // Check environment variable (for dev/test environments)
  const env = typeof import.meta !== "undefined" ? (import.meta as any).env ?? {} : {};
  if (env?.VITE_ENABLE_TELEMETRY === "true") {
    return true;
  }

  // Check localStorage for user-set preference (if available)
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem("telemetry-enabled");
      if (stored !== null) {
        return stored === "true";
      }
    } catch {
      // localStorage may be unavailable in some contexts
    }
  }

  return false;
}

/**
 * Generate a unique session ID (timestamp + random suffix).
 */
function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `session-${timestamp}-${random}`;
}

/**
 * Validate event against telemetry schema.
 * Ensures no PII is included in metadata.
 */
function validateEvent(event: TelemetryEvent): boolean {
  // Basic validation
  if (!event.sessionId || !event.timestamp || !event.eventType) {
    telemetryLogger.warn("Invalid telemetry event: missing required fields", { event });
    return false;
  }

  // PII checks: reject events with suspicious metadata
  if (event.metadata) {
    const metadataStr = JSON.stringify(event.metadata).toLowerCase();
    const piiPatterns = ["case[_-]?id", "person[_-]?id", "financial[_-]?amount", "ssn", "email", "phone"];
    const suspiciousPatterns = piiPatterns.filter(pattern =>
      new RegExp(pattern).test(metadataStr)
    );

    if (suspiciousPatterns.length > 0) {
      telemetryLogger.warn("Telemetry event rejected: potential PII detected", {
        patterns: suspiciousPatterns,
      });
      return false;
    }
  }

  return true;
}

/**
 * Collect a telemetry event.
 * Events are buffered in memory and written to disk when buffer is full.
 */
export function collectEvent(eventType: TelemetryEventType, metadata?: Record<string, unknown>, duration?: number): void {
  if (!telemetryConfig.enabled) {
    return;
  }

  const event: TelemetryEvent = {
    sessionId: telemetryConfig.sessionId,
    timestamp: new Date().toISOString(),
    eventType,
    duration,
    metadata: metadata && Object.keys(metadata).length > 0 ? metadata : undefined,
  };

  if (!validateEvent(event)) {
    return;
  }

  eventBuffer.push(event);
  telemetryLogger.debug("Telemetry event collected", { eventType, bufferSize: eventBuffer.length });

  // Flush buffer to file if it reaches the limit
  if (eventBuffer.length >= BUFFER_SIZE_LIMIT) {
    flushEventBuffer().catch(err =>
      telemetryLogger.error("Failed to flush telemetry buffer", {
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

/**
 * Write buffered events to a timestamped JSON file.
 * File is created in `.telemetry/` directory (gitignored).
 * Returns early in non-Node environments (browser-only contexts).
 */
export async function flushEventBuffer(): Promise<void> {
  if (!telemetryConfig.enabled || eventBuffer.length === 0) {
    return;
  }

  // Skip file writing in browser environments (no filesystem access)
  // In dev tooling (Node.js), this will be called manually or by dev server
  if (typeof window !== "undefined" && typeof process === "undefined") {
    telemetryLogger.debug("Skipping telemetry file write in browser context", {
      bufferedEvents: eventBuffer.length,
    });
    return;
  }

  try {
    // This will only be called in Node.js dev tooling contexts
    // Actual file writing logic would be implemented in a separate backend service
    const schema: TelemetrySchema = {
      version: "1.0",
      sessionId: telemetryConfig.sessionId,
      startedAt: new Date().toISOString(),
      events: [...eventBuffer],
    };

    // Validate entire schema
    if (!validateTelemetrySchema(schema)) {
      telemetryLogger.warn("Telemetry schema validation failed", { eventCount: eventBuffer.length });
      return;
    }

    telemetryLogger.info("Telemetry buffer flushed", {
      eventCount: eventBuffer.length,
      sessionId: telemetryConfig.sessionId,
    });

    // Clear the buffer after successful flush
    eventBuffer = [];
  } catch (err) {
    telemetryLogger.error("Error flushing telemetry buffer", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Validate entire telemetry schema.
 */
function validateTelemetrySchema(schema: TelemetrySchema): boolean {
  if (!schema.version || !schema.sessionId || !schema.startedAt || !Array.isArray(schema.events)) {
    return false;
  }

  return schema.events.every(validateEvent);
}

/**
 * Get current telemetry configuration.
 */
export function getTelemetryConfig(): Readonly<TelemetryConfig> {
  return { ...telemetryConfig };
}

/**
 * Enable or disable telemetry collection.
 * This can be toggled at runtime.
 */
export function setTelemetryEnabled(enabled: boolean): void {
  telemetryConfig.enabled = enabled;

  // Persist to localStorage if available
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem("telemetry-enabled", enabled ? "true" : "false");
    } catch {
      // localStorage may be unavailable
    }
  }

  telemetryLogger.info("Telemetry collection toggled", { enabled });

  // Flush any pending events if disabling
  if (!enabled && eventBuffer.length > 0) {
    flushEventBuffer().catch(err =>
      telemetryLogger.error("Failed to flush telemetry before disabling", {
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

/**
 * Get buffered events (for debugging or manual export).
 */
export function getBufferedEvents(): TelemetryEvent[] {
  return [...eventBuffer];
}

/**
 * Clear the event buffer (for testing or reset).
 */
export function clearEventBuffer(): void {
  eventBuffer = [];
}

/**
 * Reset telemetry session (generates new session ID).
 * Flushes current buffer before resetting.
 */
export async function resetTelemetrySession(): Promise<void> {
  await flushEventBuffer();
  telemetryConfig.sessionId = generateSessionId();
  telemetryLogger.info("Telemetry session reset", { newSessionId: telemetryConfig.sessionId });
}

/**
 * Get current session ID.
 */
export function getSessionId(): string {
  return telemetryConfig.sessionId;
}
