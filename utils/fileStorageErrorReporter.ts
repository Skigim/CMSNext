import { toast } from "sonner";

import errorReporting from "./errorReporting";

export type FileStorageOperation =
  | "connect"
  | "connectExisting"
  | "requestPermission"
  | "loadExistingData"
  | "readData"
  | "writeData"
  | "autosave"
  | "listFiles"
  | "importCases"
  | "unknown";

export type FileStorageErrorSeverity = "info" | "warning" | "error";

export type FileStorageErrorCode =
  | "permission-denied"
  | "user-cancelled"
  | "missing-handle"
  | "connection-lost"
  | "read-failed"
  | "write-failed"
  | "quota-exceeded"
  | "unknown";

export interface ReportFileStorageErrorOptions {
  operation: FileStorageOperation;
  error?: unknown;
  messageOverride?: string;
  fallbackMessage?: string;
  toastId?: string;
  toast?: boolean;
  severity?: FileStorageErrorSeverity;
  context?: Record<string, unknown>;
  source?: string;
  tags?: string[];
  log?: boolean;
}

export interface FileStorageErrorClassification {
  code: FileStorageErrorCode;
  severity: FileStorageErrorSeverity;
  message: string;
}

export interface FileStorageErrorNotification {
  code: FileStorageErrorCode;
  operation: FileStorageOperation;
  message: string;
  type: FileStorageErrorSeverity;
  timestamp: number;
}

const CODE_MESSAGES: Record<FileStorageErrorCode, string> = {
  "permission-denied": "Permission denied for the selected directory. Please allow access to continue.",
  "user-cancelled": "Directory selection was cancelled.",
  "missing-handle": "The saved folder reference is no longer valid. Please reconnect to continue.",
  "connection-lost": "Lost connection to the data folder. Reconnect and try again.",
  "read-failed": "We couldn’t read case data from the folder. Reconnect and retry.",
  "write-failed": "We couldn’t save changes to the data folder. Check the connection and try again.",
  "quota-exceeded": "The data folder appears to be out of space. Free up space and try again.",
  unknown: "The file storage operation failed. Please try again.",
};

const OPERATION_FALLBACKS: Partial<Record<FileStorageOperation, string>> = {
  connect: "We couldn’t connect to the data folder. Check permissions and try again.",
  connectExisting: "We couldn’t reconnect to the data folder. Pick the folder again to continue.",
  loadExistingData: "We couldn’t load case data from the folder. Reconnect and retry.",
  readData: "We couldn’t read the data file. Reconnect and try again.",
  writeData: "We couldn’t save your changes to the data folder. Please try again.",
  autosave: "Autosave failed. We’ll keep retrying in the background.",
  importCases: "Import failed. Check the file and try again.",
};

const toastMap: Record<FileStorageErrorSeverity, typeof toast.info> = {
  info: toast.info,
  warning: toast.warning,
  error: toast.error,
};

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }
  if (error instanceof Error) {
    return error.name === "AbortError";
  }
  if (typeof error === "object" && error !== null) {
    const maybeName = (error as { name?: string }).name;
    if (maybeName === "AbortError") return true;
  }
  const message = extractErrorMessage(error).toLowerCase();
  return message.includes("aborterror");
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error) {
    const maybeMessage = (error as { message?: string }).message;
    if (maybeMessage) return maybeMessage;
  }
  return "";
}

