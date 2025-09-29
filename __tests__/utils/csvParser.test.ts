import { describe, expect, it } from "vitest";
import { parseCsv } from "../../utils/csvParser";

describe("parseCsv", () => {
  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("parses simple CSV rows", () => {
    const csv = "id,name\n1,Alice\n2,Bob";
    expect(parseCsv(csv)).toEqual([
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]);
  });

  it("handles quoted commas and trims whitespace", () => {
    const csv = 'id,notes\n1,"Hello, world"\n2," spaced "';
    expect(parseCsv(csv)).toEqual([
      { id: "1", notes: "Hello, world" },
      { id: "2", notes: " spaced " },
    ]);
  });

  it("preserves blank trailing values", () => {
    const csv = "id,name,email\n1,Alice,\n2,Bob,bob@example.com";
    expect(parseCsv(csv)).toEqual([
      { id: "1", name: "Alice", email: "" },
      { id: "2", name: "Bob", email: "bob@example.com" },
    ]);
  });
});
