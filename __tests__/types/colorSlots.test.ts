import { describe, expect, it } from "vitest";
import { COLOR_SLOTS, slotClassMap } from "@/types/colorSlots";

describe("slotClassMap", () => {
  it("defines a badge class mapping for every color slot", () => {
    expect(Object.keys(slotClassMap).sort()).toEqual([...COLOR_SLOTS].sort());
  });

  it("uses Tailwind slot utility classes for blue badges", () => {
    expect(slotClassMap.blue).toBe("bg-slot-blue/10 text-slot-blue border-slot-blue/20");
  });
});
