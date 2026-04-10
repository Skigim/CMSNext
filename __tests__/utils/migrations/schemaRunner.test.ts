import { describe, expect, it } from "vitest";

import { runSchemaTransforms } from "@/utils/migrations/schemaRunner";

describe("schemaRunner", () => {
  it("runs no transforms when no schema transforms are registered", () => {
    // ARRANGE
    const input = { version: "2.2" };

    // ACT
    const result = runSchemaTransforms({
      currentVersion: "2.2",
      targetVersion: "2.3",
      data: input,
      transforms: [],
    });

    // ASSERT
    expect(result.applied).toEqual([]);
    expect(result.data).toEqual({ version: "2.2" });
  });
});