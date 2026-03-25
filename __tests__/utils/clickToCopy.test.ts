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
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    delete (navigator as { clipboard?: unknown }).clipboard;
  });

  it("copies text using the async clipboard API when available", async () => {
    const result = await clickToCopy("case-123");

    expect(getClipboard().writeText).toHaveBeenCalledWith("case-123");
    expect(toast.success).toHaveBeenCalledWith("Copied to clipboard");
    expect(result).toBe(true);
  });

  it("emits an error toast when the async clipboard API fails", async () => {
    getClipboard().writeText.mockRejectedValue(new Error("denied"));

    const result = await clickToCopy("broken");

    expect(getClipboard().writeText).toHaveBeenCalledWith("broken");
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
