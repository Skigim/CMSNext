import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

vi.mock("sonner", () => {
  return {
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

import { toast } from "sonner";
import { clickToCopy } from "../../utils/clipboard";

const getClipboard = () => navigator.clipboard as unknown as {
  writeText: ReturnType<typeof vi.fn>;
};

describe("clickToCopy", () => {
  let execCommandMock: ReturnType<typeof vi.fn>;
  let originalExecCommand: typeof document.execCommand;

  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });

    originalExecCommand = document.execCommand ??
      ((() => false) as typeof document.execCommand);
    execCommandMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: execCommandMock,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(document, "execCommand", {
      value: originalExecCommand,
      configurable: true,
      writable: true,
    });
    delete (navigator as { clipboard?: unknown }).clipboard;
  });

  it("copies text using the async clipboard API when available", async () => {
    const result = await clickToCopy("case-123");

    expect(getClipboard().writeText).toHaveBeenCalledWith("case-123");
  expect(execCommandMock).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Copied to clipboard");
    expect(result).toBe(true);
  });

  it("falls back to document.execCommand when the async clipboard API fails", async () => {
    getClipboard().writeText.mockRejectedValue(new Error("denied"));

    const result = await clickToCopy("fallback");

    expect(getClipboard().writeText).toHaveBeenCalledWith("fallback");
  expect(execCommandMock).toHaveBeenCalledWith("copy");
    expect(toast.success).toHaveBeenCalledWith("Copied to clipboard");
    expect(result).toBe(true);
  });

  it("emits an error toast when both clipboard strategies fail", async () => {
    getClipboard().writeText.mockRejectedValue(new Error("denied"));
  execCommandMock.mockReturnValue(false);

    const result = await clickToCopy("broken");

    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Unable to copy to clipboard");
  });

  it("can suppress toast notifications", async () => {
    const result = await clickToCopy("silent", { showToast: false });

    expect(result).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
