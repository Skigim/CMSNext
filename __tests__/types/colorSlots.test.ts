import { describe, expect, it } from "vitest";
import { COLOR_SLOTS, slotClassMap } from "@/types/colorSlots";

describe("slotClassMap", () => {
  it("defines Tailwind classes for every color slot", () => {
    for (const slot of COLOR_SLOTS) {
      expect(slotClassMap[slot]).toBe(
        `bg-slot-${slot}/10 text-slot-${slot} border-slot-${slot}/20`
      );
    }
  });
});