function classifyErrorMessage(
  rawMessage: string,
  operation: FileStorageOperation,
  defaultSeverity: FileStorageErrorSeverity,
): FileStorageErrorClassification {
  const message = rawMessage.toLowerCase();

  if (message.includes("permission") || message.includes("denied") || message.includes("notallowed")) {
    return {
      code: "permission-denied",
      severity: "warning",
      message: CODE_MESSAGES["permission-denied"],
    };
  }

  if (message.includes("user activation")) {
    return {
      code: "user-cancelled",
      severity: "warning",
      message: "Directory selection requires a user interaction. Please open the picker again and choose your data folder.",
    };
  }

  if (message.includes("cancel") || message.includes("dismiss")) {
    return {
      code: "user-cancelled",
      severity: "warning",
      message: CODE_MESSAGES["user-cancelled"],
    };
  }

  if (message.includes("handle") && (message.includes("missing") || message.includes("not found"))) {
    return {
      code: "missing-handle",
      severity: "warning",
      message: CODE_MESSAGES["missing-handle"],
    };
  }

  if (message.includes("disconnected") || message.includes("connection") || message.includes("lost")) {
    return {
      code: "connection-lost",
      severity: defaultSeverity,
      message: CODE_MESSAGES["connection-lost"],
    };
  }

  if (message.includes("quota") || message.includes("disk") || message.includes("space")) {
    return {
      code: "quota-exceeded",
      severity: "error",
      message: CODE_MESSAGES["quota-exceeded"],
    };
  }

  if (message.includes("write") || message.includes("save") || message.includes("autosave")) {
    return {
      code: "write-failed",
      severity: defaultSeverity,
      message: CODE_MESSAGES["write-failed"],
    };
  }

  if (message.includes("read") || message.includes("load") || message.includes("parse")) {
    return {
      code: "read-failed",
      severity: defaultSeverity,
      message: CODE_MESSAGES["read-failed"],
    };
  }

  if (operation === "autosave" || operation === "writeData") {
    return {
      code: "write-failed",
      severity: defaultSeverity,
      message: CODE_MESSAGES["write-failed"],
    };
  }

  if (operation === "loadExistingData" || operation === "readData") {
    return {
      code: "read-failed",
      severity: defaultSeverity,
      message: CODE_MESSAGES["read-failed"],
    };
  }

  return {
    code: "unknown",
    severity: defaultSeverity,
    message: CODE_MESSAGES.unknown,
  };
}

function selectMessage(
  classification: FileStorageErrorClassification,
  options: ReportFileStorageErrorOptions,
  rawMessage: string,
): string {
  if (options.messageOverride) {
    return options.messageOverride;
  }

  if (options.fallbackMessage) {
    return options.fallbackMessage;
  }

  if (classification.code !== "unknown") {
    return classification.message;
  }

  if (rawMessage) {
    return rawMessage;
  }

  return OPERATION_FALLBACKS[options.operation] ?? CODE_MESSAGES.unknown;
}

function logError(
  notification: FileStorageErrorNotification,
  options: ReportFileStorageErrorOptions,
  error: unknown,
): void {
  if (options.log === false) {
    return;
  }

  const payload = {
    operation: options.operation,
    source: options.source,
    context: options.context,
    error,
    code: notification.code,
  };

  if (notification.type === "warning") {
    console.warn("[FileStorage]", notification.message, payload);
  } else if (notification.type === "info") {
    console.info("[FileStorage]", notification.message, payload);
  } else {
    console.error("[FileStorage]", notification.message, payload);
  }

  if (errorReporting?.isReportingEnabled?.()) {
    try {
      errorReporting.reportError?.(new Error(notification.message), {
        severity: notification.type === "info" ? "low" : notification.type === "warning" ? "medium" : "high",
        context: {
          operation: options.operation,
          ...options.context,
        },
        tags: ["file-storage", notification.code, options.operation, ...(options.tags ?? [])],
      });
    } catch (err) {
      console.debug("[FileStorage] Failed to report error", err);
    }
  }
}

export function reportFileStorageError(
  options: ReportFileStorageErrorOptions,
): FileStorageErrorNotification | null {
  const { error, operation, severity = "error" } = options;

  if (error && isAbortError(error)) {
    return null;
  }

  const rawMessage = options.messageOverride ?? extractErrorMessage(error);
  const classification = classifyErrorMessage(rawMessage, operation, severity);
  const message = selectMessage(classification, options, rawMessage);

  const notification: FileStorageErrorNotification = {
    code: classification.code,
    operation,
    message,
    type: classification.severity,
    timestamp: Date.now(),
  };

  if (options.toast !== false) {
    const toastFn = toastMap[notification.type] ?? toast.error;
    toastFn(message, {
      id: options.toastId ?? `file-storage-${operation}`,
      duration: notification.type === "info" ? 2500 : undefined,
    });
  }

  logError(notification, options, error);

  return notification;
}

export function classifyFileStorageError(
  error: unknown,
  operation: FileStorageOperation,
  severity: FileStorageErrorSeverity = "error",
): FileStorageErrorClassification {
  const rawMessage = extractErrorMessage(error);
  return classifyErrorMessage(rawMessage, operation, severity);
}
