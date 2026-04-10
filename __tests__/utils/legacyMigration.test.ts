import { describe, expect, it } from "vitest";

import { getFormatDescription, migrateLegacyData } from "@/utils/legacyMigration";
import {
  createMockPerson,
  createMockPersistedNormalizedFileDataV21,
  createMockStoredCase,
} from "@/src/test/testUtils";
import { mergeCategoryConfig } from "@/types/categoryConfig";

describe("legacyMigration", () => {
  it("describes v2.2 payloads as the current normalized format", () => {
    expect(getFormatDescription("v2.2")).toBe("v2.2 Normalized Format (current)");
    expect(getFormatDescription("v2.1")).toBe("v2.1 Normalized Format (upgrade required)");
  });

  it("hydrates persisted v2.1 data before returning it without success-path errors", () => {
    const runtimeCase = createMockStoredCase({
      id: "case-1",
      person: createMockPerson({
        id: "person-1",
        firstName: "Hydrated",
        lastName: "Person",
        name: "Hydrated Person",
      }),
      people: [{ personId: "person-1", role: "applicant", isPrimary: true }],
    });

    const persistedV21 = createMockPersistedNormalizedFileDataV21({
      people: [runtimeCase.person],
      cases: [runtimeCase],
      financials: [],
      notes: [],
      alerts: [],
      exported_at: "2026-03-01T00:00:00.000Z",
      total_cases: 1,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    });

    const result = migrateLegacyData(persistedV21);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data?.version).toBe("2.2");
    expect(result.data?.cases[0].person.name).toBe("Hydrated Person");
    expect(result.data?.cases[0].people).toEqual([
      { personId: "person-1", role: "applicant", isPrimary: true },
    ]);
    expect(result.data?.cases[0].linkedPeople).toEqual([
      {
        person: expect.objectContaining({
          id: "person-1",
          name: "Hydrated Person",
        }),
        ref: {
          personId: "person-1",
          role: "applicant",
          isPrimary: true,
        },
      },
    ]);
  });
});
