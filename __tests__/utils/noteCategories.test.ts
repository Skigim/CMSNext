import { describe, expect, it } from "vitest";

import { resolveNoteCategories } from "@/utils/noteCategories";

describe("resolveNoteCategories", () => {
  it("deduplicates, trims, and removes empty category values", () => {
    const categories = resolveNoteCategories(
      {
        content: "test",
        categories: [" General ", "Important", "", "General", "  "],
      },
      "General"
    );

    expect(categories).toEqual(["General", "Important"]);
  });

  it("falls back to the provided category when categories are missing", () => {
    const categories = resolveNoteCategories(
      {
        content: "test",
      },
      "General"
    );

    expect(categories).toEqual(["General"]);
  });

  it("supports backward-compatible single category input", () => {
    const categories = resolveNoteCategories(
      {
        content: "test",
        category: "Follow Up",
      },
      "General"
    );

    expect(categories).toEqual(["Follow Up"]);
  });
});
