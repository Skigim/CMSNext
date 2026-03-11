import { describe, expect, it } from "vitest";

import { migrateLegacyData } from "@/utils/legacyMigration";
import { createMockPerson, createMockStoredCase } from "@/src/test/testUtils";
import { dehydrateNormalizedData } from "@/utils/storageV21Migration";
import { mergeCategoryConfig } from "@/types/categoryConfig";

describe("legacyMigration", () => {
  it("hydrates persisted v2.1 data before returning it", () => {
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

    const persistedV21 = dehydrateNormalizedData({
      version: "2.1",
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
    expect(result.data?.version).toBe("2.1");
    expect(result.data?.cases[0].person.name).toBe("Hydrated Person");
    expect(result.data?.cases[0].people).toEqual([
      { personId: "person-1", role: "applicant", isPrimary: true },
    ]);
  });
});
