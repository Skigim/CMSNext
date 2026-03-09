import { describe, it, vi } from "vitest";

describe("userEvent and fake timers", () => {
  it("shows potential conflict", async () => {
    // This test mimics what the failing test does
    console.log("Before fake timers: vi.isFakeTimers() =", vi.isFakeTimers());
    
    vi.useFakeTimers();
    console.log("After useFakeTimers: vi.isFakeTimers() =", vi.isFakeTimers());
    
    vi.setSystemTime("2025-02-15T12:00:00.000Z");
    console.log("After setSystemTime");
    
    // userEvent.setup() requires real timers to work
    console.log("Trying userEvent.setup() with fake timers would cause issues");
    
    vi.useRealTimers();
  });
});
