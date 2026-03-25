import { describe, expect, it } from "vitest";
import { COLOR_SLOTS, autoAssignColorSlot, slotClassMap } from "@/types/colorSlots";

describe("slotClassMap", () => {
  it("defines Tailwind classes for every color slot", () => {
    for (const slot of COLOR_SLOTS) {
      expect(slotClassMap[slot]).toBe(
        `bg-slot-${slot}/10 text-slot-${slot} border-slot-${slot}/20`
      );
    }
  });
});

describe("autoAssignColorSlot", () => {
  it("hashes non-BMP characters by code point when all slots are used", () => {
    // Arrange
    const usedSlots = new Set(COLOR_SLOTS);

    // Act
    const result = autoAssignColorSlot("A😀", usedSlots);

    // Assert
    expect(result).toBe("rose");
  });
});
