import { describe, expect, it } from "vitest";

import { CaseRecordSchema } from "@/domain/validation/forms";

describe("CaseRecordSchema", () => {
  it("defaults intakeCompleted to true when the field is absent", () => {
    // ARRANGE
    const input = {
      mcn: "MCN-123",
      applicationDate: "2026-03-01T00:00:00.000Z",
      caseType: "ABD Medicaid",
      personId: "person-1",
      spouseId: "",
      status: "Pending",
      description: "",
      priority: false,
      livingArrangement: "Home",
      withWaiver: false,
      admissionDate: "2026-03-01T00:00:00.000Z",
      organizationId: "org-1",
      authorizedReps: [],
      retroRequested: "",
    };

    // ACT
    const result = CaseRecordSchema.parse(input);

    // ASSERT
    expect(result.intakeCompleted).toBe(true);
  });

  it("preserves an explicit intakeCompleted value of false", () => {
    // ARRANGE
    const input = {
      mcn: "MCN-124",
      applicationDate: "2026-03-02T00:00:00.000Z",
      caseType: "ABD Medicaid",
      personId: "person-2",
      spouseId: "",
      status: "Pending",
      description: "",
      priority: false,
      livingArrangement: "Home",
      withWaiver: false,
      admissionDate: "2026-03-02T00:00:00.000Z",
      organizationId: "org-1",
      authorizedReps: [],
      retroRequested: "",
      intakeCompleted: false,
    };

    // ACT
    const result = CaseRecordSchema.parse(input);

    // ASSERT
    expect(result.intakeCompleted).toBe(false);
  });
});
