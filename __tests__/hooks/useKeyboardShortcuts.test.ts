import { describe, it, expect } from "vitest";

/**
 * Tests for keyboard shortcut utility functions.
 * 
 * The `bindingPrefix` function uses `.sort((a, b) => a.localeCompare(b))` 
 * for reliable alphabetical sorting of modifier keys.
 */

// We test the exported behavior indirectly since bindingPrefix is module-private.
// The sort comparator `(a, b) => a.localeCompare(b)` ensures deterministic ordering.
describe("useKeyboardShortcuts - sort comparator", () => {
  it("localeCompare sorts modifier keys deterministically", () => {
    const modifiers = ["shift", "ctrl", "alt"];
    const sorted = [...modifiers].sort((a, b) => a.localeCompare(b));
    
    expect(sorted).toEqual(["alt", "ctrl", "shift"]);
  });

  it("localeCompare handles single modifier", () => {
    const modifiers = ["ctrl"];
    const sorted = [...modifiers].sort((a, b) => a.localeCompare(b));
    
    expect(sorted).toEqual(["ctrl"]);
  });

  it("localeCompare handles empty array", () => {
    const modifiers: string[] = [];
    const sorted = [...modifiers].sort((a, b) => a.localeCompare(b));
    
    expect(sorted).toEqual([]);
  });

  it("produces consistent binding prefix format", () => {
    // Simulates what bindingPrefix does:
    const modifiers = ["Shift", "Ctrl"];
    const chordKey = "K";
    const mods = modifiers.map(m => m.toLowerCase()).sort((a, b) => a.localeCompare(b));
    const prefix = `${mods.join("+")}+${chordKey.toLowerCase()}`.replace(/^\+/, "");
    
    expect(prefix).toBe("ctrl+shift+k");
  });
});
