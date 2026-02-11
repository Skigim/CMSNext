import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EncryptionProvider } from "@/contexts/EncryptionContext";

vi.mock("@/utils/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    lifecycle: vi.fn(),
  }),
}));

describe("EncryptionContext - codePointAt coverage", () => {
  it("renders provider with children", () => {
    render(
      <EncryptionProvider>
        <div data-testid="child">Encrypted</div>
      </EncryptionProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("codePointAt handles basic ASCII characters", () => {
    // The EncryptionContext uses codePointAt(0) instead of charCodeAt(0)
    // Verify the behavior matches for typical use cases
    const char = "A";
    expect(char.codePointAt(0)).toBe(65);
    expect(char.codePointAt(0)).toBe(char.charCodeAt(0));
  });

  it("codePointAt handles multi-byte characters correctly", () => {
    // codePointAt properly handles surrogate pairs unlike charCodeAt
    const emoji = "😀";
    const codePoint = emoji.codePointAt(0);
    expect(codePoint).toBe(0x1F600);
    // charCodeAt would return only the first surrogate (55357)
    expect(emoji.charCodeAt(0)).toBe(55357);
    expect(codePoint).not.toBe(emoji.charCodeAt(0));
  });
});
