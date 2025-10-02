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
  const env = typeof import.meta !== "undefined" ? (import.meta as any).env ?? {} : {};
  const explicitLevel = (env?.VITE_LOG_LEVEL ?? env?.LOG_LEVEL ?? "").toLowerCase();
  if (explicitLevel && explicitLevel in levelPriority) {
    return explicitLevel as LogLevel;
  }
  return env?.DEV ? "debug" : "warn";
})();

let currentLevel: LogLevel = DEFAULT_LEVEL;

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[currentLevel];
}

function resolveCallSite(skip: number = 4): string | null {
  const err = new Error();
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

  const consoleFn = consoleMap[level];
  const timestamp = new Date().toISOString();
  const callSite = options?.includeCallSite ?? level !== "debug" ? resolveCallSite(options?.includeCallSite === false ? Number.POSITIVE_INFINITY : 5) : null;
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
