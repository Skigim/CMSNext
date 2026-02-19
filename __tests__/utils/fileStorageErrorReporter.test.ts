import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";
const toastInfo = vi.mocked(toast.info);
const toastWarning = vi.mocked(toast.warning);
const toastError = vi.mocked(toast.error);

vi.mock("../../utils/errorReporting", () => ({
  errorReporting: {
    isReportingEnabled: () => true,
    reportError: vi.fn(),
  },
}));

import {
  classifyFileStorageError,
  reportFileStorageError,
  type FileStorageErrorNotification,
} from "../../utils/fileStorageErrorReporter";

import { errorReporting } from "../../utils/errorReporting";

describe("fileStorageErrorReporter", () => {
  beforeEach(() => {
    toastInfo.mockClear();
    toastWarning.mockClear();
    toastError.mockClear();
    (errorReporting.reportError as ReturnType<typeof vi.fn>).mockClear();
  });

  it("skips abort errors without toasting", () => {
    const abortError = typeof DOMException === "undefined"
      ? Object.assign(new Error("aborted"), { name: "AbortError" })
      : new DOMException("", "AbortError");
    const notification = reportFileStorageError({
      operation: "connect",
      error: abortError,
    });

    expect(notification).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
    expect(toastWarning).not.toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it("classifies permission issues as warnings", () => {
    const notification = reportFileStorageError({
      operation: "connect",
      error: new Error("Permission denied"),
      toastId: "test-toast",
    }) as FileStorageErrorNotification;

    expect(notification.type).toBe("warning");
    expect(notification.code).toBe("permission-denied");
    expect(toastWarning).toHaveBeenCalledWith(notification.message, {
      id: "test-toast",
      duration: undefined,
    });
  });

  it("uses fallback message when provided", () => {
    const notification = reportFileStorageError({
      operation: "writeData",
      error: new Error("Unexpected failure"),
      fallbackMessage: "Failed to write file",
    }) as FileStorageErrorNotification;

    expect(notification.message).toBe("Failed to write file");
    expect(toastError).toHaveBeenCalledWith("Failed to write file", {
      id: "file-storage-writeData",
      duration: undefined,
    });
  });

  it("classify helper returns expected code", () => {
    const classification = classifyFileStorageError(
      new Error("write failed"),
      "autosave",
    );

    expect(classification.code).toBe("write-failed");
    expect(classification.severity).toBe("error");
  });

  it("logs through error reporting service", () => {
    reportFileStorageError({
      operation: "loadExistingData",
      error: new Error("read error"),
    });

    expect(errorReporting.reportError).toHaveBeenCalled();
  });

  it("supports disabling toast emission", () => {
    reportFileStorageError({
      operation: "autosave",
      error: new Error("save failed"),
      toast: false,
    });

    expect(toastError).not.toHaveBeenCalled();
  });
});
