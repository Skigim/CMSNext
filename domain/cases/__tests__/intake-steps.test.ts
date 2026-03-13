import { describe, it, expect } from "vitest";
import {
  INTAKE_STEPS,
  isStepComplete,
  isStepReachable,
  firstIncompleteStep,
} from "../intake-steps";
import { createBlankIntakeForm } from "../../validation/intake.schema";
import type { IntakeFormData } from "../../validation/intake.schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function partial(overrides: Partial<IntakeFormData>): Partial<IntakeFormData> {
  return overrides;
}

// ---------------------------------------------------------------------------
// INTAKE_STEPS structure
// ---------------------------------------------------------------------------

describe("INTAKE_STEPS", () => {
  it("has exactly 6 steps", () => {
    expect(INTAKE_STEPS).toHaveLength(6);
  });

  it("step ids are unique", () => {
    const ids = INTAKE_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every step has a non-empty label and description", () => {
    for (const step of INTAKE_STEPS) {
      expect(step.label.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });

  it("step 4 is 'household'", () => {
    expect(INTAKE_STEPS[4].id).toBe("household");
  });

  it("last step is 'review'", () => {
    expect(INTAKE_STEPS[5].id).toBe("review");
  });
});

// ---------------------------------------------------------------------------
// isStepComplete
// ---------------------------------------------------------------------------

describe("isStepComplete", () => {
  describe("step 0 – Applicant", () => {
    it("returns false when both names are missing", () => {
      expect(isStepComplete(0, partial({}))).toBe(false);
    });

    it("returns false when only firstName is provided", () => {
      expect(isStepComplete(0, partial({ firstName: "Alice" }))).toBe(false);
    });

    it("returns false when only lastName is provided", () => {
      expect(isStepComplete(0, partial({ lastName: "Smith" }))).toBe(false);
    });

    it("returns true when both names are provided", () => {
      expect(
        isStepComplete(0, partial({ firstName: "Alice", lastName: "Smith" })),
      ).toBe(true);
    });

    it("trims whitespace before checking", () => {
      expect(
        isStepComplete(0, partial({ firstName: "  ", lastName: "Smith" })),
      ).toBe(false);
    });
  });

  describe("step 1 – Contact", () => {
    it("always returns true (no required fields)", () => {
      expect(isStepComplete(1, partial({}))).toBe(true);
    });

    it("returns true even with a blank form", () => {
      expect(isStepComplete(1, createBlankIntakeForm())).toBe(true);
    });
  });

  describe("step 2 – Case Details", () => {
    it("returns false when both mcn and applicationDate are missing", () => {
      expect(isStepComplete(2, partial({}))).toBe(false);
    });

    it("returns false when only mcn is provided", () => {
      expect(isStepComplete(2, partial({ mcn: "12345" }))).toBe(false);
    });

    it("returns false when only applicationDate is provided", () => {
      expect(
        isStepComplete(2, partial({ applicationDate: "2026-01-01" })),
      ).toBe(false);
    });

    it("returns true when both mcn and applicationDate are provided", () => {
      expect(
        isStepComplete(
          2,
          partial({ mcn: "12345", applicationDate: "2026-01-01" }),
        ),
      ).toBe(true);
    });
  });

  describe("step 3 – Checklist", () => {
    it("always returns true (no required fields)", () => {
      expect(isStepComplete(3, partial({}))).toBe(true);
    });
  });

  describe("step 4 – Household", () => {
    it("always returns true (no required fields)", () => {
      expect(isStepComplete(4, partial({}))).toBe(true);
    });

    it("returns true even with a blank form", () => {
      expect(isStepComplete(4, createBlankIntakeForm())).toBe(true);
    });
  });

  describe("step 5 – Review", () => {
    it("returns false when no data is present", () => {
      expect(isStepComplete(5, partial({}))).toBe(false);
    });

    it("returns false when only applicant data is present", () => {
      expect(
        isStepComplete(
          5,
          partial({ firstName: "Alice", lastName: "Smith" }),
        ),
      ).toBe(false);
    });

    it("returns false when only case details are present", () => {
      expect(
        isStepComplete(
          5,
          partial({ mcn: "12345", applicationDate: "2026-01-01" }),
        ),
      ).toBe(false);
    });

    it("returns true when both applicant and case-details steps are complete", () => {
      expect(
        isStepComplete(
          5,
          partial({
            firstName: "Alice",
            lastName: "Smith",
            mcn: "12345",
            applicationDate: "2026-01-01",
          }),
        ),
      ).toBe(true);
    });
  });

  describe("unknown step index", () => {
    it("returns false for out-of-range index", () => {
      expect(isStepComplete(99, partial({}))).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// isStepReachable
// ---------------------------------------------------------------------------

describe("isStepReachable", () => {
  it("step 0 is always reachable", () => {
    expect(isStepReachable(0, partial({}))).toBe(true);
  });

  it("step 1 (contact) is reachable only after step 0 is complete", () => {
    expect(isStepReachable(1, partial({}))).toBe(false);
    expect(
      isStepReachable(
        1,
        partial({ firstName: "Alice", lastName: "Smith" }),
      ),
    ).toBe(true);
  });

  it("step 2 is reachable after steps 0 and 1 are satisfied", () => {
    const withApplicant = partial({ firstName: "Alice", lastName: "Smith" });
    // Step 1 is always completable, so step 2 only needs step 0
    expect(isStepReachable(2, withApplicant)).toBe(true);
  });

  it("step 2 is not reachable without step 0 complete", () => {
    expect(isStepReachable(2, partial({}))).toBe(false);
  });

  it("review step (5) requires all required-field steps to be complete", () => {
    const allRequired = partial({
      firstName: "Alice",
      lastName: "Smith",
      mcn: "12345",
      applicationDate: "2026-01-01",
    });
    expect(isStepReachable(5, allRequired)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// firstIncompleteStep
// ---------------------------------------------------------------------------

describe("firstIncompleteStep", () => {
  it("returns 0 for a blank form", () => {
    expect(firstIncompleteStep(partial({}))).toBe(0);
  });

  it("returns 2 when step 0 is complete but step 2 is not", () => {
    expect(
      firstIncompleteStep(
        partial({ firstName: "Alice", lastName: "Smith" }),
      ),
    ).toBe(2);
  });

  it("returns INTAKE_STEPS.length when all steps are complete", () => {
    const full = partial({
      firstName: "Alice",
      lastName: "Smith",
      mcn: "12345",
      applicationDate: "2026-01-01",
    });
    expect(firstIncompleteStep(full)).toBe(INTAKE_STEPS.length);
  });
});
