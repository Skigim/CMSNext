/**
 * Logging Utilities
 * =================
 * Centralized logging with configurable levels, optional call site tracking, and stack traces.
 * Provides structured logging for debugging and diagnostics across the application.
 * 
 * ## Log Levels
 * 
 * - **debug**: Detailed development-level information
 * - **info**: General informational messages
 * - **warn**: Warning conditions and potential issues
 * - **error**: Error conditions requiring attention
 * 
 * ## Features
 * 
 * - **Call Site Tracking**: Optional file:line attribution
 * - **Stack Traces**: Optional full stack trace output
 * - **Context Data**: Structured logging with additional context
 * - **Named Loggers**: Create loggers with module names for filtering
 * 
 * @module logger
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogMethod = (message: string, context?: Record<string, unknown>, options?: LogOptions) => void;

interface LogOptions {
  /** Include the originating call site (file:line) in the log output. */
  includeCallSite?: boolean;
  /** Force stack trace output for this log entry. */
  trace?: boolean;
}

interface Logger {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  /** Emits an info-level log with an attached stack trace for lifecycle tracing. */
  lifecycle: LogMethod;
}

type ConsoleMethod = typeof console.log;

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const consoleMap: Record<LogLevel, ConsoleMethod> = {
  debug: console.debug?.bind(console) ?? console.log.bind(console),
  info: console.info?.bind(console) ?? console.log.bind(console),
  warn: console.warn?.bind(console) ?? console.log.bind(console),
  error: console.error?.bind(console) ?? console.log.bind(console),
};

const DEFAULT_LEVEL: LogLevel = (() => {
  const env = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env ?? {};
  const explicitLevel = (env?.VITE_LOG_LEVEL ?? env?.LOG_LEVEL ?? "").toLowerCase();
  if (explicitLevel && explicitLevel in levelPriority) {
    return explicitLevel as LogLevel;
  }
  // Changed from 'debug' to 'info' in dev to reduce console spam
  // Use VITE_LOG_LEVEL=debug in .env to enable debug logs when needed
  return env?.DEV ? "info" : "warn";
})();

let currentLevel: LogLevel = DEFAULT_LEVEL;

// Deduplication tracking for repetitive logs
const logDedupeCache = new Map<string, { count: number; lastLogged: number; firstSeen: number }>();
const DEDUPE_WINDOW_MS = 60000; // 1 minute
const DEDUPE_SUMMARY_INTERVAL_MS = 300000; // 5 minutes
const MAX_LOGS_PER_WINDOW = 3; // Only log same message 3 times per window

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[currentLevel];
}

function createDedupeKey(scope: string, level: LogLevel, message: string): string {
  return `${scope}:${level}:${message}`;
}

function shouldLogDeduplicated(scope: string, level: LogLevel, message: string): boolean {
  const key = createDedupeKey(scope, level, message);
  const now = Date.now();
  const entry = logDedupeCache.get(key);

  if (!entry) {
    logDedupeCache.set(key, { count: 1, lastLogged: now, firstSeen: now });
    return true;
  }

  entry.count++;

  // Log summary every 5 minutes if suppressed
  if (now - entry.lastLogged >= DEDUPE_SUMMARY_INTERVAL_MS && entry.count > MAX_LOGS_PER_WINDOW) {
    const consoleFn = consoleMap[level];
    consoleFn(`[${new Date().toISOString()}] [${scope}] ${message} (suppressed ${entry.count - MAX_LOGS_PER_WINDOW} similar messages in last ${Math.round((now - entry.firstSeen) / 60000)} minutes)`);
    entry.count = 0;
    entry.lastLogged = now;
    entry.firstSeen = now;
    return false;
  }

  // Reset window if enough time has passed
  if (now - entry.firstSeen >= DEDUPE_WINDOW_MS) {
    entry.count = 1;
    entry.lastLogged = now;
    entry.firstSeen = now;
    return true;
  }

  // Allow first N logs in window
  if (entry.count <= MAX_LOGS_PER_WINDOW) {
    entry.lastLogged = now;
    return true;
  }

  // Suppress subsequent logs in this window
  return false;
}

function resolveCallSite(skip: number = 4): string | null {
  const err = new Error("resolveCallSite");
  if (!err.stack) {
    return null;
  }

  const stackLines = err.stack.split(/\r?\n/).slice(skip);
  const targetLine = stackLines.find((line) => line.trim().startsWith("at "));
  if (!targetLine) {
    return null;
  }

  return targetLine.trim().replace(/^at\s+/, "");
}

function logWithLevel(scope: string, level: LogLevel, message: string, context?: Record<string, unknown>, options?: LogOptions) {
  if (!shouldLog(level)) {
    return;
  }

  // Deduplicate legacy/repetitive warnings
  if (level === 'warn' && !shouldLogDeduplicated(scope, level, message)) {
    return;
  }

  const consoleFn = consoleMap[level];
  const timestamp = new Date().toISOString();
  const includeCallSiteOption = options?.includeCallSite;
  let callSite: string | null = null;
  if (includeCallSiteOption !== false && (includeCallSiteOption === true || level !== "debug")) {
    callSite = resolveCallSite(5);
  }
  const parts: unknown[] = [`[${timestamp}]`, `[${scope}]`, message];

  if (context && Object.keys(context).length > 0) {
    parts.push(context);
  }

  if (callSite) {
    parts.push(`@ ${callSite}`);
  }

  consoleFn(...parts);

  if (options?.trace) {
    console.trace(`[${scope}] ${message}`);
  }
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message, context, options) => logWithLevel(scope, "debug", message, context, options),
    info: (message, context, options) => logWithLevel(scope, "info", message, context, options),
    warn: (message, context, options) => logWithLevel(scope, "warn", message, context, options),
    error: (message, context, options) => logWithLevel(scope, "error", message, context, options),
    lifecycle: (message, context, options) => logWithLevel(scope, "info", message, context, { ...options, trace: true }),
  };
}

export type { LogLevel, Logger };
